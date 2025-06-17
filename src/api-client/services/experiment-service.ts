import { BaseClient, RequestMethod } from '../base-client';
import { Routes } from '../../types/routes.types';
import { ScorerConfig } from '../../types/scorer.types';
import {
  Experiment,
  PromptRunSettings,
  CreateJobResponse
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

  public createExperiment = async (name: string): Promise<Experiment> => {
    return await this.makeRequest<Experiment>(
      RequestMethod.POST,
      Routes.experiments,
      {
        name,
        task_type: 16
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
    return await this.makeRequest<void>(
      RequestMethod.POST,
      Routes.runScorerSettings,
      { run_id: experimentId, scorers },
      {
        project_id: projectId,
        experiment_id: experimentId
      }
    );
  };

  public createPromptRunJob = async (
    experimentId: string,
    projectId: string,
    promptTemplateVersionId: string,
    datasetId: string,
    scorers?: ScorerConfig[],
    promptSettings?: PromptRunSettings
  ): Promise<CreateJobResponse> => {
    return await this.makeRequest<CreateJobResponse>(
      RequestMethod.POST,
      Routes.jobs,
      {
        job_name: 'playground_run',
        project_id: projectId,
        run_id: experimentId,
        prompt_template_version_id: promptTemplateVersionId,
        prompt_settings: promptSettings || {},
        dataset_id: datasetId,
        scorers: scorers,
        task_type: 17
      }
    );
  };
}
