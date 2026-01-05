import { BaseClient, RequestMethod } from '../base-client';
import { Routes } from '../../types/routes.types';
import type { ScorerConfig } from '../../types/scorer.types';
import { JobName, EXPERIMENT_TASK_TYPE } from '../../types/job.types';
import type { TaskType } from '../../types/job.types';
import type {
  ExperimentResponseType,
  PromptRunSettings,
  CreateJobResponse,
  ExperimentDatasetRequest,
  ExperimentUpdateRequest,
  ExperimentMetricsRequest,
  ExperimentMetricsResponse,
  ExperimentsAvailableColumnsResponse,
  ListExperimentResponse,
  ExperimentUpdateRequestOpenAPI,
  ExperimentMetricsRequestOpenAPI,
  ExperimentMetricsResponseOpenAPI,
  ExperimentsAvailableColumnsResponseOpenAPI,
  ListExperimentResponseOpenAPI,
  ExperimentResponseOpenAPI,
  ExperimentCreateRequest,
  ExperimentCreateRequestOpenAPI
} from '../../types/experiment.types';

export class ExperimentService extends BaseClient {
  private projectId: string;
  constructor(apiUrl: string, token: string, projectId: string) {
    super();
    this.apiUrl = apiUrl;
    this.token = token;
    this.projectId = projectId;
    this.initializeClient();
  }

  public async getExperiment(id: string): Promise<ExperimentResponseType> {
    const response = await this.makeRequest<ExperimentResponseOpenAPI>(
      RequestMethod.GET,
      Routes.experiment,
      null,
      {
        experiment_id: id,
        project_id: this.projectId
      }
    );
    return this.convertToCamelCase<
      ExperimentResponseOpenAPI,
      ExperimentResponseType
    >(response);
  }

  public async getExperiments(): Promise<ExperimentResponseType[]> {
    const response = await this.makeRequest<ExperimentResponseOpenAPI[]>(
      RequestMethod.GET,
      Routes.experiments,
      null,
      {
        project_id: this.projectId
      }
    );
    return response.map((item) =>
      this.convertToCamelCase<
        ExperimentResponseOpenAPI,
        ExperimentResponseType
      >(item)
    );
  }

  public async createExperiment(
    name: string,
    dataset?: ExperimentDatasetRequest | null
  ): Promise<ExperimentResponseType> {
    const requestBody = this.convertToSnakeCase<
      ExperimentCreateRequest,
      ExperimentCreateRequestOpenAPI
    >({
      name,
      taskType: EXPERIMENT_TASK_TYPE,
      dataset
    });

    const response = await this.makeRequest<ExperimentResponseOpenAPI>(
      RequestMethod.POST,
      Routes.experiments,
      requestBody,
      {
        project_id: this.projectId
      }
    );
    return this.convertToCamelCase<
      ExperimentResponseOpenAPI,
      ExperimentResponseType
    >(response);
  }

  public async createRunScorerSettings(
    experimentId: string,
    projectId: string,
    scorers: ScorerConfig[]
  ): Promise<void> {
    const scorerRequest = this.convertToSnakeCase(scorers);
    return await this.makeRequest<void>(
      RequestMethod.POST,
      Routes.runScorerSettings,
      { run_id: experimentId, scorers: scorerRequest },
      {
        project_id: projectId || this.projectId,
        run_id: experimentId
      }
    );
  }

  public async createPromptRunJob(
    experimentId: string,
    projectId: string,
    promptTemplateVersionId: string,
    datasetId: string,
    scorers?: ScorerConfig[],
    promptSettings?: PromptRunSettings,
    name?: string,
    taskType?: TaskType
  ): Promise<CreateJobResponse> {
    const scorerRequest = scorers ? this.convertToSnakeCase(scorers) : null;
    return await this.makeRequest<CreateJobResponse>(
      RequestMethod.POST,
      Routes.jobs,
      {
        job_name: name || JobName.playground_run,
        project_id: projectId || this.projectId,
        run_id: experimentId,
        prompt_template_version_id: promptTemplateVersionId,
        prompt_settings: promptSettings || {},
        dataset_id: datasetId,
        scorers: scorerRequest,
        task_type: taskType || EXPERIMENT_TASK_TYPE
      }
    );
  }

