import {
  Experiment,
  ExperimentDatasetRequest,
  PromptRunSettings
} from '../types/experiment.types';
import {
  PromptTemplate,
  PromptTemplateVersion
} from '../types/prompt-template.types';
import { GalileoApiClient } from '../api-client';
import { log } from '../wrappers';
import { init, flush } from '../singleton';
import { ScorerConfig } from '../types/scorer.types';
import { Dataset, DatasetRecord } from '../types/dataset.types';
import {
  deserializeInputFromString,
  getDatasetRecordsFromArray,
  getRecordsForDataset,
  getDatasetMetadata
} from '../utils/datasets';
import {
  GalileoScorers,
  LocalMetricConfig,
  Metric
} from '../types/metrics.types';
import { createMetricConfigs } from './metrics';
import { Project } from '../types';
import { getProjectWithEnvFallbacks } from './projects';

type DatasetType = Dataset | Record<string, unknown>[];
type PromptTemplateType = PromptTemplate | PromptTemplateVersion;

type BaseRunExperimentParams = {
  name: string;
  metrics?: (GalileoScorers | string | Metric | LocalMetricConfig)[];
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

/*
 * Gets all experiments.
 */
export const getExperiments = async (
  projectName: string
): Promise<Experiment[]> => {
  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectName });
  return await apiClient.getExperiments();
};

/*
 * Creates a new experiment.
 *
 * @param name - The name of the experiment
 * @param projectName - The name of the project
 * @param dataset - Optional dataset configuration
 * @param metrics - Optional list of server-side metrics to configure for the experiment.
 *                  Note: LocalMetricConfig is not supported here as it requires a runner function.
 *                  Use runExperiment() with a function parameter to use local metrics.
 * @returns The created experiment
 */
export const createExperiment = async (
  name: string,
  projectName: string,
  dataset?: ExperimentDatasetRequest | null,
  metrics?: (GalileoScorers | Metric | string)[]
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

/*
 * Gets an experiment by id or name.
 * At least one of id or name must be provided.
 *
 * @param id - The id of the experiment
 * @param name - The name of the experiment
 * @returns The experiment
 */
export const getExperiment = async ({
  id,
  name,
  projectName
}: {
  id?: string;
  name?: string;
  projectName: string;
}): Promise<Experiment | undefined> => {
  if (!id && !name) {
    throw new Error(
      'To fetch an experiment with `getExperiment`, either id or name must be provided'
    );
  }

  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectName });
  if (id) {
    return await apiClient.getExperiment(id!);
  }

  const experiments = await apiClient.getExperiments();

  return experiments.find((experiment) => experiment.name === name!);
};

/*
 * Processes a dataset row using a runner function.
 *
 * @param row - The dataset row to process
 * @param processFn - The runner function to use for processing
 * @returns The processed output as a string
 */
const processRow = async <T extends Record<string, unknown>>(
  row: DatasetRecord,
  processFn: (input: T, metadata?: Record<string, unknown>) => Promise<unknown>
): Promise<string> => {
  console.log(`Processing dataset row: ${JSON.stringify(row)}`);

  let output: string = '';

  try {
    // Process the row with logging
    const result = await processFn(
      deserializeInputFromString(row.input) as T,
      row.metadata
    );
    output = JSON.stringify(result);
  } catch (error) {
    console.error(`Error processing dataset row:`, row, error);
    output = `Error: ${error instanceof Error ? error.message : String(error)}`;
  }

  return output;
};

/*
 * Runs an experiment by processing each row of a dataset using a runner function.
 *
 * @param experiment - The experiment to run
 * @param projectName - The name of the project
 * @param dataset - The content of the dataset
 * @param processFn - The runner function to use for processing
 * @param localMetrics - The local metrics to use for client-side evaluation (not yet fully implemented)
 * @returns The processed outputs as an array of strings
 */
