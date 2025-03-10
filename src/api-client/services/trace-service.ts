import { BaseClient, RequestMethod } from '../base-client';
import { Routes } from '../../types/routes.types';
import { Trace } from '../../types/log.types';

export class TraceService extends BaseClient {
  private projectId: string;
  private logStreamId: string;

  constructor(
    apiUrl: string,
    token: string,
    projectId: string,
    logStreamId: string
  ) {
    super();
    this.apiUrl = apiUrl;
    this.token = token;
    this.projectId = projectId;
    this.logStreamId = logStreamId;
    this.initializeClient();
  }

  public async ingestTraces(traces: Trace[]): Promise<void> {
    if (!this.projectId || !this.logStreamId) {
      throw new Error('Project ID and Log Stream ID must be set');
    }

    await this.makeRequest<void>(
      RequestMethod.POST,
      Routes.traces,
      { traces, log_stream_id: this.logStreamId },
      { project_id: this.projectId }
    );

    // eslint-disable-next-line no-console
    console.log(
      `🚀 ${traces.length} Traces ingested for project ${this.projectId}.`
    );
  }
}
