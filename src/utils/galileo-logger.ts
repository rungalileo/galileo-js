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
import { ProjectTypes } from '../types/project.types';

class GalileoLoggerConfig {
  public projectName?: string;
  public logStreamName?: string;
}

class GalileoLogger {
  private projectName?: string;
  private logStreamName?: string;
  private client = new GalileoApiClient();
  private parentStack: StepWithChildSpans[] = [];
  public traces: Trace[] = [];

  constructor(config: GalileoLoggerConfig = {}) {
    this.projectName = config.projectName || process.env.GALILEO_PROJECT || '';
    this.logStreamName =
      config.logStreamName || process.env.GALILEO_LOG_STREAM || '';

    if (!this.projectName || !this.logStreamName) {
      throw new Error(
        'User must provide projectName and logStreamName to GalileoLogger, or set them as environment variables.'
      );
    }
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

  startTrace(
    input: string,
    output?: string,
    name?: string,
    createdAt?: number,
    durationNs?: number,
    userMetadata?: Record<string, string>,
    tags?: string[]
  ): Trace {
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
      metadata: userMetadata,
      tags,
      durationNs
    });

    this.traces.push(trace);
    this.parentStack.push(trace);
    return trace;
  }

  addSingleLlmSpanTrace(
    input: LlmStepAllowedIOType,
    output: LlmStepAllowedIOType,
    model?: string,
    tools?: any[],
    name?: string,
    createdAt?: number,
    durationNs?: number,
    userMetadata?: Record<string, string>,
    tags?: string[],
    numInputTokens?: number,
    numOutputTokens?: number,
    totalTokens?: number,
    temperature?: number,
    statusCode?: number
  ): Trace {
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
      metadata: userMetadata,
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
        metadata: userMetadata,
        tags,
        durationNs,
        inputTokens: numInputTokens,
        outputTokens: numOutputTokens,
        totalTokens,
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
      temperature,
      statusCode
    });

    this.addChildSpanToParent(span);
    return span;
  }

  addRetrieverSpan(
    input: string,
    output: RetrieverStepAllowedOutputType,
    name?: string,
    durationNs?: number,
    createdAt?: number,
    userMetadata?: Record<string, string>,
    tags?: string[],
    statusCode?: number
  ): RetrieverSpan {
    /**
     * Add a new retriever span to the current parent.
     */
    const span = new RetrieverSpan({
      input,
      output,
      name,
      createdAtNs: createdAt,
      metadata: userMetadata,
      tags,
      statusCode,
      durationNs
    });

    this.addChildSpanToParent(span);
    return span;
  }

  addToolSpan(
    input: string,
    output?: string,
    name?: string,
    durationNs?: number,
    createdAt?: number,
    userMetadata?: Record<string, string>,
    tags?: string[],
    statusCode?: number,
    toolCallId?: string
  ): ToolSpan {
    /**
     * Add a new tool span to the current parent.
     */
    const span = new ToolSpan({
      input,
      output,
      name,
      createdAtNs: createdAt,
      metadata: userMetadata,
      tags,
      statusCode,
      toolCallId,
      durationNs
    });

    this.addChildSpanToParent(span);
    return span;
  }

  addWorkflowSpan(
    input: string,
    output?: string,
    name?: string,
    durationNs?: number,
    createdAt?: number,
    userMetadata?: Record<string, string>,
    tags?: string[]
  ): WorkflowSpan {
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
      metadata: userMetadata,
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
        projectType: ProjectTypes.genAI,
        projectName: this.projectName,
        logStreamName: this.logStreamName
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

  terminate(): void {
    try {
      this.flush();
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
