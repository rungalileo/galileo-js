import { Scorer } from '../types/scorer.types';
import { GalileoApiClient } from '../api-client';
import { ScorerTypes } from '../types/scorer.types';

export const getScorers = async (type?: ScorerTypes): Promise<Scorer[]> => {
  const client = new GalileoApiClient();
  await client.init();
  return await client.getScorers(type);
};

export const createRunScorerSettings = async ({
  experimentId,
  projectId,
  projectName,
  scorers
}: {
  experimentId: string;
  projectId?: string;
  projectName?: string;
  scorers: Scorer[];
}): Promise<void> => {
  if (!projectId && !projectName) {
    throw new Error(
      'To create run scorer settings, either projectId or projectName must be provided'
    );
  }
  const client = new GalileoApiClient();
  await client.init({ projectName, projectId });
  await client.createRunScorerSettings(
    experimentId,
    projectId || client.projectId,
    scorers
  );
};
