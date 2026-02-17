import type {
  BaseStepOptions,
  LlmSpanAllowedInputType,
  LlmSpanAllowedOutputType,
  MetricsOptions,
  RetrieverSpanAllowedOutputType,
  SerializedStep,
  StepAllowedInputType,
  StepAllowedOutputType
} from './step.types';
import { BaseStep, Metrics, StepType } from './step.types';
import type { SerializedMetrics } from './step.types';
import type { Message } from '../message.types';
import { MessageRole } from '../message.types';
import {
  convertLlmInput,
  convertLlmOutput,
  convertRetrieverOutput
} from '../../utils/span';
import type { Document } from '../document.types';
import type { MetricValueType } from '../metrics.types';
import { AgentType } from '../new-api.types';
import type { JsonValue, JsonObject, JsonArray } from '../base.types';

/**
 * Types of events that can appear in reasoning/multi-turn model outputs.
 */
export enum EventType {
  message = 'message',
  reasoning = 'reasoning',
  internal_tool_call = 'internal_tool_call',
  image_generation = 'image_generation',
  mcp_call = 'mcp_call',
  mcp_list_tools = 'mcp_list_tools',
  mcp_approval_request = 'mcp_approval_request'
}

/**
 * Common status values for events.
 */
export enum EventStatus {
  in_progress = 'in_progress',
  completed = 'completed',
  failed = 'failed',
  cancelled = 'cancelled',
  incomplete = 'incomplete'
}

/**
 * Base interface for all event types with common fields.
 */
export interface BaseEvent {
  type: EventType;
  id?: string;
  status?: EventStatus;
  metadata?: JsonObject;
  errorMessage?: string;
}

/**
 * An output message from the model.
 */
export interface MessageEvent extends BaseEvent {
  type: EventType.message;
  role: MessageRole;
  content?: string;
  contentParts?: JsonArray;
}

/**
 * Internal reasoning/thinking from the model (e.g., OpenAI o1/o3 reasoning tokens).
 */
export interface ReasoningEvent extends BaseEvent {
  type: EventType.reasoning;
  content?: string;
  summary?: string;
}

/**
 * A tool call executed internally by the model during reasoning.
 * This represents internal tools like web search, code execution, file search, etc.
 * that the model invokes (not user-defined functions or MCP tools).
 */
export interface InternalToolCall extends BaseEvent {
  type: EventType.internal_tool_call;
  name: string;
  input?: JsonObject;
  output?: JsonObject;
}

/**
 * An image generation event from the model.
 */
export interface ImageGenerationEvent extends BaseEvent {
  type: EventType.image_generation;
  prompt?: string;
  images?: JsonArray;
  model?: string;
}

/**
 * A Model Context Protocol (MCP) tool call.
 * MCP is a protocol for connecting LLMs to external tools/data sources.
 * This is distinct from internal tools because it involves external integrations.
 */
export interface MCPCallEvent extends BaseEvent {
  type: EventType.mcp_call;
  toolName?: string;
  serverName?: string;
  arguments?: JsonObject;
  result?: JsonObject;
}

/**
 * MCP list tools event - when the model queries available MCP tools.
 */
export interface MCPListToolsEvent extends BaseEvent {
  type: EventType.mcp_list_tools;
  serverName?: string;
  tools?: JsonArray;
}

/**
 * MCP approval request - when human approval is needed for an MCP tool call.
 */
export interface MCPApprovalRequestEvent extends BaseEvent {
  type: EventType.mcp_approval_request;
  toolName?: string;
  toolInvocation?: JsonObject;
  approved?: boolean;
}

/**
 * Union of all event types.
 */
export type Event =
  | MessageEvent
  | ReasoningEvent
  | InternalToolCall
  | ImageGenerationEvent
  | MCPCallEvent
  | MCPListToolsEvent
  | MCPApprovalRequestEvent;

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

export interface SerializedStepWithChildSpans extends SerializedStep {
  spans?: JsonArray;
}

export class StepWithChildSpans extends BaseSpan {
  spans: Span[] = [];

  constructor(type: StepType, data: StepWithChildSpansOptions) {
    super(type, data);
    this.spans = data.spans || [];
  }

