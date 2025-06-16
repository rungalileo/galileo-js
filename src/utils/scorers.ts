import { Scorer, ScorerConfig, ScorerVersion } from '../types/scorer.types';
import { GalileoApiClient } from '../api-client';
import { ScorerTypes } from '../types/scorer.types';

export const getScorers = async (type?: ScorerTypes): Promise<Scorer[]> => {
  const client = new GalileoApiClient();
  await client.init();
  return await client.getScorers(type);
};

/**
 * Retrieves a specific version of a scorer by its ID and version number.
 *
 * @param scorerId - The unique identifier of the scorer.
 * @param version - The version number of the scorer to retrieve.
 * @returns A promise that resolves to the requested {@link ScorerVersion}.
 *
 * @remarks
 * This function initializes a new instance of {@link GalileoApiClient},
 * establishes a connection, and fetches the specified scorer version.
 */
export const getScorerVersion = async (
  scorerId: string,
  version: number
): Promise<ScorerVersion> => {
  const client = new GalileoApiClient();
  await client.init();
  return await client.getScorerVersion(scorerId, version);
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
  scorers: ScorerConfig[];
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
