import { paths, components } from './api.types';

export type RunScorerSettingsPatchRequest =
  paths['/projects/{project_id}/runs/{run_id}/scorer-settings']['patch']['requestBody']['content']['application/json'];
export type RunScorerSettingsResponse =
  paths['/projects/{project_id}/runs/{run_id}/scorer-settings']['patch']['responses']['200']['content']['application/json'];
export type SegmentFilter = components['schemas']['SegmentFilter'];