const runExperimentWithFunction = async <T extends Record<string, unknown>>(
  experiment: Experiment,
  projectName: string,
  dataset: DatasetRecord[],
  processFn: (input: T, metadata?: Record<string, unknown>) => Promise<unknown>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  localMetrics: LocalMetricConfig[] = []
): Promise<string[]> => {
  const outputs: string[] = [];

  // Initialize the singleton logger
  // TODO: Local metrics support needs to be added to GalileoLogger/init
  // For now, local metrics are validated and separated from server metrics,
  // but not yet processed during logging. Full implementation pending.
  init({
    experimentId: experiment.id,
    projectName: projectName
  });

  // Process each row in the dataset
  for (const row of dataset) {
    const loggedProcessFn = log(
      {
        name: experiment.name,
        datasetRecord: row
      },
      processFn
    );
    const output = await processRow(row, loggedProcessFn);
    outputs.push(output);
  }
  // Flush the logger
  await flush();

  console.log(
    `${outputs.length} rows processed for experiment ${experiment.name}.`
  );

  return outputs;
};

const getLinkToExperimentResults = (
  experimentId: string,
  projectId: string
) => {
  let baseUrl = process.env.GALILEO_CONSOLE_URL || 'https://app.galileo.ai';
  if (baseUrl.includes('api.galileo.ai')) {
    baseUrl = baseUrl.replace('api.galileo.ai', 'app.galileo.ai');
  }
  return `${baseUrl}/project/${projectId}/experiments/${experimentId}`;
};

/**
 * Runs an experiment by processing each row of a dataset through a specified function.
 * If metrics are provided, they will be used to evaluate the experiment.
 *
 * Usage:
 *
 * ```typescript
 * // Run an experiment with a runner function
 * const results = await runExperiment({
 *   name: 'my-experiment',
 *   dataset: [{ country: 'France'}],
 *   function: async (input) => {
        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: `What is the capital of ${input['country']}?`
            }
          ]
        });
        return response.choices[0].message.content;
      },
 *   metrics: ['accuracy'],
 *   projectName: 'my-project'
 * });
 *
 * // Run an experiment with a prompt template
 * const promptTemplate = await createPromptTemplate({
 *   template: [{ role: 'user', content: 'What is the capital of {{ country }}?' }],
 *   name: 'my-prompt-template',
 *   projectName: 'my-project'
 * });
 *
 * const results = await runExperiment({
 *   name: 'my-experiment',
 *   dataset: [{ country: 'France' }],
 *   promptTemplate
 *   metrics: ['accuracy'],
 *   projectName: 'my-project'
 * });
 * ```
 * The project can be specified by providing exactly one of the project name
 * (via the 'project' parameter or the GALILEO_PROJECT environment variable)
 * or the project ID (via the 'project_id' parameter or the GALILEO_PROJECT_ID environment variable).
 *
 * @param name - The name of the experiment
 * @param dataset - Array of data records to process
 * @param function - Function that processes each record
 * @param metrics - Array of metrics to evaluate
 * @param projectName - Optional project name. Takes preference over the GALILEO_PROJECT environment variable. Leave empty if using projectId.
 * @param projectId - Optional project Id. Takes preference over the GALILEO_PROJECT_ID environment variable. Leave empty if using projectName.
 * @param promptTemplate - Optional prompt template to use instead of a function
 * @param promptSettings - Optional settings for the prompt run
 * @returns Array of outputs from the processing function
 */
