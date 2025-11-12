import type { components } from './api.types';
import type { ObjectToCamel } from 'ts-case-convert';

export type LogRecordsMetricsQueryRequestOpenAPI =
  components['schemas']['LogRecordsMetricsQueryRequest'];
export type LogRecordsMetricsResponseOpenAPI =
  components['schemas']['LogRecordsMetricsResponse'];
export type LogRecordsQueryRequestOpenAPI =
  components['schemas']['LogRecordsQueryRequest'];
export type LogRecordsQueryResponseOpenAPI =
  components['schemas']['LogRecordsQueryResponse'];
export type LogRecordsQueryFilterOpenAPI =
  | components['schemas']['LogRecordsIDFilter']
  | components['schemas']['LogRecordsDateFilter']
  | components['schemas']['LogRecordsNumberFilter']
  | components['schemas']['LogRecordsBooleanFilter']
  | components['schemas']['LogRecordsTextFilter'];
export type LogRecordsSortClauseOpenAPI =
  components['schemas']['LogRecordsSortClause'];

// TypeScript-friendly versions with camelCase properties
export type LogRecordsQueryFilter = ObjectToCamel<LogRecordsQueryFilterOpenAPI>;
export type LogRecordsSortClause = ObjectToCamel<LogRecordsSortClauseOpenAPI>;
export type LogRecordsQueryRequest =
  ObjectToCamel<LogRecordsQueryRequestOpenAPI>;
export type LogRecordsMetricsQueryRequest =
  ObjectToCamel<LogRecordsMetricsQueryRequestOpenAPI>;
export type LogRecordsQueryResponse =
  ObjectToCamel<LogRecordsQueryResponseOpenAPI>;
export type LogRecordsMetricsResponse =
  ObjectToCamel<LogRecordsMetricsResponseOpenAPI>;
