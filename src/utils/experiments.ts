import { Experiment, PromptRunSettings } from '../types/experiment.types';
import {
  PromptTemplate,
  PromptTemplateVersion
} from '../types/prompt-template.types';
import { GalileoApiClient } from '../api-client';
import { log } from '../wrappers';
import { init, flush, GalileoSingleton } from '../singleton';
import { ScorerConfig } from '../types/scorer.types';
import {
  getScorers,
  getScorerVersion,
  createRunScorerSettings
} from '../utils/scorers';
import { Metric } from '../types/metrics.types';
import { Dataset } from '../types/dataset.types';
import { getDataset, getDatasetContent } from '../utils/datasets';
import { GalileoScorers } from '../types/metrics.types';

type DatasetType = Dataset | Record<string, unknown>[];
type PromptTemplateType = PromptTemplate | PromptTemplateVersion;

// Define possible parameter combinations
type DatasetWithFunction<T extends Record<string, unknown>> = {
  name: string;
  dataset: DatasetType;
  function: (input: T, metadata?: Record<string, string>) => Promise<unknown>;
  metrics?: (GalileoScorers | string | Metric)[];
  projectName: string;
};

type DatasetIdWithFunction<T extends Record<string, unknown>> = {
  name: string;
  datasetId: string;
  function: (input: T, metadata?: Record<string, string>) => Promise<unknown>;
  metrics?: (GalileoScorers | string | Metric)[];
  projectName: string;
};

type DatasetNameWithFunction<T extends Record<string, unknown>> = {
  name: string;
  datasetName: string;
  function: (input: T, metadata?: Record<string, string>) => Promise<unknown>;
  metrics?: (GalileoScorers | string | Metric)[];
  projectName: string;
};

type DatasetWithPromptTemplate = {
  name: string;
  dataset: DatasetType;
  promptTemplate: PromptTemplateType;
  promptSettings?: PromptRunSettings;
  metrics?: (GalileoScorers | string | Metric)[];
  projectName: string;
};

type DatasetIdWithPromptTemplate = {
  name: string;
  datasetId: string;
  promptTemplate: PromptTemplateType;
  promptSettings?: PromptRunSettings;
  metrics?: (GalileoScorers | string | Metric)[];
  projectName: string;
};

type DatasetNameWithPromptTemplate = {
  name: string;
  datasetName: string;
  promptTemplate: PromptTemplateType;
  promptSettings?: PromptRunSettings;
  metrics?: (GalileoScorers | string | Metric)[];
  projectName: string;
};

// Union of all possible parameter combinations
type RunExperimentParams<T extends Record<string, unknown>> =
  | DatasetWithFunction<T>
  | DatasetIdWithFunction<T>
  | DatasetNameWithFunction<T>
  | DatasetWithPromptTemplate
  | DatasetIdWithPromptTemplate
  | DatasetNameWithPromptTemplate;

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
 */
export const createExperiment = async (
  name: string,
  projectName: string
): Promise<Experiment> => {
  if (!name) {
    throw new Error('A valid `name` must be provided to create an experiment');
  }
  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectName });
  return await apiClient.createExperiment(name);
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
  row: T,
  processFn: (input: T, metadata?: Record<string, string>) => Promise<unknown>
): Promise<string> => {
  const metadata: Record<string, string> = {
    timestamp: new Date().toISOString()
  };

  let output: string = '';

  try {
    // Process the row with logging
    console.log(`Processing dataset row: ${JSON.stringify(row as T)}`);
    const result = await processFn(row as T, metadata);
    output = JSON.stringify(result);
  } catch (error) {
    console.error(`Error processing dataset row:`, row, error);
    output = `Error: ${error instanceof Error ? error.message : String(error)}`;
  }

  const logger = GalileoSingleton.getInstance().getClient();
  if (!logger.traces.length) {
    throw new Error('An error occurred while creating a trace');
  }

  // Conclude the trace
  const startTime = logger.traces[0].createdAtNs;
  logger.conclude({
    output,
    durationNs: Date.now() - startTime
  });

  return output;
};

/*
 * Runs an experiment by processing each row of a dataset using a runner function.
 *
 * @param experiment - The experiment to run
 * @param projectName - The name of the project
 * @param datasetContent - The content of the dataset
 * @param processFn - The runner function to use for processing
 * @param metrics - The metrics to use for evaluation
 * @returns The processed outputs as an array of strings
 */
