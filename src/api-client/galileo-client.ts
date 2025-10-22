/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Scorer,
  ScorerConfig,
  ScorerDefaults,
  ScorerTypes,
  ScorerVersion,
  ModelType,
  ChainPollTemplate,
  OutputType,
  InputType
} from '../types/scorer.types';
import {
  CollaboratorUpdate,
  ListUserCollaboratorsResponse,
  ProjectCreate,
  ProjectCreateOptions,
  ProjectCreateResponse,
  ProjectDeleteResponse,
  ProjectTypes,
  UserCollaborator,
  UserCollaboratorCreate
} from '../types/project.types';
import { BaseClient } from './base-client';
import { SessionCreateResponse } from '../types/logging/session.types';
import {
  ExtendedTraceRecordWithChildren,
  ExtendedSpanRecord,
  ExtendedSessionRecordWithChildren,
  LogTraceUpdateRequest,
  LogTraceUpdateResponse,
  LogSpanUpdateRequest,
  LogSpanUpdateResponse,
  LogSpansIngestRequest,
  LogSpansIngestResponse,
  LogRecordsDeleteRequest,
  LogRecordsDeleteResponse,
  LogRecordsQueryCountRequest,
  LogRecordsQueryCountResponse,
  LogRecordsAvailableColumnsRequest,
  LogRecordsAvailableColumnsResponse,
  RecomputeLogRecordsMetricsRequest,
  AggregatedTraceViewRequest,
  AggregatedTraceViewResponse,
  LogTracesIngestRequest,
  LogTracesIngestResponse
} from '../types/logging/trace.types';
import { AuthService } from './services/auth-service';
import { ProjectService } from './services/project-service';
import { LogStreamService } from './services/logstream-service';
import {
  PromptTemplateService,
  GlobalPromptTemplateService
} from './services/prompt-template-service';
import {
  RenderTemplateRequest,
  RenderTemplateResponse
} from '../types/prompt-template.types';
import {
  DatasetService,
  DatasetAppendRow,
  SyntheticDatasetExtensionRequest,
  SyntheticDatasetExtensionResponse,
  JobProgress
} from './services/dataset-service';
import { TraceService } from './services/trace-service';
import { ExperimentService } from './services/experiment-service';
import { ScorerService } from './services/scorer-service';
import { ExportService } from './services/export-service';
import { JobsService } from './services/job-service';
import { JobProgressService } from './services/job-progress-service';
import {
  CreateJobResponse,
  ExperimentDatasetRequest,
  PromptRunSettings
} from '../types/experiment.types';
import { Job, TaskType } from '../types/job.types';
import { Message } from '../types/message.types';
import { StepType } from '../types/logging/step.types';
import { LogRecordsExportRequest } from '../types/export.types';
import {
  LogRecordsQueryRequest,
  LogRecordsQueryResponse
} from '../types/shared.types';
import {
  LogRecordsMetricsQueryRequest,
  LogRecordsMetricsResponse
} from '../types/metrics.types';

const MILLISECONDS_TO_NEXT_TIMESTAMP = 100;

export class GalileoApiClientParams {
  public projectType: ProjectTypes = ProjectTypes.genAI;
  public projectName?: string = process.env.GALILEO_PROJECT || 'default';
  public projectId?: string = undefined;
  public logStreamName?: string = process.env.GALILEO_LOG_STREAM || 'default';
  public logStreamId?: string = undefined;
  public runId?: string = undefined;
  public datasetId?: string = undefined;
  public experimentId?: string = undefined;
  public sessionId?: string = undefined;
  public projectScoped: boolean = true;
}

export class GalileoApiClient extends BaseClient {
  public projectType: ProjectTypes = ProjectTypes.genAI;
  public projectId: string = '';
  public logStreamId: string = '';
  public runId: string = '';
  public datasetId: string = '';
  public experimentId: string = '';
  public sessionId?: string = undefined;
  public projectScoped: boolean = true;

  // Service instances
  private jobsService?: JobsService;
  private jobProgressService?: JobProgressService;
  private authService?: AuthService;
  private projectService?: ProjectService;
  private logStreamService?: LogStreamService;
  private promptTemplateService?: PromptTemplateService;
  private globalPromptTemplateService?: GlobalPromptTemplateService;
  private datasetService?: DatasetService;
  private traceService?: TraceService;
  private experimentService?: ExperimentService;
  private scorerService?: ScorerService;
  private exportService?: ExportService;

  static timestampRecord: number = 0;

