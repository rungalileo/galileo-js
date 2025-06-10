import { Response } from '../types/protect.types';
import { GalileoApiClient } from '../api-client';

/*
 * Invoke Protect
 */
export const invoke = async (): Promise<Response> => {
  const apiClient = new GalileoApiClient();
  await apiClient.init();
  return await apiClient.invoke();
};
