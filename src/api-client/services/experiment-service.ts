import { BaseClient, RequestMethod } from '../base-client';
import { Routes } from '../../types/routes.types';
import { ScorerConfig } from '../../types/scorer.types';
import { JobName, TaskType, EXPERIMENT_TASK_TYPE } from '../../types/job.types';
import {
  Experiment,
  PromptRunSettings,
  CreateJobResponse,
  ExperimentDatasetRequest
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

  public getExperiment = async (id: string): Promise<Experiment> => {
    return await this.makeRequest<Experiment>(
      RequestMethod.GET,
      Routes.experiment,
      null,
      {
        experiment_id: id
      }
    );
  };

  public getExperiments = async (): Promise<Experiment[]> => {
    return await this.makeRequest<Experiment[]>(
      RequestMethod.GET,
      Routes.experiments,
      null,
      {
        project_id: this.projectId
      }
    );
  };

  public createExperiment = async (
    name: string,
    dataset?: ExperimentDatasetRequest | null
  ): Promise<Experiment> => {
    return await this.makeRequest<Experiment>(
      RequestMethod.POST,
      Routes.experiments,
      {
        name,
        task_type: EXPERIMENT_TASK_TYPE,
        dataset
      },
      {
        project_id: this.projectId
      }
    );
  };

  public createRunScorerSettings = async (
    experimentId: string,
    projectId: string,
    scorers: ScorerConfig[]
  ): Promise<void> => {
    const scorerRequest = this.convertToSnakeCase(scorers);
    return await this.makeRequest<void>(
      RequestMethod.POST,
      Routes.runScorerSettings,
      { run_id: experimentId, scorers: scorerRequest },
      {
        project_id: projectId,
        run_id: experimentId
      }
    );
  };

  public createPromptRunJob = async (
    experimentId: string,
    projectId: string,
    promptTemplateVersionId: string,
    datasetId: string,
    scorers?: ScorerConfig[],
    promptSettings?: PromptRunSettings,
    name?: string,
    taskType?: TaskType
  ): Promise<CreateJobResponse> => {
    const scorerRequest = scorers ? this.convertToSnakeCase(scorers) : null;
    return await this.makeRequest<CreateJobResponse>(
      RequestMethod.POST,
      Routes.jobs,
      {
        job_name: name || JobName.playground_run,
        project_id: projectId,
        run_id: experimentId,
        prompt_template_version_id: promptTemplateVersionId,
        prompt_settings: promptSettings || {},
        dataset_id: datasetId,
        scorers: scorerRequest,
        task_type: taskType || EXPERIMENT_TASK_TYPE
      }
    );
  };
}
