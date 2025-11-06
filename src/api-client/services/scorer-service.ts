import { BaseClient, RequestMethod } from '../base-client';
import { Routes } from '../../types/routes.types';
import {
  ChainPollTemplate,
  ModelType,
  Scorer,
  ScorerDefaults,
  ScorerVersion
} from '../../types/scorer.types';
import { OutputType, InputType, ScorerTypes } from '../../types/scorer.types';
import { StepType } from '../../types/logging/step.types';

export class ScorerService extends BaseClient {
  constructor(apiUrl: string, token: string) {
    super();
    this.apiUrl = apiUrl;
    this.token = token;
    this.initializeClient();
  }

  /**
   * Retrieves a list of scorers, optionally filtered by scorer type.
   *
   * @param type - (Optional) The type of scorer to filter by.
   * @returns A promise that resolves to an array of {@link Scorer} objects.
   */
  public getScorers = async (options?: {
    type?: ScorerTypes;
    names?: string[];
  }): Promise<Scorer[]> => {
    const filters = [];
    if (options?.type) {
      filters.push({
        name: 'scorer_type',
        value: options.type,
        operator: 'eq'
      });
    }

    if (options?.names && options.names.length === 1) {
      filters.push({
        name: 'name',
        value: options.names[0],
        operator: 'eq'
      });
    } else if (options?.names && options.names.length > 1) {
      filters.push({
        name: 'name',
        value: options.names,
        operator: 'one_of'
      });
    }

    const payload = filters.length > 0 ? { filters } : {};
    console.log('Scorer request payload:', JSON.stringify(payload));

    const response = await this.makeRequest<{ scorers: Scorer[] }>(
      RequestMethod.POST,
      Routes.scorers,
      payload
    );

    return response.scorers;
  };

  /**
   * Retrieves a specific version of a scorer by its ID and version number.
   *
   * @param scorerId - The unique identifier of the scorer.
   * @param version - The version number of the scorer to retrieve.
   * @returns A promise that resolves to the requested {@link ScorerVersion}.
   */
  public getScorerVersion = async (
    scorerId: string,
    version: number
  ): Promise<ScorerVersion> => {
    const path = Routes.scorerVersion.replace('{scorer_id}', scorerId);
    return await this.makeRequest<ScorerVersion>(
      RequestMethod.GET,
      path as Routes,
      undefined,
      {
        version: version
      }
    );
  };

  /**
   * Creates a new scorer with the specified parameters.
   *
   * @param name - The name of the scorer.
   * @param type - The type of the scorer.
   * @param description - (Optional) A description for the scorer.
   * @param tags - (Optional) Tags to associate with the scorer.
   * @param defaults - (Optional) Default settings for the scorer.
   * @param modelType - (Optional) The model type for the scorer.
   * @param defaultVersionId - (Optional) The default version ID for the scorer.
   * @returns A promise that resolves to the created {@link Scorer}.
   */
  public createScorer = async (
    name: string,
    type: ScorerTypes,
    description?: string,
    tags?: string[],
    defaults?: ScorerDefaults,
    modelType?: ModelType,
    defaultVersionId?: string,
    scoreableNodeTypes?: StepType[],
    outputType?: OutputType,
    inputType?: InputType
  ): Promise<Scorer> => {
    const scorerPayload = {
      name: name,
      scorer_type: type,
      description: description,
      tags: tags || [],
      defaults: defaults,
      model_type: modelType,
      default_version_id: defaultVersionId,
      scoreable_node_types: scoreableNodeTypes,
      output_type: outputType,
      input_type: inputType
    };

    return await this.makeRequest<Scorer>(
      RequestMethod.POST,
      Routes.scorer,
      scorerPayload
    );
  };

  /**
   * Creates a new LLM scorer version for a given scorer.
   *
   * @param scorerId - The unique identifier of the scorer.
   * @param instructions - Instructions for the scorer version.
   * @param chainPollTemplate - The chain poll template for the scorer version.
   * @param userPrompt - (Optional) The user prompt for the scorer version.
   * @param scoreableNodeTypes - (Optional) The node level for the scorer version. Defaults to ['llm'].
   * @param cotEnabled - (Optional) Whether chain of thought is enabled. Defaults to
   * @param modelName - (Optional) The model name to use.
   * @param numJudges - (Optional) The number of judges to use.
   * @param outputType - (Optional) The output type for the scorer version.
   * @returns A promise that resolves to the created {@link ScorerVersion}.
   */
  public createLLMScorerVersion = async (
    scorerId: string,
    instructions?: string,
    chainPollTemplate?: ChainPollTemplate,
    userPrompt?: string,
    cotEnabled?: boolean,
    modelName?: string,
    numJudges?: number
  ): Promise<ScorerVersion> => {
    const scorerVersionPayload: {
      model_name?: string;
      num_judges?: number;
      instructions?: string;
      chain_poll_template?: ChainPollTemplate;
      user_prompt?: string;
      scoreable_node_types?: StepType[];
      cot_enabled?: boolean;
    } = {};

    if (modelName !== undefined && modelName !== null) {
      scorerVersionPayload.model_name = modelName;
    }
    if (numJudges !== undefined && numJudges !== null) {
      scorerVersionPayload.num_judges = numJudges;
    }
    if (instructions !== undefined && instructions !== null) {
      scorerVersionPayload.instructions = instructions;
    }
    if (chainPollTemplate !== undefined && chainPollTemplate !== null) {
      scorerVersionPayload.chain_poll_template = chainPollTemplate;
    }
    if (userPrompt !== undefined && userPrompt !== null) {
      scorerVersionPayload.user_prompt = userPrompt;
    }
    if (cotEnabled !== undefined && cotEnabled !== null) {
      scorerVersionPayload.cot_enabled = cotEnabled;
    }

    const path = Routes.llmScorerVersion.replace('{scorer_id}', scorerId);

    return await this.makeRequest<ScorerVersion>(
      RequestMethod.POST,
      path as Routes,
      scorerVersionPayload,
      undefined
    );
  };

  /**
   * Deletes a scorer by its unique identifier.
   *
   * @param id - The unique identifier of the scorer to delete.
   * @returns A promise that resolves when the scorer is deleted.
   */
  public deleteScorer = async (id: string): Promise<void> => {
    const path = Routes.scorerId.replace('{scorer_id}', id);
    await this.makeRequest<void>(RequestMethod.DELETE, path as Routes);
  };

  public createCodeScorerVersion = async (
    scorerId: string,
    codeContent: string
  ): Promise<ScorerVersion> => {
    const path = Routes.codeScorerVersion.replace('{scorer_id}', scorerId);

    // Create FormData with the code content as a file
    const formData = new FormData();
    const blob = new Blob([codeContent], { type: 'text/x-python' });
    formData.append('file', blob, 'scorer.py');

    return await this.makeRequest<ScorerVersion>(
      RequestMethod.POST,
      path as Routes,
      formData
    );
  };
}
