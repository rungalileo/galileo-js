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

export interface DatasetAppendRow {
  [key: string]: string | number | null;
}

export type DatasetRow = components['schemas']['DatasetRow'];
