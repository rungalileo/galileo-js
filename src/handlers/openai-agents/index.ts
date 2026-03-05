/* eslint-disable @typescript-eslint/no-explicit-any */
import { GalileoLogger } from '../../utils/galileo-logger';
import { GalileoSingleton } from '../../singleton';
import { calculateDurationNs } from '../../utils/utils';
import type { JsonObject } from '../../types/base.types';
import { AgentType } from '../../types/new-api.types';
import { type Node, createNode } from './node';
import { mapSpanType, mapSpanName, GALILEO_CUSTOM_TYPE } from './span-mapping';
import {
  extractLlmData,
  extractToolData,
  extractWorkflowData,
  extractGalileoCustomData
} from './data-extraction';
import {
  extractEmbeddedToolCalls,
  type EmbeddedToolCall
} from './embedded-tools';
import {
  createGalileoCustomSpanData,
  type GalileoCustomSpanData,
  type GalileoSpanLike
} from './custom-span';
import { getSdkLogger } from 'galileo-generated';
const sdkLogger = getSdkLogger();

/**
 * Minimal interface for an OpenAI Agents SDK Trace object.
 */
export interface AgentTrace {
  traceId: string;
  name?: string;
  metadata?: Record<string, unknown>;
  startedAt?: string | null;
  endedAt?: string | null;
}

/**
 * Minimal interface for an OpenAI Agents SDK Span object.
 */
export interface AgentSpan<
  T extends Record<string, unknown> = Record<string, unknown>
> {
  spanId: string;
  traceId: string;
  parentId?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  error?: {
    message: string;
    data?: Record<string, unknown>;
  } | null;
  spanData: T & { type: string };
}

/**
 * Minimal TracingProcessor interface from @openai/agents-core.
 */
export interface TracingProcessor {
  onTraceStart(trace: AgentTrace): Promise<void>;
  onTraceEnd(trace: AgentTrace): Promise<void>;
  onSpanStart(span: AgentSpan): Promise<void>;
  onSpanEnd(span: AgentSpan): Promise<void>;
  shutdown(timeout?: number): Promise<void>;
  forceFlush(): Promise<void>;
}

/**
 * Maps an OpenAI agent type string to a Galileo AgentType enum value.
 * Returns undefined when no agentType is present so addAgentSpan() can use its default.
 */
function extractAgentType(
  spanParams: Record<string, unknown>
): AgentType | undefined {
  const raw = spanParams.agentType;
  if (typeof raw !== 'string' || !raw) {
    return undefined;
  }

  const typeMap: Record<string, AgentType> = {
    classifier: AgentType.CLASSIFIER,
    planner: AgentType.PLANNER,
    react: AgentType.REACT,
    reflection: AgentType.REFLECTION,
    router: AgentType.ROUTER,
    supervisor: AgentType.SUPERVISOR,
    judge: AgentType.JUDGE,
    default: AgentType.DEFAULT
  };

  return typeMap[raw.toLowerCase()] ?? AgentType.DEFAULT;
}

/**
 * GalileoTracingProcessor implements the OpenAI Agents SDK TracingProcessor interface
 * to capture agent runs and emit them to GalileoLogger.
 *
 * Trace Input Handling:
 * - Trace-level input is populated from the first LLM or Tool span with non-empty input
 * - This ensures user queries are preserved in trace metadata
 * - Falls back to trace name if no meaningful input is captured
 */
export class GalileoTracingProcessor implements TracingProcessor {
  private _nodes = new Map<string, Node>();
  private _lastOutput: unknown = null;
  private _firstInput: unknown = null;
  private static _depCheckDone = false;

  /**
   * Creates a new GalileoTracingProcessor.
   * @param _galileoLogger - (Optional) The GalileoLogger instance to use. Defaults to singleton logger.
   * @param _flushOnTraceEnd - (Optional) Whether to flush the logger after each trace ends. Defaults to true.
   */
  constructor(
    private readonly _galileoLogger: GalileoLogger = GalileoSingleton.getInstance().getClient(),
    private readonly _flushOnTraceEnd: boolean = true
  ) {
    // Lazily check for @openai/agents-core package only when processor is instantiated
    if (!GalileoTracingProcessor._depCheckDone) {
      GalileoTracingProcessor._depCheckDone = true;
      import('@openai/agents-core' as string).catch(() => {
        sdkLogger.warn(
          '@openai/agents package is not installed. GalileoTracingProcessor will not function.'
        );
      });
    }
  }

