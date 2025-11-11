import { components } from './api.types';

export type MetricSearchRequest =
  components['schemas']['LogRecordsMetricsQueryRequest'];
export type MetricSearchResponse =
  components['schemas']['LogRecordsMetricsResponse'];
export type MetricFilter =
  | components['schemas']['LogRecordsIDFilter']
  | components['schemas']['LogRecordsDateFilter']
  | components['schemas']['LogRecordsNumberFilter']
  | components['schemas']['LogRecordsBooleanFilter']
  | components['schemas']['LogRecordsTextFilter'];
export type LogRecordsQueryRequest =
  components['schemas']['LogRecordsQueryRequest'];
export type LogRecordsQueryResponse =
  components['schemas']['LogRecordsQueryResponse'];

export type LogRecordsQueryFilter =
  | components['schemas']['LogRecordsIDFilter']
  | components['schemas']['LogRecordsDateFilter']
  | components['schemas']['LogRecordsNumberFilter']
  | components['schemas']['LogRecordsBooleanFilter']
  | components['schemas']['LogRecordsTextFilter'];
export type LogRecordsSortClause =
  components['schemas']['LogRecordsSortClause'];

// TypeScript-friendly versions with camelCase properties (TS suffix)
export interface LogRecordsIDFilterTS {
  columnId: string;
  operator?: 'eq' | 'ne' | 'one_of' | 'not_in' | 'contains';
  value: string | string[];
  type: 'id';
}

export interface LogRecordsTextFilterTS {
  columnId: string;
  operator: 'eq' | 'ne' | 'contains' | 'one_of' | 'not_in';
  value: string | string[];
  caseSensitive?: boolean;
  type: 'text';
}

export interface LogRecordsNumberFilterTS {
  columnId: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'between';
  value: number | number[];
  type: 'number';
}

export interface LogRecordsDateFilterTS {
  columnId: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte';
  value: string;
  type: 'date';
}

export interface LogRecordsBooleanFilterTS {
  columnId: string;
  value: boolean;
  type: 'boolean';
}

export type LogRecordsQueryFilterTS =
  | LogRecordsIDFilterTS
  | LogRecordsTextFilterTS
  | LogRecordsNumberFilterTS
  | LogRecordsDateFilterTS
  | LogRecordsBooleanFilterTS;

export type MetricFilterTS = LogRecordsQueryFilterTS;

export interface LogRecordsSortClauseTS {
  columnId: string;
  ascending?: boolean;
  sortType?: 'column';
}
