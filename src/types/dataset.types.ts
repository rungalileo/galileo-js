import { PaginatedResponse } from './api.types';

export interface Dataset {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  project_count: number;
  num_rows: number | null;
  column_names: string[] | null;
}

export interface DatasetResponse extends PaginatedResponse {
  datasets: Dataset[];
}

type DatsetValue = string | number | boolean | null;

export interface DatasetRow {
  index: number;
  values: DatsetValue[];
}

export interface DatasetContentResponse extends PaginatedResponse {
  rows: DatasetRow[];
}
