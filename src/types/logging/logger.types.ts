import type { LocalMetricConfig } from '../metrics.types';
import type { LogTracesIngestRequest } from './trace.types';
import type { Trace } from './trace.types';
import type {
  StepWithChildSpans,
  Span,
  LlmSpan,
  RetrieverSpan,
  ToolSpan,
  WorkflowSpan,
  AgentSpan,
  Event
} from './span.types';
import type {
  LlmSpanAllowedInputType,
  LlmSpanAllowedOutputType,
  RetrieverSpanAllowedOutputType
} from './step.types';
import type { AgentType, Payload, ProtectResponse } from '../new-api.types';
import type { JsonObject } from '../base.types';
export interface GalileoLoggerConfig {
  projectName?: string;
  logStreamName?: string;
  experimentId?: string;
  sessionId?: string;
  localMetrics?: LocalMetricConfig[];
  mode?: string;
  projectId?: string;
  logStreamId?: string;
  ingestionHook?: (request: LogTracesIngestRequest) => Promise<void> | void;
  experimental?: { mode?: string };
}

export interface GalileoLoggerConfigExtended extends GalileoLoggerConfig {
  traceId?: string;
  spanId?: string;
}

/**
 * Core logger functionality - initialization, state management, and utility methods.
 * Provides access to logger state and parent stack management.
 */
export interface IGalileoLoggerCore {
  /**
   * Checks if logging is disabled.
   * @returns True if logging is disabled, false otherwise.
   */
  isLoggingDisabled(): boolean;

  /**
   * Get the current parent from context or instance.
   * @returns The current parent span or trace, or undefined if none exists.
   */
  currentParent(): StepWithChildSpans | undefined;

  /**
   * Get the previous parent (second-to-last item in the parent stack).
   * @returns The previous parent span or trace, or undefined if less than 2 items in the stack.
   */
  previousParent(): StepWithChildSpans | undefined;

  /**
   * Check if there is an active trace.
   * @returns True if there is a current parent (trace or span), false otherwise.
   */
  hasActiveTrace(): boolean;

  /**
   * Gets the current session ID.
   * @returns The current session ID, or undefined if no session is active.
   */
  currentSessionId(): string | undefined;
}

/**
 * Session management operations.
 * Handles session creation, retrieval, and lifecycle management.
 */
export interface IGalileoLoggerSession {
  /**
   * Starts a session in the active logger instance. If an externalId is provided, searches for an existing session with that external ID and reuses it if found.
   * @param options - Configuration for the session.
   * @param options.name - (Optional) The name of the session.
   * @param options.previousSessionId - (Optional) The ID of a previous session to link to.
   * @param options.externalId - (Optional) An external identifier for the session. If a session with this external ID already exists, it will be reused instead of creating a new session.
   * @returns A promise that resolves to the ID of the session (either newly created or existing).
   */
  startSession(options?: {
    name?: string;
    previousSessionId?: string;
    externalId?: string;
    metadata?: Record<string, string>;
  }): Promise<string>;

  /**
   * Sets the session ID for the logger.
   * @param sessionId - The session ID to set.
   */
  setSessionId(sessionId: string): void;

  /**
   * Clears the current session ID.
   */
  clearSession(): void;

  /**
   * Gets the current session ID.
   * @returns The current session ID, or undefined if no session is active.
   */
  currentSessionId(): string | undefined;
}

/**
 * Trace creation and management operations.
 * Handles trace lifecycle, including creation, single-span traces, and conclusion.
 */
export interface IGalileoLoggerTrace {
  /**
   * Starts a new trace.
   * @param options - Configuration for the trace.
   * @param options.input - The input content for the trace.
   * @param options.redactedInput - (Optional) Redacted version of the input.
   * @param options.output - (Optional) The output content for the trace.
   * @param options.redactedOutput - (Optional) Redacted version of the output.
   * @param options.name - (Optional) Name for the trace.
   * @param options.createdAt - (Optional) The timestamp when the trace was created.
   * @param options.durationNs - (Optional) Duration of the trace in nanoseconds.
   * @param options.metadata - (Optional) Additional metadata as key-value pairs.
   * @param options.tags - (Optional) Array of tags to categorize the trace.
   * @param options.datasetInput - (Optional) Input data for dataset evaluation.
   * @param options.datasetOutput - (Optional) Expected output for dataset evaluation.
   * @param options.datasetMetadata - (Optional) Metadata for dataset evaluation.
   * @param options.externalId - (Optional) External identifier for the trace.
   * @returns The created trace.
   * @throws Error if a trace is already in progress.
   */
  startTrace(options: {
    input: string;
    redactedInput?: string;
    output?: string;
    redactedOutput?: string;
    name?: string;
    createdAt?: Date;
    durationNs?: number;
    metadata?: Record<string, string>;
    tags?: string[];
    datasetInput?: string;
    datasetOutput?: string;
    datasetMetadata?: Record<string, string>;
    externalId?: string;
  }): Trace;

