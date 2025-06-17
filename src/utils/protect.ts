import {
  ProtectInvokeOptions,
  Response,
  Request,
} from '../types/protect.types';
import { GalileoApiClient } from '../api-client';

/*
 * Invoke Protect
 */
export const invoke = async (options: ProtectInvokeOptions): Promise<Response> => {
  const {
    projectName,
    stageName,
    stageId,
    stageVersion,
    payload,
    prioritized_rulesets,
    timeout,
    metadata,
    headers,
  } = options;

  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectName });

  const request: Request = {
    payload,
    prioritized_rulesets,
    timeout,
    metadata,
    headers,
    project_name: projectName,
    stage_name: stageName,
    stage_id: stageId,
    stage_version: stageVersion,
  };
  
  return await apiClient.invoke(request);
};