  public async init(
    params: Partial<GalileoApiClientParams> = {}
  ): Promise<void> {
    const defaultParams = new GalileoApiClientParams();
    const {
      projectType = defaultParams.projectType,
      projectId = defaultParams.projectId,
      projectName = defaultParams.projectName,
      logStreamId = defaultParams.logStreamId,
      logStreamName = defaultParams.logStreamName,
      runId = defaultParams.runId,
      datasetId = defaultParams.datasetId,
      experimentId = defaultParams.experimentId,
      sessionId = defaultParams.sessionId,
      projectScoped = defaultParams.projectScoped
    } = params;

    this.projectType = projectType;

    if (runId) {
      this.runId = runId;
    }

    if (datasetId) {
      this.datasetId = datasetId;
    }

    this.apiUrl = this.getApiUrl(this.projectType);

    if (await this.healthCheck()) {
      // Initialize auth service and get token
      this.authService = new AuthService(this.apiUrl);
      this.token = await this.authService.getToken();

      // Initialize the client in base class
      this.initializeClient();

      // Initialize dataset and trace services
      this.datasetService = new DatasetService(this.apiUrl, this.token);

      // Initialize job service
      this.jobsService = new JobsService(this.apiUrl, this.token);

      // Initialize job progress service
      this.jobProgressService = new JobProgressService(this.apiUrl, this.token);

      // Initialize the global prompt template service
      this.globalPromptTemplateService = new GlobalPromptTemplateService(
        this.apiUrl,
        this.token
      );

      if (projectScoped) {
        // Initialize project service and get project ID
        this.projectService = new ProjectService(
          this.apiUrl,
          this.token,
          this.projectType
        );

        if (projectId) {
          this.projectId = projectId;
        } else if (projectName) {
          try {
            this.projectId =
              await this.projectService.getProjectIdByName(projectName);
            // eslint-disable-next-line no-console
          } catch (err: unknown) {
            const error = err as Error;

            if (error.message.includes('not found')) {
              const project = await this.projectService.createProject({
                name: projectName,
                type: this.projectType,
                createExampleTemplates: false
              });
              this.projectId = project.id;
              // eslint-disable-next-line no-console
              console.log(`✨ ${projectName} created.`);
            } else {
              throw err;
            }
          }
        }

        // Initialize log stream service
        this.logStreamService = new LogStreamService(
          this.apiUrl,
          this.token,
          this.projectId
        );

        if (experimentId) {
          this.experimentId = experimentId;
        } else if (logStreamId) {
          this.logStreamId = logStreamId;
        } else if (logStreamName) {
          try {
            const logStream =
              await this.logStreamService.getLogStreamByName(logStreamName);
            this.logStreamId = logStream.id;
            // eslint-disable-next-line no-console
            // console.log(`✅ Using ${logStreamName}`);
          } catch (err: unknown) {
            const error = err as Error;

            if (error.message.includes('not found')) {
              const logStream =
                await this.logStreamService.createLogStream(logStreamName);
              this.logStreamId = logStream.id;
              // eslint-disable-next-line no-console
              console.log(`✨ ${logStreamName} created.`);
            } else {
              throw err;
            }
          }
        }

        if (sessionId) {
          this.sessionId = sessionId;
        }

        this.traceService = new TraceService(
          this.apiUrl,
          this.token,
          this.projectId,
          this.logStreamId,
          this.experimentId,
          this.sessionId
        );

        this.promptTemplateService = new PromptTemplateService(
          this.apiUrl,
          this.token,
          this.projectId
        );

        this.experimentService = new ExperimentService(
          this.apiUrl,
          this.token,
          this.projectId
        );
        this.scorerService = new ScorerService(this.apiUrl, this.token);

        this.exportService = new ExportService(
          this.apiUrl,
          this.token,
          this.projectId
        );
      }
    }
  }

  static getTimestampRecord(): Date {
    const dateNow = Date.now();
    const timeDifference = dateNow - this.timestampRecord;

    this.timestampRecord =
      timeDifference <= 0 &&
      Math.abs(timeDifference) < MILLISECONDS_TO_NEXT_TIMESTAMP
        ? this.timestampRecord + 1
        : dateNow;

    const result = new Date(this.timestampRecord);
    return result;
  }

  // Project methods - delegate to ProjectService
  /**
   * Lists projects available to the authenticated user.
   * @param projectType - (Optional) Project type filter for the request.
   * @returns A promise that resolves to the accessible projects.
   */
  public async getProjects(projectType?: ProjectTypes) {
    this.ensureService(this.projectService);

    // If none provided, default project type for all_projects endpoint call is genAI
    const defaultProjectType = ProjectTypes.genAI;
    return this.projectService!.getProjects(projectType ?? defaultProjectType);
  }

  /**
   * Gets a project by ID.
   * @param id - ID of the project to fetch.
   * @returns A promise that resolves to the matching project.
   */
  public async getProject(id: string) {
    this.ensureService(this.projectService);
    return this.projectService!.getProject(id);
  }

  /**
   * Gets a project by name.
   * @param name - Name of the project to fetch.
   * @param options - (Optional) Additional lookup options.
   * @param options.projectType - (Optional) Project type hint to disambiguate by name.
   * @returns A promise that resolves to the matching project.
   */
  public async getProjectByName(
    name: string,
    options?: { projectType?: ProjectTypes | null }
  ) {
    this.ensureService(this.projectService);
    return this.projectService!.getProjectByName(name, options ?? {});
  }

  /**
   * Gets a project ID by name.
   * @param name - Name of the project to resolve.
   * @param options - (Optional) Additional lookup options.
   * @param options.projectType - (Optional) Project type hint to disambiguate by name.
   * @returns A promise that resolves to the project ID.
   */
  public async getProjectIdByName(
    name: string,
    options?: { projectType?: ProjectTypes | null }
  ) {
    this.ensureService(this.projectService);
    return this.projectService!.getProjectIdByName(name, options);
  }

