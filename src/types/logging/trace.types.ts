/* galileo 2.0 Traces */

import type { components } from '../api.types';
import { StepWithChildSpans, StepWithChildSpansOptions } from './span.types';
import { StepType } from './step.types';
import type { ObjectToCamel } from 'ts-case-convert';

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

// OpenAPI types from api.types.ts (source of truth)
export type RecomputeLogRecordsMetricsRequestOpenAPI =
  components['schemas']['RecomputeLogRecordsMetricsRequest'];
export type LogRecordsAvailableColumnsRequestOpenAPI =
  components['schemas']['LogRecordsAvailableColumnsRequest'];
export type LogRecordsAvailableColumnsResponseOpenAPI =
  components['schemas']['LogRecordsAvailableColumnsResponse'];
export type LogRecordsQueryCountRequestOpenAPI =
  components['schemas']['LogRecordsQueryCountRequest'];
export type LogRecordsQueryCountResponseOpenAPI =
  components['schemas']['LogRecordsQueryCountResponse'];
export type LogSpanUpdateRequestOpenAPI =
  components['schemas']['LogSpanUpdateRequest'];
export type LogSpanUpdateResponseOpenAPI =
  components['schemas']['LogSpanUpdateResponse'];
export type LogSpansIngestRequestOpenAPI =
  components['schemas']['LogSpansIngestRequest'];
export type LogSpansIngestResponseOpenAPI =
  components['schemas']['LogSpansIngestResponse'];
export type LogRecordsDeleteRequestOpenAPI =
  components['schemas']['LogRecordsDeleteRequest'];
export type LogRecordsDeleteResponseOpenAPI =
  components['schemas']['LogRecordsDeleteResponse'];
export type LogTraceUpdateRequestOpenAPI =
  components['schemas']['LogTraceUpdateRequest'];
export type LogTraceUpdateResponseOpenAPI =
  components['schemas']['LogTraceUpdateResponse'];
export type ExtendedTraceRecordWithChildrenOpenAPI =
  components['schemas']['ExtendedTraceRecordWithChildren'];
export type ExtendedSpanRecordOpenAPI =
  | components['schemas']['ExtendedAgentSpanRecordWithChildren']
  | components['schemas']['ExtendedWorkflowSpanRecordWithChildren']
  | components['schemas']['ExtendedLlmSpanRecord']
  | components['schemas']['ExtendedToolSpanRecordWithChildren']
  | components['schemas']['ExtendedRetrieverSpanRecordWithChildren'];
export type ExtendedSessionRecordWithChildrenOpenAPI =
  components['schemas']['ExtendedSessionRecordWithChildren'];
export type AggregatedTraceViewRequestOpenAPI =
  components['schemas']['AggregatedTraceViewRequest'];
export type AggregatedTraceViewResponseOpenAPI =
  components['schemas']['AggregatedTraceViewResponse'];
export type LogTracesIngestRequestOpenAPI =
  components['schemas']['LogTracesIngestRequest'];
export type LogTracesIngestResponseOpenAPI =
  components['schemas']['LogTracesIngestResponse'];

// SDK-facing types (camelCase converted versions)
export type LogTraceUpdateRequest = ObjectToCamel<LogTraceUpdateRequestOpenAPI>;
export type LogTraceUpdateResponse =
  ObjectToCamel<LogTraceUpdateResponseOpenAPI>;
export type LogSpanUpdateRequest = ObjectToCamel<LogSpanUpdateRequestOpenAPI>;
export type LogSpanUpdateResponse = ObjectToCamel<LogSpanUpdateResponseOpenAPI>;
export type LogSpansIngestRequest = ObjectToCamel<LogSpansIngestRequestOpenAPI>;
export type LogSpansIngestResponse =
  ObjectToCamel<LogSpansIngestResponseOpenAPI>;
export type ExtendedTraceRecordWithChildren =
  ObjectToCamel<ExtendedTraceRecordWithChildrenOpenAPI>;
export type LogRecordsDeleteRequest =
  ObjectToCamel<LogRecordsDeleteRequestOpenAPI>;
export type LogRecordsDeleteResponse =
  ObjectToCamel<LogRecordsDeleteResponseOpenAPI>;
export type LogRecordsQueryCountRequest =
  ObjectToCamel<LogRecordsQueryCountRequestOpenAPI>;
export type LogRecordsQueryCountResponse =
  ObjectToCamel<LogRecordsQueryCountResponseOpenAPI>;
export type LogRecordsAvailableColumnsRequest =
  ObjectToCamel<LogRecordsAvailableColumnsRequestOpenAPI>;
export type LogRecordsAvailableColumnsResponse =
  ObjectToCamel<LogRecordsAvailableColumnsResponseOpenAPI>;
export type RecomputeLogRecordsMetricsRequest =
  ObjectToCamel<RecomputeLogRecordsMetricsRequestOpenAPI>;
export type ExtendedSpanRecord = ObjectToCamel<ExtendedSpanRecordOpenAPI>;
export type ExtendedSessionRecordWithChildren =
  ObjectToCamel<ExtendedSessionRecordWithChildrenOpenAPI>;
export type AggregatedTraceViewRequest =
  ObjectToCamel<AggregatedTraceViewRequestOpenAPI>;
export type AggregatedTraceViewResponse =
  ObjectToCamel<AggregatedTraceViewResponseOpenAPI>;
export type LogTracesIngestRequest =
  ObjectToCamel<LogTracesIngestRequestOpenAPI>;
export type LogTracesIngestResponse =
  ObjectToCamel<LogTracesIngestResponseOpenAPI>;
