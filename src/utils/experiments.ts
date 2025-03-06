import { Experiment } from '../types/experiment.types';
import { GalileoApiClient } from '../api-client';

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