  /**
   * Creates a new project.
   * @param name - Name of the project to create.
   * @param options - (Optional) Additional project creation parameters.
   * @param options.type - (Optional) Project type to assign.
   * @param options.createdBy - (Optional) Identifier of the creator.
   * @param options.createExampleTemplates - (Optional) Whether example templates should be created.
   * @returns A promise that resolves to the created project payload.
   */
  public async createProject(
    name: string,
    options?: ProjectCreateOptions
  ): Promise<ProjectCreateResponse> {
    this.ensureService(this.projectService);

    const request: ProjectCreate = {
      name,
      type: options?.type,
      createdBy: options?.createdBy,
      createExampleTemplates: options?.createExampleTemplates
    };
    return this.projectService!.createProject(request);
  }

  /**
   * Deletes a project by ID.
   * @param projectId - ID of the project to delete.
   * @returns A promise that resolves to the delete response payload.
   */
  public async deleteProject(
    projectId: string
  ): Promise<ProjectDeleteResponse> {
    this.ensureService(this.projectService);
    return this.projectService!.deleteProject(projectId);
  }

  /**
   * Lists project collaborators with optional pagination controls.
   * @param options - (Optional) Options for the list operation.
   * @param options.projectId - (Optional) Explicit project ID override.
   * @param options.startingToken - (Optional) Pagination token to start from.
   * @param options.limit - (Optional) Maximum collaborators to return per page.
   * @returns A promise that resolves to the collaborators list payload.
   */
  public async listUserProjectCollaborators(options?: {
    projectId?: string;
    startingToken?: number;
    limit?: number;
  }): Promise<ListUserCollaboratorsResponse> {
    this.ensureService(this.projectService);
    const projectId = this.resolveProjectId(options?.projectId);
    return this.projectService!.listUserProjectCollaborators(projectId, {
      startingToken: options?.startingToken,
      limit: options?.limit
    });
  }

  /**
   * Creates user collaborators for a project.
   * @param collaborators - Collaborator payloads to create.
   * @param projectId - (Optional) Project ID override when not using a scoped client.
   * @returns A promise that resolves to the created collaborators.
   */
  public async createUserProjectCollaborators(
    collaborators: UserCollaboratorCreate[],
    projectId?: string
  ): Promise<UserCollaborator[]> {
    this.ensureService(this.projectService);
    const resolvedProjectId = this.resolveProjectId(projectId);
    return this.projectService!.createUserProjectCollaborators(
      resolvedProjectId,
      collaborators
    );
  }

  /**
   * Updates a user collaborator.
   * @param userId - ID of the collaborator to update.
   * @param update - Update payload describing the collaborator changes.
   * @param projectId - (Optional) Project ID override when not using a scoped client.
   * @returns A promise that resolves to the updated collaborator.
   */
  public async updateUserProjectCollaborator(
    userId: string,
    update: CollaboratorUpdate,
    projectId?: string
  ): Promise<UserCollaborator> {
    this.ensureService(this.projectService);
    const resolvedProjectId = this.resolveProjectId(projectId);
    return this.projectService!.updateUserProjectCollaborator(
      resolvedProjectId,
      userId,
      update
    );
  }

  /**
   * Removes a user collaborator from a project.
   * @param userId - ID of the collaborator to delete.
   * @param projectId - ID of the project the collaborator belongs to.
   * @returns A promise that resolves when the collaborator is removed.
   */
  public async deleteUserProjectCollaborator(
    userId: string,
    projectId: string
  ): Promise<void> {
    this.ensureService(this.projectService);
    await this.projectService!.deleteUserProjectCollaborator(projectId, userId);
  }

  // Log Stream methods - delegate to LogStreamService
  public async getLogStreams() {
    this.ensureService(this.logStreamService);
    return this.logStreamService!.getLogStreams();
  }

  public async getLogStream(id: string) {
    this.ensureService(this.logStreamService);
    return this.logStreamService!.getLogStream(id);
  }

  public async getLogStreamByName(name: string) {
    this.ensureService(this.logStreamService);
    return this.logStreamService!.getLogStreamByName(name);
  }

  public async createLogStream(name: string) {
    this.ensureService(this.logStreamService);
    return this.logStreamService!.createLogStream(name);
  }

  public async createLogStreamScorerSettings(
    logStreamId: string,
    scorers: ScorerConfig[]
  ): Promise<void> {
    this.ensureService(this.logStreamService);
    return this.logStreamService!.createScorerSettings(logStreamId, scorers);
  }

  // Dataset methods - delegate to DatasetService
  public async getDatasets() {
    this.ensureService(this.datasetService);
    return this.datasetService!.getDatasets();
  }

  public async getDataset(id: string) {
    this.ensureService(this.datasetService);
    return this.datasetService!.getDataset(id);
  }

  public async getDatasetEtag(id: string) {
    this.ensureService(this.datasetService);
    return this.datasetService!.getDatasetEtag(id);
  }

  public async getDatasetByName(name: string) {
    this.ensureService(this.datasetService);
    return this.datasetService!.getDatasetByName(name);
  }

  public async createDataset(name: string, filePath: string, format: any) {
    this.ensureService(this.datasetService);
    return this.datasetService!.createDataset(name, filePath, format);
  }

  public async getDatasetContent(datasetId: string) {
    this.ensureService(this.datasetService);
    return this.datasetService!.getDatasetContent(datasetId);
  }

  public async deleteDataset(id: string): Promise<void> {
    this.ensureService(this.datasetService);
    return this.datasetService!.deleteDataset(id);
  }

