import { BaseClient, RequestMethod } from '../base-client';
import { Routes } from '../../types/routes.types';
import { ScorerConfig, SegmentFilter } from '../../types';
import { RunScorerSettingsResponse } from '../../types/run.types';

export class RunService extends BaseClient {
  private projectId: string;

  constructor(apiUrl: string, token: string, projectId: string) {
    super();
    this.apiUrl = apiUrl;
    this.token = token;
    this.projectId = projectId;
    this.initializeClient();
  }

  public updateScorerSettings = async (
    runId: string,
    scorers: ScorerConfig[],
    segmentFilters?: SegmentFilter[]
  ): Promise<RunScorerSettingsResponse> => {
    return await this.makeRequest<RunScorerSettingsResponse>(
      RequestMethod.PATCH,
      Routes.updateRunScorerSettings,
      { run_id: runId, scorers, segment_filters: segmentFilters },
      {
        project_id: this.projectId,
        run_id: runId
      }
    );
  };
}
