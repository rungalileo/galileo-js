import { components } from './api.types';

export type LogRecordsExportRequest =
  components['schemas']['LogRecordsExportRequest'];

export type LogRecordsSortClause =
  components['schemas']['LogRecordsSortClause'];

export type LogRecordsTextFilter =
  components['schemas']['LogRecordsTextFilter'];

export const LogRecordsTextFilter: {
  [key: string]: LogRecordsTextFilter['operator'];
} = {
  EQ: 'eq',
  NE: 'ne',
  CONTAINS: 'contains',
  ONE_OF: 'one_of',
  NOT_IN: 'not_in'
};

export type RootType = components['schemas']['RootType'];
export const RootType = {
  TRACE: 'trace' as RootType,
  SPAN: 'span' as RootType,
  SESSION: 'session' as RootType
};

export type LLMExportFormat = components['schemas']['LLMExportFormat'];
export const LLMExportFormat = {
  JSONL: 'jsonl' as LLMExportFormat,
  CSV: 'csv' as LLMExportFormat
};