  public async appendRowsToDatasetContent(
    datasetId: string,
    etag: string,
    rows: DatasetAppendRow[]
  ): Promise<void> {
    this.ensureService(this.datasetService);
    return this.datasetService!.appendRowsToDatasetContent(
      datasetId,
      etag,
      rows
    );
  }

  public async extendDataset(
    params: SyntheticDatasetExtensionRequest
  ): Promise<SyntheticDatasetExtensionResponse> {
    this.ensureService(this.datasetService);
    return this.datasetService!.extendDataset(params);
  }

  public async getExtendDatasetStatus(datasetId: string): Promise<JobProgress> {
    this.ensureService(this.datasetService);
    return this.datasetService!.getExtendDatasetStatus(datasetId);
  }

  // Trace methods - delegate to TraceService
  public async ingestTracesLegacy(traces: any[]) {
    this.ensureService(this.traceService);
    return this.traceService!.ingestTracesLegacy(traces);
  }

  public async ingestTraces(
    options: LogTracesIngestRequest
  ): Promise<LogTracesIngestResponse> {
    this.ensureService(this.traceService);
    return this.traceService!.ingestTraces(options);
  }

  public async createSessionLegacy({
    name,
    previousSessionId,
    externalId
  }: {
    name?: string;
    previousSessionId?: string;
    externalId?: string;
  }): Promise<SessionCreateResponse> {
    this.ensureService(this.traceService);
    return this.traceService!.createSessionLegacy({
      name,
      previousSessionId,
      externalId
    });
  }

  /**
   * Search for sessions matching the provided query criteria.
   *
   * @param request - Query request object
   * @param request.startingToken - (Optional) Starting token for pagination (default: 0)
   * @param request.limit - (Optional) Maximum number of records to return (default: 100)
   * @param request.previousLastRowId - (Optional) Previous last row ID for pagination
   * @param request.logStreamId - (Optional) Log stream ID to filter by
   * @param request.experimentId - (Optional) Experiment ID to filter by
   * @param request.metricsTestingId - (Optional) Metrics testing ID to filter by
   * @param request.filters - (Optional) Array of filter objects to apply
   * @param request.filterTree - (Optional) Complex filter tree structure
   * @param request.sort - (Optional) Sort clause for ordering results
   * @returns Promise resolving to a query response containing matching session records
   */
  public async searchSessions(
    request: LogRecordsQueryRequest
  ): Promise<LogRecordsQueryResponse> {
    this.ensureService(this.traceService);
    return this.traceService!.searchSessions(request);
  }

  /**
   * Retrieve a session by its ID, including all child traces and spans.
   *
   * @param sessionId - The unique identifier of the session to retrieve
   * @returns Promise resolving to the session record with its children
   */
  public async getSession(
    sessionId: string
  ): Promise<ExtendedSessionRecordWithChildren> {
    this.ensureService(this.traceService);
    return this.traceService!.getSession(sessionId);
  }

  /**
   * Delete sessions matching the provided filter criteria.
   *
   * @param options - Delete request object
   * @param options.logStreamId - (Optional) Log stream ID to filter by
   * @param options.experimentId - (Optional) Experiment ID to filter by
   * @param options.metricsTestingId - (Optional) Metrics testing ID to filter by
   * @param options.filters - (Optional) Array of filter objects to identify sessions to delete
   * @param options.filterTree - (Optional) Complex filter tree structure
   * @returns Promise resolving to a response indicating the deletion operation result
   */
  public async deleteSessions(
    options: LogRecordsDeleteRequest
  ): Promise<LogRecordsDeleteResponse> {
    this.ensureService(this.traceService);
    return this.traceService!.deleteSessions(options);
  }

  /**
   * Retrieve a trace by its ID, including all child spans.
   *
   * @param traceId - The unique identifier of the trace to retrieve
   * @returns Promise resolving to the trace record with its children
   */
  public async getTrace(
    traceId: string
  ): Promise<ExtendedTraceRecordWithChildren> {
    this.ensureService(this.traceService);
    return this.traceService!.getTrace(traceId);
  }

  /**
   * Update a trace with new data.
   *
   * @param options - Update request object
   * @param options.traceId - The unique identifier of the trace to update
   * @param options.logStreamId - (Optional) Log stream ID associated with the trace
   * @param options.experimentId - (Optional) Experiment ID associated with the trace
   * @param options.metricsTestingId - (Optional) Metrics testing ID associated with the trace
   * @param options.loggingMethod - (Optional) Logging method to use (default: 'api_direct')
   * @param options.clientVersion - (Optional) Client version identifier
   * @param options.reliable - (Optional) Whether to use reliable logging (default: false)
   * @param options.input - (Optional) New input value to overwrite existing input
   * @param options.output - (Optional) New output value to overwrite existing output
   * @param options.statusCode - (Optional) Status code to overwrite existing status code
   * @param options.tags - (Optional) Tags to add to the trace
   * @returns Promise resolving to the updated trace record
   */
  public async updateTrace(
    options: LogTraceUpdateRequest
  ): Promise<LogTraceUpdateResponse> {
    this.ensureService(this.traceService);
    return this.traceService!.updateTrace(options);
  }

