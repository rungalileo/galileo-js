import { GalileoApiClient } from '../api-client';
import {
  LogRecordsMetricsQueryRequest,
  LogRecordsMetricsResponse,
  LogRecordsQueryRequest,
  LogRecordsQueryResponse,
  LogRecordsQueryFilter,
  LogRecordsSortClause,
  LogRecordsSortClauseTS,
  LogRecordsQueryFilterTS
} from '../types/search.types';

/**
 * Record type enumeration for search operations.
 */
export enum RecordType {
  SPAN = 'spans',
  TRACE = 'traces',
  SESSION = 'sessions'
}

/**
 * Converts a TypeScript-friendly filter to OpenAPI format for API requests
 */
function convertFilterToOpenAPI(
  filter: LogRecordsQueryFilterTS
): LogRecordsQueryFilter {
  switch (filter.type) {
    case 'id':
      return {
        column_id: filter.columnId,
        operator: filter.operator,
        value: filter.value,
        type: 'id'
      };
    case 'text':
      return {
        column_id: filter.columnId,
        operator: filter.operator,
        value: filter.value,
        case_sensitive: filter.caseSensitive,
        type: 'text'
      };
    case 'number':
      return {
        column_id: filter.columnId,
        operator: filter.operator,
        value: filter.value,
        type: 'number'
      };
    case 'date':
      return {
        column_id: filter.columnId,
        operator: filter.operator,
        value: filter.value,
        type: 'date'
      };
    case 'boolean':
      return {
        column_id: filter.columnId,
        value: filter.value,
        type: 'boolean'
      };
  }
}

/**
 * Converts an array of TypeScript-friendly filters to OpenAPI format
 */
function convertFiltersToOpenAPI(
  filters?: LogRecordsQueryFilterTS[]
): LogRecordsQueryFilter[] | undefined {
  if (!filters || filters.length === 0) {
    return undefined;
  }
  return filters.map(convertFilterToOpenAPI);
}

/**
 * Converts a TypeScript-friendly sort clause to OpenAPI format for API requests
 * Defaults to created_at descending when no sort is provided
 */
function convertSortClauseToOpenAPI(
  sort?: LogRecordsSortClauseTS
): LogRecordsSortClause {
  if (!sort) {
    return {
      column_id: 'created_at',
      ascending: false,
      sort_type: 'column'
    };
  }
  return {
    column_id: sort.columnId,
    ascending: sort.ascending,
    sort_type: sort.sortType
  };
}

/**
 * Search class for querying records and metrics.
 */
export class Search {
  constructor() {}

  /**
   * Queries records (spans, traces, or sessions) in a project.
   * @param options - The query options.
   * @param options.projectId - The ID of the project to search in.
   * @param options.limit - (Optional) The maximum number of records to return.
   * @param options.startingToken - (Optional) The starting token for pagination.
   * @param options.filters - (Optional) Filters to apply to the query.
   * @param options.sort - (Optional) Sort clause for ordering results.
   * @param options.experimentId - (Optional) The experiment ID to filter by.
   * @param options.logStreamId - (Optional) The log stream ID to filter by.
   * @param recordType - The type of record to query.
   * @returns A promise that resolves to the query results.
   */
  public async query(
    options: {
      projectId: string;
      limit?: number;
      startingToken?: number;
      filters?: LogRecordsQueryFilterTS[];
      sort?: LogRecordsSortClauseTS;
      experimentId?: string;
      logStreamId?: string;
    },
    recordType: RecordType
  ): Promise<LogRecordsQueryResponse> {
    const apiClient = new GalileoApiClient();
    await apiClient.init({ projectId: options.projectId, projectScoped: true });

    const request: LogRecordsQueryRequest = {
      experiment_id: options.experimentId,
      log_stream_id: options.logStreamId,
      filters: convertFiltersToOpenAPI(options.filters),
      sort: convertSortClauseToOpenAPI(options.sort),
      limit: options.limit ?? 100,
      starting_token: options.startingToken ?? 0
    };

    switch (recordType) {
      case RecordType.SPAN:
        return await apiClient.searchSpans(request);
      case RecordType.TRACE:
        return await apiClient.searchTraces(request);
      case RecordType.SESSION:
        return await apiClient.searchSessions(request);
    }
  }

