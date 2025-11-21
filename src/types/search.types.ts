import type { components } from './api.types';
import type { ObjectToCamel } from 'ts-case-convert';

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
