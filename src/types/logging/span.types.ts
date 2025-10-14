import type { components } from '../api.types';
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
import { MetricValueType } from '../metrics.types';

export interface BaseSpanOptions extends BaseStepOptions {
  input: StepAllowedInputType;
  redactedInput?: StepAllowedInputType;
}

export class BaseSpan extends BaseStep {
  input: StepAllowedInputType;
  redactedInput?: StepAllowedInputType;

  constructor(type: StepType, data: BaseSpanOptions) {
    super(type, data);
    this.input = data.input;
    this.redactedInput = data.redactedInput;
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
  redactedInput?: string;
  output?: string;
  redactedOutput?: string;
}

export class WorkflowSpan extends StepWithChildSpans {
  type: StepType = StepType.workflow;

  constructor(data: WorkflowSpanOptions) {
    super(StepType.workflow, data);
  }
}

// Use API type as source of truth
export type AgentType = components['schemas']['AgentType'];

// Convert enum to const object with compile-time validation
export const AgentType = {
  default: 'default',
  planner: 'planner',
  react: 'react',
  reflection: 'reflection',
  router: 'router',
  classifier: 'classifier',
  supervisor: 'supervisor',
  judge: 'judge'
} as const satisfies Record<AgentType, AgentType>;

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

  constructor(options: LlmMetricsOptions) {
    super(options);
  }

  toJSON(): Record<string, MetricValueType | undefined> {
    const json = super.toJSON();
    for (const [oldKey, newKey] of Object.entries({
      numInputTokens: 'num_input_tokens',
      numOutputTokens: 'num_output_tokens',
      numTotalTokens: 'num_total_tokens',
      timeToFirstTokenNs: 'time_to_first_token_ns'
    })) {
      if (oldKey in json) {
        json[newKey] = json[oldKey];
        delete json[oldKey];
      }
    }
    return json;
  }
}

export interface LlmSpanOptions extends BaseSpanOptions {
  input: LlmSpanAllowedInputType;
  redactedInput?: LlmSpanAllowedInputType;
  output: LlmSpanAllowedOutputType;
  redactedOutput?: LlmSpanAllowedOutputType;
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
  redactedInput?: Message[];
  output: Message;
  redactedOutput?: Message;
  metrics: LlmMetrics = new LlmMetrics({});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools?: Record<string, any>[];
  model?: string;
  temperature?: number;
  finishReason?: string;

  constructor(data: LlmSpanOptions) {
    super(StepType.llm, data);
    this.input = convertLlmInput(structuredClone(data.input));
    this.redactedInput = data.redactedInput
      ? convertLlmInput(structuredClone(data.redactedInput))
      : undefined;
    this.output = convertLlmOutput(
      structuredClone(data.output),
      MessageRole.assistant
    );
    this.redactedOutput = data.redactedOutput
      ? convertLlmOutput(
          structuredClone(data.redactedOutput),
          MessageRole.assistant
        )
      : undefined;
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
  redactedInput?: string;
  output?: RetrieverSpanAllowedOutputType;
  redactedOutput?: RetrieverSpanAllowedOutputType;
}

export class RetrieverSpan extends BaseStep {
  type: StepType = StepType.retriever;
  input: string;
  redactedInput?: string;
  output: Document[] = [];
  redactedOutput?: Document[];

  constructor(data: RetrieverSpanOptions) {
    super(StepType.retriever, data);
    this.input = data.input;
    this.redactedInput = data.redactedInput;
    this.output = data.output ? convertRetrieverOutput(data.output) : [];
    this.redactedOutput = data.redactedOutput
      ? convertRetrieverOutput(data.redactedOutput)
      : undefined;
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
  redactedInput?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  output?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  redactedOutput?: any;
  toolCallId?: string;
}

export class ToolSpan extends BaseStep {
  type: StepType = StepType.tool;
  input: string;
  redactedInput?: string;
  output: string;
  redactedOutput?: string;
  toolCallId?: string;

  constructor(data: ToolSpanOptions) {
    super(StepType.tool, data);
    this.input =
      typeof data.input === 'string' ? data.input : JSON.stringify(data.input);
    this.redactedInput =
      typeof data.redactedInput === 'string'
        ? data.redactedInput
        : JSON.stringify(data.redactedInput);
    this.output =
      typeof data.output === 'string'
        ? (data.output ?? '')
        : JSON.stringify(data.output);
    this.redactedOutput =
      typeof data.redactedOutput === 'string'
        ? (data.redactedOutput ?? '')
        : JSON.stringify(data.redactedOutput);
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

/**
 * Type guard to validate if a value is a valid AgentType
 */
export function isValidAgentType(value: unknown): value is AgentType {
  return (
    typeof value === 'string' &&
    Object.values(AgentType).includes(value as AgentType)
  );
}
