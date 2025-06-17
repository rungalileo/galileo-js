import { BaseClient, RequestMethod } from '../base-client';
import { Routes } from '../../types/routes.types';
import {
  StageDB,
  StageCreationPayload,
  GetStageParams,
  UpdateStagePayload,
} from '../../types/stage.types';

export class StageService extends BaseClient {
  private projectId: string;

  constructor(apiUrl: string, token: string, projectId: string) {
    super();
    this.apiUrl = apiUrl;
    this.token = token;
    this.projectId = projectId;
    this.initializeClient();
  }

  /**
   * Creates a new stage for a project.
   * @param payload The data for the new stage.
   * @returns The created stage.
   */
  public createStage = async (
    payload: StageCreationPayload,
  ): Promise<StageDB> => {
    return await this.makeRequest<StageDB>(
      RequestMethod.POST,
      Routes.stages,
      payload,
      { project_id: this.projectId },
    );
  };

  /**
   * Retrieves a specific stage by its ID or name.
   * Either stageId or stageName must be provided.
   * @param params Parameters to identify the stage (stageId or stageName).
   * @returns The requested stage.
   */
  public getStage = async (
    params: GetStageParams,
  ): Promise<StageDB> => {
    if (!params.stageId && !params.stageName) {
      throw new Error('Either stageId or stageName must be provided to getStage.');
    }
    const requestParams: Record<string, unknown> = { project_id: this.projectId };
    if (params.stageId) {
      requestParams.stage_id = params.stageId;
    }
    if (params.stageName) {
      requestParams.stage_name = params.stageName;
    }

    return await this.makeRequest<StageDB>(
      RequestMethod.GET,
      Routes.stages,
      undefined,
      requestParams,
    );
  };

  /**
   * Updates an existing stage's rulesets.
   * @param stageId The ID of the stage to update.
   * @param payload The new ruleset data for the stage.
   * @returns The updated stage.
   */
  public updateStage = async (
    stageId: string,
    payload: UpdateStagePayload,
  ): Promise<StageDB> => {
    return await this.makeRequest<StageDB>(
      RequestMethod.POST,
      Routes.stage,
      payload,
      { project_id: this.projectId, stage_id: stageId },
    );
  };

  /**
   * Pauses a stage.
   * @param stageId The ID of the stage to pause.
   * @returns The updated stage (now paused).
   */
  public pauseStage = async (
    stageId: string,
  ): Promise<StageDB> => {
    return await this.makeRequest<StageDB>(
      RequestMethod.PUT,
      Routes.stage,
      undefined,
      { project_id: this.projectId, stage_id: stageId, pause: 'true' },
    );
  };

  /**
   * Resumes a paused stage.
   * @param stageId The ID of the stage to resume.
   * @returns The updated stage (now active).
   */
  public resumeStage = async (
    stageId: string,
  ): Promise<StageDB> => {
    return await this.makeRequest<StageDB>(
      RequestMethod.PUT,
      Routes.stage,
      undefined,
      { project_id: this.projectId, stage_id: stageId, pause: 'false' },
    );
  };
}