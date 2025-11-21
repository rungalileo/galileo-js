import { OutputType, ScorerTypes } from './scorer.types';
import { StepType } from './logging/step.types';
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
 * Galileo scorers as a const object.
 * Generated from OpenAPI schema to ensure type safety and completeness.
 *
 * This object provides camelCase keys for better developer experience
 * while maintaining the snake_case values required by the API.
 *
 * Includes backward compatibility aliases for deprecated names.
 *
 * @example
 * ```typescript
 * import { GalileoScorers } from 'galileo';
 *
 * // Use const object values
 * const metrics = [GalileoScorers.correctness, GalileoScorers.completeness];
 * ```
 */
/* eslint-disable @typescript-eslint/no-duplicate-enum-values */
export const GalileoScorers = {
  // Primary entries (all unique values from OpenAPI)
  actionCompletionLuna: 'action_completion_luna',
  actionAdvancementLuna: 'action_advancement_luna',
  agenticSessionSuccess: 'agentic_session_success',
  agenticWorkflowSuccess: 'agentic_workflow_success',
  agentEfficiency: 'agent_efficiency',
  agentFlow: 'agent_flow',
  bleu: 'bleu',
  chunkAttributionUtilization: 'chunk_attribution_utilization',
  chunkAttributionUtilizationLuna: 'chunk_attribution_utilization_luna',
  completeness: 'completeness',
  completenessLuna: 'completeness_luna',
  contextAdherence: 'context_adherence',
  contextAdherenceLuna: 'context_adherence_luna',
  contextRelevance: 'context_relevance',
  conversationQuality: 'conversation_quality',
  correctness: 'correctness',
  groundTruthAdherence: 'ground_truth_adherence',
  inputPii: 'input_pii',
  inputPiiGpt: 'input_pii_gpt',
  inputSexist: 'input_sexist',
  inputSexistLuna: 'input_sexist_luna',
  inputTone: 'input_tone',
  inputToneGpt: 'input_tone_gpt',
  inputToxicity: 'input_toxicity',
  inputToxicityLuna: 'input_toxicity_luna',
  instructionAdherence: 'instruction_adherence',
  outputPii: 'output_pii',
  outputPiiGpt: 'output_pii_gpt',
  outputSexist: 'output_sexist',
  outputSexistLuna: 'output_sexist_luna',
  outputTone: 'output_tone',
  outputToneGpt: 'output_tone_gpt',
  outputToxicity: 'output_toxicity',
  outputToxicityLuna: 'output_toxicity_luna',
  promptInjection: 'prompt_injection',
  promptInjectionLuna: 'prompt_injection_luna',
  promptPerplexity: 'prompt_perplexity',
  rouge: 'rouge',
  toolErrorRate: 'tool_error_rate',
  toolErrorRateLuna: 'tool_error_rate_luna',
  toolSelectionQuality: 'tool_selection_quality',
  toolSelectionQualityLuna: 'tool_selection_quality_luna',
  uncertainty: 'uncertainty',
  userIntentChange: 'user_intent_change',

  // Backward compatibility aliases
  actionCompletion: 'agentic_session_success',
  actionAdvancement: 'agentic_workflow_success',
  inputSexism: 'input_sexist',
  inputSexismLuna: 'input_sexist_luna',
  outputSexism: 'output_sexist',
  outputSexismLuna: 'output_sexist_luna'
} as const satisfies Record<string, ScorerNameOpenAPI>;
/* eslint-enable @typescript-eslint/no-duplicate-enum-values */

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
 * Type representing all valid Galileo scorer names.
 * This is a union of all string literal values from the OpenAPI schema.
 *
 * Use the {@link GalileoScorers} const object for runtime access to scorer names.
 *
 * @example
 * ```typescript
 * import { GalileoScorers, type GalileoScorers as GalileoScorersType } from 'galileo';
 *
 * // Runtime usage
 * const scorer: string = GalileoScorers.correctness;
 *
 * // Type usage
 * function validateScorer(name: GalileoScorersType): boolean {
 *   return Object.values(GalileoScorers).includes(name);
 * }
 * ```
 */
export type GalileoScorers = ScorerNameOpenAPI;
