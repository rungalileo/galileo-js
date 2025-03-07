import { Experiment } from '../types/experiment.types';
import { GalileoApiClient } from '../api-client';
import { log } from '../wrappers';
import { init, flush, GalileoSingleton } from '../singleton';
import { Scorer, ScorerTypes } from '../types/scorer.types';
import { getScorers, createRunScorerSettings } from '../utils/scorers';

/*
 * Gets all experiments.
 */
export const getExperiments = async (): Promise<Experiment[]> => {
  const apiClient = new GalileoApiClient();
  await apiClient.init();
  return await apiClient.getExperiments();
};

/*
 * Creates a new experiment.
 */
export const createExperiment = async (name: string): Promise<Experiment> => {
  const apiClient = new GalileoApiClient();
  await apiClient.init();
  return await apiClient.createExperiment(name);
};

/*
 * Gets an experiment by id or name.
 */
export const getExperiment = async (options: {
  id?: string;
  name?: string;
}): Promise<Experiment> => {
  const { id, name } = options;
  if (!id && !name) {
    throw new Error(
      'To fetch an experiment with `getExperiment`, either id or name must be provided'
    );
  }

  const apiClient = new GalileoApiClient();
  await apiClient.init();
  if (id) {
    return await apiClient.getExperiment(id!);
  }

  const experiments = await apiClient.getExperiments();

  const experiment = experiments.find(
    (experiment) => experiment.name === name!
  );

  if (!experiment) {
    throw new Error(`Experiment ${name} not found`);
  }

  return experiment;
};

/**
 * Runs an experiment by processing each row of a dataset through a specified function.
 *
 * @param options - The options for running the experiment
 * @param options.dataset - Array of data records to process
 * @param options.function - Function that processes each record
 * @param options.project - Project identifier
 * @returns Array of outputs from the processing function
 */
export async function runExperiment<T extends Record<string, unknown>>({
  name,
  dataset,
  function: processFn,
  metrics,
  projectName
}: {
  name: string;
  dataset: T[];
  function: (input: T, metadata?: Record<string, string>) => Promise<unknown[]>;
  metrics: string[];
  projectName?: string;
}): Promise<string[]> {
  const outputs: string[] = [];

  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectName });

  const projectId = apiClient.projectId;

  const run_scorer_settings: Scorer[] = [];

  const scorers = await getScorers(ScorerTypes.preset);

  for (const metric of metrics) {
    const scorer = scorers.find((scorer) => scorer.name === metric);
    if (!scorer) {
      throw new Error(`Scorer ${metric} not found`);
    }
    run_scorer_settings.push(scorer);
  }

  if (!run_scorer_settings.length) {
    throw new Error('No scorers found');
  }

  let experiment: Experiment | undefined = undefined;

  // Check if experiment with the same name already exists
  if (await getExperiment({ name })) {
    console.warn(
      `Experiment with name '${name}' already exists, adding a timestamp`
    );
    const timestamp = new Date()
      .toISOString()
      .replace('T', ' ')
      .replace('Z', '');
    name = `${name} ${timestamp}`;
  }

  experiment = await createExperiment(name);

  console.log(`🚀 Experiment ${name} created.`);

  apiClient.experimentId = experiment.id;

  await createRunScorerSettings(experiment.id, projectId, run_scorer_settings);

  // Initialize the singleton logger
  init({ experimentId: experiment.id, projectName });

  // Wrap the processing function with the log wrapper
  const loggedProcessFn = log(
    {
      name
    },
    async (input: T, metadata?: Record<string, string>) => {
      return processFn(input, metadata);
    }
  );

  // Process each row in the dataset
  for (const row of dataset) {
    const metadata: Record<string, string> = {
      timestamp: new Date().toISOString()
    };

    let output: string = '';

    try {
      // Process the row with logging
      const result = await loggedProcessFn(row, metadata);
      output = JSON.stringify(result);
    } catch (error) {
      console.error(`Error processing row:`, row, error);
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

    outputs.push(output);
  }

  // Flush the logger
  await flush();

  console.log(
    `🚀 Experiment ${name} completed. ${outputs.length} rows processed.`
  );

  return outputs;
}
