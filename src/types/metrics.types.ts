import type { OutputType, ScorerTypes } from './scorer.types';
import type { StepType } from './logging/step.types';
import type { components } from './api.types';
import type { ObjectToCamel } from 'ts-case-convert';
import type { Span } from './logging/span.types';
import type { Trace } from './logging/trace.types';

export type LogRecordsMetricsQueryRequestOpenAPI =
  components['schemas']['LogRecordsMetricsQueryRequest'];
export type LogRecordsMetricsResponseOpenAPI =
  components['schemas']['LogRecordsMetricsResponse'];
export type ScorerNameOpenAPI =
  components['schemas']['galileo_core__schemas__shared__scorers__scorer_name__ScorerName'];

export type SingleMetricValue = number | string | boolean;
export type MetricValueType =
  | SingleMetricValue
  | SingleMetricValue[]
  | Record<string, SingleMetricValue>;

/**
 * Built-in Galileo metric scorers.
 *
 * Values are human-readable UI labels used for scorer lookup via the API.
 * Naming convention: base name = LLM version, `Luna` suffix = SLM version.
 *
 * @example
 * ```typescript
 * import { GalileoMetrics } from 'galileo';
 *
 * await enableMetrics({
 *   projectName: 'my-project',
 *   logStreamName: 'default',
 *   metrics: [GalileoMetrics.correctness, GalileoMetrics.completeness],
 * });
 * ```
 */
export const GalileoMetrics = {
  actionAdvancement: 'Action Advancement',
  actionAdvancementLuna: 'Action Advancement (SLM)',
  actionCompletion: 'Action Completion',
  actionCompletionLuna: 'Action Completion (SLM)',
  agentEfficiency: 'Agent Efficiency',
  agentFlow: 'Agent Flow',
  chunkAttributionUtilization: 'Chunk Attribution Utilization',
  chunkAttributionUtilizationLuna: 'Chunk Attribution Utilization (SLM)',
  completeness: 'Completeness',
  completenessLuna: 'Completeness (SLM)',
  contextAdherence: 'Context Adherence',
  contextAdherenceLuna: 'Context Adherence (SLM)',
  contextPrecision: 'Context Precision',
  contextRelevance: 'Context Relevance',
  contextRelevanceLuna: 'Context Relevance (SLM)',
  conversationQuality: 'Conversation Quality',
  correctness: 'Correctness',
  groundTruthAdherence: 'Ground Truth Adherence',
  inputPii: 'Input PII', // LLM (fixed — was SLM)
  inputPiiLuna: 'Input PII (SLM)',
  inputSexism: 'Input Sexism',
  inputSexismLuna: 'Input Sexism (SLM)',
  inputTone: 'Input Tone', // LLM (fixed — was SLM)
  inputToneLuna: 'Input Tone (SLM)',
  inputToxicity: 'Input Toxicity',
  inputToxicityLuna: 'Input Toxicity (SLM)',
  instructionAdherence: 'Instruction Adherence',
  outputPii: 'Output PII', // LLM (fixed — was SLM)
  outputPiiLuna: 'Output PII (SLM)',
  outputSexism: 'Output Sexism',
  outputSexismLuna: 'Output Sexism (SLM)',
  outputTone: 'Output Tone', // LLM (fixed — was SLM)
  outputToneLuna: 'Output Tone (SLM)',
  outputToxicity: 'Output Toxicity',
  outputToxicityLuna: 'Output Toxicity (SLM)',
  precisionAtK: 'Precision@K',
  promptInjection: 'Prompt Injection',
  promptInjectionLuna: 'Prompt Injection (SLM)',
  reasoningCoherence: 'Reasoning Coherence',
  sqlAdherence: 'SQL Adherence',
  sqlCorrectness: 'SQL Correctness',
  sqlEfficiency: 'SQL Efficiency',
  sqlInjection: 'SQL Injection',
  toolErrorRate: 'Tool Error Rate',
  toolErrorRateLuna: 'Tool Error Rate (SLM)',
  toolSelectionQuality: 'Tool Selection Quality',
  toolSelectionQualityLuna: 'Tool Selection Quality (SLM)',
  userIntentChange: 'User Intent Change'
} as const;

export interface Metric {
  name: string;
  version?: number;
}

export interface CreateCustomLlmMetricParams {
  name: string;
  userPrompt: string;
  nodeLevel?: StepType;
  cotEnabled?: boolean;
  modelName?: string;
  numJudges?: number;
  description?: string;
  tags?: string[];
  outputType?: OutputType;
}

export interface CreateCustomCodeMetricParams {
  name: string;
  codePath: string;
  nodeLevel: StepType;
  description?: string;
  tags?: string[];
  /** Maximum time to wait for code validation in milliseconds (default: 60000ms / 1 minute) */
  timeoutMs?: number;
  /** Interval between validation polling attempts in milliseconds (default: 1000ms) */
  pollIntervalMs?: number;
  /** List of required metrics that this scorer depends on (can be GalileoMetrics values or metric name strings) */
  requiredMetrics?: (GalileoMetrics | string)[];
}

export interface DeleteMetricParams {
  scorerName: string;
  scorerType: ScorerTypes;
}

/**
 * Parameters for deleting a metric by name only.
 * This will delete all scorers with the given name, regardless of type.
 */
export interface DeleteMetricByNameParams {
  name: string;
}

/**
 * Configuration for a local metric that is computed client-side.
 *
 * This interface defines metrics that are evaluated on the client rather than server-side.
 * Local metrics are useful for custom scoring logic that needs to run in the client environment.
 */
export interface LocalMetricConfig {
  /** The name of the metric */
  name: string;
  /**
   * The scoring function that computes the metric value.
   * Takes a trace or span and returns a metric value.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  scorerFn: (traceOrSpan: Trace | Span) => MetricValueType;
  /**
   * Optional aggregator function to combine scores from child spans.
   * Takes an array of metric values and returns an aggregated value.
   */
  aggregatorFn?: (scores: MetricValueType[]) => MetricValueType;
  /**
   * The step types that can be scored by this metric.
   * @default ['llm']
   */
  scorableTypes?: string[];
  /**
   * The step types that can have aggregated scores.
   * Must not contain any types in scorableTypes.
   * Can only contain 'trace' or 'workflow' step types.
   * @default ['trace']
   */
  aggregatableTypes?: string[];
}

export type LogRecordsMetricsQueryRequest =
  ObjectToCamel<LogRecordsMetricsQueryRequestOpenAPI>;
export type LogRecordsMetricsResponse =
  ObjectToCamel<LogRecordsMetricsResponseOpenAPI>;

/**
 * Type representing all valid Galileo metric labels.
 * This is a union of all human-readable label string literals from the GalileoMetrics const.
 *
 * Use the {@link GalileoMetrics} const object for runtime access to metric labels.
 */
export type GalileoMetrics =
  (typeof GalileoMetrics)[keyof typeof GalileoMetrics];
