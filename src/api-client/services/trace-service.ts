import { BaseClient, RequestMethod } from '../base-client';
import { Routes } from '../../types/routes.types';
import { Trace } from '../../types/logging/trace.types';
import { SessionCreateResponse } from '../../types/logging/session.types';

import {
  LogRecordsMetricsQueryRequest,
  LogRecordsMetricsResponse,
  LogRecordsQueryRequest,
  LogRecordsQueryResponse
} from '../../types/search.types';

export class TraceService extends BaseClient {
  private projectId: string;
  private logStreamId: string | undefined;
  private experimentId: string | undefined;
  private sessionId: string | undefined;

  constructor(
    apiUrl: string,
    token: string,
    projectId: string,
    logStreamId?: string,
    experimentId?: string,
    sessionId?: string
  ) {
    super();
    this.apiUrl = apiUrl;
    this.token = token;
    this.projectId = projectId;
    this.logStreamId = logStreamId;
    this.experimentId = experimentId;
    this.sessionId = sessionId;
    this.initializeClient();
  }

  public async createSession({
    name,
    previousSessionId,
    externalId
  }: {
    name?: string;
    previousSessionId?: string;
    externalId?: string;
  }): Promise<SessionCreateResponse> {
    return await this.makeRequest<SessionCreateResponse>(
      RequestMethod.POST,
      Routes.sessions,
      {
        log_stream_id: this.logStreamId,
        name,
        previous_session_id: previousSessionId,
        external_id: externalId
      },
      { project_id: this.projectId }
    );
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
        }),
        session_id: this.sessionId
      },
      { project_id: this.projectId }
    );
    // eslint-disable-next-line no-console
    console.log(
      `🚀 ${traces.length} Traces ingested for project ${this.projectId}.`
    );
  }

  public async searchSessions(
    request: LogRecordsQueryRequest
  ): Promise<LogRecordsQueryResponse> {
    if (!this.projectId) {
      throw new Error('Project not initialized');
    }
    this.fillRequestContext(request);

    return await this.makeRequest<LogRecordsQueryResponse>(
      RequestMethod.POST,
      Routes.sessionsSearch,
      request,
      { project_id: this.projectId }
    );
  }

  public async searchMetrics(
    request: LogRecordsMetricsQueryRequest
  ): Promise<LogRecordsMetricsResponse> {
    if (!this.projectId) {
      throw new Error('Project not initialized');
    }
    this.fillRequestContext(request);

    return await this.makeRequest<LogRecordsMetricsResponse>(
      RequestMethod.POST,
      Routes.metricsSearch,
      request,
      { project_id: this.projectId }
    );
  }

  public async searchTraces(
    request: LogRecordsQueryRequest
  ): Promise<LogRecordsQueryResponse> {
    if (!this.projectId) {
      throw new Error('Project not initialized');
    }
    this.fillRequestContext(request);

    return await this.makeRequest<LogRecordsQueryResponse>(
      RequestMethod.POST,
      Routes.tracesSearch,
      request,
      { project_id: this.projectId }
    );
  }

  public async searchSpans(
    request: LogRecordsQueryRequest
  ): Promise<LogRecordsQueryResponse> {
    if (!this.projectId) {
      throw new Error('Project not initialized');
    }
    this.fillRequestContext(request);

    return await this.makeRequest<LogRecordsQueryResponse>(
      RequestMethod.POST,
      Routes.spansSearch,
      request,
      { project_id: this.projectId }
    );
  }

  /**
   * Fills in missing experiment_id or log_stream_id from the service context
   * by mutating the request object in place.
   *
   * This method modifies the input request object directly to add the context
   * (experiment_id or log_stream_id) if it's missing. The mutation is intentional
   * for performance and convenience, but callers should be aware that the request
   * object will be modified and should not reuse it if they need the original state.
   *
   * @param request - The request object to modify (will be mutated in place).
   *   Supports both LogRecordsQueryRequest and MetricSearchRequest types.
   */
  private fillRequestContext(
    request: LogRecordsQueryRequest | LogRecordsMetricsQueryRequest
  ): void {
    if (!request.experiment_id && !request.log_stream_id) {
      if (this.experimentId) {
        request.experiment_id = this.experimentId;
      } else if (this.logStreamId) {
        request.log_stream_id = this.logStreamId;
      }
    }
  }
}
