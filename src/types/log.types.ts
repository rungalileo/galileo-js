/* eslint-disable @typescript-eslint/no-explicit-any */

export enum NodeType {
  trace = 'trace',
  workflow = 'workflow',
  llm = 'llm',
  retriever = 'retriever',
  tool = 'tool',
  agent = 'agent'
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

import { StepIOType } from './step.types';
import { Document } from './document.types';
import {
  BaseStep,
  BaseStepWithChildren,
  LlmStepAllowedIOType,
  RetrieverStepAllowedOutputType
} from './step.types';
import { Message, MessageRole } from '../types/message.types';
import { convertLlmInputOutput, convertRetrieverOutput } from '../utils/span';

// TODO: Remove this interface once the API is updated
export interface SessionCreateResponse {
  id: string;
  name?: string;
  project_id: string;
  project_name: string;
  previous_session_id?: string;
  external_id?: string;
}

export class SpanWithParentStep extends BaseStep {
  parent?: StepWithChildSpans;

  constructor(data: {
    type?: NodeType;
    input: StepIOType;
    output?: StepIOType;
    name?: string;
    createdAtNs?: number;
    durationNs?: number;
    metadata?: Record<string, string>;
    statusCode?: number;
    groundTruth?: string;
    parent?: StepWithChildSpans;
  }) {
    super(data);
    this.parent = data.parent;
  }

  toJSON(): Record<string, any> {
    return {
      ...super.toJSON()
    };
  }
}
interface IStepWithChildSpans {
  spans: Span[];
  children(): BaseStep[];
  addChildSpan(...spans: Span[]): void;
}

export class StepWithChildSpans
  extends BaseStepWithChildren
  implements IStepWithChildSpans
{
  spans: Span[] = [];

  constructor(data: {
    type?: NodeType;
    input: StepIOType;
    output?: StepIOType;
    name?: string;
    createdAtNs?: number;
    durationNs?: number;
    metadata?: Record<string, string>;
    statusCode?: number;
    groundTruth?: string;
    spans?: Span[];
  }) {
    super(data);
    this.spans = data.spans || [];
  }

  toJSON(): Record<string, any> {
    return {
      ...super.toJSON(),
      spans: this.spans.map((span) => span.toJSON())
    };
  }

  children(): BaseStep[] {
    return this.spans;
  }

  addChildSpan(...spans: Span[]): void {
    for (const span of spans) {
      //   span.parent = this;
      this.spans.push(span);
    }
  }
}

export class Trace extends StepWithChildSpans {
  type: NodeType = NodeType.trace;
  input: string;
  output: string;

  constructor(data: {
    input: StepIOType;
    output?: StepIOType;
    name?: string;
    createdAtNs?: number;
    durationNs?: number;
    metadata?: Record<string, string>;
    statusCode?: number;
    groundTruth?: string;
    spans?: Span[];
    tags?: string[];
  }) {
    super({ ...data, type: NodeType.trace });
    this.input =
      typeof data.input === 'string'
        ? (data.input ?? '')
        : JSON.stringify(data.input);
    this.output =
      typeof data.output === 'string'
        ? (data.output ?? '')
        : JSON.stringify(data.output);
  }

  toJSON(): Record<string, any> {
    return {
      ...super.toJSON(),
      spans: this.spans.map((span) => span.toJSON())
    };
  }
}

export class WorkflowSpan extends StepWithChildSpans {
  type: NodeType = NodeType.workflow;
  parent?: StepWithChildSpans;

  constructor(data: {
    parent?: StepWithChildSpans;
    input: StepIOType;
    output?: StepIOType;
    name?: string;
    createdAtNs?: number;
    durationNs?: number;
    metadata?: Record<string, string>;
    statusCode?: number;
    groundTruth?: string;
    spans?: Span[];
    tags?: string[];
  }) {
    super({ ...data, type: NodeType.workflow });
    this.input =
      typeof data.input === 'string' ? data.input : JSON.stringify(data.input);
    this.output =
      typeof data.output === 'string'
        ? data.output
        : JSON.stringify(data.output);
    this.spans = data.spans || [];
  }

  children(): BaseStep[] {
    return this.spans;
  }

  addChild(...spans: Span[]): void {
    for (const span of spans) {
      this.spans.push(span);
    }
  }

  toJSON(): Record<string, any> {
    return {
      ...super.toJSON(),
      spans: this.spans.map((span) => span.toJSON())
    };
  }
}

export class AgentSpan extends StepWithChildSpans {
  type: NodeType = NodeType.agent;
  parent?: StepWithChildSpans;
  agentType: AgentType = AgentType.default;

