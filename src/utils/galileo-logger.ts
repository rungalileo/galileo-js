import { GalileoApiClient } from '../api-client';
import {
  type BaseSpan,
  AgentSpan,
  AgentType,
  type Event,
  LlmMetrics,
  LlmSpan,
  RetrieverSpan,
  type Span,
  StepWithChildSpans,
  ToolSpan,
  WorkflowSpan
} from '../types/logging/span.types';
import type { JsonObject } from '../types/base.types';
import { type SpanSchema, Trace } from '../types/logging/trace.types';
import {
  type RetrieverSpanAllowedOutputType,
  Metrics,
  type LlmSpanAllowedOutputType,
  type LlmSpanAllowedInputType,
  type MetricsOptions
} from '../types/logging/step.types';
import { toStringValue } from './serialization';
import type { LogRecordsQueryRequest } from '../types/shared.types';
import type { LocalMetricConfig } from '../types/metrics.types';
import { loggerContext } from '../singleton';
import type {
  LogTracesIngestRequest,
  LogSpansIngestRequest,
  LogTraceUpdateRequest,
  LogSpanUpdateRequest,
  TraceSchema
} from '../types/logging/trace.types';
import { populateLocalMetrics } from '../utils/metrics';
import type { Payload, ProtectResponse } from '../types/new-api.types';
import { handleGalileoHttpExceptionsForRetry, withRetry } from './retry-utils';
import { TaskHandler } from './task-handler';
import type {
  GalileoLoggerConfig,
  GalileoLoggerConfigExtended,
  IGalileoLogger
} from '../types/logging/logger.types';

const NUM_RETRIES = 3;

/**
 * Higher-order function that wraps a method to skip execution if logging is disabled
 * @param fn The original method
 * @param defaultValueFn A function that returns the default value when logging is disabled
 */
function skipIfDisabled<T, Args extends unknown[]>(
  fn: (this: GalileoLogger, ...args: Args) => T,
  defaultValueFn: (args: Args) => T
): (this: GalileoLogger, ...args: Args) => T {
  return function (this: GalileoLogger, ...args: Args): T {
    if (this.isLoggingDisabled()) {
      console.warn('Logging is disabled, skipping execution of', fn.name);
      return defaultValueFn(args);
    }
    return fn.apply(this, args);
  };
}

/**
 * Higher-order function that wraps an async method to skip execution if logging is disabled
 * @param fn The original async method
 * @param defaultValueFn A function that returns the default value when logging is disabled
 */
function skipIfDisabledAsync<T, Args extends unknown[]>(
  fn: (this: GalileoLogger, ...args: Args) => Promise<T>,
  defaultValueFn: (args: Args) => T
): (this: GalileoLogger, ...args: Args) => Promise<T> {
  return async function (this: GalileoLogger, ...args: Args): Promise<T> {
    if (this.isLoggingDisabled()) {
      console.warn('Logging is disabled, skipping execution of', fn.name);
      return defaultValueFn(args);
    }
    return await fn.apply(this, args);
  };
}

class GalileoLogger implements IGalileoLogger {
  private projectName?: string;
  private logStreamName?: string;
  private experimentId?: string;
  private sessionId?: string;
  private localMetrics?: LocalMetricConfig[];
  private mode?: string;
  private projectId?: string;
  private logStreamId?: string;
  private traceId?: string;
  private spanId?: string;
  private ingestionHook?: (
    request: LogTracesIngestRequest
  ) => Promise<void> | void;
  private client = new GalileoApiClient();
  private parentStack: StepWithChildSpans[] = [];
  public traces: Trace[] = [];
  private loggingDisabled: boolean = false;
  private taskHandler?: TaskHandler;
  private isTerminating = false;

  /**
   * Static factory method to create and initialize a logger.
   * Use this instead of `new GalileoLogger()` when traceId or spanId are provided.
   *
   * @param config - Logger configuration
   * @returns Promise that resolves to a fully initialized logger
   * @throws Error if trace or span initialization fails
   */
  static async create(
    config: GalileoLoggerConfigExtended = {}
  ): Promise<GalileoLogger> {
    const logger = new GalileoLogger(config);

    // When the Galileo Client initialization is refactored (on Golden Flow or
    // in some other effort), the project and logstream creation will go here,
    // to benefit from having the async factory method.

    // Initialize trace/span if IDs provided (streaming mode only)
    if (logger.mode === 'streaming') {
      if (config.traceId) {
        await logger.initTrace(config.traceId);
      }
      if (config.spanId) {
        await logger.initSpan(config.spanId);
      }
    } else if (config.traceId || config.spanId) {
      throw new Error('traceId and spanId can only be used in streaming mode.');
    }

    return logger;
  }

  /**
   * Gets the last output from a span or its children recursively.
   * @param node - (Optional) The span node to get output from.
   * @returns The output and redacted output, or undefined if not found.
   */
  static getLastOutput(
    node?: BaseSpan
  ): { output?: string; redactedOutput?: string } | undefined {
    if (node === undefined) {
      return undefined;
    }

    const output =
      node.output !== undefined
        ? typeof node.output === 'string'
          ? node.output
          : toStringValue(node.output)
        : undefined;

    const redactedOutput =
      node.redactedOutput !== undefined
        ? typeof node.redactedOutput === 'string'
          ? node.redactedOutput
          : toStringValue(node.redactedOutput)
        : undefined;

    if (output !== undefined || redactedOutput !== undefined) {
      return { output, redactedOutput };
    }

    if (node instanceof StepWithChildSpans && node.spans.length > 0) {
      return GalileoLogger.getLastOutput(node.spans[node.spans.length - 1]);
    }

    return undefined;
  }

  constructor(config: GalileoLoggerConfig = {}) {
    this.initializeProperties(config);
    this.validateConfiguration();
    this.initializeLoggerState();
    this.wrapMethodsForDisabledLogging();
    this.registerCleanupHandlers();
  }

  // ============================================
  // IGalileoLoggerCore Implementation
  // ============================================

  /**
   * Checks if logging is disabled.
   * @returns True if logging is disabled, false otherwise.
   */
  isLoggingDisabled(): boolean {
    return this.loggingDisabled;
  }

  /**
   * Get the current parent from context or instance.
   * @returns The current parent span or trace, or undefined if none exists.
   */
  currentParent(): StepWithChildSpans | undefined {
    const stack = this.getParentStack();
    return stack.length > 0 ? stack[stack.length - 1] : undefined;
  }

  /**
   * Get the previous parent (second-to-last item in the parent stack).
   * @returns The previous parent span or trace, or undefined if less than 2 items in the stack.
   */
  previousParent(): StepWithChildSpans | undefined {
    const stack = this.getParentStack();
    return stack.length > 1 ? stack[stack.length - 2] : undefined;
  }

  /**
   * Check if there is an active trace.
   * @returns True if there is a current parent (trace or span), false otherwise.
   */
  hasActiveTrace(): boolean {
    if (this.mode === 'streaming' && (this.traceId || this.spanId)) {
      return true;
    }
    return this.currentParent() !== undefined;
  }

  /**
   * Gets the current session ID.
   * @returns The current session ID, or undefined if no session is active.
   */
  currentSessionId(): string | undefined {
    return this.sessionId;
  }

  // ============================================
  // IGalileoLoggerSession Implementation
  // ============================================

