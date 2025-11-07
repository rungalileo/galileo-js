/* eslint-disable @typescript-eslint/no-explicit-any */
import { GalileoApiClient } from '../api-client';
import {
  BaseSpan,
  AgentSpan,
  AgentType,
  LlmMetrics,
  LlmSpan,
  RetrieverSpan,
  Span,
  StepWithChildSpans,
  ToolSpan,
  WorkflowSpan
} from '../types/logging/span.types';
import { Trace } from '../types/logging/trace.types';
import {
  RetrieverSpanAllowedOutputType,
  Metrics,
  LlmSpanAllowedOutputType,
  LlmSpanAllowedInputType
} from '../types/logging/step.types';
import { toStringValue } from './serialization';
import { LogRecordsQueryRequest } from '../types/search.types';
import { LocalMetricConfig } from '../types/metrics.types';

class GalileoLoggerConfig {
  public projectName?: string;
  public logStreamName?: string;
  public experimentId?: string;
  public sessionId?: string;
  public localMetrics?: LocalMetricConfig[];
  public mode?: string;
}

/**
 * Higher-order function that wraps a method to skip execution if logging is disabled
 * @param fn The original method
 * @param defaultValueFn A function that returns the default value when logging is disabled
 */
function skipIfDisabled<T, Args extends any[]>(
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
function skipIfDisabledAsync<T, Args extends any[]>(
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

class GalileoLogger {
  private projectName?: string;
  private logStreamName?: string;
  private experimentId?: string;
  private sessionId?: string;
  private localMetrics?: LocalMetricConfig[];
  private mode?: string;
  private client = new GalileoApiClient();
  private parentStack: StepWithChildSpans[] = [];
  public traces: Trace[] = [];
  private loggingDisabled: boolean;

  constructor(config: GalileoLoggerConfig = {}) {
    this.projectName = config.projectName;
    this.logStreamName = config.logStreamName;
    this.experimentId = config.experimentId;
    this.sessionId = config.sessionId;
    this.localMetrics = config.localMetrics;
    this.mode = config.mode;
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

    // Wrap relevant methods with skipIfDisabled or skipIfDisabledAsync

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
  }

  /**
   * Check if logging is disabled
   */
  isLoggingDisabled(): boolean {
    return this.loggingDisabled;
  }

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

  currentParent(): StepWithChildSpans | undefined {
    return this.parentStack.length > 0
      ? this.parentStack[this.parentStack.length - 1]
      : undefined;
  }

  currentSessionId(): string | undefined {
    return this.sessionId;
  }

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
   * Start a session in the active logger instance.
   *
   * If an `externalId` is provided, the method will first search for an existing session
   * with that external ID. If found, it will reuse that session instead of creating a new one.
   * This allows you to maintain persistent sessions across multiple runs or associate sessions
   * with external identifiers (e.g., user IDs, conversation IDs).
   *
   * @param options - Configuration for the session
   * @param options.name - The name of the session (optional)
   * @param options.previousSessionId - The ID of a previous session to link to (optional)
   * @param options.externalId - An external identifier for the session. If a session with this
   *                              external ID already exists, it will be reused instead of creating
   *                              a new session (optional)
   * @returns The ID of the session (either newly created or existing)
   */
  async startSession({
    name,
    previousSessionId,
    externalId
  }: {
    name?: string;
    previousSessionId?: string;
    externalId?: string;
  } = {}): Promise<string> {
    await this.client.init({
      projectName: this.projectName,
      logStreamName: this.logStreamName,
      experimentId: this.experimentId
    });

    // If externalId is provided, search for existing session
    if (externalId && externalId.trim() !== '') {
      try {
        const searchRequestFilter: LogRecordsQueryRequest = {
          filters: [
            {
              column_id: 'external_id',
              operator: 'eq',
              value: externalId,
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
      } catch (error) {
        // Continue to create new session
      }
    }

    // Create new session if no externalId or not found
    const session = await this.client.createSession({
      name,
      previousSessionId,
      externalId
    });

    this.sessionId = session.id;
    return session.id;
  }

  setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
  }

  clearSession(): void {
    this.sessionId = undefined;
  }

  startTrace({
    input,
    redactedInput,
    output,
    redactedOutput,
    name,
    createdAt,
    durationNs,
    metadata,
    tags,
    datasetInput,
    datasetOutput,
    datasetMetadata
  }: {
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
  }): Trace {
    if (this.currentParent() !== undefined) {
      throw new Error(
        'You must conclude the existing trace before adding a new one.'
      );
    }

    const trace = new Trace({
      input,
      redactedInput,
      output,
      redactedOutput,
      name,
      createdAt,
      metadata,
      tags,
      metrics: new Metrics({ durationNs: durationNs }),
      datasetInput,
      datasetOutput,
      datasetMetadata
    });

    this.traces.push(trace);
    this.parentStack.push(trace);
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
   * @returns The created trace containing the single LLM span.
   * @throws Error if a trace or span is already in progress.
   */
  addSingleLlmSpanTrace({
    input,
    redactedInput,
    output,
    redactedOutput,
    model,
    tools,
    name,
    createdAt,
    durationNs,
    metadata,
    tags,
    numInputTokens,
    numOutputTokens,
    totalTokens,
    temperature,
    statusCode,
    spanStepNumber,
    timeToFirstTokenNs,
    datasetInput,
    datasetOutput,
    datasetMetadata
  }: {
    input: LlmSpanAllowedInputType;
    redactedInput?: LlmSpanAllowedInputType;
    output: LlmSpanAllowedOutputType;
    redactedOutput?: LlmSpanAllowedOutputType;
    model?: string;
    tools?: any[];
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
  }): Trace {
    if (this.currentParent() !== undefined) {
      throw new Error(
        'A trace cannot be created within a parent trace or span, it must always be the root. You must conclude the existing trace before adding a new one.'
      );
    }

    const trace = new Trace({
      input: typeof input === 'string' ? input : JSON.stringify(input),
      redactedInput:
        redactedInput !== undefined
          ? typeof redactedInput === 'string'
            ? redactedInput
            : JSON.stringify(redactedInput)
          : undefined,
      output: typeof output === 'string' ? output : JSON.stringify(output),
      redactedOutput:
        redactedOutput !== undefined
          ? typeof redactedOutput === 'string'
            ? redactedOutput
            : JSON.stringify(redactedOutput)
          : undefined,
      name,
      metadata,
      tags,
      datasetInput,
      datasetOutput,
      datasetMetadata
    });

    trace.addChildSpan(
      new LlmSpan({
        name,
        createdAt,
        metadata,
        tags,
        input,
        redactedInput,
        output,
        redactedOutput,
        metrics: new LlmMetrics({
          durationNs,
          numInputTokens,
          numOutputTokens,
          numTotalTokens: totalTokens,
          timeToFirstTokenNs
        }),
        tools,
        model,
        temperature,
        statusCode,
        stepNumber: spanStepNumber,
        datasetInput,
        datasetOutput,
        datasetMetadata
      })
    );

    this.traces.push(trace);
    // Single span traces are automatically concluded so we reset the current parent.
    this.parentStack = [];
    return trace;
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
   * @returns The created LLM span, which is automatically added to the current parent.
   */
  addLlmSpan({
    input,
    redactedInput,
    output,
    redactedOutput,
    model,
    tools,
    name,
    createdAt,
    durationNs,
    metadata,
    tags,
    numInputTokens,
    numOutputTokens,
    totalTokens,
    timeToFirstTokenNs,
    temperature,
    statusCode,
    stepNumber
  }: {
    input: LlmSpanAllowedInputType;
    redactedInput?: LlmSpanAllowedInputType;
    output: LlmSpanAllowedOutputType;
    redactedOutput?: LlmSpanAllowedOutputType;
    model?: string;
    tools?: any[];
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
  }): LlmSpan {
    const span = new LlmSpan({
      input,
      redactedInput,
      output,
      redactedOutput,
      model,
      tools,
      name,
      createdAt: createdAt,
      metadata: metadata,
      tags,
      metrics: new LlmMetrics({
        durationNs,
        numInputTokens,
        numOutputTokens,
        numTotalTokens: totalTokens,
        timeToFirstTokenNs
      }),
      temperature,
      statusCode,
      stepNumber
    });

    this.addChildSpanToParent(span);
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
  addRetrieverSpan({
    input,
    redactedInput,
    output,
    redactedOutput,
    name,
    durationNs,
    createdAt,
    metadata,
    tags,
    statusCode,
    stepNumber
  }: {
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
      input,
      redactedInput,
      output,
      redactedOutput,
      name,
      createdAt: createdAt,
      metadata: metadata,
      tags,
      statusCode,
      metrics: new Metrics({ durationNs: durationNs }),
      stepNumber
    });

    this.addChildSpanToParent(span);
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
  addToolSpan({
    input,
    redactedInput,
    output,
    redactedOutput,
    name,
    durationNs,
    createdAt,
    metadata,
    tags,
    statusCode,
    toolCallId,
    stepNumber
  }: {
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
      input,
      redactedInput,
      output,
      redactedOutput,
      name,
      createdAt: createdAt,
      metadata: metadata,
      tags,
      statusCode,
      toolCallId,
      metrics: new Metrics({ durationNs: durationNs }),
      stepNumber
    });

    this.addChildSpanToParent(span);
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
  addWorkflowSpan({
    input,
    redactedInput,
    output,
    redactedOutput,
    name,
    durationNs,
    createdAt,
    metadata,
    tags,
    stepNumber
  }: {
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
      input,
      redactedInput,
      output,
      redactedOutput,
      name,
      createdAt: createdAt,
      metadata: metadata,
      tags,
      metrics: new Metrics({ durationNs: durationNs }),
      stepNumber
    });

    this.addChildSpanToParent(span);
    this.parentStack.push(span);
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
  addAgentSpan({
    input,
    redactedInput,
    output,
    redactedOutput,
    name,
    durationNs,
    createdAt,
    metadata,
    tags,
    agentType,
    stepNumber
  }: {
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
    /**
     * Add an agent span to the current parent.
     */
    const span = new AgentSpan({
      input,
      redactedInput,
      output,
      redactedOutput,
      name,
      createdAt: createdAt,
      metadata: metadata,
      tags,
      metrics: new Metrics({ durationNs: durationNs }),
      agentType,
      stepNumber
    });

    this.addChildSpanToParent(span);
    this.parentStack.push(span);
    return span;
  }

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
    /**
     * Conclude the current trace or workflow span by setting the output of the current node. In the case of nested
     * workflow spans, this will point the workflow back to the parent of the current workflow span.
     */
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

    const finishedStep = this.parentStack.pop();
    if (
      this.currentParent() === undefined &&
      !(finishedStep instanceof Trace)
    ) {
      throw new Error(
        'Finished step is not a trace, but has no parent. Not added to the list of traces.'
      );
    }
    return this.currentParent();
  }

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

  async flush(): Promise<Trace[]> {
    try {
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
        logStreamName: this.logStreamName,
        experimentId: this.experimentId,
        sessionId: this.sessionId
      });

      console.info(`Flushing ${this.traces.length} traces...`);
      const loggedTraces = [...this.traces];

      //// @ts-expect-error - FIXME: Type this
      await this.client.ingestTraces(loggedTraces);

      console.info(`Successfully flushed ${loggedTraces.length} traces.`);
      this.traces = []; // Clear after uploading
      this.parentStack = [];
      return loggedTraces;
    } catch (error) {
      console.error(error);
      return [];
    }
  }

  async terminate(): Promise<void> {
    try {
      await this.flush();
    } catch (error) {
      console.error(error);
    }
  }
}

export {
  GalileoLogger,
  GalileoLoggerConfig,
  Trace,
  Span,
  StepWithChildSpans,
  LlmSpan,
  RetrieverSpan,
  ToolSpan,
  WorkflowSpan,
  AgentSpan
};
