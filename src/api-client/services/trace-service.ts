import { BaseClient, RequestMethod } from '../base-client';
import { Routes } from '../../types/routes.types';
import { Trace } from '../../types/log.types';

export class TraceService extends BaseClient {
  private projectId: string;
  private logStreamId: string | undefined;
  private experimentId: string | undefined;

  constructor(
    apiUrl: string,
    token: string,
    projectId: string,
    logStreamId?: string,
    experimentId?: string
  ) {
    super();
    this.apiUrl = apiUrl;
    this.token = token;
    this.projectId = projectId;
    this.logStreamId = logStreamId;
    this.experimentId = experimentId;
    this.initializeClient();
  }

  public async ingestTraces(traces: Trace[]): Promise<void> {
    if (!this.projectId) {
      throw new Error('Project not initialized');
    }

    if (!this.logStreamId && !this.experimentId) {
      throw new Error('Log stream or experiment not initialized');
    }

    await this.makeRequest<void>(
      RequestMethod.POST,
      Routes.traces,
      {
        traces,
        ...(this.experimentId && {
          experiment_id: this.experimentId
        }),
        ...(!this.experimentId && {
          log_stream_id: this.logStreamId
        })
      },
      { project_id: this.projectId }
    );
    // eslint-disable-next-line no-console
    console.log(
      `🚀 ${traces.length} Traces ingested for project ${this.projectId}.`
    );
  }
}
