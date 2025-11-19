import type { components } from './api.types';
import type { ObjectToCamel } from 'ts-case-convert';

export type LogRecordsQueryRequestOpenAPI =
  components['schemas']['LogRecordsQueryRequest'];
export type LogRecordsQueryResponseOpenAPI =
  components['schemas']['LogRecordsQueryResponse'];

// TypeScript-friendly versions with camelCase properties
export type LogRecordsQueryRequest =
  ObjectToCamel<LogRecordsQueryRequestOpenAPI>;
export type LogRecordsQueryResponse =
  ObjectToCamel<LogRecordsQueryResponseOpenAPI>;
