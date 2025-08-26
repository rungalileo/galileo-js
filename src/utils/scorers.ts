import {
  ChainPollTemplate,
  ModelType,
  OutputType,
  Scorer,
  ScorerConfig,
  ScorerVersion
} from '../types/scorer.types';
import { GalileoApiClient } from '../api-client';
import { ScorerTypes, ScorerDefaults } from '../types/scorer.types';
import { StepType } from '../types/logging/step.types';

export const getScorers = async (options?: {
  type?: ScorerTypes;
  names?: string[];
}): Promise<Scorer[]> => {
  const client = new GalileoApiClient();
  await client.init();
  return await client.getScorers(options);
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

/**
 * Creates run scorer settings for an experiment.
 *
 * @param params - The parameters for creating run scorer settings.
 * @param params.experimentId - The experiment ID.
 * @param params.projectId - (Optional) The project ID.
 * @param params.projectName - (Optional) The project name.
 * @param params.scorers - The list of scorer configurations.
 * @returns A promise that resolves when the settings are created.
 * @throws Error if neither projectId nor projectName is provided.
 */
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

/**
 * Creates a new scorer.
 *
 * @param name - The name of the scorer.
 * @param scorerType - The type of the scorer.
 * @param description - (Optional) A description for the scorer.
 * @param tags - (Optional) Tags to associate with the scorer.
 * @param defaults - (Optional) Default settings for the scorer.
 * @param modelType - (Optional) The model type for the scorer.
 * @param defaultVersionId - (Optional) The default version ID for the scorer.
 * @returns A promise that resolves to the created {@link Scorer}.
 */
export const createScorer = async (
  name: string,
  scorerType: ScorerTypes,
  description?: string,
  tags?: string[],
  defaults?: ScorerDefaults,
  modelType?: ModelType,
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

/**
 * Creates a new LLM scorer version for a given scorer.
 *
 * @param scorerId - The unique identifier of the scorer.
 * @param instructions - (Optional) Instructions for the scorer version.
 * @param chainPollTemplate - (Optional) The chain poll template for the scorer version.
 * @param userPrompt - (Optional) The user prompt for the scorer version.
 * @param scoreableNodeTypes - (Optional) The node level for the scorer version. Defaults to ['llm'].
 * @param cotEnabled - (Optional) Whether chain of thought is enabled. Defaults to true
 * @param modelName - (Optional) The model name to use.
 * @param numJudges - (Optional) The number of judges to use.
 * @param outputType - (Optional) The output type for the scorer version. Defaults to OutputType.BOOLEAN.
 * @returns A promise that resolves to the created {@link ScorerVersion}.
 */
export const createLlmScorerVersion = async (
  scorerId: string,
  instructions?: string,
  chainPollTemplate?: ChainPollTemplate,
  userPrompt?: string,
  scoreableNodeTypes?: StepType[],
  cotEnabled?: boolean,
  modelName?: string,
  numJudges?: number,
  outputType?: OutputType
): Promise<ScorerVersion> => {
  const client = new GalileoApiClient();
  await client.init();

  return await client.createLlmScorerVersion(
    scorerId,
    instructions,
    chainPollTemplate,
    userPrompt,
    scoreableNodeTypes,
    cotEnabled,
    modelName,
    numJudges,
    outputType
  );
};

/**
 * Deletes a scorer by its unique identifier.
 *
 * @param scorerId - The unique identifier of the scorer to delete.
 * @returns A promise that resolves when the scorer is deleted.
 */
export const deleteScorer = async (scorerId: string): Promise<void> => {
  const client = new GalileoApiClient();
  await client.init();

  return await client.deleteScorer(scorerId);
};
