/* eslint-disable @typescript-eslint/no-explicit-any */
import { AxiosError } from 'axios';
import {
  BaseCallbackHandler,
  CallbackHandlerMethods,
  NewTokenIndices
} from '@langchain/core/callbacks/base';
import { LLMResult } from '@langchain/core/outputs';
import { BaseMessage } from '@langchain/core/messages';
import { ChainValues } from '@langchain/core/utils/types';
import { AgentFinish } from '@langchain/core/agents';
import { Document, DocumentInterface } from '@langchain/core/documents';
import { GalileoSingleton } from '../singleton';
import { GalileoLogger } from '../utils/galileo-logger';
import { toStringValue, convertToStringDict } from '../utils/serialization';
import { Serialized } from '@langchain/core/dist/load/serializable.js';

type LANGCHAIN_NODE_TYPE =
  | 'agent'
  | 'chain'
  | 'chat'
  | 'llm'
  | 'retriever'
  | 'tool';

/**
 * A node in the Langchain trace.
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

const rootNodeContext = {
  get: (): Node | null => _rootNode,
  set: (value: Node | null): void => {
    _rootNode = value;
  }
};

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
    flushOnChainEnd: boolean = true
  ) {
    super();
    this._galileoLogger =
      galileoLogger || GalileoSingleton.getInstance().getClient();
    this._startNewTrace = startNewTrace;
    this._flushOnChainEnd = flushOnChainEnd;
  }

  /**
   * Commit the nodes to the trace using the Galileo Logger. Optionally flush the trace.
   */
  private async _commit(): Promise<void> {
    if (Object.keys(this._nodes).length === 0) {
      console.warn('No nodes to commit');
      return;
    }

    const root = rootNodeContext.get();
    if (root === null) {
      console.warn('Unable to add nodes to trace: Root node not set');
      return;
    }

    const rootNode = this._nodes[root.runId];
    if (rootNode === undefined) {
      console.warn('Unable to add nodes to trace: Root node does not exist');
      return;
    }

    if (this._startNewTrace) {
      this._galileoLogger.startTrace({
        input: toStringValue(rootNode.spanParams.input || '')
      });
    }

    this._logNodeTree(rootNode);

    // Conclude the trace with the root node's output
    const rootOutput = rootNode.spanParams.output || '';

    if (this._startNewTrace) {
      // If a new trace was started, conclude it
      this._galileoLogger.conclude({
        output: toStringValue(rootOutput)
      });
    }

    if (this._flushOnChainEnd) {
      // Upload the trace to Galileo
      await this._galileoLogger.flush();
    }

    // Clear nodes after successful commit
    this._nodes = {};
    rootNodeContext.set(null);
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

    let metadata: Record<string, string> | undefined = undefined;
    if (node.spanParams.metadata) {
      try {
        metadata = convertToStringDict(
          node.spanParams.metadata as Record<string, any>
        );
      } catch (e) {
        console.warn('Unable to convert metadata to a string dictionary', e);
      }
    }

    // Log the current node based on its type
    if (node.nodeType === 'agent' || node.nodeType === 'chain') {
      this._galileoLogger.addWorkflowSpan({
        input: inputAsString,
        output: outputAsString,
        name,
        metadata,
        tags
      });
      isWorkflowSpan = true;
    } else if (node.nodeType === 'llm' || node.nodeType === 'chat') {
      this._galileoLogger.addLlmSpan({
        input,
        output,
        model: node.spanParams.model,
        temperature: node.spanParams.temperature,
        name,
        metadata,
        tags,
        numInputTokens: node.spanParams.numInputTokens,
        numOutputTokens: node.spanParams.numOutputTokens,
        totalTokens: node.spanParams.totalTokens,
        timeToFirstTokenNs: node.spanParams.timeToFirstTokenNs
      });
    } else if (node.nodeType === 'retriever') {
      this._galileoLogger.addRetrieverSpan({
        input: inputAsString,
        output,
        name,
        metadata,
        tags
      });
    } else if (node.nodeType === 'tool') {
      this._galileoLogger.addToolSpan({
        input: inputAsString,
        output: outputAsString,
        name,
        metadata,
        tags
      });
    } else {
      console.warn(`Unknown node type: ${node.nodeType}`);
    }

    // Process all child nodes
    let lastChild: Node | null = null;
    for (const childId of node.children) {
      const childNode = this._nodes[childId];
      if (childNode) {
        this._logNodeTree(childNode);
        lastChild = childNode;
      } else {
        console.debug(`Child node ${childId} not found`);
      }
    }

    // Conclude workflow span. Use the last child's output if necessary
    if (isWorkflowSpan) {
      const finalOutput =
        output || (lastChild ? lastChild.spanParams.output || '' : '');
      this._galileoLogger.conclude({
        output: toStringValue(finalOutput)
      });
    }
  }

  /**
   * Start a new node in the chain.
   */
  private async _startNode(
    nodeType: LANGCHAIN_NODE_TYPE,
    parentRunId: string | undefined,
    runId: string,
    params: Record<string, any>
  ): Promise<Node> {
    const nodeId = runId;
    const parentNodeId = parentRunId;

    if (this._nodes[nodeId]) {
      console.debug(`Node already exists for run_id ${runId}, overwriting...`);
    }

    // Create new node
    const node = new Node(nodeType, params, runId, parentNodeId);
    this._nodes[nodeId] = node;

    // Set as root node if needed
    if (!rootNodeContext.get()) {
      console.debug(`Setting root node to ${nodeId}`);
      rootNodeContext.set(node);
    }

    // Add to parent's children if parent exists
    if (parentRunId) {
      const parent = this._nodes[parentNodeId!];
      if (parent) {
        parent.children.push(nodeId);
      } else {
        console.debug(`Parent node ${parentNodeId} not found for ${nodeId}`);
      }
    }

    return node;
  }

  /**
   * End a node in the chain. Commit the nodes to a trace if the run_id matches the root node.
   */
  private async _endNode(
    runId: string,
    params: Record<string, any>
  ): Promise<void> {
    const nodeId = runId;
    const node = this._nodes[nodeId];

    if (!node) {
      console.warn(`No node exists for run_id ${nodeId}`);
      return;
    }

    // Update node parameters
    Object.assign(node.spanParams, params);

    // Check if this is the root node and commit if so
    const root = rootNodeContext.get();
    if (root && node.runId === root.runId) {
      await this._commit();
    }
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
    let nodeType: LANGCHAIN_NODE_TYPE = 'chain';
    let nodeName = chain?.name || 'Chain';
    let nodeInput: unknown = {};

    // If the name is LangGraph or agent, set the node type to agent
    if (nodeName === 'LangGraph' || nodeName === 'agent') {
      nodeType = 'agent';
      nodeName = 'Agent';
    }

    // If the node is tagged with hidden, don't log it
    if (tags && tags.includes('langsmith:hidden')) {
      return;
    }

    if (typeof inputs === 'string') {
      nodeInput = { input: inputs };
    } else if (inputs instanceof BaseMessage) {
      nodeInput = inputs;
    } else if (typeof inputs === 'object') {
      nodeInput = Object.fromEntries(
        Object.entries(inputs).filter(
          ([key, value]: [string, unknown]) =>
            key && value && typeof value === 'string'
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

    await this._startNode(nodeType, parentRunId, runId, {
      input: nodeInput,
      name: nodeName,
      tags,
      metadata
    });
  }

  public async handleChainError(err: AxiosError, runId: string): Promise<void> {
    await this._endNode(runId, {
      output: `ERROR: ${err.message}`,
      status_code: err.response?.status
    });
  }

  public async handleChainEnd(
    outputs: ChainValues,
    runId: string
  ): Promise<void> {
    await this._endNode(runId, { output: toStringValue(outputs) });
  }

  public async handleAgentEnd(
    finish: AgentFinish,
    runId: string
  ): Promise<void> {
    await this._endNode(runId, { output: toStringValue(finish) });
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
    const invocation_params = extraParams?.invocation_params as Record<
      string,
      unknown
    >;
    const model = invocation_params?.model_name as string | undefined;
    const temperature = invocation_params?.temperature as number | undefined;

    await this._startNode('llm', parentRunId, runId, {
      name: 'LLM',
      input: prompts.map((p) => ({ content: p, role: 'user' })),
      tags,
      model,
      temperature,
      metadata: metadata
        ? Object.fromEntries(
            Object.entries(metadata).map(([k, v]) => [k, String(v)])
          )
        : undefined,
      startTime: performance.now(),
      timeToFirstTokenNs: null
    });
  }

  public async handleLLMError(err: AxiosError, runId: string): Promise<void> {
    await this._endNode(runId, {
      output: `ERROR: ${err.message}`,
      status_code: err.response?.status
    });
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
        this._nodes[runId] = node;
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

    // Serialize messages safely
    let serializedMessages;
    try {
      const flattenedMessages = messages.flat().map((msg) => ({
        content: msg.content,
        role: msg.getType()
      }));
      serializedMessages = flattenedMessages;
    } catch (e) {
      console.warn(`Failed to serialize chat messages: ${e}`);
      serializedMessages = String(messages);
    }

    await this._startNode('chat', parentRunId, runId, {
      name: 'Chat Model',
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
    const tokenUsage = output.llmOutput?.tokenUsage || {};

    let serializedOutput;
    try {
      const flattenedOutput = output.generations.flat().map((g) => ({
        text: g.text,
        generationInfo: g.generationInfo
      }));
      serializedOutput = flattenedOutput[0];
    } catch (e) {
      console.warn(`Failed to serialize LLM output: ${e}`);
      serializedOutput = String(output.generations);
    }

    await this._endNode(runId, {
      output: serializedOutput,
      numInputTokens: tokenUsage.promptTokens,
      numOutputTokens: tokenUsage.completionTokens,
      totalTokens: tokenUsage.totalTokens
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
    const name = tool?.name || 'Tool';
    await this._startNode('tool', parentRunId, runId, {
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

  public async handleToolError(err: AxiosError, runId: string): Promise<void> {
    await this._endNode(runId, {
      output: `ERROR: ${err.message}`,
      status_code: err.response?.status
    });
  }

  public async handleToolEnd(output: string, runId: string): Promise<void> {
    await this._endNode(runId, { output: toStringValue(output) });
  }

  public async handleRetrieverStart(
    retriever: Serialized | undefined,
    query: string,
    runId: string,
    parentRunId?: string,
    tags?: string[],
    metadata?: Record<string, any>
  ): Promise<void> {
    await this._startNode('retriever', parentRunId, runId, {
      name: 'Retriever',
      input: query,
      tags,
      metadata
    });
  }

  public async handleRetrieverError(
    err: AxiosError,
    runId: string
  ): Promise<void> {
    await this._endNode(runId, {
      output: `ERROR: ${err.message}`,
      status_code: err.response?.status
    });
  }

  public async handleRetrieverEnd(
    documents: DocumentInterface<Record<string, unknown>>[],
    runId: string
  ): Promise<void> {
    let serializedResponse;
    try {
      serializedResponse = documents.map((doc) => ({
        pageContent: doc.pageContent,
        metadata: doc.metadata
      }));
    } catch (e) {
      console.warn(`Failed to serialize retriever output: ${e}`);
      serializedResponse = String(documents);
    }

    await this._endNode(runId, { output: serializedResponse });
  }
}
