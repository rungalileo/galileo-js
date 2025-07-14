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

class GalileoLoggerConfig {
  public projectName?: string;
  public logStreamName?: string;
  public experimentId?: string;
  public sessionId?: string;
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
  private client = new GalileoApiClient();
  private parentStack: StepWithChildSpans[] = [];
  public traces: Trace[] = [];
  private loggingDisabled: boolean;

  constructor(config: GalileoLoggerConfig = {}) {
    this.projectName = config.projectName;
    this.logStreamName = config.logStreamName;
    this.experimentId = config.experimentId;
    this.sessionId = config.sessionId;
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
      output: ''
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

  static getLastOutput(node?: BaseSpan): string | undefined {
    if (node === undefined) {
      return undefined;
    }

    if (node.output !== undefined) {
      return typeof node.output === 'string'
        ? node.output
        : toStringValue(node.output);
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

    const session = await this.client?.createSession({
      name,
      previousSessionId,
      externalId
    });

    this.sessionId = session.id;
    console.log('Session started.');
    return session.id;
  }

  setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
    console.log('Session ID set:', sessionId);
  }

  clearSession(): void {
    this.sessionId = undefined;
    console.log('Session cleared.');
  }

  startTrace({
    input,
    output,
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
    output?: string;
    name?: string;
    createdAt?: number;
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
      output,
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

  addSingleLlmSpanTrace({
    input,
    output,
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
    output: LlmSpanAllowedOutputType;
    model?: string;
    tools?: any[];
    name?: string;
    createdAt?: number;
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
    /**
     * Create a new trace with a single span and add it to the list of traces.
     */
    if (this.currentParent() !== undefined) {
      throw new Error(
        'A trace cannot be created within a parent trace or span, it must always be the root. You must conclude the existing trace before adding a new one.'
      );
    }

    const trace = new Trace({
      input: typeof input === 'string' ? input : JSON.stringify(input),
      output: typeof output === 'string' ? output : JSON.stringify(output),
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
        output,
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

  addLlmSpan({
    input,
    output,
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
    output: LlmSpanAllowedOutputType;
    model?: string;
    tools?: any[];
    name?: string;
    createdAt?: number;
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
    /**
     * Add a new llm span to the current parent.
     */
    const span = new LlmSpan({
      input,
      output,
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

  addRetrieverSpan({
    input,
    output,
    name,
    durationNs,
    createdAt,
    metadata,
    tags,
    statusCode,
    stepNumber
  }: {
    input: string;
    output: RetrieverSpanAllowedOutputType;
    name?: string;
    durationNs?: number;
    createdAt?: number;
    metadata?: Record<string, string>;
    tags?: string[];
    statusCode?: number;
    stepNumber?: number;
  }): RetrieverSpan {
    /**
     * Add a new retriever span to the current parent.
     */
    const span = new RetrieverSpan({
      input,
      output,
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

  addToolSpan({
    input,
    output,
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
    output?: string;
    name?: string;
    durationNs?: number;
    createdAt?: number;
    metadata?: Record<string, string>;
    tags?: string[];
    statusCode?: number;
    toolCallId?: string;
    stepNumber?: number;
  }): ToolSpan {
    /**
     * Add a new tool span to the current parent.
     */
    const span = new ToolSpan({
      input,
      output,
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

  addWorkflowSpan({
    input,
    output,
    name,
    durationNs,
    createdAt,
    metadata,
    tags,
    stepNumber
  }: {
    input: string;
    output?: string;
    name?: string;
    durationNs?: number;
    createdAt?: number;
    metadata?: Record<string, string>;
    tags?: string[];
    stepNumber?: number;
  }): WorkflowSpan {
    /**
     * Add a workflow span to the current parent. This is useful when you want to create a nested workflow span
     * within the trace or current workflow span. The next span you add will be a child of the current parent. To
     * move out of the nested workflow, use conclude().
     */
    const span = new WorkflowSpan({
      input,
      output,
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

  addAgentSpan({
    input,
    output,
    name,
    durationNs,
    createdAt,
    metadata,
    tags,
    agentType,
    stepNumber
  }: {
    input: string;
    output?: string;
    name?: string;
    durationNs?: number;
    createdAt?: number;
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
      output,
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
    durationNs,
    statusCode
  }: {
    output?: string;
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
    durationNs,
    statusCode,
    concludeAll
  }: {
    output?: string;
    durationNs?: number;
    statusCode?: number;
    concludeAll?: boolean;
  }): StepWithChildSpans | undefined {
    if (!concludeAll) {
      return this.concludeCurrentParent({ output, durationNs, statusCode });
    }
    let currentParent: StepWithChildSpans | undefined = undefined;
    while (this.currentParent() !== undefined) {
      currentParent = this.concludeCurrentParent({
        output,
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
        const lastOutput = GalileoLogger.getLastOutput(currentParent);
        this.conclude({ output: lastOutput, concludeAll: true });
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