  /**
   * Checks if a value is a meaningful, non-empty input string.
   * Filters out null, undefined, empty strings, and JSON 'null'.
   */
  private isMeaningfulInput(value: unknown): boolean {
    if (value === null || value === undefined) {
      return false;
    }
    const str = String(value).trim();
    if (str.length === 0) {
      return false;
    }
    // Filter out JSON-serialized null (from earlier spans)
    if (str === 'null' || str === '""') {
      return false;
    }
    return true;
  }

  /**
   * Called when a trace starts. Creates a root agent node.
   * @param trace - The trace that started.
   */
  async onTraceStart(trace: AgentTrace): Promise<void> {
    const spanParams: Record<string, unknown> = {
      name: trace.name || 'Agent Run',
      startedAt: trace.startedAt || new Date().toISOString()
    };

    if (trace.metadata) {
      // Convert metadata values to strings for Galileo
      const meta: Record<string, string> = {};
      for (const [k, v] of Object.entries(trace.metadata)) {
        meta[k] = typeof v === 'string' ? v : JSON.stringify(v);
      }
      spanParams.metadata = meta;
    }

    const node = createNode({
      nodeType: 'agent',
      spanParams,
      runId: trace.traceId,
      parentRunId: null
    });

    this._nodes.set(trace.traceId, node);
  }

  /**
   * Called when a trace ends. Commits the span tree and optionally flushes the logger.
   * @param trace - The trace that ended.
   */
  async onTraceEnd(trace: AgentTrace): Promise<void> {
    const rootNode = this._nodes.get(trace.traceId);
    if (rootNode) {
      const startedAt = rootNode.spanParams.startedAt as string | undefined;
      const endedAt = trace.endedAt || new Date().toISOString();
      const durationNs =
        startedAt && endedAt
          ? calculateDurationNs(new Date(startedAt), new Date(endedAt))
          : 0;
      rootNode.spanParams.durationNs = durationNs;
      rootNode.spanParams.endedAt = endedAt;
    }

    this._commitTrace(trace);
    this._galileoLogger.conclude({ concludeAll: true });

    if (this._flushOnTraceEnd) {
      await this._galileoLogger.flush();
    }

    this._nodes.clear();
    this._lastOutput = null;
    this._firstInput = null;
  }

  /**
   * Called when a span starts. Maps span type, creates a Node, and links it to its parent.
   * @param span - The span that started.
   */
  async onSpanStart(span: AgentSpan): Promise<void> {
    const spanData = span.spanData;
    const spanType = mapSpanType(spanData);
    const spanName = mapSpanName(spanData, spanType);

    let initialParams: Record<string, unknown> = {
      name: spanName,
      startedAt: span.startedAt || new Date().toISOString()
    };

    // Determine effective node type and extract data.
    // galileo_custom delegates to the inner galileoSpan for type + fields.
    let nodeType: Node['nodeType'];

    if (spanType === GALILEO_CUSTOM_TYPE) {
      const custom = extractGalileoCustomData(spanData);
      nodeType = custom.nodeType;
      initialParams = { ...initialParams, ...custom.params };
    } else if (spanType === 'llm') {
      nodeType = 'llm';
      initialParams = { ...initialParams, ...extractLlmData(spanData) };
    } else if (spanType === 'tool') {
      nodeType = 'tool';
      initialParams = { ...initialParams, ...extractToolData(spanData) };
    } else if (spanType === 'agent') {
      nodeType = 'agent';
      initialParams = { ...initialParams, ...extractWorkflowData(spanData) };
    } else {
      nodeType = 'workflow';
      initialParams = { ...initialParams, ...extractWorkflowData(spanData) };
    }

    // Determine parent ID (prefer explicit parentId, fallback to traceId)
    const parentId = span.parentId ?? span.traceId;

    // Validate that parent node exists before creating and linking this node
    const parentNode = this._nodes.get(parentId);
    if (!parentNode) {
      sdkLogger.warn(
        `Parent node ${parentId} not found for span ${span.spanId} in trace ${span.traceId}`
      );
      return;
    }

    const node = createNode({
      nodeType,
      spanParams: initialParams,
      runId: span.spanId,
      parentRunId: parentId
    });

    this._nodes.set(span.spanId, node);
    parentNode.children.push(span.spanId);
  }

