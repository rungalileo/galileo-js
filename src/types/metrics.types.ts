import { OutputType, ScorerTypes } from './scorer.types';
import { StepType } from './logging/step.types';

export type SingleMetricValue = number | string | boolean;
export type MetricValueType =
  | SingleMetricValue
  | SingleMetricValue[]
  | Record<string, SingleMetricValue>;

/* eslint-disable @typescript-eslint/no-duplicate-enum-values */
export enum GalileoScorers {
  ActionCompletionLuna = 'action_completion_luna',

  ActionAdvancementLuna = 'action_advancement_luna',

  AgenticSessionSuccess = 'agentic_session_success',
  ActionCompletion = 'agentic_session_success',

  AgenticWorkflowSuccess = 'agentic_workflow_success',
  ActionAdvancement = 'agentic_workflow_success',

  AgentEfficiency = 'agent_efficiency',

  AgentFlow = 'agent_flow',

  Bleu = 'bleu',

  ChunkAttributionUtilization = 'chunk_attribution_utilization',

  ChunkAttributionUtilizationLuna = 'chunk_attribution_utilization_luna',

  Completeness = 'completeness',

  CompletenessLuna = 'completeness_luna',

  ContextAdherence = 'context_adherence',

  ContextAdherenceLuna = 'context_adherence_luna',

  ContextRelevance = 'context_relevance',

  ConversationQuality = 'conversation_quality',

  Correctness = 'correctness',

  GroundTruthAdherence = 'ground_truth_adherence',

  InputPii = 'input_pii',
  InputPiiGPT = 'input_pii_gpt',

  InputSexist = 'input_sexist',
  InputSexism = 'input_sexist',

  InputSexistLuna = 'input_sexist_luna',
  InputSexismLuna = 'input_sexist_luna',

  InputTone = 'input_tone',
  InputToneGPT = 'input_tone_gpt',

  InputToxicity = 'input_toxicity',

  InputToxicityLuna = 'input_toxicity_luna',

  InstructionAdherence = 'instruction_adherence',

  OutputPii = 'output_pii',
  OutputPiiGPT = 'output_pii_gpt',

  OutputSexist = 'output_sexist',
  OutputSexism = 'output_sexist',

  OutputSexistLuna = 'output_sexist_luna',
  OutputSexismLuna = 'output_sexist_luna',

  OutputTone = 'output_tone',
  OutputToneGPT = 'output_tone_gpt',

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

  Uncertainty = 'uncertainty',

  UserIntentChange = 'user_intent_change',
}
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

export interface DeleteMetricParams {
  scorerName: string;
  scorerType: ScorerTypes;
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
  scorerFn: (traceOrSpan: any) => MetricValueType;
  /**
   * Optional aggregator function to combine scores from child spans.
   * Takes an array of metric values and returns an aggregated value.
   */
  aggregatorFn?: (scores: MetricValueType[]) => MetricValueType;
  /**
   * The step types that can be scored by this metric.
   * Defaults to ['llm'] if not specified.
   */
  scorableTypes?: string[];
  /**
   * The step types that can have aggregated scores.
   * Defaults to ['trace'] if not specified.
   */
  aggregatableTypes?: string[];
}
