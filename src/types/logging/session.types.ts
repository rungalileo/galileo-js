import type { components } from '../api.types';
import type { ObjectToCamel } from 'ts-case-convert';

// OpenAPI types from api.types.ts (source of truth)
export type SessionCreateRequestOpenAPI =
  components['schemas']['SessionCreateRequest'];

export type SessionCreateResponseOpenAPI =
  components['schemas']['SessionCreateResponse'];

export type LogRecordsQueryResponseOpenAPI =
  components['schemas']['LogRecordsQueryResponse'];

export type LogRecordsQueryRequestOpenAPI =
  components['schemas']['LogRecordsQueryRequest'];

// SDK-facing types (camelCase converted versions)
export type LogRecordsQueryRequest =
  ObjectToCamel<LogRecordsQueryRequestOpenAPI>;
export type LogRecordsQueryResponse =
  ObjectToCamel<LogRecordsQueryResponseOpenAPI>;
export type SessionCreateRequest = ObjectToCamel<SessionCreateRequestOpenAPI>;
export type SessionCreateResponse = ObjectToCamel<SessionCreateResponseOpenAPI>;
