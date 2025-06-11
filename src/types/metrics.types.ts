export interface Metrics {
  durationNs?: number;
}

export interface LlmMetrics extends Metrics {
  numInputTokens?: number;
  numOutputTokens?: number;
  numTotalTokens?: number;
  timeToFirstTokenNs?: number;
}

export enum GalileoScorers {
  ACTION_COMPLETION = 'agentic_session_success',
  ACTION_COMPLETION_LUNA = 'action_completion_luna',
  ACTION_ADVANCEMENT = 'agentic_workflow_success',
  ACTION_ADVANCEMENT_LUNA = 'action_advancement_luna',
  BLEU = 'bleu',
  CHUNK_ATTRIBUTION_UTILIZATION = 'chunk_attribution_utilization',
  CHUNK_ATTRIBUTION_UTILIZATION_LUNA = 'chunk_attribution_utilization_luna',
  COMPLETENESS = 'completeness',
  COMPLETENESS_LUNA = 'completeness_luna',
  CONTEXT_ADHERENCE = 'context_adherence',
  CONTEXT_ADHERENCE_LUNA = 'context_adherence_luna',
  CONTEXT_RELEVANCE = 'context_relevance',
  CORRECTNESS = 'correctness',
  GROUND_TRUTH_ADHERENCE = 'ground_truth_adherence',
  INPUT_PII = 'input_pii',
  INPUT_SEXISM = 'input_sexist',
  INPUT_SEXISM_LUNA = 'input_sexist_luna',
  INPUT_TONE = 'input_tone',
  INPUT_TOXICITY = 'input_toxicity',
  INPUT_TOXICITY_LUNA = 'input_toxicity_luna',
  INSTRUCTION_ADHERENCE = 'instruction_adherence',
  OUTPUT_PII = 'output_pii',
  OUTPUT_SEXISM = 'output_sexist',
  OUTPUT_SEXISM_LUNA = 'output_sexist_luna',
  OUTPUT_TONE = 'output_tone',
  OUTPUT_TOXICITY = 'output_toxicity',
  OUTPUT_TOXICITY_LUNA = 'output_toxicity_luna',
  PROMPT_INJECTION = 'prompt_injection',
  PROMPT_INJECTION_LUNA = 'prompt_injection_luna',
  PROMPT_PERPLEXITY = 'prompt_perplexity',
  ROUGE_1 = 'rouge',
  TOOL_ERRORS = 'tool_error_rate',
  TOOL_ERRORS_LUNA = 'tool_error_rate_luna',
  TOOL_SELECTION_QUALITY = 'tool_selection_quality',
  TOOL_SELECTION_QUALITY_LUNA = 'tool_selection_quality_luna',
  UNCERTAINTY = 'uncertainty'
}
