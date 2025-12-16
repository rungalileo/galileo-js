import { GalileoApiClient } from '../api-client';
import { ScorerConfig } from '../types/scorer.types';
import { SegmentFilter } from '../types/openapi.types';
import { RunScorerSettingsResponse } from '../types/new-api.types';

/**
 * Service class for run-scoped operations.
 * Provides methods to manage scorer settings for runs (experiments or log streams).
 */
export class Runs {
  private client: GalileoApiClient | null = null;

  private async ensureClient(): Promise<GalileoApiClient> {
    if (!this.client) {
      this.client = new GalileoApiClient();
      await this.client.init();
    }
    return this.client;
  }

  /**
   * Updates scorer settings for a specific run.
   * @param options - The run scorer settings options.
   * @param options.projectId - The unique identifier of the project.
   * @param options.runId - The unique identifier of the run (can be an experiment ID or log stream ID).
   * @param options.scorers - A list of scorer configurations to apply to the run.
   * @param options.segmentFilters - (Optional) A list of segment filters to apply to the run.
   * @returns A promise that resolves to the updated scorer settings response.
   */
  async updateScorerSettings(options: {
    projectId: string;
    runId: string;
    scorers: ScorerConfig[];
    segmentFilters?: SegmentFilter[] | null;
  }): Promise<RunScorerSettingsResponse> {
    const client = await this.ensureClient();
    return await client.updateRunScorerSettings(options);
  }
}
