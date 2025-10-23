import { GalileoApiClient } from '../api-client';
import {
  RunScorerSettingsResponse,
  ScorerConfig,
  SegmentFilter
} from '../types';

/**
 * Updates the scorer settings for a specific run.
 * @param projectName The name of the project.
 * @param runId The ID of the run.
 * @param scorers An array of scorer configurations to apply to the run.
 * @param segmentFilters An optional array of segment filters to apply to the run.
 * @returns A promise that resolves to the updated scorer settings, or null if the update fails.
 */
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