  toJSON(): SerializedStepWithChildSpans {
    return {
      ...super.toJSON(),
      spans: this.spans.map((span) => span.toJSON()) as JsonArray
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

export { AgentType };

export interface AgentSpanOptions extends StepWithChildSpansOptions {
  agentType?: AgentType;
}

export interface SerializedAgentSpan extends SerializedStepWithChildSpans {
  agentType: AgentType;
}

export class AgentSpan extends StepWithChildSpans {
  type: StepType = StepType.agent;
  agentType: AgentType;

  constructor(data: AgentSpanOptions) {
    super(StepType.agent, data);
    this.agentType = data.agentType || AgentType.DEFAULT;
  }

  toJSON(): SerializedAgentSpan {
    return {
      ...super.toJSON(),
      agentType: this.agentType
    };
  }
}

export interface LlmMetricsOptions extends MetricsOptions {
  numInputTokens?: number;
  numOutputTokens?: number;
  numTotalTokens?: number;
  numReasoningTokens?: number;
  numCachedInputTokens?: number;
  timeToFirstTokenNs?: number;
}

export interface SerializedLlmMetrics extends SerializedMetrics {
  numInputTokens?: number;
  numOutputTokens?: number;
  numTotalTokens?: number;
  numReasoningTokens?: number;
  numCachedInputTokens?: number;
  timeToFirstTokenNs?: number;
}

export class LlmMetrics extends Metrics {
  numInputTokens?: number;
  numOutputTokens?: number;
  numTotalTokens?: number;
  numReasoningTokens?: number;
  numCachedInputTokens?: number;
  timeToFirstTokenNs?: number;

  constructor(options: LlmMetricsOptions) {
    super(options);
  }

  toJSON(): SerializedLlmMetrics {
    return Object.keys(this).reduce((result, key) => {
      const value = this[key];
      if (typeof value !== 'function') {
        result[key] = value;
      }
      return result;
    }, {} as SerializedLlmMetrics);
  }
}

export interface LlmSpanOptions extends BaseSpanOptions {
  input: LlmSpanAllowedInputType;
  redactedInput?: LlmSpanAllowedInputType;
  output: LlmSpanAllowedOutputType;
  redactedOutput?: LlmSpanAllowedOutputType;
  metrics?: LlmMetrics;
  tools?: JsonObject[];
  model?: string;
  temperature?: number;
  finishReason?: string;
  events?: Event[];
}

export interface SerializedLlmSpan extends SerializedStep {
  metrics?: {
    numInputTokens?: number;
    numOutputTokens?: number;
    numTotalTokens?: number;
    numReasoningTokens?: number;
    numCachedInputTokens?: number;
    timeToFirstTokenNs?: number;
    durationNs?: number;
  };
  [key: string]:
    | MetricValueType
    | JsonArray
    | StepAllowedInputType
    | StepAllowedOutputType
    | undefined;
}

export class LlmSpan extends BaseSpan {
  type: StepType = StepType.llm;
  input: Message[];
  redactedInput?: Message[];
  output: Message;
  redactedOutput?: Message;
  metrics: LlmMetrics = new LlmMetrics({});
  tools?: JsonObject[];
  model?: string;
  temperature?: number;
  finishReason?: string;
  events?: Event[];

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
    this.events = data.events;
  }

  toJSON(): SerializedLlmSpan {
    const baseJson = super.toJSON();

    return {
      ...baseJson,
      metrics: this.metrics.toJSON(),
      tools: this.tools as JsonArray | undefined,
      model: this.model,
      temperature: this.temperature,
      finishReason: this.finishReason,
      events: this.events as JsonArray | undefined
    } as SerializedLlmSpan;
  }
}

export interface RetrieverSpanOptions extends BaseSpanOptions {
  input: string;
  redactedInput?: string;
  output?: RetrieverSpanAllowedOutputType;
  redactedOutput?: RetrieverSpanAllowedOutputType;
}

export interface SerializedRetrieverSpan extends Omit<
  SerializedStep,
  'output'
> {
  output: JsonArray;
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

  toJSON(): SerializedRetrieverSpan {
    return {
      ...super.toJSON(),
      output: this.output.map((doc) => doc.toJSON() as JsonObject) as JsonArray
    } as SerializedRetrieverSpan;
  }
}

export interface ToolSpanOptions extends Omit<
  BaseSpanOptions,
  'input' | 'redactedInput' | 'output' | 'redactedOutput'
> {
  input: JsonValue;
  redactedInput?: JsonValue;
  output?: JsonValue;
  redactedOutput?: JsonValue;
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
    // Convert JsonValue input to string for BaseStepOptions compatibility
    super(StepType.tool, {
      ...data,
      input:
        typeof data.input === 'string'
          ? data.input
          : JSON.stringify(data.input),
      redactedInput: data.redactedInput
        ? typeof data.redactedInput === 'string'
          ? data.redactedInput
          : JSON.stringify(data.redactedInput)
        : undefined,
      output:
        typeof data.output === 'string'
          ? data.output
          : JSON.stringify(data.output),
      redactedOutput: data.redactedOutput
        ? typeof data.redactedOutput === 'string'
          ? data.redactedOutput
          : JSON.stringify(data.redactedOutput)
        : undefined
    });

    // Convert JsonValue to string for storage
    this.input =
      typeof data.input === 'string' ? data.input : JSON.stringify(data.input);
    this.redactedInput =
      typeof data.redactedInput === 'string'
        ? data.redactedInput
        : data.redactedInput !== undefined
          ? JSON.stringify(data.redactedInput)
          : undefined;
    this.output =
      typeof data.output === 'string'
        ? data.output
        : JSON.stringify(data.output);
    this.redactedOutput =
      typeof data.redactedOutput === 'string'
        ? (data.redactedOutput ?? '')
        : data.redactedOutput !== undefined
          ? JSON.stringify(data.redactedOutput)
          : undefined;
    this.toolCallId = data.toolCallId;
  }

  toJSON(): SerializedStep {
    return {
      ...super.toJSON(),
      toolCallId: this.toolCallId
    } as SerializedStep;
  }
}

// Type for all span types
export type Span =
  | WorkflowSpan
  | AgentSpan
  | LlmSpan
  | RetrieverSpan
  | ToolSpan;

/**
 * Type guard to validate if a value is a valid AgentType
 */
export function isValidAgentType(value: unknown): value is AgentType {
  return (
    typeof value === 'string' &&
    Object.values(AgentType).includes(value as AgentType)
  );
}