  /**
   * Delete traces matching the provided filter criteria.
   *
   * @param options - Delete request object
   * @param options.logStreamId - (Optional) Log stream ID to filter by
   * @param options.experimentId - (Optional) Experiment ID to filter by
   * @param options.metricsTestingId - (Optional) Metrics testing ID to filter by
   * @param options.filters - (Optional) Array of filter objects to identify traces to delete
   * @param options.filterTree - (Optional) Complex filter tree structure
   * @returns Promise resolving to a response indicating the deletion operation result
   */
  public async deleteTraces(
    options: LogRecordsDeleteRequest
  ): Promise<LogRecordsDeleteResponse> {
    this.ensureService(this.traceService);
    return this.traceService!.deleteTraces(options);
  }

  /**
   * Ingest spans into a trace. Spans represent individual operations or steps within a trace.
   *
   * @param options - Ingest request object
   * @param options.spans - Array of span objects to ingest (AgentSpan, WorkflowSpan, LlmSpan, RetrieverSpan, or ToolSpan)
   * @param options.traceId - The unique identifier of the trace to attach spans to
   * @param options.parentId - The unique identifier of the parent trace or span
   * @param options.logStreamId - (Optional) Log stream ID associated with the spans
   * @param options.experimentId - (Optional) Experiment ID associated with the spans
   * @param options.metricsTestingId - (Optional) Metrics testing ID associated with the spans
   * @param options.loggingMethod - (Optional) Logging method to use (default: 'api_direct')
   * @param options.clientVersion - (Optional) Client version identifier
   * @param options.reliable - (Optional) Whether to use reliable logging (default: false)
   * @returns Promise resolving to a response indicating the ingestion result
   */
  public async ingestSpans(
    options: LogSpansIngestRequest
  ): Promise<LogSpansIngestResponse> {
    this.ensureService(this.traceService);
    return this.traceService!.ingestSpans(options);
  }

  /**
   * Retrieve a span by its ID.
   *
   * @param spanId - The unique identifier of the span to retrieve
   * @returns Promise resolving to the span record
   */
  public async getSpan(spanId: string): Promise<ExtendedSpanRecord> {
    this.ensureService(this.traceService);
    return this.traceService!.getSpan(spanId);
  }

  /**
   * Update a span with new data.
   *
   * @param options - Update request object
   * @param options.spanId - The unique identifier of the span to update
   * @param options.logStreamId - (Optional) Log stream ID associated with the span
   * @param options.experimentId - (Optional) Experiment ID associated with the span
   * @param options.metricsTestingId - (Optional) Metrics testing ID associated with the span
   * @param options.loggingMethod - (Optional) Logging method to use (default: 'api_direct')
   * @param options.clientVersion - (Optional) Client version identifier
   * @param options.reliable - (Optional) Whether to use reliable logging (default: false)
   * @param options.input - (Optional) New input value to overwrite existing input (string or Message array)
   * @param options.output - (Optional) New output value to overwrite existing output (string, Message, or Document array)
   * @param options.tags - (Optional) Tags to add to the span
   * @param options.statusCode - (Optional) Status code to overwrite existing status code
   * @returns Promise resolving to the updated span record
   */
  public async updateSpan(
    options: LogSpanUpdateRequest
  ): Promise<LogSpanUpdateResponse> {
    this.ensureService(this.traceService);
    return this.traceService!.updateSpan(options);
  }

  /**
   * Delete spans matching the provided filter criteria.
   *
   * @param options - Delete request object
   * @param options.logStreamId - (Optional) Log stream ID to filter by
   * @param options.experimentId - (Optional) Experiment ID to filter by
   * @param options.metricsTestingId - (Optional) Metrics testing ID to filter by
   * @param options.filters - (Optional) Array of filter objects to identify spans to delete
   * @param options.filterTree - (Optional) Complex filter tree structure
   * @returns Promise resolving to a response indicating the deletion operation result
   */
  public async deleteSpans(
    options: LogRecordsDeleteRequest
  ): Promise<LogRecordsDeleteResponse> {
    this.ensureService(this.traceService);
    return this.traceService!.deleteSpans(options);
  }

  /**
   * Count the number of traces matching the provided query criteria.
   *
   * @param options - Count request object
   * @param options.logStreamId - (Optional) Log stream ID to filter by
   * @param options.experimentId - (Optional) Experiment ID to filter by
   * @param options.metricsTestingId - (Optional) Metrics testing ID to filter by
   * @param options.filters - (Optional) Array of filter objects to identify traces to count
   * @param options.filterTree - (Optional) Complex filter tree structure
   * @returns Promise resolving to a response containing the total count
   */
  public async countTraces(
    options: LogRecordsQueryCountRequest
  ): Promise<LogRecordsQueryCountResponse> {
    this.ensureService(this.traceService);
    return this.traceService!.countTraces(options);
  }

  /**
   * Count the number of sessions matching the provided query criteria.
   *
   * @param options - Count request object
   * @param options.logStreamId - (Optional) Log stream ID to filter by
   * @param options.experimentId - (Optional) Experiment ID to filter by
   * @param options.metricsTestingId - (Optional) Metrics testing ID to filter by
   * @param options.filters - (Optional) Array of filter objects to identify sessions to count
   * @param options.filterTree - (Optional) Complex filter tree structure
   * @returns Promise resolving to a response containing the total count
   */
  public async countSessions(
    options: LogRecordsQueryCountRequest
  ): Promise<LogRecordsQueryCountResponse> {
    this.ensureService(this.traceService);
    return this.traceService!.countSessions(options);
  }

