import type { DatasetDBType } from '../types/dataset.types';
import type {
  PromptTemplate,
  PromptTemplateVersion
} from '../types/prompt-template.types';
import type {
  GalileoScorers,
  LocalMetricConfig,
  Metric
} from '../types/metrics.types';

import type {
  ExperimentResponse as ExperimentResponseType,
  PromptRunSettings as PromptRunSettingsType,
  CreateJobResponse as CreateJobResponseType,
  ExperimentDatasetRequest as ExperimentDatasetRequestType,
  ExperimentUpdateRequest as ExperimentUpdateRequestType,
  ExperimentMetricsRequest as ExperimentMetricsRequestType,
  ExperimentMetricsResponse as ExperimentMetricsResponseType,
  ListExperimentResponse as ListExperimentResponseType,
  ExperimentsAvailableColumnsResponse as ExperimentsAvailableColumnsResponseType,
  RunTagDb as RunTagDbType,
  RunTagCreateRequest as RunTagCreateRequestType,
  ExperimentCreateRequest
} from './new-api.types';

import type {
  ExperimentResponse as ExperimentResponseOpenAPI,
  PromptRunSettings as PromptRunSettingsOpenAPI,
  CreateJobResponse as CreateJobResponseOpenAPI,
  ExperimentDatasetRequest as ExperimentDatasetRequestOpenAPI,
  ExperimentUpdateRequest as ExperimentUpdateRequestOpenAPI,
  ExperimentMetricsRequest as ExperimentMetricsRequestOpenAPI,
  ExperimentMetricsResponse as ExperimentMetricsResponseOpenAPI,
  ListExperimentResponse as ListExperimentResponseOpenAPI,
  ExperimentsAvailableColumnsResponse as ExperimentsAvailableColumnsResponseOpenAPI,
  RunTagDb as RunTagDbOpenAPI,
  RunTagCreateRequest as RunTagCreateRequestOpenAPI,
  ExperimentCreateRequest as ExperimentCreateRequestOpenAPI
} from './openapi.types';

export {
  ExperimentResponseType,
  PromptRunSettingsType,
  CreateJobResponseType as CreateJobResponse,
  ExperimentDatasetRequestType as ExperimentDatasetRequest,
  ExperimentUpdateRequestType as ExperimentUpdateRequest,
  ExperimentMetricsRequestType as ExperimentMetricsRequest,
  ExperimentMetricsResponseType as ExperimentMetricsResponse,
  ListExperimentResponseType as ListExperimentResponse,
  ExperimentsAvailableColumnsResponseType as ExperimentsAvailableColumnsResponse,
  RunTagDbType as RunTagDB,
  RunTagCreateRequestType as RunTagCreateRequest,
  ExperimentCreateRequest,
  ExperimentResponseOpenAPI,
  PromptRunSettingsOpenAPI,
  CreateJobResponseOpenAPI,
  ExperimentDatasetRequestOpenAPI,
  ExperimentUpdateRequestOpenAPI,
  ExperimentMetricsRequestOpenAPI,
  ExperimentMetricsResponseOpenAPI,
  ListExperimentResponseOpenAPI,
  ExperimentsAvailableColumnsResponseOpenAPI,
  RunTagDbOpenAPI,
  RunTagCreateRequestOpenAPI,
  ExperimentCreateRequestOpenAPI
};

export interface PromptRunSettings extends PromptRunSettingsType {}

export const DEFAULT_PROMPT_RUN_SETTINGS: PromptRunSettings = {
  n: 1,
  echo: false,
  tools: null,
  top_k: 40,
  top_p: 1.0,
  logprobs: true,
  max_tokens: 256,
  model_alias: 'GPT-4o',
  temperature: 0.8,
  tool_choice: null,
  top_logprobs: 5,
  stop_sequences: null,
  deployment_name: null,
  response_format: null,
  presence_penalty: 0.0,
  frequency_penalty: 0.0
} as PromptRunSettings;

type DatasetType = DatasetDBType | Record<string, unknown>[] | string;
export type PromptTemplateType = PromptTemplate | PromptTemplateVersion;

type BaseRunExperimentParams = {
  name: string;
  metrics?: (GalileoScorers | string | Metric | LocalMetricConfig)[];
  projectName?: string;
  projectId?: string;
  experimentTags?: Record<string, string>;
};

type RunExperimentWithFunctionParams<T extends Record<string, unknown>> =
  BaseRunExperimentParams & {
    function: (
      input: T,
      metadata?: Record<string, unknown>
    ) => Promise<unknown>;
  };

type RunExperimentWithPromptTemplateParams = BaseRunExperimentParams & {
  promptTemplate: PromptTemplateType;
  promptSettings?: PromptRunSettings;
};

type DatasetRunExperimentParams = BaseRunExperimentParams & {
  dataset: DatasetType;
};
type DatasetIdRunExperimentParams = BaseRunExperimentParams & {
  datasetId: string;
};
type DatasetNameRunExperimentParams = BaseRunExperimentParams & {
  datasetName: string;
};

// Union of all possible parameter combinations
export type RunExperimentParams<T extends Record<string, unknown>> =
  | (RunExperimentWithFunctionParams<T> & DatasetRunExperimentParams)
  | (RunExperimentWithFunctionParams<T> & DatasetIdRunExperimentParams)
  | (RunExperimentWithFunctionParams<T> & DatasetNameRunExperimentParams)
  | (RunExperimentWithPromptTemplateParams & DatasetRunExperimentParams)
  | (RunExperimentWithPromptTemplateParams & DatasetIdRunExperimentParams)
  | (RunExperimentWithPromptTemplateParams & DatasetNameRunExperimentParams);

export type RunExperimentOutput = {
  results?: string[];
  experiment: ExperimentResponseType;
  link: string;
  message?: string;
};

export type RunExperimentWithFunctionOutput = {
  experiment: ExperimentResponseType;
  link: string;
  message: string;
  results: string[]; // Keep results for internal use
};