  /**
   * Queries metrics in a project.
   * @param options - The query options.
   * @param options.projectId - The ID of the project to search in.
   * @param options.startTime - The start time for the metrics query.
   * @param options.endTime - The end time for the metrics query.
   * @param options.logStreamId - (Optional) The log stream ID to filter by.
   * @param options.experimentId - (Optional) The experiment ID to filter by.
   * @param options.metricsTestingId - (Optional) The metrics testing ID to filter by.
   * @param options.interval - (Optional) The time interval for aggregating metrics.
   * @param options.groupBy - (Optional) The field to group metrics by.
   * @param options.filters - (Optional) Filters to apply to the query.
   * @returns A promise that resolves to the metrics search results.
   */
  public async queryMetrics(options: {
    projectId: string;
    startTime: string;
    endTime: string;
    logStreamId?: string;
    experimentId?: string;
    metricsTestingId?: string;
    interval?: number;
    groupBy?: string;
    filters?: LogRecordsQueryFilterTS[];
  }): Promise<LogRecordsMetricsResponse> {
    const apiClient = new GalileoApiClient();
    await apiClient.init({ projectId: options.projectId, projectScoped: true });

    const request: LogRecordsMetricsQueryRequest = {
      filters: convertFiltersToOpenAPI(options.filters),
      log_stream_id: options.logStreamId,
      experiment_id: options.experimentId,
      metrics_testing_id: options.metricsTestingId,
      interval: options.interval,
      group_by: options.groupBy,
      start_time: options.startTime,
      end_time: options.endTime
    };

    return await apiClient.searchMetrics(request);
  }
}

/**
 * Searches for metrics in a project.
 * @param options - The search query parameters.
 * @param options.projectId - The ID of the project to search in.
 * @param options.startTime - The start time for the metrics query.
 * @param options.endTime - The end time for the metrics query.
 * @param options.logStreamId - (Optional) The log stream ID to filter by.
 * @param options.experimentId - (Optional) The experiment ID to filter by.
 * @param options.metricsTestingId - (Optional) The metrics testing ID to filter by.
 * @param options.filters - (Optional) Filters to apply to the query.
 * @param options.interval - (Optional) The time interval for aggregating metrics.
 * @param options.groupBy - (Optional) The field to group metrics by.
 * @returns A promise that resolves to the search results.
 */
export const getMetrics = async (options: {
  projectId: string;
  startTime: string;
  endTime: string;
  logStreamId?: string;
  experimentId?: string;
  metricsTestingId?: string;
  filters?: LogRecordsQueryFilterTS[];
  interval?: number;
  groupBy?: string;
}): Promise<LogRecordsMetricsResponse> => {
  const search = new Search();
  return await search.queryMetrics(options);
};

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
export const getTraces = async (options: {
  projectId: string;
  logStreamId?: string;
  experimentId?: string;
  filters?: LogRecordsQueryFilterTS[];
  sort?: LogRecordsSortClauseTS;
  limit?: number;
  startingToken?: number;
}): Promise<LogRecordsQueryResponse> => {
  const search = new Search();
  return await search.query(options, RecordType.TRACE);
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
export const getSpans = async (options: {
  projectId: string;
  logStreamId?: string;
  experimentId?: string;
  filters?: LogRecordsQueryFilterTS[];
  sort?: LogRecordsSortClauseTS;
  limit?: number;
  startingToken?: number;
}): Promise<LogRecordsQueryResponse> => {
  const search = new Search();
  return await search.query(options, RecordType.SPAN);
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
export const getSessions = async (options: {
  projectId: string;
  logStreamId?: string;
  experimentId?: string;
  filters?: LogRecordsQueryFilterTS[];
  sort?: LogRecordsSortClauseTS;
  limit?: number;
  startingToken?: number;
}): Promise<LogRecordsQueryResponse> => {
  const search = new Search();
  return await search.query(options, RecordType.SESSION);
};
