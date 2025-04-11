/* eslint-disable @typescript-eslint/no-explicit-any */
import { GalileoApiClient } from '../api-client';
import {
  LlmSpan,
  RetrieverSpan,
  Span,
  StepWithChildSpans,
  ToolSpan,
  Trace,
  WorkflowSpan
} from '../types/log.types';
import {
  LlmStepAllowedIOType,
  RetrieverStepAllowedOutputType
} from '../types/step.types';

class GalileoLoggerConfig {
  public projectName?: string;
  public logStreamName?: string;
  public experimentId?: string;
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
  private client = new GalileoApiClient();
  private parentStack: StepWithChildSpans[] = [];
  public traces: Trace[] = [];
  private loggingDisabled: boolean;

  constructor(config: GalileoLoggerConfig = {}) {
    this.projectName = config.projectName;
    this.logStreamName = config.logStreamName;
    this.experimentId = config.experimentId;
    try {
      // Logging is disabled if GALILEO_DISABLE_LOGGING is defined, is not an empty string, and not set to '0' or 'false'
      const disableLoggingValue =
        typeof process !== 'undefined' && typeof process.env !== 'undefined'
          ? process.env.GALILEO_DISABLE_LOGGING
            ? process.env.GALILEO_DISABLE_LOGGING.trim()
            : undefined
          : undefined;

      this.loggingDisabled =
        disableLoggingValue !== undefined &&
        disableLoggingValue !== '0' &&
        disableLoggingValue.toLowerCase() !== 'false';
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
      (args) => new Trace(emptySpanData)
    );

    this.addSingleLlmSpanTrace = skipIfDisabled(
      this.addSingleLlmSpanTrace,
      (args) => new Trace(emptySpanData)
    );

    this.addLlmSpan = skipIfDisabled(
      this.addLlmSpan,
      (args) => new LlmSpan(emptySpanData)
    );

    this.addRetrieverSpan = skipIfDisabled(
      this.addRetrieverSpan,
      (args) => new RetrieverSpan(emptySpanData)
    );

    this.addToolSpan = skipIfDisabled(
      this.addToolSpan,
      (args) => new ToolSpan(emptySpanData)
    );

    this.addWorkflowSpan = skipIfDisabled(
      this.addWorkflowSpan,
      (args) => new WorkflowSpan(emptySpanData)
    );

    this.conclude = skipIfDisabled(this.conclude, () => undefined);

    this.flush = skipIfDisabledAsync(this.flush, () => []);

    this.terminate = skipIfDisabledAsync(this.terminate, () => undefined);
  }

  /**
   * Check if logging is disabled
   */
  isLoggingDisabled(): boolean {
    return this.loggingDisabled;
  }

  currentParent(): StepWithChildSpans | undefined {
    return this.parentStack.length > 0
      ? this.parentStack[this.parentStack.length - 1]
      : undefined;
  }

  addChildSpanToParent(span: Span): void {
    // Skip if logging is disabled
    if (this.loggingDisabled) return;

    const currentParent = this.currentParent();
    if (currentParent === undefined) {
      throw new Error('A trace needs to be created in order to add a span.');
    }
    currentParent.addChildSpan(span);
  }

  startTrace({
    input,
    output,
    name,
    createdAt,
    durationNs,
    metadata,
    tags
  }: {
    input: string;
    output?: string;
    name?: string;
    createdAt?: number;
    durationNs?: number;
    metadata?: Record<string, string>;
    tags?: string[];
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
      createdAtNs: createdAt,
      metadata: metadata,
      tags,
      durationNs
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
    timeToFirstTokenNs,
    temperature,
    statusCode
  }: {
    input: LlmStepAllowedIOType;
    output: LlmStepAllowedIOType;
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
      input,
      output,
      name,
      createdAtNs: createdAt,
      metadata: metadata,
      tags
    });

    trace.addChildSpan(
      new LlmSpan({
        input,
        output,
        model,
        tools,
        name,
        createdAtNs: createdAt,
        metadata: metadata,
        tags,
        durationNs,
        inputTokens: numInputTokens,
        outputTokens: numOutputTokens,
        totalTokens,
        timeToFirstTokenNs,
        temperature,
        statusCode
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
    statusCode
  }: {
    input: LlmStepAllowedIOType;
    output: LlmStepAllowedIOType;
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
      createdAtNs: createdAt,
      metadata: metadata,
      tags,
      durationNs,
      inputTokens: numInputTokens,
      outputTokens: numOutputTokens,
      totalTokens,
      timeToFirstTokenNs,
      temperature,
      statusCode
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
    statusCode
  }: {
    input: string;
    output: RetrieverStepAllowedOutputType;
    name?: string;
    durationNs?: number;
    createdAt?: number;
    metadata?: Record<string, string>;
    tags?: string[];
    statusCode?: number;
  }): RetrieverSpan {
    /**
     * Add a new retriever span to the current parent.
     */
    const span = new RetrieverSpan({
      input,
      output,
      name,
      createdAtNs: createdAt,
      metadata: metadata,
      tags,
      statusCode,
      durationNs
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
    toolCallId
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
  }): ToolSpan {
    /**
     * Add a new tool span to the current parent.
     */
    const span = new ToolSpan({
      input,
      output,
      name,
      createdAtNs: createdAt,
      metadata: metadata,
      tags,
      statusCode,
      toolCallId,
      durationNs
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
    tags
  }: {
    input: string;
    output?: string;
    name?: string;
    durationNs?: number;
    createdAt?: number;
    metadata?: Record<string, string>;
    tags?: string[];
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
      createdAtNs: createdAt,
      metadata: metadata,
      tags,
      durationNs
    });

    this.addChildSpanToParent(span);
    this.parentStack.push(span);
    return span;
  }

  conclude({
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

  async flush(): Promise<Trace[]> {
    try {
      if (!this.traces.length) {
        console.warn('No traces to flush.');
        return [];
      }

      await this.client.init({
        projectName: this.projectName,
        logStreamName: this.logStreamName,
        experimentId: this.experimentId
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
  WorkflowSpan
};
