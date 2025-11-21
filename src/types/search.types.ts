import type {
  LogRecordsMetricsQueryRequest as LogRecordsMetricsQueryRequestOpenAPI,
  LogRecordsMetricsResponse as LogRecordsMetricsResponseOpenAPI,
  LogRecordsQueryRequest as LogRecordsQueryRequestOpenAPI,
  LogRecordsQueryResponse as LogRecordsQueryResponseOpenAPI,
  LogRecordsSortClause as LogRecordsSortClauseOpenAPI,
  LogRecordsIdFilter as LogRecordsIdFilterOpenAPI,
  LogRecordsDateFilter as LogRecordsDateFilterOpenAPI,
  LogRecordsNumberFilter as LogRecordsNumberFilterOpenAPI,
  LogRecordsBooleanFilter as LogRecordsBooleanFilterOpenAPI,
  LogRecordsTextFilter as LogRecordsTextFilterOpenAPI
} from './openapi.types';

import type {
  LogRecordsMetricsQueryRequest,
  LogRecordsMetricsResponse,
  LogRecordsQueryRequest,
  LogRecordsQueryResponse,
  LogRecordsSortClause,
  LogRecordsIdFilter,
  LogRecordsDateFilter,
  LogRecordsNumberFilter,
  LogRecordsBooleanFilter,
  LogRecordsTextFilter
} from './new-api.types';

export type LogRecordsQueryFilterOpenAPI =
  | LogRecordsIdFilterOpenAPI
  | LogRecordsDateFilterOpenAPI
  | LogRecordsNumberFilterOpenAPI
  | LogRecordsBooleanFilterOpenAPI
  | LogRecordsTextFilterOpenAPI;

export type LogRecordsQueryFilter =
  | LogRecordsIdFilter
  | LogRecordsDateFilter
  | LogRecordsNumberFilter
  | LogRecordsBooleanFilter
  | LogRecordsTextFilter;

export type {
  LogRecordsMetricsQueryRequest,
  LogRecordsMetricsResponse,
  LogRecordsQueryRequest,
  LogRecordsQueryResponse,
  LogRecordsSortClause,
  LogRecordsMetricsQueryRequestOpenAPI,
  LogRecordsMetricsResponseOpenAPI,
  LogRecordsQueryRequestOpenAPI,
  LogRecordsQueryResponseOpenAPI,
  LogRecordsSortClauseOpenAPI
};
