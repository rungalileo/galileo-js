import {
  BaseStep,
  BaseStepOptions,
  LlmSpanAllowedInputType,
  LlmSpanAllowedOutputType,
  Metrics,
  MetricsOptions,
  RetrieverSpanAllowedOutputType,
  StepAllowedInputType,
  StepType
} from './step.types';
import { Message, MessageRole } from '../message.types';
import {
  convertLlmInput,
  convertLlmOutput,
  convertRetrieverOutput
} from '../../utils/span';
import { Document } from '../document.types';

export interface BaseSpanOptions extends BaseStepOptions {
  input: StepAllowedInputType;
}

export class BaseSpan extends BaseStep {
  input: StepAllowedInputType;

  constructor(type: StepType, data: BaseSpanOptions) {
    super(type, data);
    this.input = data.input;
  }
}

export interface StepWithChildSpansOptions extends BaseSpanOptions {
  spans?: Span[];
}

export class StepWithChildSpans extends BaseSpan {
  spans: Span[] = [];

  constructor(type: StepType, data: StepWithChildSpansOptions) {
    super(type, data);
    this.spans = data.spans || [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toJSON(): Record<string, any> {
    return {
      ...super.toJSON(),
      spans: this.spans.map((span) => span.toJSON())
    };
  }

  addChildSpan(...spans: Span[]): void {
    for (const span of spans) {
      //   span.parent = this;
      this.spans.push(span);
    }
  }
}

export interface WorkflowSpanOptions extends StepWithChildSpansOptions {
  input: string;
  output?: string;
}

export class WorkflowSpan extends StepWithChildSpans {
  type: StepType = StepType.workflow;

  constructor(data: WorkflowSpanOptions) {
    super(StepType.workflow, data);
  }
}

export enum AgentType {
  default = 'default',
  planner = 'planner',
  react = 'react',
  reflection = 'reflection',
  router = 'router',
  classifier = 'classifier',
  supervisor = 'supervisor',
  judge = 'judge'
}

export interface AgentSpanOptions extends StepWithChildSpansOptions {
  agentType?: AgentType;
}

export class AgentSpan extends StepWithChildSpans {
  type: StepType = StepType.agent;
  agentType: AgentType;

  constructor(data: AgentSpanOptions) {
    super(StepType.agent, data);
    this.agentType = data.agentType || AgentType.default;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toJSON(): Record<string, any> {
    return {
      ...super.toJSON(),
      agent_type: this.agentType
    };
  }
}

export interface LlmMetricsOptions extends MetricsOptions {
  numInputTokens?: number;
  numOutputTokens?: number;
  numTotalTokens?: number;
  timeToFirstTokenNs?: number;
}

export class LlmMetrics extends Metrics {
  numInputTokens?: number;
  numOutputTokens?: number;
  numTotalTokens?: number;
  timeToFirstTokenNs?: number;

  // constructor inherited from Metrics

  // toJSON() inherited from Metrics
}

export interface LlmSpanOptions extends BaseSpanOptions {
  input: LlmSpanAllowedInputType;
  output: LlmSpanAllowedOutputType;
  metrics?: LlmMetrics;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools?: Record<string, any>[];
  model?: string;
  temperature?: number;
  finishReason?: string;
}

export class LlmSpan extends BaseSpan {
  type: StepType = StepType.llm;
  input: Message[];
  output: Message;
  metrics: LlmMetrics = new LlmMetrics({});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools?: Record<string, any>[];
  model?: string;
  temperature?: number;
  finishReason?: string;

  constructor(data: LlmSpanOptions) {
    super(StepType.llm, data);
    this.input = convertLlmInput(structuredClone(data.input));
    this.output = convertLlmOutput(
      structuredClone(data.output),
      MessageRole.assistant
    );
    this.metrics = data.metrics || new LlmMetrics({});
    this.tools = data.tools;
    this.model = data.model;
    this.temperature = data.temperature;
    this.finishReason = data.finishReason;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toJSON(): Record<string, any> {
    return {
      ...super.toJSON(),
      tools: this.tools,
      model: this.model,
      temperature: this.temperature,
      finish_reason: this.finishReason
    };
  }
}

export interface RetrieverSpanOptions extends BaseSpanOptions {
  input: string;
  output?: RetrieverSpanAllowedOutputType;
}

export class RetrieverSpan extends BaseStep {
  type: StepType = StepType.retriever;
  input: string;
  output: Document[] = [];

  constructor(data: RetrieverSpanOptions) {
    super(StepType.retriever, data);
    this.input = data.input;
    this.output = data.output ? convertRetrieverOutput(data.output) : [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toJSON(): Record<string, any> {
    return {
      ...super.toJSON(),
      output: this.output.map((doc) => doc.toJSON())
    };
  }
}

export interface ToolSpanOptions extends BaseSpanOptions {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  output?: any;
  toolCallId?: string;
}

export class ToolSpan extends BaseStep {
  type: StepType = StepType.tool;
  input: string;
  output: string;
  toolCallId?: string;

  constructor(data: ToolSpanOptions) {
    super(StepType.tool, data);
    this.input =
      typeof data.input === 'string' ? data.input : JSON.stringify(data.input);
    this.output =
      typeof data.output === 'string'
        ? (data.output ?? '')
        : JSON.stringify(data.output);
    this.toolCallId = data.toolCallId;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toJSON(): Record<string, any> {
    return {
      ...super.toJSON(),
      toolCallId: this.toolCallId
    };
  }
}

// Type for all span types
export type Span = WorkflowSpan | LlmSpan | RetrieverSpan | ToolSpan;
