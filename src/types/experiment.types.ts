import type { components } from './api.types';

export interface Experiment {
  id: string;
  name: string;
  created_at: Date;
  updated_at: Date;
  project_id: string;
  created_by: string | null;
}
type PromptRunSettingsInput = components['schemas']['PromptRunSettings'];

export interface PromptRunSettings extends PromptRunSettingsInput {}

export type CreateJobResponse = components['schemas']['CreateJobResponse'];

export type ExperimentDatasetRequest =
  components['schemas']['ExperimentDatasetRequest'];
