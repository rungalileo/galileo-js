/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  BaseCallbackHandler,
  CallbackHandlerMethods,
  NewTokenIndices
} from '@langchain/core/callbacks/base';
import { LLMResult } from '@langchain/core/outputs';
import { BaseMessage, ToolMessage } from '@langchain/core/messages';
import { ChainValues } from '@langchain/core/utils/types';
import { AgentFinish } from '@langchain/core/agents';
import { Document, DocumentInterface } from '@langchain/core/documents';
import { GalileoSingleton } from '../singleton';
import { GalileoLogger } from '../utils/galileo-logger';
import { toStringValue, toStringRecord } from '../utils/serialization';
import { getSdkLogger } from 'galileo-generated';
import { Serialized } from '@langchain/core/load/serializable.js';
import type { LogTracesIngestRequest } from '../types/logging/trace.types';

const sdkLogger = getSdkLogger();

type LANGCHAIN_NODE_TYPE =
  | 'agent'
  | 'chain'
  | 'chat'
  | 'llm'
  | 'retriever'
  | 'tool';

/**
 * A node in the LangChain trace.
 */
class Node {
  nodeType: LANGCHAIN_NODE_TYPE;
  spanParams: Record<string, any>;
  runId: string;
  parentRunId?: string;
  children: string[] = [];

  constructor(
    nodeType: LANGCHAIN_NODE_TYPE,
    spanParams: Record<string, any>,
    runId: string,
    parentRunId?: string
  ) {
    this.nodeType = nodeType;
    this.spanParams = spanParams;
    this.runId = runId;
    this.parentRunId = parentRunId;
  }
}

// Root node tracking
let _rootNode: Node | null = null;

export const rootNodeContext = {
  get: (): Node | null => _rootNode,
  set: (value: Node | null): void => {
    _rootNode = value;
  }
};

/**
 * Retroactively upgrade a root-level chain node to agent type when any of its
 * children carry langgraph_* metadata keys (Python: update_root_to_agent).
 */
function updateRootToAgent(
  parentRunId: string | undefined,
  metadata: Record<string, unknown> | undefined,
  nodes: Record<string, Node>
): void {
  if (!parentRunId) return;
  if (!metadata) return;
  const hasLangGraphKey = Object.keys(metadata).some((k) =>
    k.startsWith('langgraph_')
  );
  if (!hasLangGraphKey) return;
  const parentNode = nodes[parentRunId];
  if (!parentNode) return;
  if (parentNode.nodeType === 'chain' && parentNode.parentRunId === undefined) {
    parentNode.nodeType = 'agent';
  }
}

/**
 * Langchain callback handler for logging traces to the Galileo platform.
 */
