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
  RetrieverStepAllowedOutputType,
  BaseStep
} from '../types/step.types';
import { toStringValue } from './serialization';

class GalileoLoggerConfig {
  public projectName?: string;
  public logStreamName?: string;
  public experimentId?: string;
}

class GalileoLogger {
  private projectName?: string;
  private logStreamName?: string;
  private experimentId?: string;
  private client = new GalileoApiClient();
  private parentStack: StepWithChildSpans[] = [];
  public traces: Trace[] = [];

  constructor(config: GalileoLoggerConfig = {}) {
    this.projectName = config.projectName;
    this.logStreamName = config.logStreamName;
    this.experimentId = config.experimentId;
  }

  static getLastOutput(node?: BaseStep): string | undefined {
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

  addChildSpanToParent(span: Span): void {
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
