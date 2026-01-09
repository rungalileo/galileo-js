import { CreateJobResponseType, TaskType } from '../types/job.types';
import { ScorerConfig } from '../types/scorer.types';
import { PromptRunSettings } from '../types/experiment.types';
import { GalileoApiClient } from '../api-client';

/**
 * Jobs class for creating jobs in the Galileo platform.
 * Public-facing API that delegates to internal GalileoApiClient.
 * Matches Python Jobs class API from galileo-python/src/galileo/jobs.py
 */
export class Jobs {
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
  ): Promise<CreateJobResponseType> {
    const apiClient: GalileoApiClient = new GalileoApiClient();
    await apiClient.init({ projectId, projectScoped: true });
    return apiClient.createJob({
      projectId,
      name,
      runId,
      datasetId,
      promptTemplateId,
      taskType,
      promptSettings,
      scorers
    });
  }
}
