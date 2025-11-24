import { GalileoApiClient } from '../api-client';
import {
  LogRecordsQueryRequest,
  LogRecordsQueryResponse
} from '../types/shared.types';

/**
 * Record type enumeration for search operations.
 */
export enum RecordType {
  SPAN = 'spans',
  TRACE = 'traces',
  SESSION = 'sessions'
}

/**
 * Search class for querying records (spans, traces, sessions).
 */
export class Search {
  /**
   * Queries records (spans, traces, or sessions) in a project.
   * @param projectId - The ID of the project to search in.
   * @param recordType - The type of record to query.
   * @param options - The query options.
   * @param options.limit - (Optional) The maximum number of records to return.
   * @param options.startingToken - (Optional) The starting token for pagination.
   * @param options.filters - (Optional) Filters to apply to the query.
   * @param options.sort - (Optional) Sort clause for ordering results.
   * @param options.experimentId - (Optional) The experiment ID to filter by.
   * @param options.logStreamId - (Optional) The log stream ID to filter by.
   * @returns A promise that resolves to the query results.
   */
  public async query(
    projectId: string,
    recordType: RecordType,
    options: LogRecordsQueryRequest
  ): Promise<LogRecordsQueryResponse> {
    const apiClient = new GalileoApiClient();
    await apiClient.init({ projectId, projectScoped: true });

    switch (recordType) {
      case RecordType.SPAN:
        return await apiClient.searchSpans(options);
      case RecordType.TRACE:
        return await apiClient.searchTraces(options);
      case RecordType.SESSION:
        return await apiClient.searchSessions(options);
    }
  }
}

/**
 * Searches for traces in a project.
 * @param options - The search query parameters.
 * @param options.projectId - The ID of the project to search in.
 * @param options.logStreamId - (Optional) The log stream ID to filter by.
 * @param options.experimentId - (Optional) The experiment ID to filter by.
 * @param options.filters - (Optional) Filters to apply to the query.
 * @param options.sort - (Optional) Sort clause for ordering results.
 * @param options.limit - (Optional) The maximum number of records to return.
 * @param options.startingToken - (Optional) The starting token for pagination.
 * @returns A promise that resolves to the search results.
 */
export const getTraces = async (
  options: LogRecordsQueryRequest & { projectId: string }
): Promise<LogRecordsQueryResponse> => {
  const search = new Search();
  return await search.query(options.projectId, RecordType.TRACE, options);
};

/**
 * Searches for spans in a project.
 * @param options - The search query parameters.
 * @param options.projectId - The ID of the project to search in.
 * @param options.logStreamId - (Optional) The log stream ID to filter by.
 * @param options.experimentId - (Optional) The experiment ID to filter by.
 * @param options.filters - (Optional) Filters to apply to the query.
 * @param options.sort - (Optional) Sort clause for ordering results.
 * @param options.limit - (Optional) The maximum number of records to return.
 * @param options.startingToken - (Optional) The starting token for pagination.
 * @returns A promise that resolves to the search results.
 */
export const getSpans = async (
  options: LogRecordsQueryRequest & { projectId: string }
): Promise<LogRecordsQueryResponse> => {
  const search = new Search();
  return await search.query(options.projectId, RecordType.SPAN, options);
};

/**
 * Searches for sessions in a project.
 * @param options - The search query parameters.
 * @param options.projectId - The ID of the project to search in.
 * @param options.logStreamId - (Optional) The log stream ID to filter by.
 * @param options.experimentId - (Optional) The experiment ID to filter by.
 * @param options.filters - (Optional) Filters to apply to the query.
 * @param options.sort - (Optional) Sort clause for ordering results.
 * @param options.limit - (Optional) The maximum number of records to return.
 * @param options.startingToken - (Optional) The starting token for pagination.
 * @returns A promise that resolves to the search results.
 */
export const getSessions = async (
  options: LogRecordsQueryRequest & { projectId: string }
): Promise<LogRecordsQueryResponse> => {
  const search = new Search();
  return await search.query(options.projectId, RecordType.SESSION, options);
};
