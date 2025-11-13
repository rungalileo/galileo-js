import { components } from './api.types';
import { ObjectToCamel } from 'ts-case-convert';

export type LogRecordsExportRequestOpenAPI =
  components['schemas']['LogRecordsExportRequest'];

export type LogRecordsFilterOpenAPI =
  | components['schemas']['LogRecordsIDFilter']
  | components['schemas']['LogRecordsDateFilter']
  | components['schemas']['LogRecordsNumberFilter']
  | components['schemas']['LogRecordsBooleanFilter']
  | components['schemas']['LogRecordsTextFilter'];

export type LogRecordsFilter = ObjectToCamel<LogRecordsFilterOpenAPI>;
export type LogRecordsExportRequest = Omit<
  ObjectToCamel<LogRecordsExportRequestOpenAPI>,
  'filters' | 'exportFormat'
> & {
  filters?: LogRecordsFilter[];
  exportFormat?: 'csv' | 'jsonl' | 'json';
};
