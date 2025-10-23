import { GalileoApiClient } from '../api-client';
import {
  MetricSearchRequest,
  MetricSearchResponse,
  LogRecordsQueryRequest,
  LogRecordsQueryResponse
} from '../types/search.types';

/**
 * Searches for metrics in a project.
 * @param request The search query parameters.
 * @param projectName The name of the project to search in.
 * @returns A promise that resolves to the search results.
 */
export const getMetrics = async (
  request: MetricSearchRequest,
  projectName: string
): Promise<MetricSearchResponse> => {
  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectName });
  return await apiClient.searchMetrics(request);
};

/**
 * Searches for traces in a project.
 * @param request The search query parameters.
 * @param projectName The name of the project to search in.
 * @returns A promise that resolves to the search results.
 */
export const getTraces = async (
  request: LogRecordsQueryRequest,
  projectName: string
): Promise<LogRecordsQueryResponse> => {
  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectName });
  return await apiClient.searchTraces(request);
};

/**
 * Searches for spans in a project.
 * @param request The search query parameters.
 * @param projectName The name of the project to search in.
 * @returns A promise that resolves to the search results.
 */
export const getSpans = async (
  request: LogRecordsQueryRequest,
  projectName: string
): Promise<LogRecordsQueryResponse> => {
  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectName });
  return await apiClient.searchSpans(request);
};

/**
 * Searches for sessions in a project.
 * @param request The search query parameters.
 * @param projectName The name of the project to search in.
 * @returns A promise that resolves to the search results.
 */
export const getSessions = async (
  request: LogRecordsQueryRequest,
  projectName: string
): Promise<LogRecordsQueryResponse> => {
  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectName });
  return await apiClient.searchSessions(request);
};