  /**
   * Count the number of spans matching the provided query criteria.
   *
   * @param options - Count request object
   * @param options.logStreamId - (Optional) Log stream ID to filter by
   * @param options.experimentId - (Optional) Experiment ID to filter by
   * @param options.metricsTestingId - (Optional) Metrics testing ID to filter by
   * @param options.filters - (Optional) Array of filter objects to identify spans to count
   * @param options.filterTree - (Optional) Complex filter tree structure
   * @returns Promise resolving to a response containing the total count
   */
  public async countSpans(
    options: LogRecordsQueryCountRequest
  ): Promise<LogRecordsQueryCountResponse> {
    this.ensureService(this.traceService);
    return this.traceService!.countSpans(options);
  }

  /**
   * Get the list of available columns for traces that can be used in queries and filters.
   *
   * @param options - Request object
   * @param options.logStreamId - (Optional) Log stream ID to get columns for
   * @param options.experimentId - (Optional) Experiment ID to get columns for
   * @param options.metricsTestingId - (Optional) Metrics testing ID to filter by
   * @param options.startTime - (Optional) Start time for filtering columns
   * @param options.endTime - (Optional) End time for filtering columns
   * @returns Promise resolving to a response containing the available columns
   */
  public async getTracesAvailableColumns(
    options: LogRecordsAvailableColumnsRequest
  ): Promise<LogRecordsAvailableColumnsResponse> {
    this.ensureService(this.traceService);
    return this.traceService!.getTracesAvailableColumns(options);
  }

  /**
   * Get the list of available columns for sessions that can be used in queries and filters.
   *
   * @param options - Request object
   * @param options.logStreamId - (Optional) Log stream ID to get columns for
   * @param options.experimentId - (Optional) Experiment ID to get columns for
   * @param options.metricsTestingId - (Optional) Metrics testing ID to filter by
   * @param options.startTime - (Optional) Start time for filtering columns
   * @param options.endTime - (Optional) End time for filtering columns
   * @returns Promise resolving to a response containing the available columns
   */
  public async getSessionsAvailableColumns(
    options: LogRecordsAvailableColumnsRequest
  ): Promise<LogRecordsAvailableColumnsResponse> {
    this.ensureService(this.traceService);
    return this.traceService!.getSessionsAvailableColumns(options);
  }

  /**
   * Get the list of available columns for spans that can be used in queries and filters.
   *
   * @param options - Request object
   * @param options.logStreamId - (Optional) Log stream ID to get columns for
   * @param options.experimentId - (Optional) Experiment ID to get columns for
   * @param options.metricsTestingId - (Optional) Metrics testing ID to filter by
   * @param options.startTime - (Optional) Start time for filtering columns
   * @param options.endTime - (Optional) End time for filtering columns
   * @returns Promise resolving to a response containing the available columns
   */
  public async getSpansAvailableColumns(
    options: LogRecordsAvailableColumnsRequest
  ): Promise<LogRecordsAvailableColumnsResponse> {
    this.ensureService(this.traceService);
    return this.traceService!.getSpansAvailableColumns(options);
  }

  /**
   * Recompute metrics for log records (traces, sessions, or spans) based on the provided filters and scorer IDs.
   * This triggers a background job to recalculate metrics for matching records.
   *
   * @param options - Request object
   * @param options.scorerIds - Array of scorer IDs for which metrics should be recomputed
   * @param options.logStreamId - (Optional) Log stream ID to filter by
   * @param options.experimentId - (Optional) Experiment ID to filter by
   * @param options.metricsTestingId - (Optional) Metrics testing ID to filter by
   * @param options.filters - (Optional) Array of filter objects to identify records for recomputation
   * @param options.filterTree - (Optional) Complex filter tree structure
   * @param options.sort - (Optional) Sort clause for ordering results
   * @param options.limit - (Optional) Maximum number of records to process (default: 100)
   * @param options.startingToken - (Optional) Starting token for pagination (default: 0)
   * @param options.previousLastRowId - (Optional) Previous last row ID for pagination
   * @param options.truncateFields - (Optional) Whether to truncate fields (default: false)
   * @returns Promise resolving to the recomputation job result
   */
  public async recomputeMetrics(
    options: RecomputeLogRecordsMetricsRequest
  ): Promise<unknown> {
    this.ensureService(this.traceService);
    return this.traceService!.recomputeMetrics(options);
  }

  /**
   * Get an aggregated view of traces, providing a graph representation of trace relationships and patterns.
   *
   * @param options - Request object
   * @param options.logStreamId - Log stream ID associated with the traces
   * @param options.filters - (Optional) Array of filter objects to apply (only trace-level filters are supported)
   * @returns Promise resolving to an aggregated trace view with graph data
   */
  public async getAggregatedTraceView(
    options: AggregatedTraceViewRequest
  ): Promise<AggregatedTraceViewResponse> {
    this.ensureService(this.traceService);
    return this.traceService!.getAggregatedTraceView(options);
  }

  // PromptTemplate methods - delegate to PromptTemplateService
  public async getPromptTemplates() {
    this.ensureService(this.promptTemplateService);
    return this.promptTemplateService!.getPromptTemplates();
  }

  public async getPromptTemplate(id: string) {
    this.ensureService(this.promptTemplateService);
    return this.promptTemplateService!.getPromptTemplate(id);
  }

