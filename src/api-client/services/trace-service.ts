import { BaseClient, RequestMethod } from '../base-client';
import { getSdkLogger } from 'galileo-generated';
import { Routes } from '../../types/routes.types';
import {
  Trace,
  ExtendedTraceRecordWithChildren,
  LogTraceUpdateRequest,
  LogTraceUpdateResponse,
  LogRecordsDeleteRequest,
  LogSpansIngestRequest,
  LogSpansIngestResponse,
  LogSpanUpdateRequest,
  LogSpanUpdateResponse,
  ExtendedSpanRecord,
  LogRecordsQueryCountRequest,
  LogRecordsQueryCountResponse,
  LogRecordsAvailableColumnsRequest,
  LogRecordsAvailableColumnsResponse,
  RecomputeLogRecordsMetricsRequest,
  ExtendedTraceRecordWithChildrenOpenAPI,
  ExtendedSpanRecordOpenAPI,
  LogSpansIngestRequestOpenAPI,
  LogSpansIngestResponseOpenAPI,
  LogRecordsDeleteResponse,
  LogRecordsDeleteResponseOpenAPI,
  LogRecordsDeleteRequestOpenAPI,
  LogTraceUpdateRequestOpenAPI,
  LogTraceUpdateResponseOpenAPI,
  LogSpanUpdateRequestOpenAPI,
  LogSpanUpdateResponseOpenAPI,
  LogRecordsQueryCountRequestOpenAPI,
  LogRecordsQueryCountResponseOpenAPI,
  LogRecordsAvailableColumnsRequestOpenAPI,
  LogRecordsAvailableColumnsResponseOpenAPI,
  RecomputeLogRecordsMetricsRequestOpenAPI,
  ExtendedSessionRecordWithChildren,
  ExtendedSessionRecordWithChildrenOpenAPI,
  AggregatedTraceViewRequest,
  AggregatedTraceViewRequestOpenAPI,
  AggregatedTraceViewResponse,
  AggregatedTraceViewResponseOpenAPI,
  LogTracesIngestRequest,
  LogTracesIngestResponse
} from '../../types/logging/trace.types';
import {
  SessionCreateRequest,
  SessionCreateRequestOpenAPI,
  SessionCreateResponse,
  SessionCreateResponseOpenAPI
} from '../../types/logging/session.types';
import {
  LogRecordsMetricsQueryRequest,
  LogRecordsMetricsQueryRequestOpenAPI,
  LogRecordsMetricsResponse,
  LogRecordsMetricsResponseOpenAPI
} from '../../types/metrics.types';
import {
  LogRecordsQueryRequest,
  LogRecordsQueryRequestOpenAPI,
  LogRecordsQueryResponse,
  LogRecordsQueryResponseOpenAPI
} from '../../types/shared.types';

const sdkLogger = getSdkLogger();

