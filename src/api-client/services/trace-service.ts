import { BaseClient, RequestMethod } from '../base-client';
import { Routes } from '../../types/routes.types';
import { Trace } from '../../types/logging/trace.types';
import { SessionCreateResponse } from '../../types/logging/session.types';

import {
  LogRecordsMetricsQueryRequest,
  LogRecordsMetricsQueryRequestOpenAPI,
  LogRecordsMetricsResponse,
  LogRecordsMetricsResponseOpenAPI,
  LogRecordsQueryRequest,
  LogRecordsQueryRequestOpenAPI,
  LogRecordsQueryResponse,
  LogRecordsQueryResponseOpenAPI
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
    options: LogRecordsQueryRequest
  ): Promise<LogRecordsQueryResponse> {
    if (!this.projectId) {
      throw new Error('Project not initialized');
    }
    this.fillRequestContext(options);
    const request = this.convertToSnakeCase<
      LogRecordsQueryRequest,
      LogRecordsQueryRequestOpenAPI
    >(options);

    const response = await this.makeRequest<LogRecordsQueryResponseOpenAPI>(
      RequestMethod.POST,
      Routes.sessionsSearch,
      request,
      { project_id: this.projectId }
    );

    return this.convertToCamelCase<
      LogRecordsQueryResponseOpenAPI,
      LogRecordsQueryResponse
    >(response);
  }

  public async searchMetrics(
    options: LogRecordsMetricsQueryRequest
  ): Promise<LogRecordsMetricsResponse> {
    if (!this.projectId) {
      throw new Error('Project not initialized');
    }
    this.fillRequestContext(options);
    const request = this.convertToSnakeCase<
      LogRecordsMetricsQueryRequest,
      LogRecordsMetricsQueryRequestOpenAPI
    >(options);

    const response = await this.makeRequest<LogRecordsMetricsResponseOpenAPI>(
      RequestMethod.POST,
      Routes.metricsSearch,
      request,
      { project_id: this.projectId }
    );

    return this.convertToCamelCase<
      LogRecordsMetricsResponseOpenAPI,
      LogRecordsMetricsResponse
    >(response);
  }

  public async searchTraces(
    options: LogRecordsQueryRequest
  ): Promise<LogRecordsQueryResponse> {
    if (!this.projectId) {
      throw new Error('Project not initialized');
    }
    this.fillRequestContext(options);
    const request = this.convertToSnakeCase<
      LogRecordsQueryRequest,
      LogRecordsQueryRequestOpenAPI
    >(options);

    const response = await this.makeRequest<LogRecordsQueryResponseOpenAPI>(
      RequestMethod.POST,
      Routes.tracesSearch,
      request,
      { project_id: this.projectId }
    );

    return this.convertToCamelCase<
      LogRecordsQueryResponseOpenAPI,
      LogRecordsQueryResponse
    >(response);
  }

  public async searchSpans(
    options: LogRecordsQueryRequest
  ): Promise<LogRecordsQueryResponse> {
    if (!this.projectId) {
      throw new Error('Project not initialized');
    }
    this.fillRequestContext(options);
    const request = this.convertToSnakeCase<
      LogRecordsQueryRequest,
      LogRecordsQueryRequestOpenAPI
    >(options);

    const response = await this.makeRequest<LogRecordsQueryResponseOpenAPI>(
      RequestMethod.POST,
      Routes.spansSearch,
      request,
      { project_id: this.projectId }
    );

    return this.convertToCamelCase<
      LogRecordsQueryResponseOpenAPI,
      LogRecordsQueryResponse
    >(response);
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
   * @param options - The request object to modify (will be mutated in place).
   *   Supports both LogRecordsQueryRequest and LogRecordsMetricsQueryRequest types.
   */
  private fillRequestContext(
    options: LogRecordsQueryRequest | LogRecordsMetricsQueryRequest
  ): void {
    if (!options.experimentId && !options.logStreamId) {
      if (this.experimentId) {
        options.experimentId = this.experimentId;
      } else if (this.logStreamId) {
        options.logStreamId = this.logStreamId;
      }
    }
  }
}