  /**
   * Updates an experiment.
   * @param id - The unique identifier of the experiment.
   * @param updateRequest - The experiment update request.
   * @returns A promise that resolves to the updated experiment.
   */
  public async updateExperiment(
    id: string,
    updateRequest: ExperimentUpdateRequest
  ): Promise<ExperimentResponseType> {
    const requestBody = this.convertToSnakeCase<
      ExperimentUpdateRequest,
      ExperimentUpdateRequestOpenAPI
    >(updateRequest);
    const response = await this.makeRequest<ExperimentResponseOpenAPI>(
      RequestMethod.PUT,
      Routes.experiment,
      requestBody,
      {
        experiment_id: id,
        project_id: this.projectId
      }
    );
    return this.convertToCamelCase<
      ExperimentResponseOpenAPI,
      ExperimentResponseType
    >(response);
  }

  /**
   * Deletes an experiment.
   * @param id - The unique identifier of the experiment.
   * @returns A promise that resolves when the experiment is deleted.
   */
  public async deleteExperiment(id: string): Promise<void> {
    return await this.makeRequest<void>(
      RequestMethod.DELETE,
      Routes.experiment,
      null,
      {
        experiment_id: id,
        project_id: this.projectId
      }
    );
  }

  /**
   * Gets experiment metrics.
   * @param id - The unique identifier of the experiment.
   * @param metricsRequest - The experiment metrics request.
   * @returns A promise that resolves to the experiment metrics response.
   */
  public async getExperimentMetrics(
    id: string,
    projectId: string,
    metricsRequest: ExperimentMetricsRequest
  ): Promise<ExperimentMetricsResponse> {
    const requestBody = this.convertToSnakeCase<
      ExperimentMetricsRequest,
      ExperimentMetricsRequestOpenAPI
    >(metricsRequest);
    const response = await this.makeRequest<ExperimentMetricsResponseOpenAPI>(
      RequestMethod.POST,
      Routes.experimentMetrics,
      requestBody,
      {
        experiment_id: id,
        project_id: projectId || this.projectId
      }
    );
    return this.convertToCamelCase<
      ExperimentMetricsResponseOpenAPI,
      ExperimentMetricsResponse
    >(response);
  }

  /**
   * Gets paginated experiments.
   * @param options - The pagination options.
   * @param options.startingToken - (Optional) The starting token for pagination (default: 0).
   * @param options.limit - (Optional) The maximum number of records to return (default: 100).
   * @param options.includeCounts - (Optional) Whether to include counts (default: false).
   * @returns A promise that resolves to the paginated experiments response.
   */
  public async getExperimentsPaginated(options?: {
    startingToken?: number;
    limit?: number;
    includeCounts?: boolean;
  }): Promise<ListExperimentResponse> {
    const params: Record<string, unknown> = {
      project_id: this.projectId
    };
    if (options?.startingToken !== undefined) {
      params.starting_token = options.startingToken;
    }
    if (options?.limit !== undefined) {
      params.limit = options.limit;
    }
    if (options?.includeCounts !== undefined) {
      params.include_counts = options.includeCounts;
    }
    const response = await this.makeRequest<ListExperimentResponseOpenAPI>(
      RequestMethod.GET,
      Routes.experimentsPaginated,
      null,
      params
    );
    return this.convertToCamelCase<
      ListExperimentResponseOpenAPI,
      ListExperimentResponse
    >(response);
  }

  /**
   * Gets available columns for experiments.
   * @returns A promise that resolves to the available columns response.
   */
  public async getAvailableColumns(): Promise<ExperimentsAvailableColumnsResponse> {
    const response =
      await this.makeRequest<ExperimentsAvailableColumnsResponseOpenAPI>(
        RequestMethod.POST,
        Routes.experimentsAvailableColumns,
        null,
        {
          project_id: this.projectId
        }
      );
    return this.convertToCamelCase<
      ExperimentsAvailableColumnsResponseOpenAPI,
      ExperimentsAvailableColumnsResponse
    >(response);
  }
}
