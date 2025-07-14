import { User } from './user.types';
import { components } from './api.types';

export interface Dataset {
  id: string;
  name: string;
  column_names: string[] | null;
  project_count: number;
  created_at: string;
  updated_at: string;
  num_rows: number | null;
  created_by_user: User | null;
  current_version_index: number;
  draft: boolean;
}

export type DatasetRow = components['schemas']['DatasetRow'];

export interface DatasetRecord {
  id?: string;
  input: string;
  output?: string;
  metadata?: Record<string, string>;
}

export interface DatasetRecordOptions {
  id?: string;
  input: unknown;
  output?: unknown;
  metadata?: unknown;
}
