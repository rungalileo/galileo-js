import { GalileoApiClient } from '../api-client';
import {
  MetricSearchRequest,
  MetricSearchResponse,
  LogRecordsQueryRequest,
  LogRecordsQueryResponse
} from '../types/search.types';

export const getMetrics = async (
  request: MetricSearchRequest,
  projectName: string
): Promise<MetricSearchResponse> => {
  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectName });
  return await apiClient.searchMetrics(request);
};

export const getTraces = async (
  request: LogRecordsQueryRequest,
  projectName: string
): Promise<LogRecordsQueryResponse> => {
  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectName });
  return await apiClient.searchTraces(request);
};

export const getSpans = async (
  request: LogRecordsQueryRequest,
  projectName: string
): Promise<LogRecordsQueryResponse> => {
  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectName });
  return await apiClient.searchSpans(request);
};

export const getSessions = async (
  request: LogRecordsQueryRequest,
  projectName: string
): Promise<LogRecordsQueryResponse> => {
  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectName });
  return await apiClient.searchSessions(request);
};
