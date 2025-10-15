import type { components } from './api.types';

export type Experiment = components['schemas']['ExperimentResponse'];
type PromptRunSettingsInput = components['schemas']['PromptRunSettings'];

export interface PromptRunSettings extends PromptRunSettingsInput {}

export type CreateJobResponse = components['schemas']['CreateJobResponse'];

export type ExperimentDatasetRequest =
  components['schemas']['ExperimentDatasetRequest'];
