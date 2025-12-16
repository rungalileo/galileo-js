import { BaseClient, RequestMethod } from '../base-client';
import { Routes } from '../../types/routes.types';
import { ScorerConfig } from '../../types/scorer.types';
import { SegmentFilter } from '../../types/openapi.types';
import {
  RunScorerSettingsResponse,
  RunScorerSettingsPatchRequestOpenAPI,
  RunScorerSettingsResponseOpenAPI
} from '../../types/runs.types';

/**
 * Internal RunsService for run-scoped scorer settings functionality.
 * Not exposed publicly - use Runs class from entities/runs.ts instead.
 */
export class RunsService extends BaseClient {
  private projectId: string;

  constructor(apiUrl: string, token: string, projectId: string) {
    super();
    this.apiUrl = apiUrl;
    this.token = token;
    this.projectId = projectId;
    this.initializeClient();
  }

  /**
   * Updates scorer settings for a specific run using PATCH upsert semantics.
   * @param options - The run scorer settings options.
   * @param options.projectId - The unique identifier of the project.
   * @param options.runId - The unique identifier of the run.
   * @param options.scorers - The list of scorer configurations to apply.
   * @param options.segmentFilters - (Optional) The list of segment filters to apply.
   * @returns A promise that resolves to the updated scorer settings response.
   */
  public async updateScorerSettings(options: {
    projectId: string;
    runId: string;
    scorers: ScorerConfig[];
    segmentFilters?: SegmentFilter[] | null;
  }): Promise<RunScorerSettingsResponse> {
    const scorers: ScorerConfig[] | null = this.convertToSnakeCase(
      options.scorers
    );
    const segmentFilters: SegmentFilter[] | null = options.segmentFilters
      ? this.convertToSnakeCase(options.segmentFilters)
      : null;

    const body: RunScorerSettingsPatchRequestOpenAPI = {
      run_id: options.runId,
      scorers,
      segment_filters: segmentFilters
    };

    const response = await this.makeRequest<RunScorerSettingsResponseOpenAPI>(
      RequestMethod.PATCH,
      Routes.runScorerSettings,
      body,
      {
        project_id: options.projectId,
        run_id: options.runId
      }
    );

    return this.convertToCamelCase<
      RunScorerSettingsResponseOpenAPI,
      RunScorerSettingsResponse
    >(response);
  }
}