  public async getPromptTemplateVersion(id: string, version: number) {
    this.ensureService(this.promptTemplateService);
    return this.promptTemplateService!.getPromptTemplateVersion(id, version);
  }

  public async getPromptTemplateVersionByName(name: string, version?: number) {
    this.ensureService(this.promptTemplateService);
    return this.promptTemplateService!.getPromptTemplateVersionByName(
      name,
      version
    );
  }

  public async createPromptTemplate(template: Message[], name: string) {
    this.ensureService(this.promptTemplateService);
    return this.promptTemplateService!.createPromptTemplate({
      template,
      name
    });
  }

  /**
   * Stream records from the export endpoint.
   *
   * Defaults to the first log stream available if `logStreamId` and `experimentId` are not provided.
   *
   * Setup (validation, log stream resolution) happens immediately when this function is called.
   * The HTTP request is made immediately when this function is called.
   * Record streaming and line buffering happen when the returned AsyncIterable is iterated.
   *
   * @param params - Export parameters
   * @param params.rootType - The type of records to export (default: 'trace')
   * @param params.filters - Filters to apply to the export
   * @param params.sort - Sort clause to order the exported records (default: { columnId: 'created_at', ascending: false })
   * @param params.exportFormat - The desired format for the exported data (default: 'jsonl')
   * @param params.logStreamId - Filter records by a specific log stream ID
   * @param params.experimentId - Filter records by a specific experiment ID
   * @param params.columnIds - Column IDs to include in the export
   * @param params.redact - Redact sensitive data from the response (default: true)
   * @param params.metricsTestingId - Metrics testing ID associated with the traces
   * @returns A Promise that resolves to an AsyncIterable that yields records based on the export format.
   *   - For JSONL format: Each record is a `string` containing a complete JSONL line (JSON object as string with trailing newline)
   *   - For JSON format: Each record is a `Record<string, unknown>` (parsed JSON object)
   *   - For CSV format: Each record is a `string` containing a complete CSV line (with trailing newline)
   */
  public async exportRecords(
    options: LogRecordsExportRequest
  ): Promise<AsyncIterable<string | Record<string, unknown>>> {
    if (!this.projectId) {
      throw new Error(
        'Client must be initialized with a project before exporting records'
      );
    }

    this.ensureService(this.exportService);
    this.ensureService(this.logStreamService);

    if (!options.logStreamId && !options.experimentId) {
      const logStreams = await this.getLogStreams();
      if (logStreams && logStreams.length > 0) {
        // Sort by created_at and get the first one
        const sortedLogStreams = [...logStreams].sort(
          (a, b) =>
            new Date(a.created_at || 0).getTime() -
            new Date(b.created_at || 0).getTime()
        );

        if (sortedLogStreams.length > 0) {
          options.logStreamId = sortedLogStreams[0].id;
        } else {
          throw new Error(
            'No log stream or experiment ID provided, no existing logstreams found.'
          );
        }
      }
    } else if (options.logStreamId && options.experimentId) {
      throw new Error(
        'Exactly one of logStreamId or experimentId must be provided.'
      );
    }

    return await this.exportService!.records(options);
  }

  // GlobalPromptTemplate methods - delegate to GlobalPromptTemplateService
  public async createGlobalPromptTemplate(template: Message[], name: string) {
    this.ensureService(this.globalPromptTemplateService);
    return this.globalPromptTemplateService!.createGlobalPromptTemplate({
      template,
      name
    });
  }

  public async listGlobalPromptTemplates(
    name_filter: string,
    limit: number,
    starting_token: number
  ) {
    this.ensureService(this.globalPromptTemplateService);
    return this.globalPromptTemplateService!.listGlobalPromptTemplates(
      name_filter,
      limit,
      starting_token
    );
  }

  public async getGlobalPromptTemplate(id: string) {
    this.ensureService(this.globalPromptTemplateService);
    return this.globalPromptTemplateService!.getGlobalPromptTemplate(id);
  }

  public async getGlobalPromptTemplateVersion(id: string, version: number) {
    this.ensureService(this.globalPromptTemplateService);
    return this.globalPromptTemplateService!.getGlobalPromptTemplateVersion(
      id,
      version
    );
  }

  public async deleteGlobalPromptTemplate(id: string) {
    this.ensureService(this.globalPromptTemplateService);
    return this.globalPromptTemplateService!.deleteGlobalPromptTemplate(id);
  }

  public async renderPromptTemplate(
    body: RenderTemplateRequest,
    starting_token: number = 0,
    limit: number = 100
  ): Promise<RenderTemplateResponse> {
    this.ensureService(this.globalPromptTemplateService);
    return this.globalPromptTemplateService!.renderTemplate(
      body,
      starting_token,
      limit
    );
  }

  // Experiment methods - delegate to ExperimentService
  public async getExperiments() {
    this.ensureService(this.experimentService);
    return this.experimentService!.getExperiments();
  }

  public async getExperiment(id: string) {
    this.ensureService(this.experimentService);
    return this.experimentService!.getExperiment(id);
  }

  public async createExperiment(
    name: string,
    dataset?: ExperimentDatasetRequest | null
  ) {
    this.ensureService(this.experimentService);
    return this.experimentService!.createExperiment(name, dataset);
  }