  /**
   * Create a new trace with a single LLM span. This is a convenience method that combines trace creation
   * and LLM span creation in one call. The trace is automatically concluded, so no need to call conclude().
   * @param options - Configuration for the single LLM span trace. All parameters are optional except `input` and `output`.
   * @returns The created trace containing the single LLM span.
   * @throws Error if a trace or span is already in progress.
   */
  addSingleLlmSpanTrace(options: {
    input: LlmSpanAllowedInputType;
    redactedInput?: LlmSpanAllowedInputType;
    output: LlmSpanAllowedOutputType;
    redactedOutput?: LlmSpanAllowedOutputType;
    model?: string;
    tools?: JsonObject[];
    name?: string;
    createdAt?: Date;
    durationNs?: number;
    metadata?: Record<string, string>;
    tags?: string[];
    numInputTokens?: number;
    numOutputTokens?: number;
    totalTokens?: number;
    temperature?: number;
    statusCode?: number;
    spanStepNumber?: number;
    timeToFirstTokenNs?: number;
    datasetInput?: string;
    datasetOutput?: string;
    datasetMetadata?: Record<string, string>;
    events?: Event[];
  }): Trace;

  /**
   * Create a new trace with a single retriever span. This is a convenience method that combines trace creation
   * and retriever span creation in one call. The trace is automatically concluded, so no need to call conclude().
   * @param options - Configuration for the single retriever span trace. All parameters are optional except `input` and `output`.
   * @returns The created trace containing the single retriever span.
   * @throws Error if a trace or span is already in progress.
   */
  addSingleRetrieverSpanTrace(options: {
    input: string;
    redactedInput?: string;
    output: RetrieverSpanAllowedOutputType;
    redactedOutput?: RetrieverSpanAllowedOutputType;
    name?: string;
    createdAt?: Date;
    durationNs?: number;
    metadata?: Record<string, string>;
    tags?: string[];
    statusCode?: number;
    spanStepNumber?: number;
    datasetInput?: string;
    datasetOutput?: string;
    datasetMetadata?: Record<string, string>;
  }): Trace;

  /**
   * Create a new trace with a single tool span. This is a convenience method that combines trace creation
   * and tool span creation in one call. The trace is automatically concluded, so no need to call conclude().
   * @param options - Configuration for the single tool span trace. Only `input` is required.
   * @returns The created trace containing the single tool span.
   * @throws Error if a trace or span is already in progress.
   */
  addSingleToolSpanTrace(options: {
    input: string;
    redactedInput?: string;
    output?: string;
    redactedOutput?: string;
    name?: string;
    createdAt?: Date;
    durationNs?: number;
    metadata?: Record<string, string>;
    tags?: string[];
    statusCode?: number;
    toolCallId?: string;
    spanStepNumber?: number;
    datasetInput?: string;
    datasetOutput?: string;
    datasetMetadata?: Record<string, string>;
  }): Trace;

  /**
   * Create a new trace with a single workflow span. This is a convenience method that combines trace creation
   * and workflow span creation in one call. The trace is automatically concluded, so no need to call conclude().
   * @param options - Configuration for the single workflow span trace. Only `input` is required.
   * @returns The created trace containing the single workflow span.
   * @throws Error if a trace or span is already in progress.
   */
  addSingleWorkflowSpanTrace(options: {
    input: string;
    redactedInput?: string;
    output?: string;
    redactedOutput?: string;
    name?: string;
    createdAt?: Date;
    durationNs?: number;
    metadata?: Record<string, string>;
    tags?: string[];
    spanStepNumber?: number;
    datasetInput?: string;
    datasetOutput?: string;
    datasetMetadata?: Record<string, string>;
  }): Trace;

  /**
   * Concludes the current trace or span, or all active traces/spans if concludeAll is true.
   * @param options - Configuration for concluding.
   * @param options.output - (Optional) The output content to set.
   * @param options.redactedOutput - (Optional) The redacted output content to set.
   * @param options.durationNs - (Optional) Duration in nanoseconds.
   * @param options.statusCode - (Optional) HTTP status code or execution status.
   * @param options.concludeAll - (Optional) Whether to conclude all active traces/spans. Defaults to false.
   * @returns The current parent after concluding, or undefined if all traces/spans were concluded.
   * @throws Error if no trace or span exists to conclude.
   */
  conclude(options?: {
    output?: string;
    redactedOutput?: string;
    durationNs?: number;
    statusCode?: number;
    concludeAll?: boolean;
  }): StepWithChildSpans | undefined;
}

/**
 * Span creation operations.
 * Handles creation of various span types (LLM, Retriever, Tool, Workflow, Agent).
 */
