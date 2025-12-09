import {
  CreateLlmScorerVersionParams,
  ModelType,
  ScorerConfig,
  ScorerResponse,
  OutputType,
  InputType,
  ValidateRegisteredScorerResult,
  BaseScorerVersionResponse,
  DeleteScorerResponse
} from '../types/scorer.types';
import { GalileoApiClient } from '../api-client';
import { ScorerTypes, ScorerDefaults } from '../types/scorer.types';
import { StepType } from '../types/logging/step.types';
import { Scorers, ScorerSettings } from '../entities/scorers';

/**
 * Lists scorers with optional filtering.
 * @param options - (Optional) The filtering options.
 * @param options.type - (Optional) Filter by a single scorer type.
 * @param options.types - (Optional) Filter by multiple scorer types.
 * @param options.name - (Optional) Filter by a single scorer name.
 * @param options.names - (Optional) Filter by multiple scorer names.
 * @returns A promise that resolves to an array of scorers.
 */
export const getScorers = async (options?: {
  type?: ScorerTypes;
  types?: ScorerTypes[];
  name?: string;
  names?: string[];
}): Promise<ScorerResponse[]> => {
  // Resolve overloaded arguments first
  const resolvedTypes =
    options?.types ?? (options?.type ? [options.type] : undefined);
  const resolvedName =
    options?.name ??
    (options?.names?.length === 1 ? options.names[0] : undefined);

  // Instantiate class and delegate to class method
  const scorersService = new Scorers();
  return await scorersService.list({
    name: resolvedName,
    types: resolvedTypes,
    names:
      options?.names?.length && options.names.length > 1
        ? options.names
        : undefined
  });
};

/**
 * Retrieves a specific version of a scorer by its ID and version number.
 * @param scorerId - The unique identifier of the scorer.
 * @param version - The version number of the scorer to retrieve.
 * @returns A promise that resolves to the requested scorer version.
 */
export const getScorerVersion = async (
  scorerId: string,
  version: number
): Promise<BaseScorerVersionResponse> => {
  const scorersService = new Scorers();
  return await scorersService.getScorerVersion(scorerId, version);
};

/**
 * Creates run scorer settings for an experiment.
 * @param params - The parameters for creating run scorer settings.
 * @param params.experimentId - The experiment ID.
 * @param params.projectId - (Optional) The project ID.
 * @param params.projectName - (Optional) The project name.
 * @param params.scorers - The list of scorer configurations.
 * @returns A promise that resolves when the settings are created.
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

  // Resolve projectId from projectName if needed
  let resolvedProjectId = projectId;
  if (!resolvedProjectId && projectName) {
    const client = new GalileoApiClient();
    await client.init({ projectName });
    resolvedProjectId = client.projectId;
  }

  const scorerSettings = new ScorerSettings();
  await scorerSettings.create({
    projectId: resolvedProjectId!,
    runId: experimentId,
    scorers
  });
};

/**
 * Creates a new scorer.
 * @param name - The name of the scorer.
 * @param scorerType - The type of the scorer.
 * @param description - (Optional) A description for the scorer.
 * @param tags - (Optional) Tags to associate with the scorer.
 * @param defaults - (Optional) Default settings for the scorer. Required for LLM scorers.
 * @param modelType - (Optional) The model type for the scorer.
 * @param defaultVersionId - (Optional) The default version ID for the scorer.
 * @param scoreableNodeTypes - (Optional) The node types that can be scored.
 * @param outputType - (Optional) The output type for the scorer.
 * @param inputType - (Optional) The input type for the scorer.
 * @returns A promise that resolves to the created scorer.
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
): Promise<ScorerResponse> => {
  const scorersService = new Scorers();
  return await scorersService.create({
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
  });
};

/**
 * Creates a new LLM scorer version for a given scorer.
 * @param params - The parameters for creating the LLM scorer version.
 * @param params.scorerId - The unique identifier of the scorer.
 * @param params.instructions - (Optional) Instructions for the LLM scorer.
 * @param params.chainPollTemplate - (Optional) Chain poll template configuration.
 * @param params.userPrompt - (Optional) User prompt for the LLM scorer.
 * @param params.cotEnabled - (Optional) Whether chain-of-thought is enabled.
 * @param params.modelName - (Optional) The model name to use.
 * @param params.numJudges - (Optional) The number of judges for consensus.
 * @returns A promise that resolves to the created scorer version.
 */
export const createLlmScorerVersion = async ({
  scorerId,
  instructions,
  chainPollTemplate,
  userPrompt,
  cotEnabled,
  modelName,
  numJudges
}: CreateLlmScorerVersionParams): Promise<BaseScorerVersionResponse> => {
  const scorersService = new Scorers();
  return await scorersService.createLlmScorerVersion({
    scorerId,
    instructions,
    chainPollTemplate,
    userPrompt,
    cotEnabled,
    modelName,
    numJudges
  });
};

/**
 * Deletes a scorer by its unique identifier.
 * @param scorerId - The unique identifier of the scorer to delete.
 * @returns A promise that resolves to a response containing a success message.
 */
export const deleteScorer = async (
  scorerId: string
): Promise<DeleteScorerResponse> => {
  const scorersService = new Scorers();
  return await scorersService.delete(scorerId);
};

/**
 * Creates a code-based scorer version by uploading code content.
 * @param scorerId - The ID of the scorer to create a version for.
 * @param codeContent - The Python code content for the scorer. Must include a function named scorer_fn with a return type annotation.
 * @param validationResult - (Optional) Validation result JSON string from validateCodeScorer.
 * @returns A promise that resolves to the created scorer version.
 */
export const createCodeScorerVersion = async (
  scorerId: string,
  codeContent: string,
  validationResult?: string
): Promise<BaseScorerVersionResponse> => {
  const scorersService = new Scorers();
  return await scorersService.createCodeScorerVersion(
    scorerId,
    codeContent,
    validationResult
  );
};

/**
 * Validates code scorer content and waits for the result.
 * @param codeContent - The Python code content to validate. Must include a function named scorer_fn with a return type annotation.
 * @param scoreableNodeTypes - The node types that this scorer can score.
 * @param timeoutMs - (Optional) Maximum time to wait for validation in milliseconds.
 * @param pollIntervalMs - (Optional) Interval between polling attempts in milliseconds.
 * @returns A promise that resolves to the validation result.
 */
export const validateCodeScorer = async (
  codeContent: string,
  scoreableNodeTypes: StepType[],
  timeoutMs?: number,
  pollIntervalMs?: number,
  requiredScorers?: string[]
): Promise<ValidateRegisteredScorerResult> => {
  const client = new GalileoApiClient();
  await client.init();

  return await client.validateCodeScorerAndWait(
    codeContent,
    scoreableNodeTypes,
    timeoutMs,
    pollIntervalMs,
    requiredScorers
  );
};
