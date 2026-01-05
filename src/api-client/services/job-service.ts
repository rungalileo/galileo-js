import { BaseClient, RequestMethod } from '../base-client';
import { Routes } from '../../types/routes.types';
import { TaskType } from '../../types/job.types';
import { ScorerConfig } from '../../types/scorer.types';
import {
  CreateJobResponse,
  PromptRunSettings
} from '../../types/experiment.types';

/**
 * Internal JobsService for job creation functionality.
 * Not exposed publicly - use Jobs class from utils/jobs.ts instead.
 */
export class JobsService extends BaseClient {
  constructor(apiUrl: string, token: string) {
    super();
    this.apiUrl = apiUrl;
    this.token = token;
    this.initializeClient();
  }

  /**
   * Creates a new job in the Galileo platform for executing a prompt run with specified scorers.
   * @param projectId Unique identifier of the project
   * @param name Name for the job (e.g., "playground_run")
   * @param runId Unique identifier of the run (typically experiment ID)
   * @param datasetId Unique identifier of the dataset to process
   * @param promptTemplateId Version ID of the prompt template to use
   * @param taskType Type of task to execute (e.g., EXPERIMENT_TASK_TYPE = 16)
   * @param scorers Optional list of scorer configurations to apply
   * @param promptSettings Settings for the prompt run (model, temperature, etc.)
   * @returns CreateJobResponse containing job details
   * @throws Error if job creation fails
   */
  public async create(
    projectId: string,
    name: string,
    runId: string,
    datasetId: string,
    promptTemplateId: string,
    taskType: TaskType,
    promptSettings: PromptRunSettings,
    scorers?: ScorerConfig[]
  ): Promise<CreateJobResponse> {
    const createParams = {
      project_id: projectId,
      dataset_id: datasetId,
      job_name: name,
      run_id: runId,
      prompt_settings: promptSettings || {},
      prompt_template_version_id: promptTemplateId,
      task_type: taskType,
      scorers: scorers
    };

    try {
      const response = await this.makeRequest<CreateJobResponse>(
        RequestMethod.POST,
        Routes.jobs,
        createParams
      );

      if (!response || !response.jobId) {
        throw new Error(
          `Create job failed: ${JSON.stringify(response || 'No response')}`
        );
      }

      return response;
    } catch (error: unknown) {
      let errorMessage = 'Create job failed';

      if (error && typeof error === 'object') {
        const err = error as {
          response?: { data?: { detail?: string } };
          message?: string;
        };
        errorMessage =
          err.response?.data?.detail || err.message || errorMessage;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      throw new Error(`Create job failed: ${errorMessage}`);
    }
  }
}
