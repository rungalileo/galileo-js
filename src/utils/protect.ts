import {
  ProtectInvokeOptions,
  Response,
  BackendRequest, // Using BackendRequest for the original Request type from API schema
} from '../types/protect.types';
import { GalileoApiClient } from '../api-client';

/*
 * Invoke Protect
 */
export const invoke = async (options: ProtectInvokeOptions): Promise<Response> => {
  const {
    // Contextual:
    projectName, // Mandatory
    stageName,
    stageId,
    stageVersion,
    // Operational:
    payload, // Mandatory from ProtectInvokeOptions (and BackendRequest)
    prioritized_rulesets,
    timeout,
    metadata,
    headers,
  } = options;

  const apiClient = new GalileoApiClient();
  // projectName is now mandatory for init from ProtectInvokeOptions
  await apiClient.init({ projectName });

  // Construct the actual Request object expected by apiClient.invoke and the backend
  const backendApiRequest: BackendRequest = {
    payload,
    prioritized_rulesets,
    timeout,
    metadata,
    headers,
    project_name: projectName, // Pass the mandatory projectName
    // project_id is not explicitly set here; backend will use project_name or what's in payload if any
    stage_name: stageName,
    stage_id: stageId,
    stage_version: stageVersion,
  };
  
  return await apiClient.invoke(backendApiRequest);
};
