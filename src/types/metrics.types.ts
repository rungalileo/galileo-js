export interface Metrics {
  durationNs?: number;
}

export interface LlmMetrics extends Metrics {
  numInputTokens?: number;
  numOutputTokens?: number;
  numTotalTokens?: number;
  timeToFirstTokenNs?: number;
}

/* eslint-disable @typescript-eslint/no-duplicate-enum-values */
export enum GalileoScorers {
  ActionCompletion = 'agentic_session_success',
  ActionCompletionLuna = 'action_completion_luna',
  ActionAdvancement = 'agentic_workflow_success',
  ActionAdvancementLuna = 'action_advancement_luna',
  AgenticSessionSuccess = 'agentic_session_success',
  AgenticWorkflowSuccess = 'agentic_workflow_success',
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
  InputSexism = 'input_sexist',
  InputSexismLuna = 'input_sexist_luna',
  InputTone = 'input_tone',
  InputToxicity = 'input_toxicity',
  InputToxicityLuna = 'input_toxicity_luna',
  InstructionAdherence = 'instruction_adherence',
  OutputPii = 'output_pii',
  OutputSexism = 'output_sexist',
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
