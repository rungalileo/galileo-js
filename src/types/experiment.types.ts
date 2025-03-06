export interface Experiment {
  id: string;
  name: string;
  created_at: Date;
  updated_at: Date;
  project_id: string;
  created_by: string | null;
}
