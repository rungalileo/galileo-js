import { Models } from './models.types';
import { components } from './api.types';

export interface ScorersConfiguration {
  adherence_nli?: boolean;
  chunk_attribution_utilization_gpt?: boolean;
  chunk_attribution_utilization_nli?: boolean;
  completeness_gpt?: boolean;
  completeness_nli?: boolean;
  context_relevance?: boolean;
  factuality?: boolean;
  groundedness?: boolean;
  instruction_adherence?: boolean;
  ground_truth_adherence?: boolean;
  pii?: boolean;
  prompt_injection?: boolean;
  prompt_perplexity?: boolean;
  sexist?: boolean;
  tone?: boolean;
  tool_selection_quality?: boolean;
  tool_errors?: boolean;
  toxicity?: boolean;
}

export interface RegisteredScorer {
  registered_scorer_id: string;
  metric_name: string;
  score_type?: string;
  scoreable_node_types?: string[];
}

enum CustomizedScorerName {
  chunk_attribution_utilization_plus = '_customized_chunk_attribution_utilization_gpt',
  completeness_plus = '_customized_completeness_gpt',
  context_adherence_plus = '_customized_groundedness',
  correctness = '_customized_factuality',
  instruction_adherence = '_customized_instruction_adherence',
  tool_selection_quality = '_customized_ tool_selection_quality',
  tool_errors = '_customized_tool_errors'
}

export interface CustomizedScorer {
  scorer_name: CustomizedScorerName;
  model_alias?: Models;
  num_judges?: number;
}

export enum ScorerTypes {
  llm = 'llm',
  code = 'code',
  preset = 'preset'
}

export type ScorerVersion = components['schemas']['BaseScorerVersionDB'];

export type ScorerConfig = components['schemas']['ScorerConfig'];

export type ScorerDefaults = components['schemas']['ScorerDefaults'];

export type ModelType = components['schemas']['ModelType'];

export type ChainPollTemplate = components['schemas']['ChainPollTemplate'];

export interface Scorer {
  id: string;
  name: string;
  scorer_type: ScorerTypes;
  defaults?: ScorerDefaults;
}

export enum OutputType {
  BOOLEAN = 'boolean',
  CATEGORICAL = 'categorical',
  COUNT = 'count',
  DISCRETE = 'discrete',
  FREEFORM = 'freeform',
  PERCENTAGE = 'percentage'
}

export enum InputType {
  basic = 'basic',
  llm_spans = 'llm_spans',
  retriever_spans = 'retriever_spans',
  sessions_normalized = 'sessions_normalized',
  sessions_trace_io_only = 'sessions_trace_io_only',
  tool_spans = 'tool_spans',
  trace_input_only = 'trace_input_only',
  trace_io_only = 'trace_io_only',
  trace_normalized = 'trace_normalized',
  trace_output_only = 'trace_output_only'
}

import { StepType } from './logging/step.types';

export interface CreateLlmScorerVersionParams {
  scorerId: string;
  instructions?: string;
  chainPollTemplate?: ChainPollTemplate;
  userPrompt?: string;
  scoreableNodeTypes?: StepType[];
  cotEnabled?: boolean;
  modelName?: string;
  numJudges?: number;
  outputType?: OutputType;
}
