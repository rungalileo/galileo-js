// src/utils/stage.ts
import { GalileoApiClient } from '../api-client';
import {
  StageCreationPayload,
  GetStageParams,
  UpdateStagePayload,
  StageDB,
} from '../types/stage.types';

/**
 * Creates a new stage for a project.
 * This is a utility function that instantiates GalileoApiClient internally.
 * @param projectId The ID of the project.
 * @param payload The data for the new stage.
 * @returns The created stage.
 */
export const createStage = async (
  projectId: string,
  payload: StageCreationPayload,
): Promise<StageDB> => {
  const apiClient = new GalileoApiClient();
  // Initialize the apiClient with the specific projectId for this operation
  await apiClient.init({ projectId: projectId });
  return apiClient.createStage(payload); // Now apiClient.createStage uses its internal projectId
};

/**
 * Retrieves a specific stage by its ID or name.
 * This is a utility function that instantiates GalileoApiClient internally.
 * @param projectId The ID of the project.
 * @param params Parameters to identify the stage (stageId or stageName).
 * @returns The requested stage.
 */
export const getStage = async (
  projectId: string,
  params: GetStageParams,
): Promise<StageDB> => {
  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectId: projectId });
  return apiClient.getStage(params);
};

/**
 * Updates an existing stage's rulesets.
 * This is a utility function that instantiates GalileoApiClient internally.
 * @param projectId The ID of the project.
 * @param stageId The ID of the stage to update.
 * @param payload The new ruleset data for the stage.
 * @returns The updated stage.
 */
export const updateStage = async (
  projectId: string,
  stageId: string,
  payload: UpdateStagePayload,
): Promise<StageDB> => {
  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectId: projectId });
  return apiClient.updateStage(stageId, payload);
};

/**
 * Pauses a stage.
 * This is a utility function that instantiates GalileoApiClient internally.
 * @param projectId The ID of the project.
 * @param stageId The ID of the stage to pause.
 * @returns The updated stage (now paused).
 */
export const pauseStage = async (
  projectId: string,
  stageId: string,
): Promise<StageDB> => {
  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectId: projectId });
  return apiClient.pauseStage(stageId);
};

/**
 * Resumes a paused stage.
 * This is a utility function that instantiates GalileoApiClient internally.
 * @param projectId The ID of the project.
 * @param stageId The ID of the stage to resume.
 * @returns The updated stage (now active).
 */
export const resumeStage = async (
  projectId: string,
  stageId: string,
): Promise<StageDB> => {
  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectId: projectId });
  return apiClient.resumeStage(stageId);
};