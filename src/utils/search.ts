import { GalileoApiClient } from '../api-client';
import {
  MetricSearchRequest,
  MetricSearchResponse
} from '../types/search.types';

export const getMetrics = async (
  request: MetricSearchRequest,
  projectName: string
): Promise<MetricSearchResponse> => {
  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectName });
  return await apiClient.searchMetrics(request);
};