  /**
   * Starts a session in the active logger instance. If an externalId is provided, searches for an existing session with that external ID and reuses it if found.
   * @param options - Configuration for the session.
   * @param options.name - (Optional) The name of the session.
   * @param options.previousSessionId - (Optional) The ID of a previous session to link to.
   * @param options.externalId - (Optional) An external identifier for the session. If a session with this external ID already exists, it will be reused instead of creating a new session.
   * @returns A promise that resolves to the ID of the session (either newly created or existing).
   */
  async startSession(
    options: {
      name?: string;
      previousSessionId?: string;
      externalId?: string;
    } = {}
  ): Promise<string> {
    await this.client.init({
      projectName: this.projectName,
      logStreamName: this.logStreamName,
      experimentId: this.experimentId
    });

    // If externalId is provided, search for existing session
    if (options.externalId && options.externalId.trim() !== '') {
      try {
        const searchRequestFilter: LogRecordsQueryRequest = {
          filters: [
            {
              columnId: 'external_id',
              operator: 'eq',
              value: options.externalId,
              type: 'id'
            }
          ],
          limit: 1
        };
        const searchResult =
          await this.client.searchSessions(searchRequestFilter);

        if (searchResult.records && searchResult.records.length > 0) {
          const existingSessionId = searchResult.records[0].id;
          this.sessionId = existingSessionId;
          return existingSessionId;
        }
      } catch (_error) {
        console.info(
          'No session found with external ID provided, continuing to create new session'
        );
      }
    }

    // Create new session if no externalId or not found
    const session = await this.client.createSessionLegacy({
      name: options.name,
      previousSessionId: options.previousSessionId,
      externalId: options.externalId
    });

    this.sessionId = session.id;
    return session.id;
  }

