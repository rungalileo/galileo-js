import { Scorer } from '../types/scorer.types';
import { GalileoApiClient } from '../api-client';
import { ScorerTypes } from '../types/scorer.types';

export const getScorers = async (type?: ScorerTypes): Promise<Scorer[]> => {
  const client = new GalileoApiClient();
  await client.init();
  return await client.getScorers(type);
};

export const createRunScorerSettings = async (
  experimentId: string,
  projectId: string,
  scorers: Scorer[]
): Promise<void> => {
  const client = new GalileoApiClient();
  await client.init();
  await client.createRunScorerSettings(experimentId, projectId, scorers);
};
