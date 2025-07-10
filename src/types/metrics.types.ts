import { Trace } from './logging/trace.types';
import { Span } from './logging/span.types';
import { StepType } from './logging/step.types';

export type SingleMetricValue = number | string | boolean;
export type MetricValueType =
  | SingleMetricValue
  | SingleMetricValue[]
  | Record<string, SingleMetricValue>;

/**
 * LocalMetricConfig is a configuration object for a metric that can be computed locally.
 * It contains the name of the metric, a scorer function that computes the metric value for a given input,
 * an aggregator function that aggregates the metric values for multiple inputs, and the types of nodes that the metric can be scored and aggregated for.
 */
export interface LocalMetricConfig<T extends MetricValueType> {
  name: string;
  scorer_fn: (input: Trace | Span) => Promise<T>;
  aggregator_fn?: (values: T[]) => Promise<T | Record<string, T>>;
  scorable_types: StepType[];
  aggregatable_types: StepType[];
}

/**
 * Creates a LocalMetricConfig object from a given configuration.
 * If scorable_types or aggregatable_types are not provided, they default to [NodeType.llm] and [NodeType.trace] respectively.
 */
export function createLocalScorerConfig<T extends MetricValueType>(config: {
  name: string;
  scorer_fn: (input: Trace | Span) => Promise<T>;
  aggregator_fn?: (values: T[]) => Promise<T | Record<string, T>>;
  scorable_types?: StepType[];
  aggregatable_types?: StepType[];
}): LocalMetricConfig<T> {
  return {
    name: config.name,
    scorer_fn: config.scorer_fn,
    aggregator_fn: config.aggregator_fn || undefined,
    scorable_types: config.scorable_types || [StepType.llm],
    aggregatable_types: config.aggregatable_types || [StepType.trace]
  };
}

/* eslint-disable @typescript-eslint/no-duplicate-enum-values */
export enum GalileoScorers {
  ActionCompletionLuna = 'action_completion_luna',

  ActionAdvancementLuna = 'action_advancement_luna',

  AgenticSessionSuccess = 'agentic_session_success',
  ActionCompletion = 'agentic_session_success',

  AgenticWorkflowSuccess = 'agentic_workflow_success',
  ActionAdvancement = 'agentic_workflow_success',

  Bleu = 'bleu',

  ChunkAttributionUtilization = 'chunk_attribution_utilization',

  ChunkAttributionUtilizationLuna = 'chunk_attribution_utilization_luna',

  Completeness = 'completeness',

  CompletenessLuna = 'completeness_luna',

  ContextAdherence = 'context_adherence',

  ContextAdherenceLuna = 'context_adherence_luna',

  ContextRelevance = 'context_relevance',

  Correctness = 'correctness',

  GroundTruthAdherence = 'ground_truth_adherence',

  InputPii = 'input_pii',

  InputSexist = 'input_sexist',
  InputSexism = 'input_sexist',

  InputSexistLuna = 'input_sexist_luna',
  InputSexismLuna = 'input_sexist_luna',

  InputTone = 'input_tone',

  InputToxicity = 'input_toxicity',

  InputToxicityLuna = 'input_toxicity_luna',

  InstructionAdherence = 'instruction_adherence',

  OutputPii = 'output_pii',

  OutputSexist = 'output_sexist',
  OutputSexism = 'output_sexist',

  OutputSexistLuna = 'output_sexist_luna',
  OutputSexismLuna = 'output_sexist_luna',

  OutputTone = 'output_tone',

  OutputToxicity = 'output_toxicity',

  OutputToxicityLuna = 'output_toxicity_luna',

  PromptInjection = 'prompt_injection',

  PromptInjectionLuna = 'prompt_injection_luna',

  PromptPerplexity = 'prompt_perplexity',

  Rouge = 'rouge',

  ToolErrorRate = 'tool_error_rate',

  ToolErrorRateLuna = 'tool_error_rate_luna',

  ToolSelectionQuality = 'tool_selection_quality',

  ToolSelectionQualityLuna = 'tool_selection_quality_luna',

  Uncertainty = 'uncertainty'
}
/* eslint-enable @typescript-eslint/no-duplicate-enum-values */

export interface Metric {
  name: string;
  version?: number;
}
