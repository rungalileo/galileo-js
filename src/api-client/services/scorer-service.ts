import { BaseClient, RequestMethod } from '../base-client';
import { Routes } from '../../types/routes.types';
import {
  Scorer,
  ScorerDefaults,
  ScorerVersion
} from '../../types/scorer.types';
import { ScorerTypes } from '../../types/scorer.types';
import { components } from '../../types/api.types';

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
  public getScorers = async (type?: ScorerTypes): Promise<Scorer[]> => {
    const response = await this.makeRequest<{ scorers: Scorer[] }>(
      RequestMethod.POST,
      Routes.scorers,
      type
        ? {
            filters: [
              {
                name: 'scorer_type',
                value: type,
                operator: 'eq'
              }
            ]
          }
        : {}
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
    modelType?: components['schemas']['ModelType'],
    defaultVersionId?: string
  ): Promise<Scorer> => {
    const scorerPayload = {
      name: name,
      scorer_type: type,
      description: description,
      tags: tags || [],
      defaults: defaults,
      model_type: modelType,
      default_version_id: defaultVersionId
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
   * @param modelName - (Optional) The model name to use.
   * @param numJudges - (Optional) The number of judges to use.
   * @returns A promise that resolves to the created {@link ScorerVersion}.
   */
  public createLLMScorerVersion = async (
    scorerId: string,
    instructions: string,
    chainPollTemplate: components['schemas']['ChainPollTemplate'],
    modelName?: string,
    numJudges?: number
  ): Promise<ScorerVersion> => {
    const scorerVersionPayload = {
      model_name: modelName,
      num_judges: numJudges,
      instructions: instructions,
      chain_poll_template: chainPollTemplate
    };

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
}
