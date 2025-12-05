import { GalileoApiClient } from '../api-client';
import {
  ScorerTypes,
  ScorerConfig,
  ScorerDefaults,
  ModelType,
  OutputType,
  InputType,
  ChainPollTemplate,
  ScorerResponse,
  BaseScorerVersionResponse,
  DeleteScorerResponse
} from '../types/scorer.types';
import { StepType } from '../types/logging/step.types';

/**
 * Service class for scorer operations.
 */
export class Scorers {
  private client: GalileoApiClient | null = null;

  private async ensureClient(): Promise<GalileoApiClient> {
    if (!this.client) {
      this.client = new GalileoApiClient();
      await this.client.init();
    }
    return this.client;
  }

  /**
   * Lists scorers with optional filtering and built-in pagination.
   * @param options - (Optional) The filtering options.
   * @param options.name - (Optional) Filter by a single scorer name.
   * @param options.names - (Optional) Filter by multiple scorer names.
   * @param options.types - (Optional) Filter by scorer types.
   * @returns A promise that resolves to an array of scorers.
   */
  async list(options?: {
    name?: string;
    names?: string[];
    types?: ScorerTypes[];
  }): Promise<ScorerResponse[]> {
    const client = await this.ensureClient();

    // Built-in pagination like Python
    const allScorers: ScorerResponse[] = [];
    let startingToken: number | null = 0;

    while (startingToken !== null) {
      const response = await client.getScorersPage({
        name: options?.name,
        names: options?.names,
        types: options?.types,
        startingToken,
        limit: 100
      });

      allScorers.push(...(response.scorers ?? []));
      startingToken = response.nextStartingToken ?? null;
    }

    return allScorers;
  }

  /**
   * Gets a specific scorer version.
   * @param scorerId - The unique identifier of the scorer.
   * @param version - The version number to retrieve.
   * @returns A promise that resolves to the scorer version.
   */
  async getScorerVersion(
    scorerId: string,
    version: number
  ): Promise<BaseScorerVersionResponse> {
    const client = await this.ensureClient();
    return await client.getScorerVersion(scorerId, version);
  }

  /**
   * Creates a new scorer.
   * @param options - The scorer creation options.
   * @param options.name - The name of the scorer.
   * @param options.scorerType - The type of the scorer.
   * @param options.description - (Optional) A description for the scorer.
   * @param options.tags - (Optional) Tags to associate with the scorer.
   * @param options.defaults - (Optional) Default settings for the scorer.
   * @param options.modelType - (Optional) The model type for the scorer.
   * @param options.defaultVersionId - (Optional) The default version ID for the scorer.
   * @param options.scoreableNodeTypes - (Optional) The node types that can be scored.
   * @param options.outputType - (Optional) The output type for the scorer.
   * @param options.inputType - (Optional) The input type for the scorer.
   * @returns A promise that resolves to the created scorer.
   */
  async create(options: {
    name: string;
    scorerType: ScorerTypes;
    description?: string;
    tags?: string[];
    defaults?: ScorerDefaults;
    modelType?: ModelType;
    defaultVersionId?: string;
    scoreableNodeTypes?: StepType[];
    outputType?: OutputType;
    inputType?: InputType;
  }): Promise<ScorerResponse> {
    const client = await this.ensureClient();
    return await client.createScorer(options);
  }

  /**
   * Creates a new LLM scorer version.
   * @param options - The LLM scorer version creation options.
   * @param options.scorerId - The unique identifier of the scorer.
   * @param options.instructions - (Optional) Instructions for the LLM scorer.
   * @param options.chainPollTemplate - (Optional) Chain poll template configuration.
   * @param options.userPrompt - (Optional) User prompt for the LLM scorer.
   * @param options.cotEnabled - (Optional) Whether chain-of-thought is enabled.
   * @param options.modelName - (Optional) The model name to use.
   * @param options.numJudges - (Optional) The number of judges for consensus.
   * @returns A promise that resolves to the created scorer version.
   */
  async createLlmScorerVersion(options: {
    scorerId: string;
    instructions?: string;
    chainPollTemplate?: ChainPollTemplate;
    userPrompt?: string;
    cotEnabled?: boolean;
    modelName?: string;
    numJudges?: number;
  }): Promise<BaseScorerVersionResponse> {
    const client = await this.ensureClient();
    return await client.createLlmScorerVersion(
      options.scorerId,
      options.instructions,
      options.chainPollTemplate,
      options.userPrompt,
      options.cotEnabled,
      options.modelName,
      options.numJudges
    );
  }

  /**
   * Creates a code-based scorer version.
   * @param scorerId - The unique identifier of the scorer.
   * @param codeContent - The Python code content for the scorer.
   * @param validationResult - (Optional) The validation result JSON string.
   * @returns A promise that resolves to the created scorer version.
   */
  async createCodeScorerVersion(
    scorerId: string,
    codeContent: string,
    validationResult?: string
  ): Promise<BaseScorerVersionResponse> {
    const client = await this.ensureClient();
    return await client.createCodeScorerVersion(
      scorerId,
      codeContent,
      validationResult
    );
  }

  /**
   * Deletes a scorer by ID.
   * @param scorerId - The unique identifier of the scorer to delete.
   * @returns A promise that resolves to a response containing a success message.
   */
  async delete(scorerId: string): Promise<DeleteScorerResponse> {
    const client = await this.ensureClient();
    return await client.deleteScorer(scorerId);
  }
}

/**
 * Service class for run scorer settings.
 */
export class ScorerSettings {
  private client: GalileoApiClient | null = null;

  private async ensureClient(): Promise<GalileoApiClient> {
    if (!this.client) {
      this.client = new GalileoApiClient();
      await this.client.init();
    }
    return this.client;
  }

  /**
   * Creates run scorer settings.
   * @param options - The run scorer settings options.
   * @param options.projectId - The unique identifier of the project.
   * @param options.runId - The unique identifier of the run or experiment.
   * @param options.scorers - The array of scorer configurations.
   * @returns A promise that resolves when the settings are created.
   */
  async create(options: {
    projectId: string;
    runId: string;
    scorers: ScorerConfig[];
  }): Promise<void> {
    const client = await this.ensureClient();
    return await client.createRunScorerSettings(
      options.runId,
      options.projectId,
      options.scorers
    );
  }
}
