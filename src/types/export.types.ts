import { components } from './api.types';

export type LogRecordsExportRequest =
  components['schemas']['LogRecordsExportRequest'];

export type LogRecordsSortClause =
  components['schemas']['LogRecordsSortClause'];

export type LogRecordsTextFilter =
  components['schemas']['LogRecordsTextFilter'];

export type LogRecordsNumberFilter =
  components['schemas']['LogRecordsNumberFilter'];

export type LogRecordsDateFilter =
  components['schemas']['LogRecordsDateFilter'];

export type LogRecordsBooleanFilter =
  components['schemas']['LogRecordsBooleanFilter'];

export type LogRecordsIDFilter = components['schemas']['LogRecordsIDFilter'];

export type RootType = components['schemas']['RootType'];
export const RootType = {
  trace: 'trace',
  span: 'span',
  session: 'session'
} as const satisfies Record<RootType, RootType>;

export type LLMExportFormat = components['schemas']['LLMExportFormat'];
export const LLMExportFormat = {
  jsonl: 'jsonl',
  csv: 'csv'
} as const satisfies Record<LLMExportFormat, LLMExportFormat>;

export interface TSSortClause {
  columnId: string;
  ascending?: boolean;
  sortType?: 'column';
}

export interface TSTextFilter {
  columnId: string;
  operator: 'eq' | 'ne' | 'contains' | 'one_of' | 'not_in';
  value: string | string[];
  caseSensitive?: boolean;
}

export interface TSNumberFilter {
  columnId: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'between';
  value: number | number[];
}

export interface TSDateFilter {
  columnId: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte';
  value: string; // ISO date-time string
}

export interface TSBooleanFilter {
  columnId: string;
  value: boolean;
}

export interface TSIDFilter {
  columnId: string;
  operator?: 'eq' | 'ne' | 'contains' | 'not_in' | 'one_of';
  value: string | string[];
}

export type TSRootType = 'trace' | 'span' | 'session';
export const TSRootType = {
  trace: 'trace',
  span: 'span',
  session: 'session'
} as const satisfies Record<TSRootType, TSRootType>;

export type TSFormat = 'jsonl' | 'csv';
export const TSFormat = {
  jsonl: 'jsonl',
  csv: 'csv'
} as const satisfies Record<TSFormat, TSFormat>;

export type TSFilter =
  | TSTextFilter
  | TSNumberFilter
  | TSDateFilter
  | TSBooleanFilter
  | TSIDFilter;

export interface TSRecordsParams {
  projectId: string;
  rootType?: TSRootType;
  filters?: TSFilter[];
  sort?: TSSortClause;
  exportFormat?: TSFormat;
  logStreamId?: string;
  experimentId?: string;
  columnIds?: string[];
  redact?: boolean;
  metricsTestingId?: string;
}
