export interface Dataset {
  id: string;
  name: string;
  column_names: string[] | null;
  project_count: number;
  created_at: string;
  updated_at: string;
  num_rows: number | null;
}