export interface IGalileoLoggerSpan {
  /**
   * Add a child span to the current parent (trace or workflow/agent span).
   * This method automatically propagates dataset information from the parent to the child span.
   * @param span - The span to add as a child to the current parent.
   * @throws Error if no trace or parent span exists.
   */
  addChildSpanToParent(span: Span): void;

  /**
   * Add a new LLM span to the current parent.
   * @param options - Configuration for the LLM span. All parameters are optional except `input` and `output`.
   * @returns The created LLM span, which is automatically added to the current parent.
   */
  addLlmSpan(options: {
    input: LlmSpanAllowedInputType;
    redactedInput?: LlmSpanAllowedInputType;
    output: LlmSpanAllowedOutputType;
    redactedOutput?: LlmSpanAllowedOutputType;
    model?: string;
    tools?: JsonObject[];
    name?: string;
    createdAt?: Date;
    durationNs?: number;
    metadata?: Record<string, string>;
    tags?: string[];
    numInputTokens?: number;
    numOutputTokens?: number;
    totalTokens?: number;
    timeToFirstTokenNs?: number;
    temperature?: number;
    statusCode?: number;
    stepNumber?: number;
    events?: Event[];
  }): LlmSpan;

  /**
   * Add a new retriever span to the current parent.
   * @param options - Configuration for the retriever span. All parameters are optional except `input` and `output`.
   * @returns The created retriever span.
   */
  addRetrieverSpan(options: {
    input: string;
    redactedInput?: string;
    output: RetrieverSpanAllowedOutputType;
    redactedOutput?: RetrieverSpanAllowedOutputType;
    name?: string;
    durationNs?: number;
    createdAt?: Date;
    metadata?: Record<string, string>;
    tags?: string[];
    statusCode?: number;
    stepNumber?: number;
  }): RetrieverSpan;

  /**
   * Add a new tool span to the current parent.
   * @param options - Configuration for the tool span. Only `input` is required.
   * @returns The created tool span.
   */
  addToolSpan(options: {
    input: string;
    redactedInput?: string;
    output?: string;
    redactedOutput?: string;
    name?: string;
    durationNs?: number;
    createdAt?: Date;
    metadata?: Record<string, string>;
    tags?: string[];
    statusCode?: number;
    toolCallId?: string;
    stepNumber?: number;
  }): ToolSpan;

  /**
   * Add a new Protect tool span to the current parent.
   * This is a specialized method for logging Galileo Protect tool spans.
   * @param options - Configuration for the Protect span.
   * @returns The created Protect tool span.
   */
  addProtectSpan(options: {
    payload: Payload;
    redactedPayload?: Payload;
    response?: ProtectResponse;
    redactedResponse?: ProtectResponse;
    createdAt?: Date;
    metadata?: Record<string, string>;
    tags?: string[];
    statusCode?: number;
    stepNumber?: number;
  }): ToolSpan;

  /**
   * Add a workflow span to the current parent. This is useful when you want to create a nested workflow span
   * within the trace or current workflow span. The next span you add will be a child of the current parent. To
   * move out of the nested workflow, use conclude().
   * @param options - Configuration for the workflow span. Only `input` is required. This creates a parent span that can contain child spans.
   * @returns The created workflow span.
   */
  addWorkflowSpan(options: {
    input: string;
    redactedInput?: string;
    output?: string;
    redactedOutput?: string;
    name?: string;
    durationNs?: number;
    createdAt?: Date;
    metadata?: Record<string, string>;
    tags?: string[];
    stepNumber?: number;
  }): WorkflowSpan;

  /**
   * Add an agent span to the current parent. Agent spans can contain child spans (like workflow spans).
   * @param options - Configuration for the agent span. Only `input` is required. This creates a parent span that can contain child spans.
   * @returns The created agent span.
   */
  addAgentSpan(options: {
    input: string;
    redactedInput?: string;
    output?: string;
    redactedOutput?: string;
    name?: string;
    durationNs?: number;
    createdAt?: Date;
    metadata?: Record<string, string>;
    tags?: string[];
    agentType?: AgentType;
    stepNumber?: number;
  }): AgentSpan;
}

/**
 * Batch mode operations.
 * Handles flushing traces to the server and termination.
 */
export interface IGalileoLoggerBatch {
  /**
   * Flushes all traces to the server. Concludes any active traces before flushing.
   * @returns A promise that resolves to an array of flushed traces.
   */
  flush(): Promise<Trace[]>;

  /**
   * Terminates the logger. In batch mode, flushes all traces. In streaming mode, waits for all tasks to complete.
   * @returns A promise that resolves when termination is complete.
   */
  terminate(): Promise<void>;
}

/**
 * Complete logger interface combining all capabilities.
 * This is the main interface that the GalileoLogger class implements.
 */
export interface IGalileoLogger
  extends
    IGalileoLoggerCore,
    IGalileoLoggerSession,
    IGalileoLoggerTrace,
    IGalileoLoggerSpan,
    IGalileoLoggerBatch {}