  /**
   * Sets the session ID for the logger.
   * @param sessionId - The session ID to set.
   */
  setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
  }

  /**
   * Clears the current session ID.
   */
  clearSession(): void {
    this.sessionId = undefined;
  }

  // ============================================
  // IGalileoLoggerTrace Implementation
  // ============================================

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
  }): Trace {
    if (this.currentParent() !== undefined) {
      throw new Error(
        'You must conclude the existing trace before adding a new one.'
      );
    }

    const trace = new Trace({
      input: options.input,
      redactedInput: options.redactedInput,
      output: options.output,
      redactedOutput: options.redactedOutput,
      name: options.name,
      createdAt: options.createdAt || GalileoApiClient.getTimestampRecord(),
      metadata: options.metadata,
      tags: options.tags,
      metrics: new Metrics({ durationNs: options.durationNs }),
      datasetInput: options.datasetInput,
      datasetOutput: options.datasetOutput,
      datasetMetadata: options.datasetMetadata,
      externalId: options.externalId
    });

    this.traces.push(trace);
    const stack = this.getParentStack();
    stack.push(trace);
    this.setParentStack(stack);

    // In streaming mode, ingest trace immediately
    if (this.mode === 'streaming') {
      this.ingestTraceStreaming(trace, false);
    }

    return trace;
  }

  /**
   * Create a new trace with a single LLM span. This is a convenience method that combines trace creation
   * and LLM span creation in one call. The trace is automatically concluded, so no need to call conclude().
   * @param options - Configuration for the single LLM span trace. All parameters are optional except `input` and `output`.
   * @param options.input - The input content for the LLM span.
   * @param options.redactedInput - (Optional) Redacted version of the input content.
   * @param options.output - The output content from the LLM span.
   * @param options.redactedOutput - (Optional) Redacted version of the output content.
   * @param options.model - (Optional) The name or identifier of the LLM model used (e.g., 'gpt-4o', 'claude-3-sonnet').
   * @param options.tools - (Optional) Array of tool definitions. Expected format: Array<{ type: 'function', function: { name: string, description?: string, parameters?: object } }>.
   * @param options.name - (Optional) Name for the span.
   * @param options.createdAt - (Optional) The timestamp when the span was created.
   * @param options.durationNs - (Optional) Duration of the span in nanoseconds.
   * @param options.metadata - (Optional) Additional metadata as key-value pairs.
   * @param options.tags - (Optional) Array of tags to categorize the span.
   * @param options.numInputTokens - (Optional) Number of tokens in the input.
   * @param options.numOutputTokens - (Optional) Number of tokens in the output.
   * @param options.totalTokens - (Optional) Total number of tokens used (input + output).
   * @param options.temperature - (Optional) The temperature parameter used for the LLM (typically 0.0-2.0).
   * @param options.statusCode - (Optional) HTTP status code or execution status (e.g., 200 for success).
   * @param options.spanStepNumber - (Optional) The step number for the span in a multi-step process.
   * @param options.timeToFirstTokenNs - (Optional) Time to first token in nanoseconds (for streaming).
   * @param options.datasetInput - (Optional) Input data for dataset evaluation.
   * @param options.datasetOutput - (Optional) Expected output for dataset evaluation.
   * @param options.datasetMetadata - (Optional) Metadata for dataset evaluation.
   * @param options.events - (Optional) Array of events associated with the span.
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
  }): Trace {
    if (this.currentParent() !== undefined) {
      throw new Error(
        'A trace cannot be created within a parent trace or span, it must always be the root. You must conclude the existing trace before adding a new one.'
      );
    }

    const trace = new Trace({
      input: toStringValue(options.input),
      redactedInput: options.redactedInput
        ? toStringValue(options.redactedInput)
        : undefined,
      output: toStringValue(options.output),
      redactedOutput: options.redactedOutput
        ? toStringValue(options.redactedOutput)
        : undefined,
      name: options.name,
      metadata: options.metadata,
      tags: options.tags,
      datasetInput: options.datasetInput,
      datasetOutput: options.datasetOutput,
      datasetMetadata: options.datasetMetadata
    });

    trace.addChildSpan(
      new LlmSpan({
        name: options.name,
        createdAt: options.createdAt || GalileoApiClient.getTimestampRecord(),
        metadata: options.metadata,
        tags: options.tags,
        input: options.input,
        redactedInput: options.redactedInput,
        output: options.output,
        redactedOutput: options.redactedOutput,
        metrics: new LlmMetrics({
          durationNs: options.durationNs,
          numInputTokens: options.numInputTokens,
          numOutputTokens: options.numOutputTokens,
          numTotalTokens: options.totalTokens,
          timeToFirstTokenNs: options.timeToFirstTokenNs
        }),
        tools: options.tools,
        model: options.model,
        temperature: options.temperature,
        statusCode: options.statusCode,
        stepNumber: options.spanStepNumber,
        datasetInput: options.datasetInput,
        datasetOutput: options.datasetOutput,
        datasetMetadata: options.datasetMetadata,
        events: options.events
      })
    );

    this.traces.push(trace);
    // Single span traces are automatically concluded so we reset the current parent.
    this.setParentStack([]);

    // In streaming mode, ingest trace immediately as complete
    if (this.mode === 'streaming') {
      this.ingestTraceStreaming(trace, true);
    }

    return trace;
  }

  /**
   * Create a new trace with a single retriever span. This is a convenience method that combines trace creation
   * and retriever span creation in one call. The trace is automatically concluded, so no need to call conclude().
   * @param options - Configuration for the single retriever span trace. All parameters are optional except `input` and `output`.
   * @param options.input - The input query for the retriever span.
   * @param options.redactedInput - (Optional) Redacted version of the input query.
   * @param options.output - The output documents or results from the retriever span.
   * @param options.redactedOutput - (Optional) Redacted version of the output.
   * @param options.name - (Optional) Name for the span.
   * @param options.createdAt - (Optional) The timestamp when the span was created.
   * @param options.durationNs - (Optional) Duration of the span in nanoseconds.
   * @param options.metadata - (Optional) Additional metadata as key-value pairs.
   * @param options.tags - (Optional) Array of tags to categorize the span.
   * @param options.statusCode - (Optional) HTTP status code or execution status (e.g., 200 for success).
   * @param options.spanStepNumber - (Optional) The step number for the span in a multi-step process.
   * @param options.datasetInput - (Optional) Input data for dataset evaluation.
   * @param options.datasetOutput - (Optional) Expected output for dataset evaluation.
   * @param options.datasetMetadata - (Optional) Metadata for dataset evaluation.
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
  }): Trace {
    if (this.currentParent() !== undefined) {
      throw new Error(
        'A trace cannot be created within a parent trace or span, it must always be the root. You must conclude the existing trace before adding a new one.'
      );
    }

    const trace = new Trace({
      input: toStringValue(options.input),
      redactedInput: options.redactedInput,
      output: toStringValue(options.output),
      redactedOutput: options.redactedOutput
        ? toStringValue(options.redactedOutput)
        : undefined,
      name: options.name,
      metadata: options.metadata,
      tags: options.tags,
      datasetInput: options.datasetInput,
      datasetOutput: options.datasetOutput,
      datasetMetadata: options.datasetMetadata
    });

    trace.addChildSpan(
      new RetrieverSpan({
        name: options.name,
        createdAt: options.createdAt || GalileoApiClient.getTimestampRecord(),
        metadata: options.metadata,
        tags: options.tags,
        input: options.input,
        redactedInput: options.redactedInput,
        output: options.output,
        redactedOutput: options.redactedOutput,
        statusCode: options.statusCode,
        metrics: new Metrics({ durationNs: options.durationNs }),
        stepNumber: options.spanStepNumber,
        datasetInput: options.datasetInput,
        datasetOutput: options.datasetOutput,
        datasetMetadata: options.datasetMetadata
      })
    );

    this.traces.push(trace);
    // Single span traces are automatically concluded so we reset the current parent.
    this.setParentStack([]);

    // In streaming mode, ingest trace immediately as complete
    if (this.mode === 'streaming') {
      this.ingestTraceStreaming(trace, true);
    }

    return trace;
  }

  /**
   * Create a new trace with a single tool span. This is a convenience method that combines trace creation
   * and tool span creation in one call. The trace is automatically concluded, so no need to call conclude().
   * @param options - Configuration for the single tool span trace. Only `input` is required.
   * @param options.input - The input parameters for the tool span.
   * @param options.redactedInput - (Optional) Redacted version of the input.
   * @param options.output - (Optional) The output result from the tool span.
   * @param options.redactedOutput - (Optional) Redacted version of the output.
   * @param options.name - (Optional) Name for the span (e.g., the tool name or function name).
   * @param options.createdAt - (Optional) The timestamp when the span was created.
   * @param options.durationNs - (Optional) Duration of the span in nanoseconds.
   * @param options.metadata - (Optional) Additional metadata as key-value pairs.
   * @param options.tags - (Optional) Array of tags to categorize the span.
   * @param options.statusCode - (Optional) HTTP status code or execution status (e.g., 200 for success).
   * @param options.toolCallId - (Optional) Unique identifier for the tool call.
   * @param options.spanStepNumber - (Optional) The step number for the span in a multi-step process.
   * @param options.datasetInput - (Optional) Input data for dataset evaluation.
   * @param options.datasetOutput - (Optional) Expected output for dataset evaluation.
   * @param options.datasetMetadata - (Optional) Metadata for dataset evaluation.
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
  }): Trace {
    if (this.currentParent() !== undefined) {
      throw new Error(
        'A trace cannot be created within a parent trace or span, it must always be the root. You must conclude the existing trace before adding a new one.'
      );
    }

    const trace = new Trace({
      input: toStringValue(options.input),
      redactedInput: options.redactedInput,
      output: options.output || '',
      redactedOutput: options.redactedOutput,
      name: options.name,
      metadata: options.metadata,
      tags: options.tags,
      datasetInput: options.datasetInput,
      datasetOutput: options.datasetOutput,
      datasetMetadata: options.datasetMetadata
    });

    trace.addChildSpan(
      new ToolSpan({
        name: options.name,
        createdAt: options.createdAt || GalileoApiClient.getTimestampRecord(),
        metadata: options.metadata,
        tags: options.tags,
        input: options.input,
        redactedInput: options.redactedInput,
        output: options.output,
        redactedOutput: options.redactedOutput,
        statusCode: options.statusCode,
        toolCallId: options.toolCallId,
        metrics: new Metrics({ durationNs: options.durationNs }),
        stepNumber: options.spanStepNumber,
        datasetInput: options.datasetInput,
        datasetOutput: options.datasetOutput,
        datasetMetadata: options.datasetMetadata
      })
    );

    this.traces.push(trace);
    // Single span traces are automatically concluded so we reset the current parent.
    this.setParentStack([]);

    // In streaming mode, ingest trace immediately as complete
    if (this.mode === 'streaming') {
      this.ingestTraceStreaming(trace, true);
    }

    return trace;
  }

  /**
   * Create a new trace with a single workflow span. This is a convenience method that combines trace creation
   * and workflow span creation in one call. The trace is automatically concluded, so no need to call conclude().
   * @param options - Configuration for the single workflow span trace. Only `input` is required.
   * @param options.input - The input content for the workflow span.
   * @param options.redactedInput - (Optional) Redacted version of the input.
   * @param options.output - (Optional) The output result from the workflow span.
   * @param options.redactedOutput - (Optional) Redacted version of the output.
   * @param options.name - (Optional) Name for the span.
   * @param options.createdAt - (Optional) The timestamp when the span was created.
   * @param options.durationNs - (Optional) Duration of the span in nanoseconds.
   * @param options.metadata - (Optional) Additional metadata as key-value pairs.
   * @param options.tags - (Optional) Array of tags to categorize the span.
   * @param options.spanStepNumber - (Optional) The step number for the span in a multi-step process.
   * @param options.datasetInput - (Optional) Input data for dataset evaluation.
   * @param options.datasetOutput - (Optional) Expected output for dataset evaluation.
   * @param options.datasetMetadata - (Optional) Metadata for dataset evaluation.
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
  }): Trace {
    if (this.currentParent() !== undefined) {
      throw new Error(
        'A trace cannot be created within a parent trace or span, it must always be the root. You must conclude the existing trace before adding a new one.'
      );
    }

    const trace = new Trace({
      input: toStringValue(options.input),
      redactedInput: options.redactedInput,
      output: options.output || '',
      redactedOutput: options.redactedOutput,
      name: options.name,
      metadata: options.metadata,
      tags: options.tags,
      datasetInput: options.datasetInput,
      datasetOutput: options.datasetOutput,
      datasetMetadata: options.datasetMetadata
    });

    trace.addChildSpan(
      new WorkflowSpan({
        name: options.name,
        createdAt: options.createdAt || GalileoApiClient.getTimestampRecord(),
        metadata: options.metadata,
        tags: options.tags,
        input: options.input,
        redactedInput: options.redactedInput,
        output: options.output,
        redactedOutput: options.redactedOutput,
        metrics: new Metrics({ durationNs: options.durationNs }),
        stepNumber: options.spanStepNumber,
        datasetInput: options.datasetInput,
        datasetOutput: options.datasetOutput,
        datasetMetadata: options.datasetMetadata
      })
    );

    this.traces.push(trace);
    // Single span traces are automatically concluded so we reset the current parent.
    this.setParentStack([]);

    // In streaming mode, ingest trace immediately as complete
    if (this.mode === 'streaming') {
      this.ingestTraceStreaming(trace, true);
    }

    return trace;
  }

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
  conclude({
    output,
    redactedOutput,
    durationNs,
    statusCode,
    concludeAll
  }: {
    output?: string;
    redactedOutput?: string;
    durationNs?: number;
    statusCode?: number;
    concludeAll?: boolean;
  }): StepWithChildSpans | undefined {
    if (!concludeAll) {
      return this.concludeCurrentParent({
        output,
        redactedOutput,
        durationNs,
        statusCode
      });
    }
    let currentParent: StepWithChildSpans | undefined = undefined;
    while (this.currentParent() !== undefined) {
      currentParent = this.concludeCurrentParent({
        output,
        redactedOutput,
        durationNs,
        statusCode
      });
    }
    return currentParent;
  }

  // ============================================
  // IGalileoLoggerSpan Implementation
  // ============================================

  /**
   * Add a child span to the current parent (trace or workflow/agent span).
   * This method automatically propagates dataset information from the parent to the child span.
   * @param span - The span to add as a child to the current parent.
   * @throws Error if no trace or parent span exists.
   */
  addChildSpanToParent(span: Span): void {
    const currentParent = this.currentParent();
    if (currentParent === undefined) {
      throw new Error('A trace needs to be created in order to add a span.');
    }
    span.datasetInput = currentParent.datasetInput;
    span.datasetOutput = currentParent.datasetOutput;
    span.datasetMetadata = currentParent.datasetMetadata;
    currentParent.addChildSpan(span);
  }

  /**
   * Add a new LLM span to the current parent.
   * @param options - Configuration for the LLM span. All parameters are optional except `input` and `output`.
   * @param options.input - The input content for the LLM span. Accepts string, Message, or arrays of these.
   * @param options.redactedInput - (Optional) Redacted version of the input content.
   * @param options.output - The output content from the LLM span. Accepts string, Message, or arrays of these.
   * @param options.redactedOutput - (Optional) Redacted version of the output content.
   * @param options.model - (Optional) The name or identifier of the LLM model used (e.g., 'gpt-4o', 'claude-3-sonnet').
   * @param options.tools - (Optional) Array of tool definitions available to the LLM.
   * @param options.name - (Optional) Name for the span.
   * @param options.createdAt - (Optional) The timestamp when the span was created. Defaults to current time if not provided.
   * @param options.durationNs - (Optional) Duration of the span in nanoseconds.
   * @param options.metadata - (Optional) Additional metadata as key-value pairs.
   * @param options.tags - (Optional) Array of tags to categorize the span.
   * @param options.numInputTokens - (Optional) Number of tokens in the input.
   * @param options.numOutputTokens - (Optional) Number of tokens in the output.
   * @param options.totalTokens - (Optional) Total number of tokens used (input + output).
   * @param options.timeToFirstTokenNs - (Optional) Time to first token in nanoseconds (for streaming responses).
   * @param options.temperature - (Optional) The temperature parameter used for the LLM (typically 0.0-2.0).
   * @param options.statusCode - (Optional) HTTP status code or execution status (e.g., 200 for success).
   * @param options.stepNumber - (Optional) The step number in a multi-step process.
   * @param options.events - (Optional) Array of events associated with the span.
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
  }): LlmSpan {
    const span = new LlmSpan({
      input: options.input,
      redactedInput: options.redactedInput,
      output: options.output,
      redactedOutput: options.redactedOutput,
      model: options.model,
      tools: options.tools,
      name: options.name,
      createdAt: options.createdAt || GalileoApiClient.getTimestampRecord(),
      metadata: options.metadata,
      tags: options.tags,
      metrics: new LlmMetrics({
        durationNs: options.durationNs,
        numInputTokens: options.numInputTokens,
        numOutputTokens: options.numOutputTokens,
        numTotalTokens: options.totalTokens,
        timeToFirstTokenNs: options.timeToFirstTokenNs
      }),
      temperature: options.temperature,
      statusCode: options.statusCode,
      stepNumber: options.stepNumber,
      events: options.events
    });

    this.addChildSpanToParent(span);

    // In streaming mode, ingest span immediately
    if (this.mode === 'streaming') {
      this.ingestSpanStreaming(span);
    }

    return span;
  }

  /**
   * Add a new retriever span to the current parent.
   * @param options - Configuration for the retriever span. All parameters are optional except `input` and `output`.
   * @param options.input - The input query for the retriever.
   * @param options.redactedInput - (Optional) Redacted version of the input query.
   * @param options.output - The output documents or results. Accepts string, Record<string, string>, Document, or arrays of these. Document has properties: { content: string, metadata?: Record<string, string | number | boolean> }.
   * @param options.redactedOutput - (Optional) Redacted version of the output.
   * @param options.name - (Optional) Name for the span.
   * @param options.durationNs - (Optional) Duration of the span in nanoseconds.
   * @param options.createdAt - (Optional) The timestamp when the span was created.
   * @param options.metadata - (Optional) Additional metadata as key-value pairs.
   * @param options.tags - (Optional) Array of tags to categorize the span.
   * @param options.statusCode - (Optional) HTTP status code or execution status (e.g., 200 for success).
   * @param options.stepNumber - (Optional) The step number in a multi-step process.
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
  }): RetrieverSpan {
    const span = new RetrieverSpan({
      input: options.input,
      redactedInput: options.redactedInput,
      output: options.output,
      redactedOutput: options.redactedOutput,
      name: options.name,
      createdAt: options.createdAt || GalileoApiClient.getTimestampRecord(),
      metadata: options.metadata,
      tags: options.tags,
      statusCode: options.statusCode,
      metrics: new Metrics({ durationNs: options.durationNs }),
      stepNumber: options.stepNumber
    });

    this.addChildSpanToParent(span);

    // In streaming mode, ingest span immediately
    if (this.mode === 'streaming') {
      this.ingestSpanStreaming(span);
    }

    return span;
  }

  /**
   * Add a new tool span to the current parent.
   * @param options - Configuration for the tool span. Only `input` is required.
   * @param options.input - The input parameters for the tool.
   * @param options.redactedInput - (Optional) Redacted version of the input.
   * @param options.output - (Optional) The output result from the tool.
   * @param options.redactedOutput - (Optional) Redacted version of the output.
   * @param options.name - (Optional) Name for the span (e.g., the tool name or function name).
   * @param options.durationNs - (Optional) Duration of the span in nanoseconds.
   * @param options.createdAt - (Optional) The timestamp when the span was created.
   * @param options.metadata - (Optional) Additional metadata as key-value pairs.
   * @param options.tags - (Optional) Array of tags to categorize the span.
   * @param options.statusCode - (Optional) HTTP status code or execution status (e.g., 200 for success).
   * @param options.toolCallId - (Optional) Unique identifier for the tool call, typically from LLM tool_calls (e.g., 'call_abc123').
   * @param options.stepNumber - (Optional) The step number in a multi-step process.
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
  }): ToolSpan {
    const span = new ToolSpan({
      input: options.input,
      redactedInput: options.redactedInput,
      output: options.output,
      redactedOutput: options.redactedOutput,
      name: options.name,
      createdAt: options.createdAt || GalileoApiClient.getTimestampRecord(),
      metadata: options.metadata,
      tags: options.tags,
      statusCode: options.statusCode,
      toolCallId: options.toolCallId,
      metrics: new Metrics({ durationNs: options.durationNs }),
      stepNumber: options.stepNumber
    });

    this.addChildSpanToParent(span);

    // In streaming mode, ingest span immediately
    if (this.mode === 'streaming') {
      this.ingestSpanStreaming(span);
    }

    return span;
  }

  /**
   * Add a new Protect tool span to the current parent.
   * This is a specialized method for logging Galileo Protect tool spans.
   * @param options - Configuration for the Protect span.
   * @param options.payload - Input to the Protect invoke method. Payload object with input and/or output attributes.
   * @param options.redactedPayload - (Optional) Redacted version of the payload.
   * @param options.response - (Optional) Output from the Protect invoke method. Response object with text, traceMetadata, and status.
   * @param options.redactedResponse - (Optional) Redacted version of the response.
   * @param options.createdAt - (Optional) The timestamp when the span was created.
   * @param options.metadata - (Optional) Additional metadata as key-value pairs.
   * @param options.tags - (Optional) Array of tags to categorize the span.
   * @param options.statusCode - (Optional) HTTP status code or execution status (e.g., 200 for success).
   * @param options.stepNumber - (Optional) The step number in a multi-step process.
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
  }): ToolSpan {
    // Serialize payload to JSON string for input
    const input = toStringValue(options.payload);
    const redactedInput = options.redactedPayload
      ? toStringValue(options.redactedPayload)
      : undefined;

    // Serialize response to JSON string for output
    const output = options.response
      ? toStringValue(options.response)
      : undefined;
    const redactedOutput = options.redactedResponse
      ? toStringValue(options.redactedResponse)
      : undefined;

    // Calculate duration from response metadata if available
    // Duration is responseAt - receivedAt (both in nanoseconds)
    let durationNs: number | undefined;
    if (options.response?.traceMetadata) {
      const receivedAt = options.response.traceMetadata.receivedAt;
      const responseAt = options.response.traceMetadata.responseAt;
      if (receivedAt !== undefined && responseAt !== undefined) {
        durationNs = responseAt - receivedAt;
      }
    }

    const span = new ToolSpan({
      input,
      redactedInput,
      output,
      redactedOutput,
      name: 'GalileoProtect',
      createdAt: options.createdAt || GalileoApiClient.getTimestampRecord(),
      metadata: options.metadata,
      tags: options.tags,
      statusCode: options.statusCode,
      metrics: new Metrics({ durationNs }),
      stepNumber: options.stepNumber
    });

    this.addChildSpanToParent(span);

    // In streaming mode, ingest span immediately
    if (this.mode === 'streaming') {
      this.ingestSpanStreaming(span);
    }

    return span;
  }

  /**
   * Add a workflow span to the current parent. This is useful when you want to create a nested workflow span
   * within the trace or current workflow span. The next span you add will be a child of the current parent. To
   * move out of the nested workflow, use conclude().
   * @param options - Configuration for the workflow span. Only `input` is required. This creates a parent span that can contain child spans.
   * @param options.input - The input content for the workflow.
   * @param options.redactedInput - (Optional) Redacted version of the input.
   * @param options.output - (Optional) The output result from the workflow.
   * @param options.redactedOutput - (Optional) Redacted version of the output.
   * @param options.name - (Optional) Name for the span (e.g., 'Data Processing Workflow').
   * @param options.durationNs - (Optional) Duration of the span in nanoseconds.
   * @param options.createdAt - (Optional) The timestamp when the span was created.
   * @param options.metadata - (Optional) Additional metadata as key-value pairs.
   * @param options.tags - (Optional) Array of tags to categorize the span.
   * @param options.stepNumber - (Optional) The step number in a multi-step process.
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
  }): WorkflowSpan {
    const span = new WorkflowSpan({
      input: options.input,
      redactedInput: options.redactedInput,
      output: options.output,
      redactedOutput: options.redactedOutput,
      name: options.name,
      createdAt: options.createdAt || GalileoApiClient.getTimestampRecord(),
      metadata: options.metadata,
      tags: options.tags,
      metrics: new Metrics({ durationNs: options.durationNs }),
      stepNumber: options.stepNumber
    });

    this.addChildSpanToParent(span);
    const stack = this.getParentStack();
    stack.push(span);
    this.setParentStack(stack);

    // In streaming mode, ingest span immediately
    if (this.mode === 'streaming') {
      this.ingestSpanStreaming(span);
    }

    return span;
  }

  /**
   * Add an agent span to the current parent. Agent spans can contain child spans (like workflow spans).
   * @param options - Configuration for the agent span. Only `input` is required. This creates a parent span that can contain child spans.
   * @param options.input - The input content for the agent.
   * @param options.redactedInput - (Optional) Redacted version of the input.
   * @param options.output - (Optional) The output result from the agent.
   * @param options.redactedOutput - (Optional) Redacted version of the output.
   * @param options.name - (Optional) Name for the span (e.g., 'Planning Agent', 'Router Agent').
   * @param options.durationNs - (Optional) Duration of the span in nanoseconds.
   * @param options.createdAt - (Optional) The timestamp when the span was created.
   * @param options.metadata - (Optional) Additional metadata as key-value pairs.
   * @param options.tags - (Optional) Array of tags to categorize the span.
   * @param options.agentType - (Optional) The type of agent. One of: 'default', 'planner', 'react', 'reflection', 'router', 'classifier', 'supervisor', 'judge'. Defaults to 'default'.
   * @param options.stepNumber - (Optional) The step number in a multi-step process.
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
  }): AgentSpan {
    const span = new AgentSpan({
      input: options.input,
      redactedInput: options.redactedInput,
      output: options.output,
      redactedOutput: options.redactedOutput,
      name: options.name,
      createdAt: options.createdAt || GalileoApiClient.getTimestampRecord(),
      metadata: options.metadata,
      tags: options.tags,
      metrics: new Metrics({ durationNs: options.durationNs }),
      agentType: options.agentType,
      stepNumber: options.stepNumber
    });

    this.addChildSpanToParent(span);
    const stack = this.getParentStack();
    stack.push(span);
    this.setParentStack(stack);

    // In streaming mode, ingest span immediately
    if (this.mode === 'streaming') {
      this.ingestSpanStreaming(span);
    }

    return span;
  }

  // ============================================
  // IGalileoLoggerBatch Implementation
  // ============================================

  /**
   * Flushes all traces to the server. Concludes any active traces before flushing.
   * @returns A promise that resolves to an array of flushed traces.
   */
  async flush(): Promise<Trace[]> {
    try {
      if (this.mode === 'streaming') {
        console.warn(
          'Flushing in streaming mode is not supported. Traces are automatically ingested as they are created.'
        );
        return [];
      }

      if (!this.traces.length) {
        console.warn('No traces to flush.');
        return [];
      }

      const currentParent = this.currentParent();
      if (currentParent !== undefined) {
        console.info('Concluding the active trace...');
        const lastOutputs = GalileoLogger.getLastOutput(currentParent);
        this.conclude({
          output: lastOutputs?.output,
          redactedOutput: lastOutputs?.redactedOutput,
          concludeAll: true
        });
      }

      await this.client.init({
        projectName: this.projectName,
        projectId: this.projectId,
        logStreamName: this.logStreamName,
        logStreamId: this.logStreamId,
        experimentId: this.experimentId,
        sessionId: this.sessionId
      });

      // Compute local metrics if configured
      if (this.localMetrics && this.localMetrics.length > 0) {
        console.info('Computing metrics for local scorers...');
        for (const trace of this.traces) {
          populateLocalMetrics(trace, this.localMetrics);
        }
      }

      console.info(`Flushing ${this.traces.length} traces...`);
      const loggedTraces = [...this.traces];

      // Create TracesIngestRequest - convert traces to JSON format.
      const tracesIngestRequest = {
        traces: loggedTraces.map((trace) => trace.toJSON() as TraceSchema),
        sessionId: this.sessionId || null,
        experimentId: this.experimentId || null,
        logStreamId: this.logStreamId || this.client.logStreamId || null,
        isComplete: true
      } as LogTracesIngestRequest;

      // Call ingestion hook if provided
      if (this.ingestionHook) {
        const hookResult = this.ingestionHook(tracesIngestRequest);
        if (hookResult instanceof Promise) {
          await hookResult;
        }
      } else {
        // Use the new ingestTraces method
        await this.client.ingestTraces(tracesIngestRequest);
      }

      console.info(`Successfully flushed ${loggedTraces.length} traces.`);
      this.traces = []; // Clear after uploading
      this.setParentStack([]);
      return loggedTraces;
    } catch (error) {
      console.error(error);
      return [];
    }
  }

  /**
   * Terminates the logger. In batch mode, flushes all traces. In streaming mode, waits for all tasks to complete.
   * @returns A promise that resolves when termination is complete.
   */
  async terminate(): Promise<void> {
    try {
      if (this.mode !== 'streaming') {
        await this.flush();
      } else {
        // Wait for tasks to complete
        if (this.taskHandler) {
          const timeoutSeconds = 5;
          const startWait = Date.now();

          while (!this.taskHandler.allTasksCompleted()) {
            if (Date.now() - startWait > timeoutSeconds * 1000) {
              console.warn(
                'Terminate timeout reached. Some requests may not have completed.'
              );
              break;
            }
            // Use a small delay to avoid blocking
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          if (this.taskHandler.allTasksCompleted()) {
            console.info('All requests are complete.');
          }

          this.taskHandler.terminate();
        }
        console.info('Terminating logger in streaming mode.');
      }
    } catch (error) {
      console.error('Error in terminate():', error);
      throw error;
    }
  }

  private initializeProperties(config: GalileoLoggerConfig): void {
    this.projectName = config.projectName;
    this.logStreamName = config.logStreamName;
    this.experimentId = config.experimentId;
    this.sessionId = config.sessionId;
    this.localMetrics = config.localMetrics;
    this.projectId = config.projectId;
    this.logStreamId = config.logStreamId;
    this.ingestionHook = config.ingestionHook;

    this.mode = config.mode || config.experimental?.mode || 'batch';
  }

  private validateConfiguration(): void {
    if (this.ingestionHook && this.mode !== 'batch') {
      throw new Error(
        'ingestionHook is intended for batch mode; using it with a non-batch mode may lead to unexpected behavior.'
      );
    }
  }

  private initializeLoggerState(): void {
    // Initialize task handler for streaming mode
    if (this.mode === 'streaming') {
      this.taskHandler = new TaskHandler();
    }
    try {
      // Logging is disabled if GALILEO_DISABLE_LOGGING is defined, is not an empty string, and not set to '0' or 'false'
      const disableLoggingValue =
        process?.env?.GALILEO_DISABLE_LOGGING?.trim() ?? undefined;

      this.loggingDisabled = !['', '0', 'false'].includes(
        disableLoggingValue?.toLowerCase() ?? ''
      );
    } catch (error) {
      console.error(
        'Error checking if logging is disabled; GALILEO_DISABLE_LOGGING environment variable is not set correctly:',
        error
      );
      this.loggingDisabled = false;
    }
  }

  private wrapMethodsForDisabledLogging(): void {
    const emptySpanData = {
      input: '',
      redactedInput: undefined,
      output: '',
      redactedOutput: undefined
    };

    this.addChildSpanToParent = skipIfDisabled(
      this.addChildSpanToParent,
      () => undefined
    );

    this.startTrace = skipIfDisabled(
      this.startTrace,
      () => new Trace(emptySpanData)
    );

    this.addSingleLlmSpanTrace = skipIfDisabled(
      this.addSingleLlmSpanTrace,
      () => new Trace(emptySpanData)
    );

    this.addSingleRetrieverSpanTrace = skipIfDisabled(
      this.addSingleRetrieverSpanTrace,
      () => new Trace(emptySpanData)
    );

    this.addSingleToolSpanTrace = skipIfDisabled(
      this.addSingleToolSpanTrace,
      () => new Trace(emptySpanData)
    );

    this.addSingleWorkflowSpanTrace = skipIfDisabled(
      this.addSingleWorkflowSpanTrace,
      () => new Trace(emptySpanData)
    );

    this.addLlmSpan = skipIfDisabled(
      this.addLlmSpan,
      () => new LlmSpan(emptySpanData)
    );

    this.addRetrieverSpan = skipIfDisabled(
      this.addRetrieverSpan,
      () => new RetrieverSpan(emptySpanData)
    );

    this.addToolSpan = skipIfDisabled(
      this.addToolSpan,
      () => new ToolSpan(emptySpanData)
    );

    this.addProtectSpan = skipIfDisabled(
      this.addProtectSpan,
      () => new ToolSpan(emptySpanData)
    );

    this.addWorkflowSpan = skipIfDisabled(
      this.addWorkflowSpan,
      () => new WorkflowSpan(emptySpanData)
    );

    this.addAgentSpan = skipIfDisabled(
      this.addAgentSpan,
      () => new AgentSpan(emptySpanData)
    );

    this.conclude = skipIfDisabled(this.conclude, () => undefined);
    this.flush = skipIfDisabledAsync(this.flush, () => []);
    this.terminate = skipIfDisabledAsync(this.terminate, () => undefined);
    this.startSession = skipIfDisabledAsync(this.startSession, () => '');
    this.clearSession = skipIfDisabled(this.clearSession, () => undefined);
    this.initTrace = skipIfDisabledAsync(this.initTrace, () => undefined);
    this.initSpan = skipIfDisabledAsync(this.initSpan, () => undefined);
  }

  private registerCleanupHandlers(): void {
    process.on('beforeExit', async () => {
      if (this.isTerminating) return;
      this.isTerminating = true;

      await this.terminate();
    });
  }

  /**
   * Initializes a trace from the API using the provided traceId. Fetches the trace and adds it to the traces array and parent stack.
   * @param traceId - The ID of the trace to initialize.
   * @param addToParentStack - (Optional) Whether to add the trace to the parent stack. Defaults to true.
   */
  private async initTrace(
    traceId: string,
    addToParentStack: boolean = true
  ): Promise<void> {
    const currentTraceId = this.traceId;
    let localTrace: Trace | undefined;
    try {
      await this.ensureClientInitialized();

      const traceObj = await this.client.getTrace(traceId);
      if (!traceObj) {
        throw new Error(`Trace ${traceId} not found`);
      }

      localTrace = new Trace({
        input: traceObj.input || '',
        redactedInput: traceObj.redactedInput || undefined,
        output: traceObj.output || undefined,
        redactedOutput: traceObj.redactedOutput || undefined,
        name: traceObj.name,
        createdAt: traceObj.createdAt
          ? new Date(traceObj.createdAt)
          : undefined,
        metadata: traceObj.userMetadata,
        tags: traceObj.tags,
        statusCode: traceObj.statusCode || undefined,
        metrics: traceObj.metrics
          ? new Metrics(traceObj.metrics as MetricsOptions)
          : undefined,
        externalId: traceObj.externalId || undefined,
        datasetInput: traceObj.datasetInput || undefined,
        datasetOutput: traceObj.datasetOutput || undefined,
        datasetMetadata: traceObj.datasetMetadata || undefined,
        id: traceObj.id
      });

      // Clear spans array
      localTrace.spans = [];
      this.traces.push(localTrace);
      if (addToParentStack) {
        const stack = this.getParentStack();
        stack.push(localTrace);
        this.setParentStack(stack);
      }
      this.traceId = traceId;
    } catch (error) {
      this.traceId = currentTraceId;
      if (localTrace) {
        // Remove last item if it's the one we just pushed
        if (
          this.traces.length > 0 &&
          this.traces[this.traces.length - 1] === localTrace
        ) {
          this.traces.pop();
        }
        // Undo pushing to stack as well
        const stack = this.getParentStack();
        if (stack.length > 0 && stack[stack.length - 1] === localTrace) {
          stack.pop();
          this.setParentStack(stack);
        }
      }

      throw error;
    }
  }

  /**
   * Initialize a span from the API using the provided spanId.
   * Fetches the span, validates it belongs to the trace, and adds it to the parent stack.
   * Only workflow and agent spans can be initialized.
   */
  private async initSpan(spanId: string): Promise<void> {
    const currentSpanId = this.spanId;
    let localSpan: WorkflowSpan | AgentSpan | undefined;
    try {
      await this.ensureClientInitialized();

      const spanObj = await this.client.getSpan(spanId);
      if (!spanObj) {
        throw new Error(`Span ${this.spanId} not found`);
      }

      // Validate span belongs to trace if traceId is set
      const spanTraceId = spanObj.traceId;
      if (this.traceId && spanTraceId && spanTraceId !== this.traceId) {
        throw new Error(
          `Span ${this.spanId} does not belong to trace ${this.traceId}`
        );
      }

      // Only workflow and agent spans can be initialized
      const spanType = spanObj.type;
      if (spanType !== 'workflow' && spanType !== 'agent') {
        throw new Error(
          `Only 'workflow' and 'agent' span types can be initialized, got ${spanType}`
        );
      }

      // If trace hasn't been initialized yet, initialize it first
      if (this.traces.length === 0 && spanTraceId) {
        await this.initTrace(spanTraceId, false);
      }

      // Convert API response to span options
      // For workflow/agent spans, input/output are strings
      const inputValue = spanObj.input ? toStringValue(spanObj.input) : '';
      const outputValue = spanObj.output
        ? toStringValue(spanObj.output)
        : undefined;
      const redactedInputValue = spanObj.redactedInput
        ? toStringValue(spanObj.redactedInput)
        : undefined;
      const redactedOutputValue = spanObj.redactedOutput
        ? toStringValue(spanObj.redactedOutput)
        : undefined;

      if (spanType === 'agent') {
        // Type guard to check if it's ExtendedAgentSpanRecordWithChildren
        const agentSpanObj = spanObj as {
          agentType?: AgentType;
        };
        localSpan = new AgentSpan({
          input: inputValue,
          redactedInput: redactedInputValue,
          output: outputValue,
          redactedOutput: redactedOutputValue,
          name: spanObj.name,
          createdAt: spanObj.createdAt
            ? new Date(spanObj.createdAt)
            : undefined,
          metadata: spanObj.userMetadata,
          tags: spanObj.tags,
          statusCode: spanObj.statusCode || undefined,
          metrics: spanObj.metrics
            ? new Metrics(spanObj.metrics as MetricsOptions)
            : undefined,
          externalId: spanObj.externalId || undefined,
          datasetInput: spanObj.datasetInput || undefined,
          datasetOutput: spanObj.datasetOutput || undefined,
          datasetMetadata: spanObj.datasetMetadata || undefined,
          id: spanObj.id,
          agentType: agentSpanObj.agentType || AgentType.DEFAULT
        });
      } else {
        localSpan = new WorkflowSpan({
          input: inputValue,
          redactedInput: redactedInputValue,
          output: outputValue,
          redactedOutput: redactedOutputValue,
          name: spanObj.name,
          createdAt: spanObj.createdAt
            ? new Date(spanObj.createdAt)
            : undefined,
          metadata: spanObj.userMetadata,
          tags: spanObj.tags,
          statusCode: spanObj.statusCode || undefined,
          metrics: spanObj.metrics
            ? new Metrics(spanObj.metrics as MetricsOptions)
            : undefined,
          externalId: spanObj.externalId || undefined,
          datasetInput: spanObj.datasetInput || undefined,
          datasetOutput: spanObj.datasetOutput || undefined,
          datasetMetadata: spanObj.datasetMetadata || undefined,
          id: spanObj.id
        });
      }

      const stack = this.getParentStack();
      stack.push(localSpan);
      this.setParentStack(stack);
      this.spanId = spanId;
    } catch (error) {
      this.spanId = currentSpanId;
      if (localSpan) {
        // Remove last item if it's the one we just pushed
        const stack = this.getParentStack();
        if (stack.length > 0 && stack[stack.length - 1] === localSpan) {
          stack.pop();
          this.setParentStack(stack);
        }
      }

      throw error;
    }
  }

  // ============================================
  // Private Implementation Methods
  // ============================================

  /**
   * Ensures the Galileo API client is initialized with the current logger's configuration.
   *
   * This method initializes the client with the logger's project, log stream, experiment,
   * and session settings. Uses `forceInit: false` to avoid re-initializing if the client
   * is already initialized, making it safe to call multiple times.
   *
   * @throws Error if client initialization fails
   */
  private async ensureClientInitialized(): Promise<void> {
    await this.client.init({
      projectName: this.projectName,
      projectId: this.projectId,
      logStreamName: this.logStreamName,
      logStreamId: this.logStreamId,
      experimentId: this.experimentId,
      sessionId: this.sessionId,
      forceInit: false
    });
  }

  /**
   * Get the parent stack from context or instance, maintaining backward compatibility.
   * @returns The parent stack array.
   */
  private getParentStack(): StepWithChildSpans[] {
    const context = loggerContext.getStore();
    if (context?.parentStack) {
      return context.parentStack;
    }
    return this.parentStack;
  }

  /**
   * Set the parent stack in context and instance.
   * @param stack - The parent stack to set.
   */
  private setParentStack(stack: StepWithChildSpans[]): void {
    this.parentStack = stack;
    const context = loggerContext.getStore();
    if (context) {
      context.parentStack = stack;
    }
  }

  /**
   * Ingests a trace in streaming mode.
   * @param trace - The trace to ingest.
   * @param isComplete - (Optional) Whether the trace is complete. Defaults to false.
   */
  private ingestTraceStreaming(
    trace: Trace,
    isComplete: boolean = false
  ): void {
    if (this.mode !== 'streaming' || !this.taskHandler) {
      return;
    }

    const traceJson = trace.toJSON() as TraceSchema;
    const tracesIngestRequest = {
      traces: [traceJson],
      sessionId: this.sessionId || null,
      experimentId: this.experimentId || null,
      logStreamId: this.logStreamId || this.client.logStreamId || null,
      isComplete
    } as LogTracesIngestRequest;

    const taskId = `trace-ingest-${trace.id}`;

    // Submit task with retry logic wrapped inside (fire-and-forget)
    this.taskHandler
      .submitTask(taskId, async () => {
        await this.ensureClientInitialized();

        await withRetry(
          handleGalileoHttpExceptionsForRetry(async () => {
            await this.client.ingestTraces(tracesIngestRequest);
          }),
          taskId,
          NUM_RETRIES,
          (error) => {
            // Increment retry count on each retry attempt
            this.taskHandler?.incrementRetry(taskId);
            const retryCount = this.taskHandler?.getRetryCount(taskId) || 0;
            console.info(
              `Retry #${retryCount} for task ${taskId}: ${error.message}`
            );
          }
        );
      })
      .catch((error) => {
        // Handle errors silently in fire-and-forget mode
        // Errors are already logged by retry logic
        console.error(`Task ${taskId} failed:`, error);
      });
  }

  /**
   * Ingest a span in streaming mode.
   * @param span - The span to ingest.
   */
  private ingestSpanStreaming(span: Span): void {
    if (this.mode !== 'streaming' || !this.taskHandler) {
      return;
    }

    const currentParent = this.currentParent();
    if (!currentParent) {
      throw new Error('A trace needs to be created in order to add a span.');
    }

    // For workflow/agent spans, use previous parent
    const parentStep =
      span instanceof WorkflowSpan || span instanceof AgentSpan
        ? this.previousParent()
        : currentParent;

    if (!parentStep) {
      throw new Error('A trace needs to be created in order to add a span.');
    }

    // Use traceId from constructor if provided, otherwise use first trace's id
    const traceIdToUse = this.traceId || this.traces[0]?.id || '';
    const parentIdToUse = this.spanId || parentStep.id || '';

    const spanJson = span.toJSON() as SpanSchema;
    const spansIngestRequest = {
      spans: [spanJson],
      traceId: traceIdToUse,
      parentId: parentIdToUse,
      experimentId: this.experimentId || null,
      logStreamId: this.logStreamId || this.client.logStreamId || null
    } as LogSpansIngestRequest;

    const taskId = `span-ingest-${span.id}`;

    // Submit task with retry logic wrapped inside (fire-and-forget)
    this.taskHandler
      .submitTask(taskId, async () => {
        await this.ensureClientInitialized();

        await withRetry(
          handleGalileoHttpExceptionsForRetry(async () => {
            await this.client.ingestSpans(spansIngestRequest);
          }),
          taskId,
          NUM_RETRIES,
          (error) => {
            // Increment retry count on each retry attempt
            this.taskHandler?.incrementRetry(taskId);
            const retryCount = this.taskHandler?.getRetryCount(taskId) || 0;
            console.info(
              `Retry #${retryCount} for task ${taskId}: ${error.message}`
            );
          }
        );
      })
      .catch((error) => {
        // Handle errors silently in fire-and-forget mode
        // Errors are already logged by retry logic
        console.error(`Task ${taskId} failed:`, error);
      });
  }

  /**
   * Updates a trace in streaming mode.
   * @param trace - The trace to update.
   * @param isComplete - (Optional) Whether the trace is complete. Defaults to false.
   */
  private updateTraceStreaming(
    trace: Trace,
    isComplete: boolean = false
  ): void {
    if (this.mode !== 'streaming' || !this.taskHandler) {
      return;
    }

    // Use traceId from constructor if provided, otherwise use trace's id
    const traceIdToUse = this.traceId || trace.id || '';

    const traceUpdateRequest: LogTraceUpdateRequest = {
      traceId: traceIdToUse,
      output: trace.output,
      statusCode: trace.statusCode,
      tags: trace.tags,
      isComplete,
      experimentId: this.experimentId || null,
      logStreamId: this.logStreamId || this.client.logStreamId || null
    };

    const taskId = `trace-update-${trace.id}`;

    // Submit task with retry logic wrapped inside (fire-and-forget)
    // Updates depend on previous tasks (dependent_on_prev=True in Python)
    this.taskHandler
      .submitTask(
        taskId,
        async () => {
          await this.ensureClientInitialized();

          await withRetry(
            handleGalileoHttpExceptionsForRetry(async () => {
              await this.client.updateTrace(traceUpdateRequest);
            }),
            taskId,
            NUM_RETRIES,
            (error) => {
              // Increment retry count on each retry attempt
              this.taskHandler?.incrementRetry(taskId);
              const retryCount = this.taskHandler?.getRetryCount(taskId) || 0;
              console.info(
                `Retry #${retryCount} for task ${taskId}: ${error.message}`
              );
            }
          );
        },
        `trace-ingest-${trace.id}` // Dependent on previous task
      )
      .catch((error) => {
        // Handle errors silently in fire-and-forget mode
        // Errors are already logged by retry logic
        console.error(`Task ${taskId} failed:`, error);
      });
  }

  /**
   * Update a span in streaming mode.
   * @param span - The span to update.
   */
  private updateSpanStreaming(span: Span): void {
    if (this.mode !== 'streaming' || !this.taskHandler) {
      return;
    }

    // Use spanId from constructor if provided, otherwise use span's id
    const spanIdToUse = this.spanId || span.id || '';

    // Serialize output properly - handle string, Message, Document[], etc.
    let serializedOutput: string | null | undefined;
    if (span.output !== undefined) {
      if (typeof span.output === 'string') {
        serializedOutput = span.output;
      } else {
        serializedOutput = toStringValue(span.output);
      }
    }

    const spanUpdateRequest: LogSpanUpdateRequest = {
      spanId: spanIdToUse,
      output: serializedOutput,
      statusCode: span.statusCode,
      tags: span.tags,
      experimentId: this.experimentId || null,
      logStreamId: this.logStreamId || this.client.logStreamId || null
    };

    const taskId = `span-update-${span.id}`;

    // Submit task with retry logic wrapped inside (fire-and-forget)
    // Updates depend on previous tasks (dependent_on_prev=True in Python)
    this.taskHandler
      .submitTask(
        taskId,
        async () => {
          await this.ensureClientInitialized();

          await withRetry(
            handleGalileoHttpExceptionsForRetry(async () => {
              await this.client.updateSpan(spanUpdateRequest);
            }),
            taskId,
            NUM_RETRIES,
            (error) => {
              // Increment retry count on each retry attempt
              this.taskHandler?.incrementRetry(taskId);
              const retryCount = this.taskHandler?.getRetryCount(taskId) || 0;
              console.info(
                `Retry #${retryCount} for task ${taskId}: ${error.message}`
              );
            }
          );
        },
        `span-ingest-${span.id}` // Dependent on previous task
      )
      .catch((error) => {
        // Handle errors silently in fire-and-forget mode
        // Errors are already logged by retry logic
        console.error(`Task ${taskId} failed:`, error);
      });
  }

  /**
   * Concludes the current trace or workflow span by setting the output of the current node. In the case of nested workflow spans, this will point the workflow back to the parent of the current workflow span.
   * @param options - Configuration for concluding.
   * @param options.output - (Optional) The output content to set.
   * @param options.redactedOutput - (Optional) The redacted output content to set.
   * @param options.durationNs - (Optional) Duration in nanoseconds.
   * @param options.statusCode - (Optional) HTTP status code or execution status.
   * @returns The current parent after concluding, or undefined.
   * @throws Error if no trace or span exists to conclude.
   */
  private concludeCurrentParent({
    output,
    redactedOutput,
    durationNs,
    statusCode
  }: {
    output?: string;
    redactedOutput?: string;
    durationNs?: number;
    statusCode?: number;
  }): StepWithChildSpans | undefined {
    const currentParent = this.currentParent();
    if (currentParent === undefined) {
      throw new Error('No existing workflow to conclude.');
    }

    currentParent.output = output || currentParent.output;
    currentParent.redactedOutput =
      redactedOutput || currentParent.redactedOutput;
    currentParent.statusCode = statusCode;
    if (durationNs !== undefined) {
      currentParent.metrics.durationNs = durationNs;
    }

    const stack = this.getParentStack();
    const finishedStep = stack.pop();
    this.setParentStack(stack);

    // In streaming mode, update the finished step
    if (this.mode === 'streaming' && finishedStep) {
      if (finishedStep instanceof Trace) {
        this.updateTraceStreaming(finishedStep, true);
      } else {
        this.updateSpanStreaming(finishedStep);
      }
    }

    return this.currentParent();
  }
}

export {
  GalileoLogger,
  Trace,
  StepWithChildSpans,
  LlmSpan,
  RetrieverSpan,
  ToolSpan,
  WorkflowSpan,
  AgentSpan
};
export type { GalileoLoggerConfig, Span };
