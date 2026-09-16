/* galileo 2.0 Traces */

import {
  StepWithChildSpans,
  type StepWithChildSpansOptions
} from './span.types';
import { StepType } from './step.types';

import type {
  AgentSpan as AgentSpanOpenAPI,
  WorkflowSpan as WorkflowSpanOpenAPI,
  LlmSpan as LlmSpanOpenAPI,
  RetrieverSpan as RetrieverSpanOpenAPI,
  ToolSpan as ToolSpanOpenAPI,
  ExtendedAgentSpanRecordWithChildren as ExtendedAgentSpanRecordWithChildrenOpenAPI,
  ExtendedWorkflowSpanRecordWithChildren as ExtendedWorkflowSpanRecordWithChildrenOpenAPI,
  ExtendedLlmSpanRecord as ExtendedLlmSpanRecordOpenAPI,
  ExtendedToolSpanRecordWithChildren as ExtendedToolSpanRecordWithChildrenOpenAPI,
  ExtendedRetrieverSpanRecordWithChildren as ExtendedRetrieverSpanRecordWithChildrenOpenAPI
} from '../openapi.types';

import type {
  AgentSpan,
  WorkflowSpan,
  LlmSpan,
  RetrieverSpan,
  ToolSpan,
  ExtendedAgentSpanRecordWithChildren,
  ExtendedWorkflowSpanRecordWithChildren,
  ExtendedLlmSpanRecord,
  ExtendedToolSpanRecordWithChildren,
  ExtendedRetrieverSpanRecordWithChildren
} from 'galileo-generated';

export type {
  Trace as TraceSchema,
  LogTraceUpdateRequest,
  LogTraceUpdateResponse,
  LogSpanUpdateRequest,
  LogSpanUpdateResponse,
  LogSpansIngestRequest,
  LogSpansIngestResponse,
  ExtendedTraceRecordWithChildren,
  LogRecordsDeleteRequest,
  LogRecordsDeleteResponse,
  LogRecordsQueryCountRequest,
  LogRecordsQueryCountResponse,
  LogRecordsAvailableColumnsRequest,
  LogRecordsAvailableColumnsResponse,
  RecomputeLogRecordsMetricsRequest,
  ExtendedSessionRecordWithChildren,
  AggregatedTraceViewRequest,
  AggregatedTraceViewResponse
} from '../new-api.types';

export type {
  LogTracesIngestRequest,
  LogTracesIngestResponse
} from 'galileo-generated';

export type ExtendedSpanRecord =
  | ExtendedAgentSpanRecordWithChildren
  | ExtendedWorkflowSpanRecordWithChildren
  | ExtendedLlmSpanRecord
  | ExtendedToolSpanRecordWithChildren
  | ExtendedRetrieverSpanRecordWithChildren;

export type SpanSchema =
  | AgentSpan
  | WorkflowSpan
  | LlmSpan
  | RetrieverSpan
  | ToolSpan;

export {
  Trace as TraceSchemaOpenAPI,
  RecomputeLogRecordsMetricsRequest as RecomputeLogRecordsMetricsRequestOpenAPI,
  LogRecordsAvailableColumnsRequest as LogRecordsAvailableColumnsRequestOpenAPI,
  LogRecordsAvailableColumnsResponse as LogRecordsAvailableColumnsResponseOpenAPI,
  LogRecordsQueryCountRequest as LogRecordsQueryCountRequestOpenAPI,
  LogRecordsQueryCountResponse as LogRecordsQueryCountResponseOpenAPI,
  LogSpanUpdateRequest as LogSpanUpdateRequestOpenAPI,
  LogSpanUpdateResponse as LogSpanUpdateResponseOpenAPI,
  LogSpansIngestRequest as LogSpansIngestRequestOpenAPI,
  LogSpansIngestResponse as LogSpansIngestResponseOpenAPI,
  LogRecordsDeleteRequest as LogRecordsDeleteRequestOpenAPI,
  LogRecordsDeleteResponse as LogRecordsDeleteResponseOpenAPI,
  LogTraceUpdateRequest as LogTraceUpdateRequestOpenAPI,
  LogTraceUpdateResponse as LogTraceUpdateResponseOpenAPI,
  ExtendedTraceRecordWithChildren as ExtendedTraceRecordWithChildrenOpenAPI,
  ExtendedSessionRecordWithChildren as ExtendedSessionRecordWithChildrenOpenAPI,
  AggregatedTraceViewRequest as AggregatedTraceViewRequestOpenAPI,
  AggregatedTraceViewResponse as AggregatedTraceViewResponseOpenAPI,
  LogTracesIngestRequest as LogTracesIngestRequestOpenAPI,
  LogTracesIngestResponse as LogTracesIngestResponseOpenAPI
} from '../openapi.types';

export type SpanSchemaOpenAPI =
  | AgentSpanOpenAPI
  | WorkflowSpanOpenAPI
  | LlmSpanOpenAPI
  | RetrieverSpanOpenAPI
  | ToolSpanOpenAPI;

export type ExtendedSpanRecordOpenAPI =
  | ExtendedAgentSpanRecordWithChildrenOpenAPI
  | ExtendedWorkflowSpanRecordWithChildrenOpenAPI
  | ExtendedLlmSpanRecordOpenAPI
  | ExtendedToolSpanRecordWithChildrenOpenAPI
  | ExtendedRetrieverSpanRecordWithChildrenOpenAPI;

export interface TraceOptions extends StepWithChildSpansOptions {
  input: string;
  redactedInput?: string;
  output?: string;
  redactedOutput?: string;
}

export class Trace extends StepWithChildSpans {
  type: StepType = StepType.trace;
  input: string;
  redactedInput?: string;
  output?: string;
  redactedOutput?: string;

  constructor(data: TraceOptions) {
    super(StepType.trace, data);
    this.input = data.input;
    this.redactedInput = data.redactedInput;
    this.output = data.output;
    this.redactedOutput = data.redactedOutput;
  }
}