export class GalileoCallback
  extends BaseCallbackHandler
  implements CallbackHandlerMethods
{
  _galileoLogger: GalileoLogger;
  _startNewTrace: boolean;
  _flushOnChainEnd: boolean;
  _nodes: Record<string, Node> = {};

  public name = 'GalileoCallback';

  constructor(
    galileoLogger?: GalileoLogger,
    startNewTrace: boolean = true,
    flushOnChainEnd: boolean = true,
    ingestionHook?: (request: LogTracesIngestRequest) => Promise<void> | void
  ) {
    super();
    if (galileoLogger) {
      this._galileoLogger = galileoLogger;
    } else if (ingestionHook) {
      this._galileoLogger = new GalileoLogger({ ingestionHook });
    } else {
      this._galileoLogger = GalileoSingleton.getInstance().getClient();
    }
    this._startNewTrace = startNewTrace;
    this._flushOnChainEnd = flushOnChainEnd;
  }

  /**
   * Shared name resolution helper (Python: _get_node_name).
   * Resolution order: serialized.name → serialized.id[-1] → params.name →
   * params.metadata.name → nodeType capitalised.
   */
  private static _getNodeName(
    nodeType: string,
    serialized?: Serialized | null,
    params?: Record<string, unknown>
  ): string {
    try {
      if (serialized?.name && serialized.name.length > 0) {
        return serialized.name;
      }
      const idArr = serialized?.id;
      if (Array.isArray(idArr) && idArr.length > 0) {
        return String(idArr[idArr.length - 1]);
      }
      const paramsName = params?.name;
      if (typeof paramsName === 'string' && paramsName.length > 0) {
        return paramsName;
      }
      const metaName = (params?.metadata as Record<string, unknown>)?.name;
      if (typeof metaName === 'string' && metaName.length > 0) {
        return metaName;
      }
      return nodeType.charAt(0).toUpperCase() + nodeType.slice(1);
    } catch {
      return nodeType.charAt(0).toUpperCase() + nodeType.slice(1);
    }
  }

  /**
   * Build a hierarchical agent name from the parent node (Python: get_agent_name).
   */
  private _getAgentName(
    parentRunId: string | undefined,
    defaultName: string
  ): string {
    if (parentRunId !== undefined && this._nodes[parentRunId]) {
      return `${this._nodes[parentRunId].spanParams.name}:${defaultName}`;
    }
    return defaultName;
  }

  /**
   * Detect a ToolMessage inside a tool output, including LangGraph Command objects
   * that carry a messages array (Python: _find_tool_message).
   */
  private static _findToolMessage(output: unknown): ToolMessage | null {
    if (output instanceof ToolMessage) return output;
    const update = (output as Record<string, unknown>)?.update;
    if (
      typeof update === 'object' &&
      update !== null &&
      Array.isArray((update as Record<string, unknown>).messages)
    ) {
      const messages = (update as Record<string, unknown>)
        .messages as unknown[];
      const last = messages.length === 0 ? null : messages[messages.length - 1];
      if (last instanceof ToolMessage) return last;
    }
    return null;
  }

  /**
   * Commit the nodes to the trace using the Galileo Logger. Optionally flush the trace.
   * Uses try/finally to guarantee node state is always cleared even on error.
   */
  private async _commit(): Promise<void> {
    if (Object.keys(this._nodes).length === 0) {
      sdkLogger.warn('No nodes to commit');
      return;
    }

    const root = rootNodeContext.get();
    if (root === null) {
      sdkLogger.warn('Unable to add nodes to trace: Root node not set');
      return;
    }

    const rootNode = this._nodes[root.runId];
    if (rootNode === undefined) {
      sdkLogger.warn('Unable to add nodes to trace: Root node does not exist');
      return;
    }

    try {
      if (this._startNewTrace) {
        let traceMetadata: Record<string, string> | undefined;
        if (rootNode.spanParams.metadata) {
          try {
            traceMetadata = toStringRecord(
              rootNode.spanParams.metadata as Record<string, unknown>
            );
          } catch (e) {
            sdkLogger.warn(
              'Unable to convert trace metadata to string dictionary',
              e
            );
          }
        }

        this._galileoLogger.startTrace({
          input: toStringValue(rootNode.spanParams.input || ''),
          name: rootNode.spanParams.name as string | undefined,
          metadata: traceMetadata
        });
      }

      this._logNodeTree(rootNode);

      // Conclude the trace with the root node's output
      const rootOutput = rootNode.spanParams.output || '';

      if (this._startNewTrace) {
        this._galileoLogger.conclude({
          output: toStringValue(rootOutput),
          statusCode: rootNode.spanParams.statusCode as number | undefined
        });
      }

      if (this._flushOnChainEnd) {
        await this._galileoLogger.flush();
      }
    } finally {
      // Always clear state, even if an exception occurs
      this._nodes = {};
      rootNodeContext.set(null);
    }
  }

  /**
   * Log a node and its children recursively.
   */
  private _logNodeTree(node: Node): void {
    let isWorkflowSpan = false;
    const input = node.spanParams.input || '';
    const inputAsString =
      typeof input === 'string' ? input : toStringValue(input);
    const output = node.spanParams.output || '';
    const outputAsString =
      typeof output === 'string' ? output : toStringValue(output);
    const name = node.spanParams.name;
    const tags = node.spanParams.tags;
    const durationNs = node.spanParams.durationNs as number | undefined;
    const createdAt = node.spanParams.createdAt as Date | undefined;
    const statusCode = node.spanParams.statusCode as number | undefined;

    let metadata: Record<string, string> | undefined = undefined;
    if (node.spanParams.metadata) {
      try {
        metadata = toStringRecord(
          node.spanParams.metadata as Record<string, unknown>
        );
      } catch (e) {
        sdkLogger.warn('Unable to convert metadata to a string dictionary', e);
      }
    }

    // Extract step number from metadata
    let stepNumber: number | undefined = undefined;
    if (metadata) {
      const langgraphStep = metadata['langgraph_step'];
      if (langgraphStep !== undefined) {
        try {
          stepNumber = parseInt(langgraphStep, 10);
          if (isNaN(stepNumber)) {
            sdkLogger.warn(
              `Invalid step number: ${langgraphStep}, not a valid integer`
            );
            stepNumber = undefined;
          }
        } catch (e) {
          sdkLogger.warn(
            `Invalid step number: ${langgraphStep}, exception raised ${e}`
          );
          stepNumber = undefined;
        }
      }
    }

    // Log the current node based on its type
    if (node.nodeType === 'agent') {
      this._galileoLogger.addAgentSpan({
        input: inputAsString,
        output: outputAsString,
        name,
        metadata,
        tags,
        durationNs,
        createdAt,
        statusCode,
        stepNumber
      });
      isWorkflowSpan = true;
    } else if (node.nodeType === 'chain') {
      this._galileoLogger.addWorkflowSpan({
        input: inputAsString,
        output: outputAsString,
        name,
        metadata,
        tags,
        durationNs,
        createdAt,
        statusCode,
        stepNumber
      });
      isWorkflowSpan = true;
    } else if (node.nodeType === 'llm' || node.nodeType === 'chat') {
      this._galileoLogger.addLlmSpan({
        input,
        output,
        model: node.spanParams.model,
        temperature: node.spanParams.temperature,
        tools: 'tools' in node.spanParams ? node.spanParams.tools : undefined,
        name,
        metadata,
        tags,
        numInputTokens: node.spanParams.numInputTokens,
        numOutputTokens: node.spanParams.numOutputTokens,
        totalTokens: node.spanParams.totalTokens,
        timeToFirstTokenNs: node.spanParams.timeToFirstTokenNs,
        durationNs,
        createdAt,
        statusCode,
        stepNumber
      });
    } else if (node.nodeType === 'retriever') {
      this._galileoLogger.addRetrieverSpan({
        input: inputAsString,
        output,
        name,
        metadata,
        tags,
        durationNs,
        createdAt,
        statusCode,
        stepNumber
      });
    } else if (node.nodeType === 'tool') {
      const toolSpan = this._galileoLogger.addToolSpan({
        input: inputAsString,
        output: outputAsString,
        name,
        metadata,
        tags,
        toolCallId: node.spanParams.toolCallId as string | undefined,
        durationNs,
        createdAt,
        statusCode,
        stepNumber
      });
      if (node.children.length > 0) {
        // Push tool span as parent so agent-as-tool child spans nest correctly
        this._galileoLogger.pushParent(toolSpan);
        isWorkflowSpan = true;
      }
    } else {
      sdkLogger.warn(`Unknown node type: ${node.nodeType}`);
    }

    // Process all child nodes
    let lastChild: Node | null = null;
    for (const childId of node.children) {
      const childNode = this._nodes[childId];
      if (childNode) {
        this._logNodeTree(childNode);
        lastChild = childNode;
      } else {
        sdkLogger.debug(`Child node ${childId} not found`);
      }
    }

    // Conclude workflow/agent span. Use the last child's output if necessary
    if (isWorkflowSpan) {
      const finalOutput =
        output || (lastChild ? lastChild.spanParams.output || '' : '');
      this._galileoLogger.conclude({
        output: toStringValue(finalOutput),
        statusCode
      });
    }
  }

  /**
   * Start a new node in the chain.
   * Records startTime and createdAt for all nodes automatically.
   */
  private _startNode(
    nodeType: LANGCHAIN_NODE_TYPE,
    parentRunId: string | undefined,
    runId: string,
    params: Record<string, any>
  ): Node {
    const nodeId = runId;
    const parentNodeId = parentRunId;

    if (this._nodes[nodeId]) {
      sdkLogger.debug(
        `Node already exists for run_id ${runId}, overwriting...`
      );
    }

    // Always record startTime and createdAt for duration tracking.
    const nodeParams: Record<string, any> = {
      ...params,
      startTime: performance.now(),
      createdAt: new Date()
    };

    // Create new node
    const node = new Node(nodeType, nodeParams, runId, parentNodeId);
    this._nodes[nodeId] = node;

    // Set as root node if needed
    if (!rootNodeContext.get()) {
      sdkLogger.debug(`Setting root node to ${nodeId}`);
      rootNodeContext.set(node);
    }

    // Add to parent's children if parent exists
    if (parentRunId) {
      const parent = this._nodes[parentNodeId!];
      if (parent) {
        parent.children.push(nodeId);
      } else {
        sdkLogger.debug(`Parent node ${parentNodeId} not found for ${nodeId}`);
      }
    }

    return node;
  }

  /**
   * End a node in the chain. Commit the nodes to a trace if the run_id matches the root node.
   * Automatically computes durationNs from the node's startTime.
   */
  private async _endNode(
    runId: string,
    params: Record<string, any>
  ): Promise<void> {
    const nodeId = runId;
    const node = this._nodes[nodeId];

    if (!node) {
      sdkLogger.warn(`No node exists for run_id ${nodeId}`);
      return;
    }

    // Compute durationNs before merging params
    if (node.spanParams.startTime !== undefined) {
      node.spanParams.durationNs =
        (performance.now() - (node.spanParams.startTime as number)) * 1e6;
    }

    // Update node parameters
    Object.assign(node.spanParams, params);

    // Check if this is the root node and commit if so
    const root = rootNodeContext.get();
    if (root && node.runId === root.runId) {
      await this._commit();
    }
  }

  /**
   * Shared error handler for all callback error methods.
   * Extracts HTTP status from the error's response if available, falls back to 400.
   */
  private async _handleError(err: Error, runId: string): Promise<void> {
    const errRecord = err as unknown as Record<string, unknown>;
    const response = errRecord.response;
    const status =
      typeof response === 'object' &&
      response !== null &&
      typeof (response as Record<string, unknown>).status === 'number'
        ? ((response as Record<string, unknown>).status as number)
        : 400;

    await this._endNode(runId, {
      output: `Error: ${err.name}: ${err.message}`,
      statusCode: status
    });
  }

  // LangChain callback methods

  public async handleChainStart(
    chain: Serialized | undefined,
    inputs: ChainValues,
    runId: string,
    parentRunId?: string,
    tags?: string[],
    metadata?: Record<string, any>
  ): Promise<void> {
    // If the node is tagged with hidden, don't log it
    if (tags && tags.includes('langsmith:hidden')) {
      return;
    }

    // Retroactively upgrade the parent to agent type if langgraph_* metadata present
    updateRootToAgent(parentRunId, metadata, this._nodes);

    let nodeType: LANGCHAIN_NODE_TYPE = 'chain';
    let nodeName = GalileoCallback._getNodeName('chain', chain, metadata);
    let nodeInput: unknown = {};

    // Case-insensitive detection of LangGraph / agent nodes
    const lowerName = nodeName.toLowerCase();
    if (lowerName === 'langgraph' || lowerName === 'agent') {
      nodeType = 'agent';
      nodeName = this._getAgentName(parentRunId, 'Agent');
    }

    if (typeof inputs === 'string') {
      nodeInput = { input: inputs };
    } else if (inputs instanceof BaseMessage) {
      nodeInput = inputs;
    } else if (typeof inputs === 'object') {
      nodeInput = Object.fromEntries(
        Object.entries(inputs).filter(
          ([key, value]: [string, unknown]) => key && typeof value === 'string'
        )
      );
    } else if (
      (Array.isArray(inputs) as boolean) &&
      (inputs as Document[]).every((v: unknown) => v instanceof Document)
    ) {
      nodeInput = Object.fromEntries(
        (inputs as Document[]).map((value: Document, index: number) => [
          String(index),
          value.pageContent
        ])
      );
    }

    this._startNode(nodeType, parentRunId, runId, {
      input: nodeInput,
      name: nodeName,
      tags,
      metadata
    });
  }

  public async handleChainError(err: Error, runId: string): Promise<void> {
    await this._handleError(err, runId);
  }

  public async handleChainEnd(
    outputs: ChainValues,
    runId: string,
    parentRunId?: string | undefined,
    tags?: string[] | undefined,
    kwargs?:
      | {
          inputs?: Record<string, unknown> | undefined;
        }
      | undefined
  ): Promise<void> {
    // In async scenarios, the input is sent in handleChainEnd, so we need to handle it here
    const input = kwargs?.inputs;
    await this._endNode(runId, {
      output: toStringValue(outputs),
      statusCode: 200,
      ...(input !== undefined && { input: toStringValue(input) })
    });
  }

  public async handleAgentEnd(
    finish: AgentFinish,
    runId: string
  ): Promise<void> {
    await this._endNode(runId, {
      output: toStringValue(finish),
      statusCode: 200
    });
  }

  public async handleLLMStart(
    llm: Serialized | undefined,
    prompts: string[],
    runId: string,
    parentRunId?: string,
    extraParams?: Record<string, unknown>,
    tags?: string[],
    metadata?: Record<string, any>
  ): Promise<void> {
    const invocationParams = extraParams?.invocation_params as
      | Record<string, unknown>
      | undefined;
    const model = invocationParams?.model_name as string | undefined;
    const temperature = invocationParams?.temperature as number | undefined;
    const name = GalileoCallback._getNodeName('llm', llm, extraParams);

    this._startNode('llm', parentRunId, runId, {
      name,
      input: prompts.map((p) => ({ content: p, role: 'user' })),
      tags,
      model,
      temperature,
      metadata: metadata
        ? Object.fromEntries(
            Object.entries(metadata).map(([k, v]) => [k, String(v)])
          )
        : undefined,
      timeToFirstTokenNs: null
    });
  }

  public async handleLLMError(err: Error, runId: string): Promise<void> {
    await this._handleError(err, runId);
  }

  public async handleLLMNewToken(
    token: string,
    idx: NewTokenIndices,
    runId: string
  ): Promise<void> {
    const node = this._nodes[runId];
    if (!node) {
      return;
    }

    if (node.spanParams.timeToFirstTokenNs === null) {
      const startTime = node.spanParams.startTime;
      if (startTime !== undefined) {
        node.spanParams.timeToFirstTokenNs =
          (performance.now() - startTime) * 1e6; // Convert ms to ns
      }
    }
  }

  public async handleChatModelStart(
    llm: Serialized | undefined,
    messages: BaseMessage[][],
    runId: string,
    parentRunId?: string,
    extraParams?: Record<string, unknown>,
    tags?: string[],
    metadata?: Record<string, any>
  ): Promise<void> {
    const invocationParams = extraParams?.invocation_params as Record<
      string,
      unknown
    >;
    const model =
      invocationParams?.model || invocationParams?._type || 'undefined-type';
    const temperature = invocationParams?.temperature || 0.0;
    const tools = invocationParams?.tools as
      | Record<string, unknown>[]
      | undefined;
    const name = GalileoCallback._getNodeName('chat', llm, extraParams);

    // Serialize messages safely, preserving tool_calls when present
    let serializedMessages;
    try {
      const flattenedMessages = messages.flat().map((msg) => {
        const serialized: {
          content: unknown;
          role: string;
          tool_calls?: unknown[];
        } = {
          content: msg.content,
          role: msg.getType()
        };
        if (
          'tool_calls' in msg &&
          Array.isArray(msg.tool_calls) &&
          msg.tool_calls.length > 0
        ) {
          serialized.tool_calls = msg.tool_calls;
        }
        return serialized;
      });
      serializedMessages = flattenedMessages;
    } catch (e) {
      sdkLogger.warn(`Failed to serialize chat messages: ${e}`);
      serializedMessages = String(messages);
    }

    this._startNode('chat', parentRunId, runId, {
      name,
      input: serializedMessages,
      tags,
      tools,
      model,
      temperature,
      metadata: metadata
        ? Object.fromEntries(
            Object.entries(metadata).map(([k, v]) => [k, String(v)])
          )
        : undefined,
      timeToFirstTokenNs: null
    });
  }

  public async handleLLMEnd(output: LLMResult, runId: string): Promise<void> {
    // Support OpenAI camelCase keys and Vertex AI / snake_case keys
    const rawUsage =
      output.llmOutput?.tokenUsage || output.llmOutput?.token_usage || {};
    const tokenUsage = rawUsage as Record<string, unknown>;

    let numInputTokens: number | undefined = (tokenUsage.promptTokens ??
      tokenUsage.prompt_tokens ??
      tokenUsage.inputTokens ??
      tokenUsage.input_tokens) as number | undefined;
    let numOutputTokens: number | undefined = (tokenUsage.completionTokens ??
      tokenUsage.completion_tokens ??
      tokenUsage.outputTokens ??
      tokenUsage.output_tokens) as number | undefined;
    let totalTokens: number | undefined = (tokenUsage.totalTokens ??
      tokenUsage.total_tokens) as number | undefined;

    // Fallback: usage_metadata on the first generation message
    if (
      numInputTokens === undefined &&
      numOutputTokens === undefined &&
      totalTokens === undefined
    ) {
      const firstGen = output.generations?.flat()?.[0];
      // ChatGeneration has a .message property with usage_metadata; plain Generation does not.
      // Use property narrowing since the Generation type doesn't declare .message.
      const genRecord = firstGen as unknown as
        | Record<string, unknown>
        | undefined;
      const message =
        genRecord &&
        typeof genRecord.message === 'object' &&
        genRecord.message !== null
          ? (genRecord.message as Record<string, unknown>)
          : undefined;
      const usageMeta = message?.usage_metadata as
        | Record<string, unknown>
        | undefined;
      if (usageMeta) {
        numInputTokens = (usageMeta.input_tokens ?? usageMeta.prompt_tokens) as
          | number
          | undefined;
        numOutputTokens = (usageMeta.output_tokens ??
          usageMeta.completion_tokens) as number | undefined;
        totalTokens = usageMeta.total_tokens as number | undefined;
      }
    }

    let serializedOutput;
    try {
      const flattenedOutput = output.generations.flat().map((g) => ({
        text: g.text,
        generationInfo: g.generationInfo
      }));
      serializedOutput = flattenedOutput[0];
    } catch (e) {
      sdkLogger.warn(`Failed to serialize LLM output: ${e}`);
      serializedOutput = String(output.generations);
    }

    await this._endNode(runId, {
      output: serializedOutput,
      numInputTokens,
      numOutputTokens,
      totalTokens,
      statusCode: 200
    });
  }

  public async handleToolStart(
    tool: Serialized | undefined,
    input: string,
    runId: string,
    parentRunId?: string,
    tags?: string[],
    metadata?: Record<string, any>
  ): Promise<void> {
    // Note: Python's on_tool_start checks for a structured inputs dict via **kwargs
    // and uses it over the flat input_str. The JS @langchain/core callback interface
    // does not expose an equivalent parameter, so we always use the flat `input`
    // string here. This is a known JS/Python divergence; revisit if a future
    // @langchain/core version adds an `inputs` parameter.
    const name = GalileoCallback._getNodeName('tool', tool, metadata);
    this._startNode('tool', parentRunId, runId, {
      name,
      input,
      tags,
      metadata: metadata
        ? Object.fromEntries(
            Object.entries(metadata).map(([k, v]) => [k, String(v)])
          )
        : undefined
    });
  }

  public async handleToolError(err: Error, runId: string): Promise<void> {
    await this._handleError(err, runId);
  }

  public async handleToolEnd(output: unknown, runId: string): Promise<void> {
    let serializedOutput: string = '';

    // Check for ToolMessage (covers response_format="content_and_artifact" indirectly
    // and LangGraph Command objects carrying a ToolMessage)
    const toolMessage = GalileoCallback._findToolMessage(output);
    if (toolMessage !== null) {
      serializedOutput = toStringValue(toolMessage.content);
      await this._endNode(runId, {
        output: serializedOutput,
        toolCallId: toolMessage.tool_call_id,
        statusCode: 200
      });
      return;
    }

    // Handle [content, artifact] tuple outputs (response_format="content_and_artifact")
    if (Array.isArray(output) && output.length >= 1) {
      // Check if the first element is itself a ToolMessage
      if (output[0] instanceof ToolMessage) {
        serializedOutput = toStringValue(output[0].content);
        await this._endNode(runId, {
          output: serializedOutput,
          toolCallId: output[0].tool_call_id,
          statusCode: 200
        });
        return;
      }
      serializedOutput = toStringValue(output[0]);
    } else if (
      typeof output === 'object' &&
      output !== null &&
      'content' in output
    ) {
      serializedOutput = toStringValue(output.content);
    } else {
      serializedOutput = toStringValue(output);
    }

    await this._endNode(runId, { output: serializedOutput, statusCode: 200 });
  }

  public async handleRetrieverStart(
    retriever: Serialized | undefined,
    query: string,
    runId: string,
    parentRunId?: string,
    tags?: string[],
    metadata?: Record<string, any>
  ): Promise<void> {
    const name = GalileoCallback._getNodeName('retriever', retriever, metadata);
    this._startNode('retriever', parentRunId, runId, {
      name,
      input: query,
      tags,
      metadata
    });
  }

  public async handleRetrieverError(err: Error, runId: string): Promise<void> {
    await this._handleError(err, runId);
  }

  public async handleRetrieverEnd(
    documents: DocumentInterface<Record<string, unknown>>[],
    runId: string
  ): Promise<void> {
    let serializedResponse: unknown;
    try {
      serializedResponse = documents.map((doc) => ({
        pageContent: doc.pageContent,
        metadata: doc.metadata
      }));
    } catch (e) {
      sdkLogger.warn(`Failed to serialize retriever output: ${e}`);
      serializedResponse = String(documents);
    }

    await this._endNode(runId, { output: serializedResponse, statusCode: 200 });
  }
}
