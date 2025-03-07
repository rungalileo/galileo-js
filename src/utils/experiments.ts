import { Experiment } from '../types/experiment.types';
// import { Dataset } from '../types/dataset.types';
import { GalileoApiClient } from '../api-client';
import { log } from '../wrappers';
import { init, flush, GalileoSingleton } from '../singleton';

// class RunExperimentParams {
//   public experimentId: string = '';
//   public experimentName: string = '';
//   public datasetId: string = '';
//   public datasetName: string = '';
//   public dataset: Dataset | undefined = undefined;
//   public projectId: string = '';
//   public projectName: string = '';
// }

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
export const getExperiment = async (
  id?: string,
  name?: string
): Promise<Experiment> => {
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
  projectName
}: {
  name: string;
  dataset: T[];
  function: (input: T, metadata?: Record<string, string>) => Promise<unknown[]>;
  projectName?: string;
}): Promise<string[]> {
  // Array to collect the outputs
  const outputs: string[] = [];

  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectName });

  const experiment = await apiClient.createExperiment(name);
  console.log(`🚀 Experiment ${name} created.`);

  apiClient.experimentId = experiment.id;

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
    // Create metadata object
    const metadata: Record<string, string> = {
      timestamp: new Date().toISOString()
    };

    let output: string = '';

    try {
      // Process the row using the logged function and store the result
      const result = await loggedProcessFn(row, metadata);
      output = JSON.stringify(result);
    } catch (error) {
      // Handle errors gracefully
      console.error(`Error processing row:`, row, error);
      output = `Error: ${error instanceof Error ? error.message : String(error)}`;
    }

    const logger = GalileoSingleton.getInstance().getClient();
    if (!logger.traces.length) {
      throw new Error('An error occurred while creating a trace');
    }

    const startTime = logger.traces[0].createdAtNs;
    logger.conclude({
      output,
      durationNs: Date.now() - startTime
    });

    outputs.push(output);
  }

  await flush();

  return outputs;
}