  constructor(data: {
    parent?: StepWithChildSpans;
    input: StepIOType;
    output?: StepIOType;
    name?: string;
    createdAtNs?: number;
    durationNs?: number;
    metadata?: Record<string, string>;
    statusCode?: number;
    groundTruth?: string;
    spans?: Span[];
    tags?: string[];
    agentType?: AgentType;
  }) {
    super({ ...data, type: NodeType.agent });
    this.input =
      typeof data.input === 'string' ? data.input : JSON.stringify(data.input);
    this.output =
      typeof data.output === 'string'
        ? data.output
        : JSON.stringify(data.output);
    this.spans = data.spans || [];
    this.agentType = data.agentType || AgentType.default;
  }

  children(): BaseStep[] {
    return this.spans;
  }

  addChild(...spans: Span[]): void {
    for (const span of spans) {
      this.spans.push(span);
    }
  }

  toJSON(): Record<string, any> {
    return {
      ...super.toJSON(),
      spans: this.spans.map((span) => span.toJSON())
    };
  }
}

export class LlmSpan extends BaseStep {
  type: NodeType = NodeType.llm;
  input: Message[];
  output: Message;
  tools?: Record<string, any>[];
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  temperature?: number;
  timeToFirstTokenNs?: number;

  constructor(data: {
    parent?: StepWithChildSpans;
    input: LlmStepAllowedIOType;
    output: LlmStepAllowedIOType;
    model?: string;
    tools?: Record<string, any>[];
    name?: string;
    durationNs?: number;
    createdAtNs?: number;
    metadata?: Record<string, string>;
    statusCode?: number;
    groundTruth?: string;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    temperature?: number;
    timeToFirstTokenNs?: number;
    tags?: string[];
  }) {
    super({ ...data, type: NodeType.llm });
    this.input = convertLlmInputOutput(structuredClone(data.input));
    this.output = convertLlmInputOutput(
      structuredClone(data.output),
      MessageRole.assistant
    )[0];
    this.tools = data.tools;
    this.model = data.model;
    this.inputTokens = data.inputTokens;
    this.outputTokens = data.outputTokens;
    this.totalTokens = data.totalTokens;
    this.temperature = data.temperature;
    this.timeToFirstTokenNs = data.timeToFirstTokenNs;
  }

  toJSON(): Record<string, any> {
    return {
      ...super.toJSON(),
      input_tokens: this.inputTokens,
      output_tokens: this.outputTokens,
      total_tokens: this.totalTokens,
      temperature: this.temperature,
      time_to_first_token_ns: this.timeToFirstTokenNs,
      model: this.model,
      tools: this.tools,
      type: this.type,
      input: this.input,
      output: this.output,
      name: this.name,
      duration_ns: this.durationNs
    };
  }
}

export class RetrieverSpan extends BaseStep {
  type: NodeType = NodeType.retriever;
  parent?: StepWithChildSpans;
  input: string;
  output: Document[] = [];

  constructor(data: {
    parent?: StepWithChildSpans;
    input: StepIOType;
    output: RetrieverStepAllowedOutputType;
    name?: string;
    durationNs?: number;
    createdAtNs?: number;
    metadata?: Record<string, string>;
    statusCode?: number;
    groundTruth?: string;
    tags?: string[];
  }) {
    super({ ...data });
    this.input =
      typeof data.input === 'string'
        ? (data.input ?? '')
        : JSON.stringify(data.input);
    this.output = convertRetrieverOutput(data.output);
  }

  toJSON(): Record<string, any> {
    return {
      ...super.toJSON(),
      output: this.output.map((doc) => doc.toJSON())
    };
  }
}

export class ToolSpan extends BaseStep {
  input: string;
  output: string;

  type: NodeType = NodeType.tool;
  toolCallId?: string;

  constructor(data: {
    parent?: StepWithChildSpans;
    input: StepIOType;
    output?: StepIOType;
    name?: string;
    durationNs?: number;
    createdAtNs?: number;
    metadata?: Record<string, string>;
    statusCode?: number;
    groundTruth?: string;
    tags?: string[];
    toolCallId?: string;
  }) {
    super({
      ...data,
      type: NodeType.tool
    });
    this.input =
      typeof data.input === 'string'
        ? (data.input ?? '')
        : JSON.stringify(data.input);
    this.output =
      typeof data.output === 'string'
        ? (data.output ?? '')
        : JSON.stringify(data.output);
  }
}

// Type for all span types
export type Span = WorkflowSpan | LlmSpan | RetrieverSpan | ToolSpan;
