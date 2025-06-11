// src/api-client/services/stage-service.ts
import { BaseClient, RequestMethod } from '../base-client';
import { Routes } from '../../types/routes.types';
import {
  StageDB,
  StageCreationPayload,
  GetStageParams,
  UpdateStagePayload,
} from '../../types/stage.types';

export class StageService extends BaseClient {
  // projectId is stored for consistency, though methods currently receive it.
  private projectId: string;

  constructor(apiUrl: string, token: string, projectId: string) {
    super();
    this.apiUrl = apiUrl;
    this.token = token;
    this.projectId = projectId; // Store projectId
    this.initializeClient();
  }

  /**
   * Creates a new stage for a project.
   * @param projectId The ID of the project.
   * @param payload The data for the new stage.
   * @returns The created stage.
   */
  public createStage = async (
    projectId: string,
    payload: StageCreationPayload,
  ): Promise<StageDB> => {
    return await this.makeRequest<StageDB>(
      RequestMethod.POST,
      Routes.stages, // Use enum member
      payload,
      { project_id: projectId }, // Pass projectId for path replacement
    );
  };

  /**
   * Retrieves a specific stage by its ID or name.
   * Either stageId or stageName must be provided.
   * @param projectId The ID of the project.
   * @param params Parameters to identify the stage (stageId or stageName).
   * @returns The requested stage.
   */
  public getStage = async (
    projectId: string,
    params: GetStageParams,
  ): Promise<StageDB> => {
    if (!params.stageId && !params.stageName) {
      throw new Error('Either stageId or stageName must be provided to getStage.');
    }
    const requestParams: Record<string, unknown> = { project_id: projectId };
    if (params.stageId) {
      requestParams.stage_id = params.stageId;
    }
    if (params.stageName) {
      requestParams.stage_name = params.stageName;
    }

    return await this.makeRequest<StageDB>(
      RequestMethod.GET,
      Routes.stages, // Use enum member
      undefined, // No body for GET
      requestParams, // Pass consolidated params
    );
  };

  /**
   * Updates an existing stage's rulesets.
   * @param projectId The ID of the project.
   * @param stageId The ID of the stage to update.
   * @param payload The new ruleset data for the stage.
   * @returns The updated stage.
   */
  public updateStage = async (
    projectId: string,
    stageId: string,
    payload: UpdateStagePayload,
  ): Promise<StageDB> => {
    return await this.makeRequest<StageDB>(
      RequestMethod.POST,
      Routes.stage, // Use enum member
      payload,
      { project_id: projectId, stage_id: stageId }, // Pass params for path replacement
    );
  };

  /**
   * Pauses a stage.
   * @param projectId The ID of the project.
   * @param stageId The ID of the stage to pause.
   * @returns The updated stage (now paused).
   */
  public pauseStage = async (
    projectId: string,
    stageId: string,
  ): Promise<StageDB> => {
    return await this.makeRequest<StageDB>(
      RequestMethod.PUT,
      Routes.stage, // Use enum member
      undefined, // No body
      { project_id: projectId, stage_id: stageId, pause: 'true' }, // Path & query
    );
  };

  /**
   * Resumes a paused stage.
   * @param projectId The ID of the project.
   * @param stageId The ID of the stage to resume.
   * @returns The updated stage (now active).
   */
  public resumeStage = async (
    projectId: string,
    stageId: string,
  ): Promise<StageDB> => {
    return await this.makeRequest<StageDB>(
      RequestMethod.PUT,
      Routes.stage, // Use enum member
      undefined, // No body
      { project_id: projectId, stage_id: stageId, pause: 'false' }, // Path & query
    );
  };
}