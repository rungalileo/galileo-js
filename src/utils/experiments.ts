import type {
  ExperimentResponseType,
  ExperimentDatasetRequest,
  ExperimentUpdateRequest,
  RunExperimentParams,
  RunExperimentOutput
} from '../types/experiment.types';
import {
  PromptTemplate,
  PromptTemplateVersion
} from '../types/prompt-template.types';
import { GalileoApiClient } from '../api-client';
import { log } from '../wrappers';
import { init, flush, experimentContext } from '../singleton';
import { ScorerConfig } from '../types/scorer.types';
import { DatasetDBType, DatasetRecord } from '../types/dataset.types';
import {
  deserializeInputFromString,
  getDatasetRecordsFromArray,
  getRecordsForDataset,
  getDatasetMetadata
} from '../utils/datasets';
import {
  GalileoMetrics,
  LocalMetricConfig,
  Metric
} from '../types/metrics.types';
import { createMetricConfigs } from './metrics';
import { Project } from '../types';
import { getProjectWithEnvFallbacks } from './projects';

type DatasetType = DatasetDBType | Record<string, unknown>[];
type PromptTemplateType = PromptTemplate | PromptTemplateVersion;

type BaseRunExperimentParams = {
  name: string;
  metrics?: (GalileoMetrics | string | Metric | LocalMetricConfig)[];
  projectName?: string;
  projectId?: string;
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

type RunExperimentOutput = {
  results?: string[];
  experiment: Experiment;
  link: string;
  message?: string;
};

/**
 * Gets all experiments.
 * @param projectName - (Optional) The name of the project.
 * @param projectId - (Optional) The id of the project.
 * @returns A promise that resolves to an array of experiments.
 */
export async function getExperiments(
  projectName?: string,
  projectId?: string
): Promise<ExperimentResponseType[]> {
  const experiment = new Experiments();
  return await experiment.getExperiments({ projectName, projectId });
}

/**
 * Creates a new experiment.
 * @param name - The name of the experiment.
 * @param projectName - The name of the project.
 * @param dataset - (Optional) The dataset configuration.
 * @param metrics - (Optional) List of server-side metrics to configure for the experiment.
 * @returns A promise that resolves to the created experiment.
 */
export async function createExperiment(
  name: string,
  projectName: string,
  dataset?: ExperimentDatasetRequest | null,
  metrics?: (GalileoMetrics | Metric | string)[]
): Promise<Experiment> => {
  if (!name) {
    throw new Error('A valid `name` must be provided to create an experiment');
  }
  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectName });
  const experiment = await apiClient.createExperiment(name, dataset);

  // Configure metrics if provided
  if (metrics && metrics.length > 0) {
    const project = await apiClient.getProjectByName(projectName);
    await createMetricConfigs(project.id, experiment.id, metrics);
  }

  return experiment;
};

/**
 * Gets an experiment by id or name.
 * At least one of id or name must be provided.
 * @param options - The options for getting an experiment.
 * @param options.id - (Optional) The id of the experiment.
 * @param options.name - (Optional) The name of the experiment.
 * @param options.projectName - The name of the project.
 * @returns A promise that resolves to the experiment, or undefined if not found.
 */
export async function getExperiment({
  id,
  name,
  projectName
}: {
  id?: string;
  name?: string;
  projectName: string;
}): Promise<ExperimentResponseType | undefined> {
  const experiment = new Experiments();
  return await experiment.getExperiment({
    id,
    name,
    projectName
  });
}

/**
 * Runs an experiment by processing each row of a dataset through a specified function or prompt template.
 * If metrics are provided, they will be used to evaluate the experiment.
 * @param params - The experiment run parameters.
 * @param params.name - The name of the experiment.
 * @param params.function - The function to process each dataset row. Either function or promptTemplate must be provided.
 * @param params.promptTemplate - The prompt template to use. Either function or promptTemplate must be provided.
 * @param params.dataset - The dataset to process. Either dataset, datasetId, or datasetName must be provided.
 * @param params.datasetId - The id of the dataset to process. Either dataset, datasetId, or datasetName must be provided.
 * @param params.datasetName - The name of the dataset to process. Either dataset, datasetId, or datasetName must be provided.
 * @param params.metrics - (Optional) List of metrics to evaluate the experiment.
 * @param params.projectName - (Optional) The name of the project.
 * @param params.projectId - (Optional) The id of the project.
 * @param params.experimentTags - (Optional) Tags to associate with the experiment.
 * @param params.promptSettings - (Optional) Settings for prompt template execution.
 * @returns A promise that resolves to the experiment run output.
 */
export async function runExperiment<T extends Record<string, unknown>>(
  params: RunExperimentParams<T>
): Promise<RunExperimentOutput> {
  const experiments = new Experiments();
  return await experiments.runExperiment(params);
}

/**
 * Updates an experiment.
 * Either projectId or projectName must be provided.
 * @param options - The options for updating an experiment.
 * @param options.id - The unique identifier of the experiment.
 * @param options.projectId - (Optional) The unique identifier of the project.
 * @param options.projectName - (Optional) The name of the project.
 * @param options.updateRequest - The experiment update request.
 * @returns A promise that resolves to the updated experiment.
 */
export async function updateExperiment(options: {
  id: string;
  projectId?: string;
  projectName?: string;
  updateRequest: ExperimentUpdateRequest;
}): Promise<ExperimentResponseType> {
  const experiments = new Experiments();

  // Resolve project ID if only projectName is provided
  let projectId = options.projectId;
  if (!projectId && options.projectName) {
    const project = await getProjectWithEnvFallbacks({
      name: options.projectName
    });
    projectId = project.id;
  }

  if (!projectId) {
    throw new Error(
      'Either projectId or projectName must be provided to update an experiment'
    );
  }

  return await experiments.updateExperiment({
    id: options.id,
    projectId,
    updateRequest: options.updateRequest
  });
}

/**
 * Deletes an experiment.
 * @param options - The options for deleting an experiment.
 * @param options.id - The unique identifier of the experiment.
 * @param options.projectId - The unique identifier of the project.
 * @returns A promise that resolves when the experiment is deleted.
 */
export async function deleteExperiment(options: {
  id: string;
  projectId: string;
}): Promise<void> {
  if (!options.id || !options.projectId) {
    throw new Error(
      'Experiment id and projectId are required to delete an experiment'
    );
  }
  const experiments = new Experiments();
  return await experiments.deleteExperiment(options);
}
