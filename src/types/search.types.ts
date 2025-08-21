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
