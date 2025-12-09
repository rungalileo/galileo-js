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
  InputType,
  ValidateRegisteredScorerResult
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
import {
  ProjectService,
  GlobalProjectService
} from './services/project-service';
import { LogStreamService } from './services/logstream-service';
import {
  PromptTemplateService,
  GlobalPromptTemplateService
} from './services/prompt-template-service';
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
import {
  RenderTemplateRequest,
  RenderTemplateResponse,
  ListPromptTemplateParams,
  GlobalPromptTemplateListOptions,
  ListPromptTemplateResponse
} from '../types/prompt-template.types';
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
  private globalProjectService?: GlobalProjectService;
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

      // Initialize global prompt template service
      this.globalPromptTemplateService = new GlobalPromptTemplateService(
        this.apiUrl,
        this.token,
        this.projectId
      );

      // Initialize global project service (not dependent on projectId)
      this.globalProjectService = new GlobalProjectService(
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
  public async getProjectIdByName(name: string, projectType?: ProjectTypes) {
    this.ensureService(this.globalProjectService);
    return this.globalProjectService!.getProjectIdByName(name, projectType);
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

  // PromptTemplate methods - delegate to PromptTemplateService (project-scoped)
  /**
   * Lists prompt templates scoped to the initialized project.
   *
   * These methods operate on project-scoped templates, which are templates
   * that exist only within a specific project and are not shared across projects.
   * The client must be initialized with a project (via `init({ projectName })`
   * or `init({ projectId })`) before using these methods.
   *
   * **Note:** For global templates (which can be shared across projects but
   * can also be filtered by project), use the `getGlobalPromptTemplate*` methods
   * instead. The global methods (`listGlobalPromptTemplates`, `getGlobalPromptTemplate`,
   * etc.) support optional `projectId` and `projectName` parameters to filter
   * results.
   *
   * @returns A promise that resolves to an array of prompt templates
   *   associated with the initialized project.
   * @throws Error if the client is not initialized with a project or if
   *   the prompt template service is not available.
   */
  public async getPromptTemplates() {
    this.ensureService(this.promptTemplateService);
    return this.promptTemplateService!.getPromptTemplates();
  }

  /**
   * Retrieves a prompt template by ID from the initialized project.
   *
   * This method retrieves project-scoped templates only. For global templates
   * (which can also be filtered by project), use `getGlobalPromptTemplate(id)` instead.
   *
   * @param id - The unique identifier of the template to fetch. Must be
   *   a template ID that exists within the initialized project.
   * @returns A promise that resolves to the prompt template payload containing
   *   template metadata, versions, and associated information.
   * @throws Error if the template is not found in the project, if the client
   *   is not initialized with a project, or if the service is unavailable.
   */
  public async getPromptTemplate(id: string) {
    this.ensureService(this.promptTemplateService);
    return this.promptTemplateService!.getPromptTemplate(id);
  }

  /**
   * Retrieves a specific prompt template version by ID and version number.
   *
   * Templates can have multiple versions. This method fetches a specific
   * version of a project-scoped template within the initialized project.
   * For global templates (which can also be filtered by project), use
   * `getGlobalPromptTemplateVersion(id, version)` instead.
   *
   * @param id - The unique identifier of the template.
   * @param version - The version number to retrieve. Version numbers are
   *   typically sequential integers starting from 1.
   * @returns A promise that resolves to the prompt template version payload,
   *   including the template content, settings, and version metadata.
   * @throws Error if the template or version is not found in the project,
   *   if the client is not initialized with a project, or if the service
   *   is unavailable.
   */
  public async getPromptTemplateVersion(id: string, version: number) {
    this.ensureService(this.promptTemplateService);
    return this.promptTemplateService!.getPromptTemplateVersion(id, version);
  }

  /**
   * Resolves a prompt template by name and fetches the requested version.
   *
   * This method first searches for a project-scoped template by name within
   * the initialized project, then retrieves the specified version. If no version
   * is provided, it returns the currently selected version of the template.
   *
   * For global templates (which can be filtered by project using `projectId`
   * or `projectName` in the options), use `listGlobalPromptTemplates()` with
   * name filtering and project filtering, then `getGlobalPromptTemplateVersion()`.
   *
   * @param name - The name of the template to search for. The search is
   *   performed within the scope of the initialized project.
   * @param version - (Optional) The version number to fetch. If not provided,
   *   defaults to the template's selected version (typically the latest).
   * @returns A promise that resolves to the prompt template version payload.
   * @throws Error if no template with the given name is found in the project,
   *   if the specified version doesn't exist, if the client is not initialized
   *   with a project, or if the service is unavailable.
   */
  public async getPromptTemplateVersionByName(name: string, version?: number) {
    this.ensureService(this.promptTemplateService);
    return this.promptTemplateService!.getPromptTemplateVersionByName(
      name,
      version
    );
  }

  /**
   * Creates a new prompt template scoped to the initialized project.
   *
   * Creates a project-scoped prompt template that is associated with the project
   * the client was initialized with.
   *
   * For global templates (which can be shared across projects but can optionally
   * be associated with a project), use `createGlobalPromptTemplate()` instead,
   * which accepts optional `projectId` or `projectName` parameters.
   *
   * @param template - An array of Message objects representing the template
   *   content. Each message should have a role (e.g., 'user', 'system',
   *   'assistant') and content.
   * @param name - A unique name to assign to the template within the project.
   *   The name should be descriptive and follow your naming conventions.
   * @returns A promise that resolves to the created prompt template payload,
   *   including the assigned ID, version information, and metadata.
   * @throws Error if a template with the same name already exists in the project,
   *   if the client is not initialized with a project, if the service is
   *   unavailable, or if the template data is invalid.
   */
  public async createPromptTemplate(template: Message[], name: string) {
    this.ensureService(this.promptTemplateService);
    return this.promptTemplateService!.createPromptTemplate({
      template,
      name
    });
  }

  /**
   * Builds list request parameters for the global prompt template API.
   * @param options - Base list options.
   * @param options.nameFilter - (Optional) Name filter applied to results.
   * @param options.nameOperator - (Optional) Name comparison operator.
   * @param options.projectId - (Optional) Project ID to include in results.
   * @param options.excludeProjectId - (Optional) Project ID to exclude from results.
   * @param options.sortField - (Optional) Field used for sorting results.
   * @param options.ascending - (Optional) Sort direction flag.
   * @returns A promise that resolves to the generated list parameters.
   */
  private async buildGlobalPromptTemplateListOptions(
    options: GlobalPromptTemplateListOptions
  ): Promise<ListPromptTemplateParams> {
    const filters: NonNullable<ListPromptTemplateParams['filters']> = [];

    if (options.nameFilter) {
      filters.push({
        name: 'name',
        operator: options.nameOperator ?? 'contains',
        value: options.nameFilter
      });
    }

    if (options.projectId) {
      filters.push({
        name: 'used_in_project',
        value: options.projectId
      });
    }

    if (options.excludeProjectId) {
      filters.push({
        name: 'not_in_project',
        value: options.excludeProjectId
      });
    }

    const sortField = options.sortField ?? 'created_at';
    const sortClause: ListPromptTemplateParams['sort'] = {
      name: sortField,
      ascending: options.ascending ?? false,
      sortType: 'column'
    } as ListPromptTemplateParams['sort'];

    return {
      filters: filters.length > 0 ? filters : undefined,
      sort: sortClause
    };
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
  /**
   * Creates a global prompt template, optionally resolving a project by ID or name.
   *
   * If both `projectId` and `projectName` are provided, an error will be thrown.
   * Only one of these parameters should be specified.
   *
   * @param template - Template messages stored in the template.
   * @param name - Name assigned to the template.
   * @param options - (Optional) Project scoping information.
   * @param options.projectId - (Optional) Project ID to associate with the template.
   * @param options.projectName - (Optional) Project name to resolve to an ID.
   * @returns A promise that resolves to the created template payload.
   */
  public async createGlobalPromptTemplate(
    template: Message[],
    name: string,
    options?: { projectId?: string | null; projectName?: string }
  ) {
    this.ensureService(this.globalPromptTemplateService);
    // Resolve projectName to projectId if provided
    const resolvedProjectId = await this.resolveProjectIdOrName(
      options?.projectId ?? undefined,
      options?.projectName
    );

    return this.globalPromptTemplateService!.createGlobalPromptTemplate(
      {
        template,
        name
      },
      resolvedProjectId
    );
  }

  /**
   * Lists global prompt templates using name filter, limit, and pagination token.
   *
   * @overload
   * @param nameFilter - Template name filter. Filters templates by name containing this string.
   * @param limit - Maximum number of templates to fetch per page.
   * @param startingToken - Pagination starting token (default: 0 for first page).
   * @returns A promise that resolves to the list response payload containing templates and pagination info.
   */
  public async listGlobalPromptTemplates(
    nameFilter: string,
    limit: number,
    startingToken: number
  ): Promise<ListPromptTemplateResponse>;

  /**
   * Lists global prompt templates using optional filters and pagination.
   *
   * @overload
   * @param options - (Optional) Options for the list call.
   * @param options.projectId - (Optional) Project ID used to filter results.
   * @param options.projectName - (Optional) Project name resolved to an ID.
   * @param options.nameFilter - (Optional) Template name filter.
   * @param options.nameOperator - (Optional) Operator applied to the name filter.
   * @param options.excludeProjectId - (Optional) Project ID excluded from results.
   * @param options.sortField - (Optional) Field used to sort results.
   * @param options.ascending - (Optional) Sort direction flag.
   * @param options.limit - (Optional) Maximum templates to fetch.
   * @param options.startingToken - (Optional) Pagination starting token.
   * @returns A promise that resolves to the list response payload.
   */
  public async listGlobalPromptTemplates(
    options: GlobalPromptTemplateListOptions
  ): Promise<ListPromptTemplateResponse>;

  public async listGlobalPromptTemplates(
    nameFilterOrOptions?: string | GlobalPromptTemplateListOptions,
    limit?: number,
    startingToken?: number
  ): Promise<ListPromptTemplateResponse> {
    this.ensureService(this.globalPromptTemplateService);

    // Normalize to options object
    const options: GlobalPromptTemplateListOptions =
      typeof nameFilterOrOptions === 'string'
        ? { nameFilter: nameFilterOrOptions, limit, startingToken }
        : (nameFilterOrOptions ?? {});

    const resolvedProjectId = await this.resolveProjectIdOrName(
      options.projectId,
      options.projectName
    );

    const request = await this.buildGlobalPromptTemplateListOptions({
      ...options,
      projectId: resolvedProjectId
    });
    return this.globalPromptTemplateService!.listGlobalPromptTemplates(
      request,
      options.limit,
      options.startingToken
    );
  }

  /**
   * Retrieves a global prompt template by ID.
   * @param id - Template identifier to fetch.
   * @returns A promise that resolves to the prompt template payload.
   */
  public async getGlobalPromptTemplate(id: string) {
    this.ensureService(this.globalPromptTemplateService);
    return this.globalPromptTemplateService!.getGlobalPromptTemplate(id);
  }

  /**
   * Retrieves a global prompt template version by ID.
   * @param id - Template identifier to fetch.
   * @param version - Version number to retrieve.
   * @returns A promise that resolves to the template version payload.
   */
  public async getGlobalPromptTemplateVersion(id: string, version: number) {
    this.ensureService(this.globalPromptTemplateService);
    return this.globalPromptTemplateService!.getGlobalPromptTemplateVersion(
      id,
      version
    );
  }

  /**
   * Deletes a global prompt template by ID.
   * @param id - Template identifier to delete.
   * @returns A promise that resolves when the template is removed.
   */
  public async deleteGlobalPromptTemplate(id: string) {
    this.ensureService(this.globalPromptTemplateService);
    return this.globalPromptTemplateService!.deleteGlobalPromptTemplate(id);
  }

  /**
   * Renames a global prompt template.
   * @param templateId - Template identifier to update.
   * @param name - New template name.
   * @returns A promise that resolves to the updated template payload.
   */
  public async updateGlobalPromptTemplate(templateId: string, name: string) {
    this.ensureService(this.globalPromptTemplateService);
    return this.globalPromptTemplateService!.updateGlobalPromptTemplate({
      templateId,
      name
    });
  }

  /**
   * Renders a global prompt template using dataset or string inputs.
   * @param request - Render template request payload.
   * @param request.template - Template messages to render.
   * @param request.data - Dataset identifier, string input, or structured data.
   * @param startingToken - (Optional) Pagination starting token (default: 0).
   * @param limit - (Optional) Maximum records per page (default: 100).
   * @returns A promise that resolves to the render response payload.
   */
  public async renderPromptTemplate(
    request: RenderTemplateRequest,
    startingToken?: number,
    limit?: number
  ): Promise<RenderTemplateResponse> {
    this.ensureService(this.globalPromptTemplateService);
    return this.globalPromptTemplateService!.renderTemplate(
      request,
      startingToken ?? 0,
      limit ?? 100
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
    codeContent: string,
    validationResult?: string
  ): Promise<ScorerVersion> {
    this.ensureService(this.scorerService);
    return this.scorerService!.createCodeScorerVersion(
      scorerId,
      codeContent,
      validationResult
    );
  }

  public async validateCodeScorerAndWait(
    codeContent: string,
    scoreableNodeTypes: StepType[],
    timeoutMs?: number,
    pollIntervalMs?: number,
    requiredScorers?: string[]
  ): Promise<ValidateRegisteredScorerResult> {
    this.ensureService(this.scorerService);
    return this.scorerService!.validateCodeScorerAndWait(
      codeContent,
      scoreableNodeTypes,
      timeoutMs,
      pollIntervalMs,
      requiredScorers
    );
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

  private async resolveProjectIdOrName(
    projectId?: string,
    projectName?: string
  ): Promise<string | undefined> {
    if (!projectId && !projectName) {
      return undefined;
    }

    if (projectId && projectName) {
      throw new Error('Provide either projectId or projectName, not both');
    }

    if (projectId) {
      return projectId;
    }

    if (projectName) {
      return await this.getProjectIdByName(projectName, this.projectType);
    }

    return undefined;
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
