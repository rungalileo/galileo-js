export type {
  CreateJobResponse as CreateJobResponseType,
  CreateJobRequest as CreateJobRequestType,
  JobDb as JobDbType
} from './new-api.types';

export type {
  CreateJobResponse as CreateJobResponseOpenAPI,
  CreateJobRequest as CreateJobRequestOpenAPI,
  JobDb as JobDBOpenAPIType
} from './openapi.types';

/**
 * Valid task types for modeling (stored as ints for database lookups).
 */
export enum TaskType {
  VALUE_0 = 0,
  VALUE_1 = 1,
  VALUE_2 = 2,
  VALUE_3 = 3,
  VALUE_4 = 4,
  VALUE_5 = 5,
  VALUE_6 = 6,
  VALUE_7 = 7,
  VALUE_8 = 8,
  VALUE_9 = 9,
  VALUE_10 = 10,
  VALUE_11 = 11,
  VALUE_12 = 12,
  VALUE_13 = 13,
  VALUE_14 = 14,
  VALUE_15 = 15,
  VALUE_16 = 16,
  VALUE_17 = 17,
  VALUE_18 = 18
}

/**
 * Experiment task type constant used for experiment job creation.
 */
export const EXPERIMENT_TASK_TYPE = TaskType.VALUE_16;

export enum JobStatus {
  pending = 'pending',
  processing = 'processing',
  completed = 'completed',
  failed = 'failed',
  cancelled = 'cancelled'
}

/**
 * Job name constants matching Python JobName enum.
 * These represent the function names for runners entrypoint.
 */
export enum JobName {
  default = 'default',
  inference = 'inference',
  lykos_migration = 'lykos_migration',
  monitor_run = 'monitor_run',
  monitor_scorer = 'monitor_scorer',
  prompt_chain_run = 'prompt_chain_run',
  prompt_optimization = 'prompt_optimization',
  prompt_rater = 'prompt_rater',
  prompt_run = 'prompt_run',
  prompt_scorer = 'prompt_scorer',
  protect_scorer = 'protect_scorer',
  registered_scorer_validation = 'registered_scorer_validation',
  metric_critique = 'metric_critique',
  auto_gen = 'auto_gen',
  generated_scorer_validation = 'generated_scorer_validation',
  log_record_generated_scorer_validation = 'log_record_generated_scorer_validation',
  log_stream_run = 'log_stream_run',
  playground_run = 'playground_run',
  log_stream_scorer = 'log_stream_scorer',
  synthetic_datagen = 'synthetic_datagen',
  logstream_insights = 'logstream_insights',
  auto_metric_suggestion = 'auto_metric_suggestion'
}

export interface RequestData {
  prompt_scorer_settings?: {
    scorer_name: string;
  };
  scorer_config?: {
    name: string;
  };
}

/**
 * Maps canonical scorer names to their aliases.
 * Used for normalizing scorer names from aliases to canonical form.
 */
export const Scorers = {
  completeness_luna: 'completeness_nli',
  completeness_plus: 'completeness_gpt',
  context_adherence_luna: 'adherence_nli',
  context_adherence_plus: 'groundedness',
  context_relevance: 'context_relevance',
  correctness: 'factuality',
  chunk_attribution_utilization_luna: 'chunk_attribution_utilization_nli',
  chunk_attribution_utilization_plus: 'chunk_attribution_utilization_gpt',
  pii: 'pii',
  prompt_injection: 'prompt_injection',
  prompt_injection_plus: 'prompt_injection_gpt',
  prompt_perplexity: 'prompt_perplexity',
  input_sexist: 'input_sexist',
  input_sexist_plus: 'input_sexist_gpt',
  sexist: 'sexist',
  sexist_plus: 'sexist_gpt',
  tone: 'tone',
  input_toxicity: 'input_toxicity',
  input_toxicity_plus: 'input_toxicity_gpt',
  toxicity: 'toxicity',
  toxicity_plus: 'toxicity_gpt',
  instruction_adherence_plus: 'instruction_adherence',
  ground_truth_adherence_plus: 'ground_truth_adherence',
  tool_errors_plus: 'tool_error_rate',
  tool_selection_quality_plus: 'tool_selection_quality',
  action_advancement_plus: 'agentic_workflow_success',
  action_completion_plus: 'agentic_session_success'
} as const;