  /**
   * Called when a span ends. Finalises duration, merges data, and handles errors.
   * @param span - The span that ended.
   */
  async onSpanEnd(span: AgentSpan): Promise<void> {
    const node = this._nodes.get(span.spanId);
    if (!node) return;

    const startedAt = node.spanParams.startedAt as string | undefined;
    const endedAt = span.endedAt || new Date().toISOString();
    const durationNs =
      startedAt && endedAt
        ? calculateDurationNs(new Date(startedAt), new Date(endedAt))
        : 0;
    node.spanParams.durationNs = durationNs;

    // Merge final data for response spans (embedded tool calls + response object)
    const spanData = span.spanData;
    if (spanData.type === 'response') {
      const finalData = extractLlmData(spanData);
      const responseObj = finalData._responseObject as
        | Record<string, unknown>
        | undefined;
      if (responseObj) {
        const embeddedTools = extractEmbeddedToolCalls(responseObj);
        if (embeddedTools.length > 0) {
          node.spanParams.embeddedToolCalls = embeddedTools;
        }
      }
      // Merge updated data (output may not have been available at span start)
      const { _responseObject: _removed, ...rest } = finalData;
      void _removed;
      node.spanParams = { ...node.spanParams, ...rest };
    } else if (spanData.type === 'generation') {
      // Refresh LLM data at end (usage may be populated now)
      const finalData = extractLlmData(spanData);
      node.spanParams = { ...node.spanParams, ...finalData };
    }

    // Handle errors
    if (span.error) {
      const errorMessage = span.error.message || 'Unknown error';
      const existingMeta =
        (node.spanParams.metadata as Record<string, string> | undefined) ?? {};
      node.spanParams.statusCode = 500;
      node.spanParams.metadata = {
        ...existingMeta,
        error_message: errorMessage,
        error_type: 'SpanError',
        error_details: span.error.data
          ? JSON.stringify(span.error.data)
          : errorMessage
      };
    }

    // Track last output for trace-level output
    if (node.spanParams.output !== undefined) {
      this._lastOutput = node.spanParams.output;
    }

    // Track first input for trace-level input (capture from first meaningful span)
    // Only capture from LLM or Tool spans (not workflow/agent), and only if we haven't captured yet
    if (
      this._firstInput === null &&
      (node.nodeType === 'llm' || node.nodeType === 'tool') &&
      this.isMeaningfulInput(node.spanParams.input)
    ) {
      this._firstInput = node.spanParams.input;
    }
  }

  /**
   * Shuts down the processor, flushing any pending data.
   * @param _timeout - (Optional) Shutdown timeout in milliseconds.
   */
  async shutdown(timeout?: number): Promise<void> {
    void timeout;
    await this._galileoLogger.flush();
  }

  /**
   * Forces a flush of any pending data.
   */
  async forceFlush(): Promise<void> {
    await this._galileoLogger.flush();
  }

  /**
   * Finds the root node for the trace and recursively logs the span tree.
   * @param trace - The trace to commit.
   */
  private _commitTrace(trace: AgentTrace): void {
    const rootNode = this._nodes.get(trace.traceId);
    if (!rootNode) return;
    this._logNodeTree(rootNode, true);
  }