export const runExperiment = async <T extends Record<string, unknown>>(
  params: RunExperimentParams<T>
): Promise<RunExperimentOutput> => {
  const { name, metrics, projectName, projectId } = params;

  console.log(`Preparing to run experiment '${name}'...`);

  let project: Project | undefined = undefined;

  // Get the project by passing the name and Id. If none are provided, this will use the environment variables
  try {
    project = await getProjectWithEnvFallbacks({
      name: projectName,
      id: projectId
    });
  } catch (error) {
    throw new Error(
      "Exactly one of 'projectId' or 'projectName' must be provided, or set in the environment variables GALILEO_PROJECT_ID or GALILEO_PROJECT"
    );
  }

  let experiment: Experiment | undefined = undefined;

  // Check if experiment with the same name already exists
  let experimentName = name;
  experiment = await getExperiment({ name, projectName: project.name });
  if (experiment) {
    console.warn(
      `Experiment with name '${name}' already exists, adding a timestamp`
    );

    const timestamp = new Date()
      .toISOString()
      .replace('T', ' at ')
      .replace('Z', '');
    experimentName = `${name} ${timestamp}`;
  }

  const datasetObj = await getDatasetMetadata(params, project.name);
  const datasetRequest: ExperimentDatasetRequest | undefined = datasetObj
    ? {
        dataset_id: datasetObj.id,
        version_index: datasetObj.current_version_index
      }
    : undefined;

  experiment = await createExperiment(
    experimentName,
    project.name,
    datasetRequest
  );

  if (!experiment) {
    throw new Error(`Experiment ${experimentName} could not be created`);
  }

  console.log(`🚀 Experiment ${experimentName} created.`);

  // Process metrics using the unified createMetricConfigs function
  let scorerConfigs: ScorerConfig[] = [];
  let localMetricConfigs: LocalMetricConfig[] = [];

  if (metrics && metrics.length > 0) {
    console.log('Retrieving metrics...');
    [scorerConfigs, localMetricConfigs] = await createMetricConfigs(
      project.id,
      experiment.id,
      metrics
    );
  }

  // Validate local metrics usage
  if (localMetricConfigs.length > 0 && 'promptTemplate' in params) {
    throw new Error(
      'Local metrics can only be used with a locally run experiment (function-based), not a prompt template experiment.'
    );
  }

  console.log('Retrieving the dataset...');

  // Determine the dataset source
  let dataset: DatasetRecord[];
  let datasetId: string | undefined = undefined;
  if ('dataset' in params) {
    if (!(params.dataset instanceof Array)) {
      // If dataset is a Dataset object, convert it to an array of records
      datasetId = (params.dataset as Dataset).id;
      const columnNames = (params.dataset as Dataset).column_names;
      if (!columnNames) {
        throw new Error('Column names not found in dataset');
      }
      dataset = await getRecordsForDataset({ datasetId: params.dataset.id });
    } else {
      // If dataset is an array of records
      if ('promptTemplate' in params) {
        throw new Error(
          'Prompt template experiments cannot be run with a local dataset'
        );
      }

      dataset = await getDatasetRecordsFromArray(params.dataset);
    }
  } else if ('datasetId' in params) {
    // If datasetId is provided, get the dataset and its content as an array of records
    dataset = await getRecordsForDataset({ datasetId: params.datasetId });
  } else if ('datasetName' in params) {
    dataset = await getRecordsForDataset({ datasetName: params.datasetName });
  } else {
    throw new Error(
      'One of dataset, datasetId, or datasetName must be provided'
    );
  }

  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectName: project.name });
  const linkToResults = getLinkToExperimentResults(experiment.id, project.id);

  // Process using either a runner function or a prompt template
  if ('function' in params) {
    const processFn = params.function;

    console.log(
      `Processing runner function experiment ${experiment.name} for project ${project.name}...`
    );

    const results = await runExperimentWithFunction(
      experiment,
      project.name,
      dataset,
      processFn,
      localMetricConfigs
    );

    if (scorerConfigs.length > 0) {
      console.log(
        `Metrics are still being calculated for runner function experiment ${experiment.name}. Results will be available at ${linkToResults}`
      );
    } else {
      console.log(
        `Runner function experiment ${experiment.name} is complete. Results are available at ${linkToResults}`
      );
    }

    return {
      results,
      experiment,
      link: linkToResults,
      message: 'Experiment completed.'
    };
  } else if ('promptTemplate' in params) {
    let promptTemplateVersionId: string | undefined = undefined;
    if ('version' in params.promptTemplate) {
      promptTemplateVersionId = (params.promptTemplate as PromptTemplateVersion)
        .id;
    } else {
      console.log(
        `Defaulting to the selected version for prompt template ${params.promptTemplate.name}`
      );
      promptTemplateVersionId = (params.promptTemplate as PromptTemplate)
        .selected_version_id;
    }
    apiClient.experimentId = experiment.id;

    const promptSettings =
      params.promptSettings ||
      ({
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
      } as PromptRunSettings);

    console.log(
      `Starting prompt experiment ${experiment.name} for project ${project.name}...`
    );

    const response = await apiClient.createPromptRunJob(
      experiment.id,
      project.id,
      promptTemplateVersionId,
      datasetId!,
      scorerConfigs,
      promptSettings
    );

    console.log(
      `Prompt experiment ${experiment.name} has started and is currently processing. Results will be available at ${linkToResults}`
    );

    return { experiment, link: linkToResults, message: response.message };
  } else {
    throw new Error('One of function or promptTemplate must be provided');
  }
};
