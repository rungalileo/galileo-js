import {
  CreateLlmScorerVersionParams,
  ModelType,
  Scorer,
  ScorerConfig,
  ScorerVersion,
  OutputType,
  InputType
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
  defaultVersionId?: string,
  scoreableNodeTypes?: StepType[],
  outputType?: OutputType,
  inputType?: InputType
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
    defaultVersionId,
    scoreableNodeTypes,
    outputType,
    inputType
  );
};

/**
 * Creates a new LLM scorer version for a given scorer.
 *
 * @param params - The parameters for creating the LLM scorer version.
 * @returns A promise that resolves to the created {@link ScorerVersion}.
 */
export const createLlmScorerVersion = async ({
  scorerId,
  instructions,
  chainPollTemplate,
  userPrompt,
  cotEnabled,
  modelName,
  numJudges
}: CreateLlmScorerVersionParams): Promise<ScorerVersion> => {
  const client = new GalileoApiClient();
  await client.init();

  return await client.createLlmScorerVersion(
    scorerId,
    instructions,
    chainPollTemplate,
    userPrompt,
    cotEnabled,
    modelName,
    numJudges
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

/**
 * Creates a code-based scorer version by uploading code content.
 *
 * @param scorerId - The ID of the scorer to create a version for.
 * @param codeContent - The Python code content to upload as the scorer implementation.
 * @returns A promise that resolves to the created scorer version.
 *
 * @example
 * ```typescript
 * const version = await createCodeScorerVersion(
 *   'scorer-123',
 *   'def score(input, output): return 1.0'
 * );
 * ```
 */
export const createCodeScorerVersion = async (
  scorerId: string,
  codeContent: string
): Promise<ScorerVersion> => {
  const client = new GalileoApiClient();
  await client.init();

  return await client.createCodeScorerVersion(scorerId, codeContent);
};
