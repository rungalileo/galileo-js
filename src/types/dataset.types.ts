import type { components } from './api.types';

export type Dataset = components['schemas']['DatasetDB'];

export type DatasetRow = components['schemas']['DatasetRow'];

export interface DatasetRecord {
  id?: string;
  input?: string;
  output?: string;
  metadata?: Record<string, string>;
}

export interface DatasetRecordOptions {
  id?: string;
  input: unknown;
  output?: unknown;
  metadata?: unknown;
}