const runExperimentWithFunction = async <T extends Record<string, unknown>>(
  experiment: Experiment,
  projectName: string,
  datasetContent: Record<string, unknown>[],
  processFn: (input: T, metadata?: Record<string, string>) => Promise<unknown>
): Promise<string[]> => {
  const outputs: string[] = [];

  // Initialize the singleton logger
  init({ experimentId: experiment.id, projectName });

  // Wrap the processing function with the log wrapper
  const loggedProcessFn = log(
    {
      name: experiment.name
    },
    async (input: T, metadata?: Record<string, string>) => {
      return processFn(input, metadata);
    }
  );

  // Process each row in the dataset
  for (const row of datasetContent as Record<string, unknown>[]) {
    const output = await processRow(row as T, loggedProcessFn);
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
 *
 * @param name - The name of the experiment
 * @param dataset - Array of data records to process
 * @param function - Function that processes each record
 * @param metrics - Array of metrics to evaluate
 * @param projectName - Optional project name
 * @returns Array of outputs from the processing function
 */
export const runExperiment = async <T extends Record<string, unknown>>(
  params: RunExperimentParams<T>
): Promise<RunExperimentOutput> => {
  const { name, metrics, projectName } = params;

  console.log(`Preparing to run experiment '${name}'...`);

  if (!projectName) {
    throw new Error('Project name is required');
  }

  let experiment: Experiment | undefined = undefined;

  // Check if experiment with the same name already exists
  let experimentName = name;
  experiment = await getExperiment({ name, projectName });
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

  experiment = await createExperiment(experimentName, projectName);

  if (!experiment) {
    throw new Error(`Experiment ${experimentName} could not be created`);
  }

  console.log(`🚀 Experiment ${experimentName} created.`);

  const scorersToUse: ScorerConfig[] = [];

  console.log('Retrieving metrics...');

  if (metrics && metrics.length > 0) {
    const scorers = await getScorers();

    for (const metric of metrics) {
      let metricName: string = '';
      let metricVersion: number | undefined = undefined;
      if (typeof metric === 'string') {
        metricName = metric;
      } else {
        metricName = metric.name;
        metricVersion = metric.version;
      }
      const scorer = scorers.find((scorer) => scorer.name === metricName);

      if (!scorer) {
        throw new Error(
          `Metric ${metric} not found. Please check the name is correct.`
        );
      }

      const scorerConfig: ScorerConfig = {
        id: scorer.id,
        name: scorer.name,
        model_name: scorer.defaults?.model_name || 'gpt-4o',
        num_judges: scorer.defaults?.num_judges || 3,
        filters: scorer.defaults?.filters || [],
        scoreable_node_types: scorer.defaults?.scoreable_node_types || [],
        scorer_type: scorer.scorer_type
      };

      // If a version is specified, fetch the scorer version
      if (metricVersion !== undefined) {
        const scorerVersion = await getScorerVersion(scorer.id, metricVersion);
        scorerConfig.scorer_version = scorerVersion;
      }

      scorersToUse.push(scorerConfig);
    }
  }

  if (scorersToUse.length > 0) {
    console.log('Adding metrics to the experiment...');
    await createRunScorerSettings({
      experimentId: experiment.id,
      projectName,
      scorers: scorersToUse
    });
  }

  console.log('Retrieving the dataset...');

  // Determine the dataset source
  let dataset: DatasetType;
  let datasetId: string | undefined = undefined;
  if ('dataset' in params) {
    if (!(params.dataset instanceof Array)) {
      // If dataset is a Dataset object, convert it to an array of records
      datasetId = (params.dataset as Dataset).id;
      const columnNames = (params.dataset as Dataset).column_names;
      if (!columnNames) {
        throw new Error('Column names not found in dataset');
      }
      const datasetContent = await getDatasetContent({
        datasetId: params.dataset.id
      });
      dataset = datasetContent.map((row) => {
        const record: Record<string, string> = {};
        for (let i = 0; i < columnNames.length; i++) {
          record[columnNames[i]] = (row.values[i] || '') as string;
        }
        return record;
      });
    } else {
      // If dataset is an array of records
      if ('promptTemplate' in params) {
        throw new Error(
          'Prompt template experiments cannot be run with a local dataset'
        );
      }

      dataset = params.dataset as Record<string, unknown>[];
    }
  } else if ('datasetId' in params) {
    // If datasetId is provided, get the dataset and its content as an array of records
    datasetId = params.datasetId;
    // const dataset_ = await getDataset({ id: datasetId });
    const datasetContent = await getDatasetContent({ datasetId });
    dataset = datasetContent.map((row) => row.values_dict);
  } else if ('datasetName' in params) {
    // If datasetName is provided, get the dataset and its content as an array of records
    const dataset_ = await getDataset({ name: params.datasetName });
    datasetId = dataset_.id;
    const datasetContent = await getDatasetContent({
      datasetName: params.datasetName
    });
    dataset = datasetContent.map((row) => row.values_dict);
  } else {
    throw new Error(
      'One of dataset, datasetId, or datasetName must be provided'
    );
  }

  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectName });
  const projectId = apiClient.projectId;
  const linkToResults = getLinkToExperimentResults(experiment.id, projectId);

  // Process using either a runner function or a prompt template
  if ('function' in params) {
    const processFn = params.function;

    console.log(
      `Processing runner function experiment ${experiment.name} for project ${projectName}...`
    );

    const results = await runExperimentWithFunction(
      experiment,
      projectName,
      dataset as Record<string, unknown>[],
      processFn
    );

    if (scorersToUse.length > 0) {
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
      `Starting prompt experiment ${experiment.name} for project ${projectName}...`
    );

    const response = await apiClient.createPromptRunJob(
      experiment.id,
      projectId,
      promptTemplateVersionId,
      datasetId!,
      scorersToUse,
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