  public async getScorers(options?: {
    type?: ScorerTypes;
    names?: string[];
  }): Promise<Scorer[]> {
    this.ensureService(this.scorerService);
    return this.scorerService!.getScorers(options);
  }

  public async getScorerVersion(
    scorer_id: string,
    version: number
  ): Promise<ScorerVersion> {
    this.ensureService(this.scorerService);
    return this.scorerService!.getScorerVersion(scorer_id, version);
  }

  public async createRunScorerSettings(
    experimentId: string,
    projectId: string,
    scorers: ScorerConfig[]
  ): Promise<void> {
    this.ensureService(this.experimentService);
    return this.experimentService!.createRunScorerSettings(
      experimentId,
      projectId,
      scorers
    );
  }

  public async createPromptRunJob(
    experimentId: string,
    projectId: string,
    promptTemplateVersionId: string,
    datasetId: string,
    scorers?: ScorerConfig[],
    promptSettings?: PromptRunSettings
  ): Promise<CreateJobResponse> {
    this.ensureService(this.experimentService);
    return this.experimentService!.createPromptRunJob(
      experimentId,
      projectId,
      promptTemplateVersionId,
      datasetId,
      scorers,
      promptSettings
    );
  }

  public async createJob(
    projectId: string,
    name: string,
    runId: string,
    datasetId: string,
    promptTemplateId: string,
    taskType: TaskType,
    promptSettings: PromptRunSettings,
    scorers?: ScorerConfig[]
  ): Promise<CreateJobResponse> {
    this.ensureService(this.jobsService);
    return this.jobsService.create(
      projectId,
      name,
      runId,
      datasetId,
      promptTemplateId,
      taskType,
      promptSettings,
      scorers
    );
  }

  public async createScorer(
    name: string,
    scorerType: ScorerTypes,
    description?: string,
    tags?: string[],
    defaults?: ScorerDefaults,
    modelType?: ModelType,
    defaultVersionId?: string,
    scoreableNodeTypes?: StepType[],
    outputType?: OutputType,
    inputType?: InputType
  ): Promise<Scorer> {
    this.ensureService(this.scorerService);
    return this.scorerService!.createScorer(
      name,
      scorerType,
      description,
      tags,
      defaults,
      modelType,
      defaultVersionId,
      scoreableNodeTypes,
      outputType,
      inputType
    );
  }

  public async createLlmScorerVersion(
    scorerId: string,
    instructions?: string,
    chainPollTemplate?: ChainPollTemplate,
    userPrompt?: string,
    cotEnabled?: boolean,
    modelName?: string,
    numJudges?: number
  ): Promise<ScorerVersion> {
    this.ensureService(this.scorerService);
    return this.scorerService!.createLLMScorerVersion(
      scorerId,
      instructions,
      chainPollTemplate,
      userPrompt,
      cotEnabled,
      modelName,
      numJudges
    );
  }

  public async deleteScorer(scorerId: string): Promise<void> {
    this.ensureService(this.scorerService);
    return this.scorerService!.deleteScorer(scorerId);
  }

  public async createCodeScorerVersion(
    scorerId: string,
    codeContent: string
  ): Promise<ScorerVersion> {
    this.ensureService(this.scorerService);
    return this.scorerService!.createCodeScorerVersion(scorerId, codeContent);
  }

  private resolveProjectId(projectId?: string): string {
    const resolvedProjectId = projectId ?? this.projectId;
    if (!resolvedProjectId) {
      throw new Error(
        'Project ID is required for this operation. Provide projectId or initialize the client with one.'
      );
    }

    return resolvedProjectId;
  }

  // Helper to ensure service is initialized
  private ensureService<T>(service: T | undefined): asserts service is T {
    if (!service) {
      // If serviceName is not provided, try to infer it from the constructor name
      const name = (service?.constructor?.name || 'Unknown').replace(
        'Service',
        ''
      );

      throw new Error(`${name} service not initialized. Did you call init()?`);
    }
  }

  // Search methods - delegate to TraceService
  public async searchTraces(
    options: LogRecordsQueryRequest
  ): Promise<LogRecordsQueryResponse> {
    this.ensureService(this.traceService);
    return this.traceService!.searchTraces(options);
  }

  public async searchSpans(
    options: LogRecordsQueryRequest
  ): Promise<LogRecordsQueryResponse> {
    this.ensureService(this.traceService);
    return this.traceService!.searchSpans(options);
  }

  public async searchMetrics(
    options: LogRecordsMetricsQueryRequest
  ): Promise<LogRecordsMetricsResponse> {
    this.ensureService(this.traceService);
    return this.traceService!.searchMetrics(options);
  }

  public async getJob(jobId: string): Promise<Job> {
    this.ensureService(this.jobProgressService);
    return this.jobProgressService!.getJob(jobId);
  }

  // This method maintains backward compatibility but delegates to getRunScorerJobs
  public async getJobsForProjectRun(
    projectId: string,
    runId: string
  ): Promise<Job[]> {
    this.ensureService(this.jobProgressService);
    return this.jobProgressService!.getRunScorerJobs(projectId, runId);
  }

  public async getRunScorerJobs(
    projectId: string,
    runId: string
  ): Promise<Job[]> {
    this.ensureService(this.jobProgressService);
    return this.jobProgressService.getRunScorerJobs(projectId, runId);
  }
}
