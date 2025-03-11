import { BaseClient, RequestMethod } from '../base-client';
import { Routes } from '../../types/routes.types';
import { Scorer } from '../../types/scorer.types';
import { ScorerTypes } from '../../types/scorer.types';
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
        name
      },
      {
        project_id: this.projectId
      }
    );
  };

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

  public createRunScorerSettings = async (
    experimentId: string,
    projectId: string,
    scorers: Scorer[]
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
    scorers?: Scorer[],
    promptSettings?: PromptRunSettings
  ): Promise<CreateJobResponse> => {
    return await this.makeRequest<CreateJobResponse>(
      RequestMethod.POST,
      Routes.jobs,
      {
        name: 'prompt_run',
        project_id: projectId,
        run_id: experimentId,
        prompt_template_id: promptTemplateVersionId,
        prompt_settings: promptSettings || null,
        dataset_id: datasetId,
        scorers: scorers || null,
        task_type: 16
      }
    );
  };
}