import { GalileoGenerated } from 'galileo-generated';
const galileoGenerated = new GalileoGenerated();

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

  // createSessionLegacy holds old contract to support GalileoLogger's startSession method until further refactoring
  public async createSessionLegacy({
    name,
    previousSessionId,
    externalId,
    metadata
  }: {
    name?: string;
    previousSessionId?: string;
    externalId?: string;
    metadata?: Record<string, string>;
  }): Promise<SessionCreateResponse> {
    return await this.makeRequest<SessionCreateResponse>(
      RequestMethod.POST,
      Routes.sessions,
      {
        log_stream_id: this.logStreamId,
        name,
        previous_session_id: previousSessionId,
        external_id: externalId,
        user_metadata: metadata
      },
      { project_id: this.projectId }
    );
  }

  public async createSession(
    options: SessionCreateRequest
  ): Promise<SessionCreateResponse> {
    if (!this.projectId) {
      throw new Error('Project not initialized');
    }
    options.logStreamId ??= this.logStreamId;

    this.validateLogstreamAndExperiment<typeof options>(options);
    const request = this.convertToSnakeCase<
      typeof options,
      SessionCreateRequestOpenAPI
    >(options);

    const response = await this.makeRequest<SessionCreateResponseOpenAPI>(
      RequestMethod.POST,
      Routes.sessions,
      request,
      { project_id: this.projectId }
    );

    return this.convertToCamelCase<
      SessionCreateResponseOpenAPI,
      SessionCreateResponse
    >(response);
  }

  // ingestTracesLegacy holds old contract to support GalileoLogger's flush method until further refactoring
  public async ingestTracesLegacy(traces: Trace[]): Promise<void> {
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
    sdkLogger.info(
      `🚀 ${traces.length} Traces ingested for project ${this.projectId}.`
    );
  }

  /**
   * Ingests trace data for the current project (or a specific project when given).
   *
   * @param options - Trace ingest payload (traces, logstream/experiment, etc.). `sessionId` is defaulted from the service when omitted.
   * @param projectId - Optional project ID to ingest into; defaults to the service's current project.
   * @returns Promise resolving to the ingest response ({@link LogTracesIngestResponse}).
   * @throws {Error} If the service has no project initialized.
   */
  public async ingestTraces(
    options: LogTracesIngestRequest,
    projectId?: string
  ): Promise<LogTracesIngestResponse> {
    if (!this.projectId) {
      throw new Error('Project not initialized');
    }

    this.validateLogstreamAndExperiment<typeof options>(options);
    options.sessionId ??= this.sessionId;

    const response =
      await galileoGenerated.trace.logTracesProjectsProjectIdTracesPost(
        {},
        {
          projectId: projectId ?? this.projectId,
          body: options
        }
      );

    return response;
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
    if (!options.interval) options.interval = 5;

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

  public async getSession(
    sessionId: string
  ): Promise<ExtendedSessionRecordWithChildren> {
    if (!this.projectId) {
      throw new Error('Project not initialized');
    }

    const response =
      await this.makeRequest<ExtendedSessionRecordWithChildrenOpenAPI>(
        RequestMethod.GET,
        Routes.session,
        undefined,
        { project_id: this.projectId, session_id: sessionId }
      );

    return this.convertToCamelCase<
      ExtendedSessionRecordWithChildrenOpenAPI,
      ExtendedSessionRecordWithChildren
    >(response);
  }

  public async getTrace(
    traceId: string
  ): Promise<ExtendedTraceRecordWithChildren> {
    if (!this.projectId) {
      throw new Error('Project not initialized');
    }

    const response =
      await this.makeRequest<ExtendedTraceRecordWithChildrenOpenAPI>(
        RequestMethod.GET,
        Routes.trace,
        undefined,
        { project_id: this.projectId, trace_id: traceId }
      );

    return this.convertToCamelCase<
      ExtendedTraceRecordWithChildrenOpenAPI,
      ExtendedTraceRecordWithChildren
    >(response);
  }

  public async updateTrace(
    options: LogTraceUpdateRequest
  ): Promise<LogTraceUpdateResponse> {
    if (!this.projectId) {
      throw new Error('Project not initialized');
    }

    this.validateLogstreamAndExperiment<typeof options>(options);
    const request = this.convertToSnakeCase<
      LogTraceUpdateRequest,
      LogTraceUpdateRequestOpenAPI
    >(options);

    const response = await this.makeRequest<LogTraceUpdateResponseOpenAPI>(
      RequestMethod.PATCH,
      Routes.trace,
      request,
      { project_id: this.projectId, trace_id: options.traceId }
    );

    return this.convertToCamelCase<
      LogTraceUpdateResponseOpenAPI,
      LogTraceUpdateResponse
    >(response);
  }

  public async deleteTraces(
    options: LogRecordsDeleteRequest
  ): Promise<LogRecordsDeleteResponse> {
    if (!this.projectId) {
      throw new Error('Project not initialized');
    }

    this.validateLogstreamAndExperiment<typeof options>(options);
    const request = this.convertToSnakeCase<
      LogRecordsDeleteRequest,
      LogRecordsDeleteRequestOpenAPI
    >(options);

    const response = await this.makeRequest<LogRecordsDeleteResponseOpenAPI>(
      RequestMethod.POST,
      Routes.tracesDelete,
      request,
      { project_id: this.projectId }
    );

    return this.convertToCamelCase<
      LogRecordsDeleteResponseOpenAPI,
      LogRecordsDeleteResponse
    >(response);
  }

  public async deleteSessions(
    options: LogRecordsDeleteRequest
  ): Promise<LogRecordsDeleteResponse> {
    if (!this.projectId) {
      throw new Error('Project not initialized');
    }

    this.validateLogstreamAndExperiment<typeof options>(options);
    const request = this.convertToSnakeCase<
      LogRecordsDeleteRequest,
      LogRecordsDeleteRequestOpenAPI
    >(options);

    const response = await this.makeRequest<LogRecordsDeleteResponseOpenAPI>(
      RequestMethod.POST,
      Routes.sessionsDelete,
      request,
      { project_id: this.projectId }
    );

    return this.convertToCamelCase<
      LogRecordsDeleteResponseOpenAPI,
      LogRecordsDeleteResponse
    >(response);
  }

  public async ingestSpans(
    options: LogSpansIngestRequest
  ): Promise<LogSpansIngestResponse> {
    if (!this.projectId) {
      throw new Error('Project not initialized');
    }

    this.validateLogstreamAndExperiment<typeof options>(options);
    this.fillOptionsContext(options);
    const request = this.convertToSnakeCase<
      LogSpansIngestRequest,
      LogSpansIngestRequestOpenAPI
    >(options);

    const response = await this.makeRequest<LogSpansIngestResponseOpenAPI>(
      RequestMethod.POST,
      Routes.spans,
      request,
      { project_id: this.projectId }
    );

    return this.convertToCamelCase<
      LogSpansIngestResponseOpenAPI,
      LogSpansIngestResponse
    >(response);
  }

  public async getSpan(spanId: string): Promise<ExtendedSpanRecord> {
    if (!this.projectId) {
      throw new Error('Project not initialized');
    }

    const response = await this.makeRequest<ExtendedSpanRecordOpenAPI>(
      RequestMethod.GET,
      Routes.span,
      undefined,
      { project_id: this.projectId, span_id: spanId }
    );

    return this.convertToCamelCase<
      ExtendedSpanRecordOpenAPI,
      ExtendedSpanRecord
    >(response);
  }

  public async updateSpan(
    options: LogSpanUpdateRequest
  ): Promise<LogSpanUpdateResponse> {
    if (!this.projectId) {
      throw new Error('Project not initialized');
    }

    this.validateLogstreamAndExperiment<typeof options>(options);
    const request = this.convertToSnakeCase<
      LogSpanUpdateRequest,
      LogSpanUpdateRequestOpenAPI
    >(options);

    const response = await this.makeRequest<LogSpanUpdateResponseOpenAPI>(
      RequestMethod.PATCH,
      Routes.span,
      request,
      { project_id: this.projectId, span_id: options.spanId }
    );

    return this.convertToCamelCase<
      LogSpanUpdateResponseOpenAPI,
      LogSpanUpdateResponse
    >(response);
  }

  public async deleteSpans(
    options: LogRecordsDeleteRequest
  ): Promise<LogRecordsDeleteResponse> {
    if (!this.projectId) {
      throw new Error('Project not initialized');
    }

    this.validateLogstreamAndExperiment<typeof options>(options);
    const request = this.convertToSnakeCase<
      LogRecordsDeleteRequest,
      LogRecordsDeleteRequestOpenAPI
    >(options);

    const response = await this.makeRequest<LogRecordsDeleteResponseOpenAPI>(
      RequestMethod.POST,
      Routes.spansDelete,
      request,
      { project_id: this.projectId }
    );

    return this.convertToCamelCase<
      LogRecordsDeleteResponseOpenAPI,
      LogRecordsDeleteResponse
    >(response);
  }

  public async countTraces(
    options: LogRecordsQueryCountRequest
  ): Promise<LogRecordsQueryCountResponse> {
    if (!this.projectId) {
      throw new Error('Project not initialized');
    }

    this.validateLogstreamAndExperiment<typeof options>(options);
    const request = this.convertToSnakeCase<
      LogRecordsQueryCountRequest,
      LogRecordsQueryCountRequestOpenAPI
    >(options);

    const response =
      await this.makeRequest<LogRecordsQueryCountResponseOpenAPI>(
        RequestMethod.POST,
        Routes.tracesCount,
        request,
        { project_id: this.projectId }
      );

    return this.convertToCamelCase<
      LogRecordsQueryCountResponseOpenAPI,
      LogRecordsQueryCountResponse
    >(response);
  }

  public async countSessions(
    options: LogRecordsQueryCountRequest
  ): Promise<LogRecordsQueryCountResponse> {
    if (!this.projectId) {
      throw new Error('Project not initialized');
    }

    this.validateLogstreamAndExperiment<typeof options>(options);
    const request = this.convertToSnakeCase<
      LogRecordsQueryCountRequest,
      LogRecordsQueryCountRequestOpenAPI
    >(options);

    const response =
      await this.makeRequest<LogRecordsQueryCountResponseOpenAPI>(
        RequestMethod.POST,
        Routes.sessionsCount,
        request,
        { project_id: this.projectId }
      );

    return this.convertToCamelCase<
      LogRecordsQueryCountResponseOpenAPI,
      LogRecordsQueryCountResponse
    >(response);
  }

  public async countSpans(
    options: LogRecordsQueryCountRequest
  ): Promise<LogRecordsQueryCountResponse> {
    if (!this.projectId) {
      throw new Error('Project not initialized');
    }

    this.validateLogstreamAndExperiment<typeof options>(options);
    const request = this.convertToSnakeCase<
      LogRecordsQueryCountRequest,
      LogRecordsQueryCountRequestOpenAPI
    >(options);

    const response =
      await this.makeRequest<LogRecordsQueryCountResponseOpenAPI>(
        RequestMethod.POST,
        Routes.spansCount,
        request,
        { project_id: this.projectId }
      );

    return this.convertToCamelCase<
      LogRecordsQueryCountResponseOpenAPI,
      LogRecordsQueryCountResponse
    >(response);
  }

  public async getTracesAvailableColumns(
    options: LogRecordsAvailableColumnsRequest
  ): Promise<LogRecordsAvailableColumnsResponse> {
    if (!this.projectId) {
      throw new Error('Project not initialized');
    }

    this.validateLogstreamAndExperiment<typeof options>(options);
    const request = this.convertToSnakeCase<
      LogRecordsAvailableColumnsRequest,
      LogRecordsAvailableColumnsRequestOpenAPI
    >(options);

    const response =
      await this.makeRequest<LogRecordsAvailableColumnsResponseOpenAPI>(
        RequestMethod.POST,
        Routes.tracesAvailableColumns,
        request,
        { project_id: this.projectId }
      );

    return this.convertToCamelCase<
      LogRecordsAvailableColumnsResponseOpenAPI,
      LogRecordsAvailableColumnsResponse
    >(response);
  }

  public async getSessionsAvailableColumns(
    options: LogRecordsAvailableColumnsRequest
  ): Promise<LogRecordsAvailableColumnsResponse> {
    if (!this.projectId) {
      throw new Error('Project not initialized');
    }

    this.validateLogstreamAndExperiment<typeof options>(options);
    const request = this.convertToSnakeCase<
      LogRecordsAvailableColumnsRequest,
      LogRecordsAvailableColumnsRequestOpenAPI
    >(options);

    const response =
      await this.makeRequest<LogRecordsAvailableColumnsResponseOpenAPI>(
        RequestMethod.POST,
        Routes.sessionsAvailableColumns,
        request,
        { project_id: this.projectId }
      );

    return this.convertToCamelCase<
      LogRecordsAvailableColumnsResponseOpenAPI,
      LogRecordsAvailableColumnsResponse
    >(response);
  }

  public async getSpansAvailableColumns(
    options: LogRecordsAvailableColumnsRequest
  ): Promise<LogRecordsAvailableColumnsResponse> {
    if (!this.projectId) {
      throw new Error('Project not initialized');
    }

    this.validateLogstreamAndExperiment<typeof options>(options);
    const request = this.convertToSnakeCase<
      LogRecordsAvailableColumnsRequest,
      LogRecordsAvailableColumnsRequestOpenAPI
    >(options);

    const response =
      await this.makeRequest<LogRecordsAvailableColumnsResponseOpenAPI>(
        RequestMethod.POST,
        Routes.spansAvailableColumns,
        request,
        { project_id: this.projectId }
      );

    return this.convertToCamelCase<
      LogRecordsAvailableColumnsResponseOpenAPI,
      LogRecordsAvailableColumnsResponse
    >(response);
  }

  public async recomputeMetrics(
    options: RecomputeLogRecordsMetricsRequest
  ): Promise<unknown> {
    if (!this.projectId) {
      throw new Error('Project not initialized');
    }

    this.validateLogstreamAndExperiment<RecomputeLogRecordsMetricsRequest>(
      options
    );
    const request = this.convertToSnakeCase<
      RecomputeLogRecordsMetricsRequest,
      RecomputeLogRecordsMetricsRequestOpenAPI
    >(options);

    return await this.makeRequest<unknown>(
      RequestMethod.POST,
      Routes.recomputeMetrics,
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

  public async getAggregatedTraceView(
    options: AggregatedTraceViewRequest
  ): Promise<AggregatedTraceViewResponse> {
    if (!this.projectId) {
      throw new Error('Project not initialized');
    }

    this.validateLogstreamAndExperiment<AggregatedTraceViewRequest>(options);
    const request = this.convertToSnakeCase<
      AggregatedTraceViewRequest,
      AggregatedTraceViewRequestOpenAPI
    >(options);

    const response = await this.makeRequest<AggregatedTraceViewResponseOpenAPI>(
      RequestMethod.POST,
      Routes.tracesAggregated,
      request,
      { project_id: this.projectId }
    );

    return this.convertToCamelCase<
      AggregatedTraceViewResponseOpenAPI,
      AggregatedTraceViewResponse
    >(response);
  }

  private validateLogstreamAndExperiment<
    T extends { logStreamId?: string | null; experimentId?: string | null }
  >(options: T): void {
    if (!options.logStreamId && !options.experimentId) {
      if (this.logStreamId) options.logStreamId = this.logStreamId;
      else if (this.experimentId) options.experimentId = this.experimentId;
      else throw new Error('Log stream or experiment not initialized');
    } else if (options.logStreamId && options.experimentId)
      throw new Error('Either logstream or experiment must be provided');
  }

  private fillOptionsContext(options: LogSpansIngestRequest): void {
    if (!options.reliable) options.reliable = false;
  }
}
