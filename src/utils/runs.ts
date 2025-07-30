import { GalileoApiClient } from '../api-client';
import {
  RunScorerSettingsResponse,
  ScorerConfig,
  SegmentFilter
} from '../types';

export const updateScorerSettings = async (
  projectName: string,
  runId: string,
  scorers: ScorerConfig[],
  segmentFilters?: SegmentFilter[]
): Promise<RunScorerSettingsResponse | null> => {
  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectName, runId });

  try {
    return await apiClient.updateRunScorerSettings(
      runId,
      scorers,
      segmentFilters
    );
  } catch (e) {
    console.error(`Failed to update scorer settings for run ${runId}`, e);
    return null;
  }
};