  /**
   * Recursively emits nodes to GalileoLogger in correct parent→child order.
   * @param node - The node to log.
   * @param firstNode - Whether this is the root trace node.
   */
  private _logNodeTree(node: Node, firstNode = false): void {
    const params = node.spanParams;
    const name = (params.name as string | undefined) ?? 'Agent Run';
    const durationNs = (params.durationNs as number | undefined) ?? 0;
    const metadata =
      (params.metadata as Record<string, string> | undefined) ?? {};
    const tags = (params.tags as string[] | undefined) ?? undefined;
    const statusCode = (params.statusCode as number | undefined) ?? 200;
    const input = params.input !== undefined ? String(params.input) : '';
    const output =
      params.output !== undefined ? String(params.output) : undefined;
    const startedAt =
      params.startedAt !== undefined
        ? new Date(params.startedAt as string)
        : undefined;

    if (firstNode) {
      // Root node → startTrace
      const traceInput =
        this._firstInput !== null ? String(this._firstInput) : input;
      const traceOutput =
        this._lastOutput !== null ? String(this._lastOutput) : output;
      this._galileoLogger.startTrace({
        input: traceInput || name,
        output: traceOutput,
        name,
        createdAt: startedAt,
        durationNs,
        metadata
      });
    } else if (node.nodeType === 'llm') {
      const numInputTokens =
        (params.numInputTokens as number | undefined) ?? undefined;
      const numOutputTokens =
        (params.numOutputTokens as number | undefined) ?? undefined;
      const totalTokens =
        (params.totalTokens as number | undefined) ?? undefined;
      const numReasoningTokens =
        (params.numReasoningTokens as number | undefined) ?? undefined;
      const numCachedInputTokens =
        (params.numCachedInputTokens as number | undefined) ?? undefined;
      const temperature =
        (params.temperature as number | undefined) ?? undefined;
      const model = (params.model as string | undefined) ?? 'unknown';
      const tools = (params.tools as string | undefined)
        ? (JSON.parse(params.tools as string) as Record<string, unknown>[])
        : undefined;

      // Build embedded tool calls metadata
      const embeddedToolCalls = params.embeddedToolCalls as
        | EmbeddedToolCall[]
        | undefined;
      const llmMeta: Record<string, string> = { ...metadata };
      if (embeddedToolCalls && embeddedToolCalls.length > 0) {
        llmMeta.embedded_tool_calls = JSON.stringify(embeddedToolCalls);
      }

      this._galileoLogger.addLlmSpan({
        input,
        output: output ?? '',
        name,
        model,
        durationNs,
        numInputTokens,
        numOutputTokens,
        totalTokens,
        numReasoningTokens,
        numCachedInputTokens,
        temperature,
        statusCode,
        metadata: llmMeta,
        tools: tools as JsonObject[] | undefined,
        createdAt: startedAt
      });
    } else if (node.nodeType === 'tool') {
      this._galileoLogger.addToolSpan({
        input,
        output,
        name,
        durationNs,
        statusCode,
        metadata,
        tags,
        createdAt: startedAt
      });
    } else if (node.nodeType === 'agent') {
      this._galileoLogger.addAgentSpan({
        input,
        output,
        name,
        durationNs,
        metadata,
        tags,
        createdAt: startedAt,
        agentType: extractAgentType(params),
        statusCode
      });
    } else {
      // workflow and other parent nodes
      this._galileoLogger.addWorkflowSpan({
        input,
        output,
        name,
        durationNs,
        metadata,
        tags,
        createdAt: startedAt,
        statusCode
      });
    }

    // Recursively log children
    for (const childId of node.children) {
      const childNode = this._nodes.get(childId);
      if (childNode) {
        this._logNodeTree(childNode, false);
      }
    }

    // Conclude workflow/agent spans after their children
    if (
      !firstNode &&
      (node.nodeType === 'workflow' || node.nodeType === 'agent')
    ) {
      this._galileoLogger.conclude({ output, durationNs, statusCode });
    }
  }

  /**
   * Creates a custom span backed by GalileoCustomSpanData.
   * @param galileoSpan - The Galileo span object to embed.
   * @param name - (Optional) Display name for the custom span.
   * @param extraData - (Optional) Extra data to include in the span payload.
   * @returns A GalileoCustomSpanData object that can be passed to the OpenAI Agents SDK.
   */
  static addGalileoCustomSpan(
    galileoSpan: GalileoSpanLike,
    name?: string,
    extraData?: Record<string, unknown>
  ): GalileoCustomSpanData {
    return createGalileoCustomSpanData(galileoSpan, name, extraData);
  }
}

/**
 * Registers a new GalileoTracingProcessor with the OpenAI Agents SDK.
 * Requires @openai/agents-core to be installed.
 * @param galileoLogger - (Optional) The GalileoLogger instance to use.
 * @param flushOnTraceEnd - (Optional) Whether to flush after each trace ends.
 * @returns The created GalileoTracingProcessor instance.
 */
export async function registerGalileoTraceProcessor(options?: {
  galileoLogger?: GalileoLogger;
  flushOnTraceEnd?: boolean;
}): Promise<GalileoTracingProcessor> {
  const processor = new GalileoTracingProcessor(
    options?.galileoLogger,
    options?.flushOnTraceEnd
  );

  const { addTraceProcessor } = (await import(
    '@openai/agents-core' as string
  )) as {
    addTraceProcessor: (processor: TracingProcessor) => void;
  };
  addTraceProcessor(processor);

  return processor;
}

export { createGalileoCustomSpanData as GalileoCustomSpan } from './custom-span';
export type { GalileoCustomSpanData, GalileoSpanLike } from './custom-span';
export type { Node, NodeType } from './node';
export { mapSpanType, mapSpanName, GALILEO_CUSTOM_TYPE } from './span-mapping';
export {
  extractLlmData,
  extractToolData,
  extractWorkflowData,
  extractGalileoCustomData,
  parseUsage
} from './data-extraction';
export {
  extractEmbeddedToolCalls,
  getToolNameFromType,
  extractToolInput,
  extractToolOutput
} from './embedded-tools';
