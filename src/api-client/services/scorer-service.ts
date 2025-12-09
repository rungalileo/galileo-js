import { BaseClient, RequestMethod } from '../base-client';
import { Routes } from '../../types/routes.types';
import {
  ScorerTypes,
  ValidateCodeScorerResponse,
  RegisteredScorerTaskResultResponse,
  TaskStatus,
  ResultType,
  ValidateRegisteredScorerResult,
  CreateScorerRequest,
  CreateScorerRequestOpenAPI,
  ScorerResponseOpenAPI,
  ListScorersRequestOpenAPI,
  ScorerResponse,
  ListScorersRequest,
  ListScorersResponseOpenAPI,
  ListScorersResponse,
  BaseScorerVersionResponseOpenAPI,
  BaseScorerVersionResponse,
  CreateLlmScorerVersionRequest,
  CreateLlmScorerVersionRequestOpenAPI,
  DeleteScorerResponse,
  DeleteScorerResponseOpenAPI
} from '../../types/scorer.types';
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
  }): Promise<ListScorersResponse> => {
    const payload: ListScorersRequest = {
      filters: []
    };

    if (options?.type) {
      payload.filters!.push({
        name: 'scorer_type',
        value: options.type,
        operator: 'eq'
      });
    }

    if (options?.names && options.names.length === 1) {
      payload.filters!.push({
        name: 'name',
        value: options.names[0],
        operator: 'eq'
      });
    } else if (options?.names && options.names.length > 1) {
      payload.filters!.push({
        name: 'name',
        value: options.names,
        operator: 'one_of'
      });
    }

    const request = this.convertToSnakeCase<
      ListScorersRequest,
      ListScorersRequestOpenAPI
    >(payload);
    const response = await this.makeRequest<ListScorersResponseOpenAPI>(
      RequestMethod.POST,
      Routes.scorers,
      request
    );

    return this.convertToCamelCase<
      ListScorersResponseOpenAPI,
      ListScorersResponse
    >(response);
  };

  /**
   * Retrieves a page of scorers with pagination support.
   */
  public getScorersPage = async (options?: {
    name?: string;
    names?: string[];
    types?: ScorerTypes[];
    startingToken?: number;
    limit?: number;
  }): Promise<ListScorersResponse> => {
    const payload: ListScorersRequest = {
      filters: []
    };

    if (options?.types && options.types.length === 1) {
      payload.filters!.push({
        name: 'scorer_type',
        value: options.types[0],
        operator: 'eq'
      });
    } else if (options?.types && options.types.length > 1) {
      payload.filters!.push({
        name: 'scorer_type',
        value: options.types,
        operator: 'one_of'
      });
    }

    if (options?.name) {
      payload.filters!.push({
        name: 'name',
        value: options.name,
        operator: 'eq'
      });
    }

    if (options?.names && options.names.length === 1) {
      payload.filters!.push({
        name: 'name',
        value: options.names[0],
        operator: 'eq'
      });
    } else if (options?.names && options.names.length > 1) {
      payload.filters!.push({
        name: 'name',
        value: options.names,
        operator: 'one_of'
      });
    }

    const request = this.convertToSnakeCase<
      ListScorersRequest,
      ListScorersRequestOpenAPI
    >(payload);
    const response = await this.makeRequest<ListScorersResponseOpenAPI>(
      RequestMethod.POST,
      Routes.scorers,
      request,
      {
        starting_token: options?.startingToken ?? 0,
        limit: options?.limit ?? 100
      }
    );

    return this.convertToCamelCase<
      ListScorersResponseOpenAPI,
      ListScorersResponse
    >(response);
  };

  /**
   * Retrieves a specific version of a scorer by its ID and version number.
   *
   * @param scorerId - The unique identifier of the scorer.
   * @param version - The version number of the scorer to retrieve.
   * @returns A promise that resolves to the requested {@link BaseScorerVersionResponse}.
   */
  public getScorerVersion = async (
    scorerId: string,
    version: number
  ): Promise<BaseScorerVersionResponse> => {
    const response = await this.makeRequest<BaseScorerVersionResponseOpenAPI>(
      RequestMethod.GET,
      Routes.scorerVersion,
      undefined,
      {
        scorer_id: scorerId,
        version: version
      }
    );

    return this.convertToCamelCase<
      BaseScorerVersionResponseOpenAPI,
      BaseScorerVersionResponse
    >(response);
  };

  /**
   * Creates a new scorer with the specified parameters.
   * @param options - The scorer creation options.
   * @param options.name - The name of the scorer.
   * @param options.scorerType - The type of the scorer.
   * @param options.description - (Optional) A description for the scorer.
   * @param options.tags - (Optional) Tags to associate with the scorer.
   * @param options.defaults - (Optional) Default settings for the scorer. Required for LLM scorers.
   * @param options.modelType - (Optional) The model type for the scorer.
   * @param options.defaultVersionId - (Optional) The default version ID for the scorer.
   * @param options.scoreableNodeTypes - (Optional) The node types that can be scored.
   * @param options.outputType - (Optional) The output type for the scorer.
   * @param options.inputType - (Optional) The input type for the scorer.
   * @returns A promise that resolves to the created scorer.
   */
  public createScorer = async (
    options: CreateScorerRequest
  ): Promise<ScorerResponse> => {
    const requestBody: CreateScorerRequestOpenAPI = this.convertToSnakeCase<
      CreateScorerRequest,
      CreateScorerRequestOpenAPI
    >(options);

    const response = await this.makeRequest<ScorerResponseOpenAPI>(
      RequestMethod.POST,
      Routes.scorer,
      requestBody
    );

    return this.convertToCamelCase<ScorerResponseOpenAPI, ScorerResponse>(
      response
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
    options: CreateLlmScorerVersionRequest
  ): Promise<BaseScorerVersionResponse> => {
    const request = this.convertToSnakeCase<
      CreateLlmScorerVersionRequest,
      CreateLlmScorerVersionRequestOpenAPI
    >(options);
    const response = await this.makeRequest<BaseScorerVersionResponseOpenAPI>(
      RequestMethod.POST,
      Routes.llmScorerVersion,
      request,
      { scorer_id: scorerId }
    );

    return this.convertToCamelCase<
      BaseScorerVersionResponseOpenAPI,
      BaseScorerVersionResponse
    >(response);
  };

  /**
   * Deletes a scorer by its unique identifier.
   *
   * @param id - The unique identifier of the scorer to delete.
   * @returns A promise that resolves when the scorer is deleted.
   */
  public deleteScorer = async (id: string): Promise<DeleteScorerResponse> => {
    const response = await this.makeRequest<DeleteScorerResponseOpenAPI>(
      RequestMethod.DELETE,
      Routes.scorerId,
      undefined,
      { scorer_id: id }
    );

    return this.convertToCamelCase<
      DeleteScorerResponseOpenAPI,
      DeleteScorerResponse
    >(response);
  };

  public createCodeScorerVersion = async (
    scorerId: string,
    codeContent: string,
    validationResult?: string
  ): Promise<BaseScorerVersionResponse> => {
    console.log(`Creating metric version: ${scorerId}`);
    console.log(`Code content length: ${codeContent.length} bytes`);

    // Create FormData with the code content as a file
    const formData = new FormData();
    const blob = new Blob([codeContent], { type: 'text/x-python' });
    formData.append('file', blob, 'scorer.py');

    // Add validation result if provided
    if (validationResult) {
      console.log(`Including validation result in request`);
      formData.append('validation_result', validationResult);
    }

    const result = await this.makeRequest<BaseScorerVersionResponseOpenAPI>(
      RequestMethod.POST,
      Routes.codeScorerVersion,
      formData,
      { scorer_id: scorerId }
    );

    console.log(`Metric version created: ${result.id}`);
    return this.convertToCamelCase<
      BaseScorerVersionResponseOpenAPI,
      BaseScorerVersionResponse
    >(result);
  };

  /**
   * Validates code scorer content by submitting it for validation.
   *
   * @param codeContent - The Python code content to validate.
   * @param scoreableNodeTypes - The node types that this scorer can score.
   * @returns A promise that resolves to the validation task ID.
   */
  public validateCodeScorer = async (
    codeContent: string,
    scoreableNodeTypes: StepType[]
  ): Promise<ValidateCodeScorerResponse> => {
    console.log(`Submitting code for validation...`);
    console.log(`Step type(s): ${JSON.stringify(scoreableNodeTypes)}`);

    const formData = new FormData();
    const blob = new Blob([codeContent], { type: 'text/x-python' });
    formData.append('file', blob, 'scorer.py');
    formData.append('scoreable_node_types', JSON.stringify(scoreableNodeTypes));

    const response = await this.makeRequest<ValidateCodeScorerResponse>(
      RequestMethod.POST,
      Routes.codeScorerValidate,
      formData
    );
    console.log(`Validation task created: ${response.task_id}`);
    return response;
  };

  /**
   * Gets the result of a code scorer validation task.
   *
   * @param taskId - The ID of the validation task.
   * @returns A promise that resolves to the validation result.
   */
  public getCodeScorerValidationResult = async (
    taskId: string
  ): Promise<RegisteredScorerTaskResultResponse> => {
    const path = Routes.codeScorerValidateResult.replace('{task_id}', taskId);
    return await this.makeRequest<RegisteredScorerTaskResultResponse>(
      RequestMethod.GET,
      path as Routes
    );
  };

  /**
   * Validates code scorer and waits for the result.
   * Polls the validation endpoint at specified intervals until complete or timeout.
   *
   * @param codeContent - The Python code content to validate.
   * @param scoreableNodeTypes - The node types that this scorer can score.
   * @param timeoutMs - Maximum time to wait for validation (default: 60000ms).
   * @param pollIntervalMs - Interval between polling attempts (default: 1000ms).
   * @returns A promise that resolves to the validation result.
   * @throws Error if validation fails or times out.
   */
  public validateCodeScorerAndWait = async (
    codeContent: string,
    scoreableNodeTypes: StepType[],
    timeoutMs: number = 60000,
    pollIntervalMs: number = 1000
  ): Promise<ValidateRegisteredScorerResult> => {
    // Submit validation request
    const { task_id } = await this.validateCodeScorer(
      codeContent,
      scoreableNodeTypes
    );

    const startTime = Date.now();
    let pollCount = 0;

    // Poll for result
    while (Date.now() - startTime < timeoutMs) {
      pollCount++;
      const response = await this.getCodeScorerValidationResult(task_id);

      if (response.status === TaskStatus.COMPLETE) {
        console.log(`Validation completed successfully`);
        // Parse result if it's a string
        let result: ValidateRegisteredScorerResult | null = null;
        if (typeof response.result === 'string') {
          try {
            result = JSON.parse(
              response.result
            ) as ValidateRegisteredScorerResult;
          } catch (err) {
            throw new Error(
              `Failed to parse validation result as JSON: ${err instanceof Error ? err.message : String(err)}`
            );
          }
        } else {
          result = response.result;
        }

        if (result === null) {
          throw new Error('Validation completed but result is empty');
        }

        // Check if result is invalid
        if (result.result.result_type === ResultType.INVALID) {
          console.log(
            `Validation result: INVALID - ${result.result.error_message}`
          );
          throw new Error(
            `Code metric validation failed: ${result.result.error_message}`
          );
        }

        console.log(`  Score type: ${result.result.score_type}`);
        console.log(
          `  Step type(s): ${JSON.stringify(result.result.scoreable_node_types)}`
        );

        return result;
      }

      if (response.status === TaskStatus.FAILED) {
        const errorMessage =
          typeof response.result === 'string'
            ? response.result
            : 'Validation task failed';
        console.log(`Validation task failed: ${errorMessage}`);
        throw new Error(`Code metric validation failed: ${errorMessage}`);
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    console.log(
      `Validation timed out after ${timeoutMs / 1000} seconds (${pollCount} polls)`
    );
    throw new Error(
      `Code scorer validation timed out after ${timeoutMs / 1000} seconds`
    );
  };
}
