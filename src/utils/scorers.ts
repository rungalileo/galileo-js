import { Scorer, ScorerConfig, ScorerVersion } from '../types/scorer.types';
import { GalileoApiClient } from '../api-client';
import { ScorerTypes, ScorerDefaults } from '../types/scorer.types';
import { components } from '../types/api.types';

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

export const createScorer = async (
  name: string,
  scorerType: ScorerTypes,
  description?: string,
  tags?: string[],
  defaults?: ScorerDefaults,
  modelType?: components['schemas']['ModelType'],
  defaultVersionId?: string
): Promise<Scorer> => {
  const client = new GalileoApiClient();
  await client.init();

  return await client.createScorer(
    name,
    scorerType,
    description,
    tags,
    defaults,
    modelType,
    defaultVersionId
  );
};

export const createLlmScorerVersion = async (
  scorerId: string,
  instructions: string,
  chainPollTemplate: components['schemas']['ChainPollTemplate'],
  modelName?: string,
  numJudges?: number
): Promise<ScorerVersion> => {
  const client = new GalileoApiClient();
  await client.init();

  return await client.createLlmScorerVersion(
    scorerId,
    instructions,
    chainPollTemplate,
    modelName,
    numJudges
  );
};

export const deleteScorer = async (scorerId: string): Promise<void> => {
  const client = new GalileoApiClient();
  await client.init();

  return await client.deleteScorer(scorerId);
};
