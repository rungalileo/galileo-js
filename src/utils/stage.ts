import { GalileoApiClient } from '../api-client';
import {
  StageCreationPayload,
  UpdateStagePayload,
  StageDB,
} from '../types/stage.types';

/**
 * Creates a new stage for a project.
 * 
 * @param projectName The name of the project.
 * @param payload The data for the new stage (must include stage name).
 * @returns The created stage.
 */
export const createStage = async (
  projectName: string,
  payload: StageCreationPayload,
): Promise<StageDB> => {
  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectName });
  return apiClient.createStage(payload);
};

/**
 * Retrieves a specific stage by its ID or name within a project.
 * 
 * @param projectName The name of the project.
 * @param id The ID of the stage (optional if name is provided).
 * @param name The name of the stage (optional if id is provided).
 * @returns The requested stage.
 */
export const getStage = async ({
  projectName,
  id,
  name,
}: {
  projectName: string;
  id?: string;
  name?: string;
}): Promise<StageDB> => {
  if (!id && !name) {
    throw new Error('Either id or name must be provided to getStage');
  }
  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectName });

  if (id) {
    return apiClient.getStage(id);
  }
  return apiClient.getStageByName(name!);
};

/**
 * Updates an existing stage's rulesets.
 * 
 * @param projectName The name of the project.
 * @param stageId The ID of the stage to update (optional if stageName is provided).
 * @param stageName The name of the stage to update (optional if stageId is provided).
 * @param payload The new ruleset data for the stage.
 * @returns The updated stage.
 */
export const updateStage = async ({
  projectName,
  stageId,
  stageName,
  payload,
}: {
  projectName: string;
  stageId?: string;
  stageName?: string;
  payload: UpdateStagePayload;
}): Promise<StageDB> => {
  if (!stageId && !stageName) {
    throw new Error('Either stageId or stageName must be provided to updateStage');
  }
  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectName });

  let actualStageId = stageId;
  if (!actualStageId && stageName) {
    const stage = await apiClient.getStageByName(stageName);
    actualStageId = stage.id;
  }
  return apiClient.updateStage(actualStageId!, payload);
};

/**
 * Pauses a stage.
 * 
 * @param projectName The name of the project.
 * @param stageId The ID of the stage to pause (optional if stageName is provided).
 * @param stageName The name of the stage to pause (optional if stageId is provided).
 * @returns The updated stage (now paused).
 */
export const pauseStage = async ({
  projectName,
  stageId,
  stageName,
}: {
  projectName: string;
  stageId?: string;
  stageName?: string;
}): Promise<StageDB> => {
  if (!stageId && !stageName) {
    throw new Error('Either stageId or stageName must be provided to pauseStage');
  }
  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectName });

  let actualStageId = stageId;
  if (!actualStageId && stageName) {
    const stage = await apiClient.getStageByName(stageName);
    actualStageId = stage.id;
  }
  return apiClient.pauseStage(actualStageId!);
};

/**
 * Resumes a paused stage.
 * 
 * @param projectName The name of the project.
 * @param stageId The ID of the stage to resume (optional if stageName is provided).
 * @param stageName The name of the stage to resume (optional if stageId is provided).
 * @returns The updated stage (now active).
 */
export const resumeStage = async ({
  projectName,
  stageId,
  stageName,
}: {
  projectName: string;
  stageId?: string;
  stageName?: string;
}): Promise<StageDB> => {
  if (!stageId && !stageName) {
    throw new Error('Either stageId or stageName must be provided to resumeStage');
  }
  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectName });

  let actualStageId = stageId;
  if (!actualStageId && stageName) {
    const stage = await apiClient.getStageByName(stageName);
    actualStageId = stage.id;
  }
  return apiClient.resumeStage(actualStageId!);
};