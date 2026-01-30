/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ScorerConfig,
  ScorerDefaults,
  ScorerTypes,
  ModelType,
  ChainPollTemplate,
  OutputType,
  InputType,
  ValidateRegisteredScorerResult,
  createScorerOptions,
  ScorerResponse,
  CreateScorerRequest,
  ListScorersResponse,
  BaseScorerVersionResponse,
  DeleteScorerResponse
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
  LogTracesIngestResponse,
  Trace
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
import { DatasetService } from './services/dataset-service';
import { TraceService } from './services/trace-service';
import { ExperimentService } from './services/experiment-service';
import type {
  ExperimentUpdateRequest,
  ExperimentMetricsRequest,
  ExperimentMetricsResponse,
  ListExperimentResponse,
  ExperimentsAvailableColumnsResponse
} from '../types/experiment.types';
import { ExperimentTagsService } from './services/experiment-tags-service';
import { ScorerService } from './services/scorer-service';
import { ExportService } from './services/export-service';
import { JobsService } from './services/job-service';
import { JobProgressService } from './services/job-progress-service';
import { RunsService } from './services/runs-service';
import {
  DatasetAppendRow,
  SyntheticDatasetExtensionRequest,
  SyntheticDatasetExtensionResponse,
  JobProgress,
  ListDatasetProjectsResponse,
  ListDatasetResponse,
  ListDatasetParams,
  DatasetFormat,
  DatasetDBType
} from '../types/dataset.types';
import {
  CreateJobResponse,
  ExperimentDatasetRequest,
  PromptRunSettings,
  ExperimentResponseType,
  RunTagDB
} from '../types/experiment.types';
import {
  RenderTemplateRequest,
  RenderTemplateResponse,
  ListPromptTemplateParams,
  GlobalPromptTemplateListOptions,
  ListPromptTemplateResponse
} from '../types/prompt-template.types';
import { JobDbType, TaskType } from '../types/job.types';
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
import { SegmentFilter, RunScorerSettingsResponse } from '../types/runs.types';
import { GalileoConfig } from 'galileo-generated/lib/galileo-config';

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
  public forceInit: boolean = true;
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
  private experimentTagsService?: ExperimentTagsService;
  private scorerService?: ScorerService;
  private exportService?: ExportService;
  private runsService?: RunsService;

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
      projectScoped = defaultParams.projectScoped,
      forceInit = defaultParams.forceInit
    } = params;

    if (this._isClientInitialized(params) && !forceInit) {
      return;
    }

    this.projectType = projectType;

    if (runId) {
      this.runId = runId;
    }

    if (datasetId) {
      this.datasetId = datasetId;
    }

    const config = GalileoConfig.get();
    this.apiUrl = config.getApiUrl(this.projectType);

    if (await this.healthCheck()) {
      // Initialize auth service and get token from config credentials
      this.authService = new AuthService(this.apiUrl);
      this.authService.setCredentials(config.getAuthCredentials());
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
        this.experimentTagsService = new ExperimentTagsService(
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

        this.runsService = new RunsService(
          this.apiUrl,
          this.token,
          this.projectId
        );
      }
    }
  }

  /**
   * Utility function to ensure the Galileo client is initialized.
   * Checks if the client is already initialized before calling init() to avoid redundant initialization.
   * A client is considered initialized if it has:
   * - A projectId (non-empty string) OR is not projectScoped
   * - Either logStreamId or experimentId set (non-empty string)
   *
   * @param client - The GalileoApiClient instance to initialize
   * @param params - Parameters for client initialization
   * @returns Promise that resolves when client is initialized
   */
  private _isClientInitialized(params: {
    projectName?: string;
    projectId?: string;
    logStreamName?: string;
    logStreamId?: string;
    experimentId?: string;
    sessionId?: string;
  }): boolean {
    // Check if client is already initialized
    // Client is initialized if:
    // 1. It has a projectId (non-empty string) OR is not projectScoped
    // 2. It has either logStreamId or experimentId set (non-empty string)
    // Note: We check client properties first, then fall back to params if needed
    const hasProject =
      (this.projectId && this.projectId.trim() !== '') ||
      !this.projectScoped ||
      (params.projectId && params.projectId.trim() !== '');

    const hasLogStreamOrExperiment =
      (this.logStreamId && this.logStreamId.trim() !== '') ||
      (this.experimentId && this.experimentId.trim() !== '') ||
      (params.logStreamId && params.logStreamId.trim() !== '') ||
      (params.experimentId && params.experimentId.trim() !== '');

    // If both conditions are met, client is likely initialized
    // However, if params provide IDs that differ from client's current state, we should re-init
    const needsReinit =
      (params.projectId && params.projectId !== this.projectId) ||
      (params.logStreamId && params.logStreamId !== this.logStreamId) ||
      (params.experimentId && params.experimentId !== this.experimentId);

    return Boolean(hasProject && hasLogStreamOrExperiment && !needsReinit);
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
   * Gets a project by name.
   * @param name - Name of the project to fetch.
   * @param options - (Optional) Additional lookup options.
   * @param options.projectType - (Optional) Project type hint to disambiguate by name.
   * @returns A promise that resolves to the matching project.
   */
  public async getGlobalProjectByName(
    name: string,
    projectType?: ProjectTypes
  ) {
    this.ensureService(this.globalProjectService);
    return this.globalProjectService.getProjectByName(name, projectType);
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
  /**
   * Lists all log streams for the project.
   * @returns A promise that resolves to an array of log streams.
   */
  public async getLogStreams() {
    this.ensureService(this.logStreamService);
    return this.logStreamService!.getLogStreams();
  }

  /**
   * Retrieves a log stream by ID.
   * @param id - The ID of the log stream to retrieve.
   * @returns A promise that resolves to the log stream.
   */
  public async getLogStream(id: string) {
    this.ensureService(this.logStreamService);
    return this.logStreamService!.getLogStream(id);
  }

  /**
   * Retrieves a log stream by name.
   * @param name - The name of the log stream to retrieve.
   * @returns A promise that resolves to the log stream.
   */
  public async getLogStreamByName(name: string) {
    this.ensureService(this.logStreamService);
    return this.logStreamService!.getLogStreamByName(name);
  }

  /**
   * Creates a new log stream.
   * @param name - The name of the log stream to create.
   * @returns A promise that resolves to the created log stream.
   */
  public async createLogStream(name: string) {
    this.ensureService(this.logStreamService);
    return this.logStreamService!.createLogStream(name);
  }

  /**
   * Creates scorer settings for a log stream.
   * @param logStreamId - The ID of the log stream to configure scorers for.
   * @param scorers - Array of scorer configurations to apply.
   * @returns A promise that resolves when the scorer settings are created.
   */
  public async createLogStreamScorerSettings(
    logStreamId: string,
    scorers: ScorerConfig[]
  ): Promise<void> {
    this.ensureService(this.logStreamService);
    return this.logStreamService!.createScorerSettings(logStreamId, scorers);
  }

  // Dataset methods - delegate to DatasetService
  /**
   * Gets all datasets visible to the client.
   * @returns A promise that resolves to the list of datasets.
   */
  public async getDatasets(limit?: number) {
    this.ensureService(this.datasetService);
    return this.datasetService!.getDatasets(limit);
  }

  /**
   * Gets a dataset by ID.
   * @param id - The ID of the dataset to retrieve.
   * @returns A promise that resolves to the dataset.
   */
  public async getDataset(id: string): Promise<DatasetDBType> {
    this.ensureService(this.datasetService);
    return this.datasetService!.getDataset(id);
  }

  /**
   * Gets the ETag for a dataset used for optimistic concurrency control.
   * @param id - The ID of the dataset.
   * @returns A promise that resolves to the dataset ETag.
   */
  public async getDatasetEtag(id: string) {
    this.ensureService(this.datasetService);
    return this.datasetService!.getDatasetEtag(id);
  }

  /**
   * Gets a dataset by name.
   * @param name - The name of the dataset to retrieve.
   * @returns A promise that resolves to the dataset.
   */
  public async getDatasetByName(name: string): Promise<DatasetDBType> {
    this.ensureService(this.datasetService);
    return this.datasetService!.getDatasetByName(name);
  }

  /**
   * @overload
   * Creates a new dataset with a name, file path, and format.
   * @param name - The name of the dataset.
   * @param filePath - The path to the dataset file.
   * @param format - The format of the dataset file.
   * @returns A promise that resolves to the created dataset.
   */
  public async createDataset(
    name: string,
    filePath: string,
    format: DatasetFormat
  ): Promise<any>;
  /**
   * @overload
   * Creates a new dataset from an options object.
   * @param params - The options used to create the dataset.
   * @param params.name - The name of the dataset.
   * @param params.filePath - The path to the dataset file.
   * @param params.format - The format of the dataset file.
   * @param params.projectId - (Optional) The ID of the project that will use the dataset.
   * @returns A promise that resolves to the created dataset.
   */
  public async createDataset(params: {
    name: string;
    filePath: string;
    format: DatasetFormat;
    projectId?: string;
  }): Promise<any>;
  public async createDataset(
    nameOrParams:
      | string
      | {
          name: string;
          filePath: string;
          format: DatasetFormat;
          projectId?: string;
        },
    maybeFilePath?: string,
    maybeFormat?: any
  ): Promise<DatasetDBType> {
    this.ensureService(this.datasetService);

    // Normalize both call signatures into a single params object
    const params =
      typeof nameOrParams === 'string'
        ? {
            name: nameOrParams,
            filePath: maybeFilePath as string,
            format: maybeFormat
          }
        : nameOrParams;

    return this.datasetService!.createDataset(params);
  }

  /**
   * Gets the content of a dataset.
   * @param datasetId - The ID of the dataset.
   * @returns A promise that resolves to the rows of the dataset.
   */
  public async getDatasetContent(datasetId: string) {
    this.ensureService(this.datasetService);
    return this.datasetService!.getDatasetContent(datasetId);
  }

  /**
   * Deletes a dataset by ID.
   * @param datasetId - The ID of the dataset to delete.
   * @returns A promise that resolves when the dataset has been deleted.
   */
  public async deleteDataset(datasetId: string): Promise<void> {
    this.ensureService(this.datasetService);
    return this.datasetService!.deleteDataset(datasetId);
  }

  /**
   * Appends rows to the content of a dataset.
   * @param datasetId - The ID of the dataset.
   * @param etag - The ETag used for optimistic concurrency control.
   * @param rows - The rows to append to the dataset content.
   * @returns A promise that resolves when the rows have been appended.
   */
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

  /**
   * Extends a dataset with synthetically generated data.
   * @param params - Configuration for synthetic dataset generation.
   * @returns A promise that resolves to the synthetic dataset extension response.
   */
  public async extendDataset(
    params: SyntheticDatasetExtensionRequest
  ): Promise<SyntheticDatasetExtensionResponse> {
    this.ensureService(this.datasetService);
    return this.datasetService.extendDataset(params);
  }

  /**
   * Gets the status of a dataset extension job.
   * @param datasetId - The ID of the dataset being extended.
   * @returns A promise that resolves to the job progress.
   */
  public async getExtendDatasetStatus(datasetId: string): Promise<JobProgress> {
    this.ensureService(this.datasetService);
    return this.datasetService!.getExtendDatasetStatus(datasetId);
  }

  /**
   * Queries datasets with filters and pagination options.
   * @param params - The list dataset parameters used to filter datasets.
   * @param query - (Optional) Pagination options for the query.
   * @param query.startingToken - (Optional) The starting token for pagination.
   * @param query.limit - (Optional) The maximum number of datasets to return.
   * @returns A promise that resolves to the list dataset response.
   */
  public async queryDatasets(
    params: ListDatasetParams,
    query?: {
      startingToken?: number;
      limit?: number;
    }
  ): Promise<ListDatasetResponse> {
    this.ensureService(this.datasetService);
    return this.datasetService!.queryDatasets(params, query);
  }

  /**
   * Gets the version history for a dataset.
   * @param datasetId - The ID of the dataset.
   * @returns A promise that resolves to the version history.
   */
  public async getDatasetVersionHistory(datasetId: string) {
    this.ensureService(this.datasetService);
    return this.datasetService!.getDatasetVersionHistory(datasetId);
  }

  /**
   * Gets the content for a specific version of a dataset.
   * @param datasetId - The ID of the dataset.
   * @param versionIndex - The index of the version to retrieve.
   * @returns A promise that resolves to the dataset content for the specified version.
   */
  public async getDatasetVersionContent(
    datasetId: string,
    versionIndex: number
  ) {
    this.ensureService(this.datasetService);
    return this.datasetService!.getDatasetVersionContent(
      datasetId,
      versionIndex
    );
  }

  /**
   * Lists all projects that use a dataset.
   * @param datasetId - The ID of the dataset.
   * @param limit - (Optional) The maximum number of projects to return.
   * @returns A promise that resolves to the list of projects that use the dataset.
   */
  public async listDatasetProjects(
    datasetId: string,
    limit: number = 100
  ): Promise<ListDatasetProjectsResponse> {
    this.ensureService(this.datasetService);
    return this.datasetService.listDatasetProjects(datasetId, limit);
  }

  // Trace methods - delegate to TraceService
  public async ingestTracesLegacy(traces: Trace[]) {
    this.ensureService(this.traceService);
    return this.traceService.ingestTracesLegacy(traces);
  }

  public async ingestTraces(
    options: LogTracesIngestRequest
  ): Promise<LogTracesIngestResponse> {
    this.ensureService(this.traceService);
    return this.traceService.ingestTraces(options);
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
    return this.traceService.createSessionLegacy({
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
    return this.traceService.searchSessions(request);
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
    return this.traceService.getSession(sessionId);
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
    return this.traceService.deleteSessions(options);
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
    return this.traceService.getTrace(traceId);
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
    return this.traceService.updateTrace(options);
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
    return this.traceService.deleteTraces(options);
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
    return this.traceService.ingestSpans(options);
  }

  /**
   * Retrieve a span by its ID.
   *
   * @param spanId - The unique identifier of the span to retrieve
   * @returns Promise resolving to the span record
   */
  public async getSpan(spanId: string): Promise<ExtendedSpanRecord> {
    this.ensureService(this.traceService);
    return this.traceService.getSpan(spanId);
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
    return this.traceService.updateSpan(options);
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
    return this.traceService.deleteSpans(options);
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
    return this.traceService.countTraces(options);
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
            new Date(a.createdAt || 0).getTime() -
            new Date(b.createdAt || 0).getTime()
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
    return this.experimentService.getExperiments();
  }

  public async getExperiment(id: string) {
    this.ensureService(this.experimentService);
    return this.experimentService.getExperiment(id);
  }

  public async createExperiment(
    name: string,
    dataset?: ExperimentDatasetRequest | null
  ) {
    this.ensureService(this.experimentService);
    return this.experimentService.createExperiment(name, dataset);
  }

  /**
   * Lists scorers with optional filtering (backward compatible, use
   * getScorersPage for pagination and limit).
   * @param options - (Optional) The filtering options.
   * @param options.type - (Optional) Filter by a single scorer type.
   * @param options.names - (Optional) Filter by multiple scorer names.
   * @returns A promise that resolves to an array of scorers.
   */
  public async getScorers(options?: {
    type?: ScorerTypes;
    names?: string[];
  }): Promise<ScorerResponse[]> {
    this.ensureService(this.scorerService);
    const response = await this.scorerService.getScorers(options);
    return response.scorers ?? [];
  }

  /**
   * Lists scorers with pagination support.
   * @param options - (Optional) The filtering and pagination options.
   * @param options.name - (Optional) Filter by a single scorer name.
   * @param options.names - (Optional) Filter by multiple scorer names.
   * @param options.types - (Optional) Filter by scorer types.
   * @param options.startingToken - (Optional) The starting token for pagination.
   * @param options.limit - (Optional) The maximum number of scorers to return.
   * @returns A promise that resolves to an object containing scorers and the next starting token.
   */
  public async getScorersPage(options?: {
    name?: string;
    names?: string[];
    types?: ScorerTypes[];
    startingToken?: number;
    limit?: number;
  }): Promise<ListScorersResponse> {
    this.ensureService(this.scorerService);
    return this.scorerService.getScorersPage(options);
  }

  /**
   * Retrieves a specific version of a scorer.
   * @param scorerId - The unique identifier of the scorer.
   * @param version - The version number to retrieve.
   * @returns A promise that resolves to the scorer version.
   */
  public async getScorerVersion(
    scorerId: string,
    version: number
  ): Promise<BaseScorerVersionResponse> {
    this.ensureService(this.scorerService);
    return this.scorerService.getScorerVersion(scorerId, version);
  }

  /**
   * Updates scorer settings for a specific run using PATCH upsert semantics.
   * @param options - The run scorer settings options.
   * @param options.projectId - The unique identifier of the project.
   * @param options.runId - The unique identifier of the run.
   * @param options.scorers - The list of scorer configurations to apply.
   * @param options.segmentFilters - (Optional) The list of segment filters to apply.
   * @returns A promise that resolves to the updated scorer settings response.
   * @throws Error if validation errors occur (HTTP 422) or if the update fails.
   */
  public async updateRunScorerSettings(options: {
    projectId: string;
    runId: string;
    scorers: ScorerConfig[];
    segmentFilters?: SegmentFilter[] | null;
  }): Promise<RunScorerSettingsResponse> {
    this.ensureService(this.runsService);
    return await this.runsService.updateScorerSettings(options);
  }

  /**
   * Creates run scorer settings (backward compatibility method).
   * @param experimentId - The experiment ID (used as runId).
   * @param projectId - The unique identifier of the project.
   * @param scorers - The list of scorer configurations to apply.
   * @returns A promise that resolves when the settings are created.
   * @deprecated Use updateRunScorerSettings instead for new code.
   */
  public async createRunScorerSettings(
    experimentId: string,
    projectId: string,
    scorers: ScorerConfig[]
  ): Promise<void> {
    this.ensureService(this.experimentService);
    return this.experimentService.createRunScorerSettings(
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
    return this.experimentService.createPromptRunJob(
      experimentId,
      projectId,
      promptTemplateVersionId,
      datasetId,
      scorers,
      promptSettings
    );
  }

  /**
   * Updates an experiment.
   * @param id - The unique identifier of the experiment.
   * @param updateRequest - The experiment update request.
   * @returns A promise that resolves to the updated experiment.
   */
  public async updateExperiment(
    id: string,
    updateRequest: ExperimentUpdateRequest
  ): Promise<ExperimentResponseType> {
    this.ensureService(this.experimentService);
    return this.experimentService.updateExperiment(id, updateRequest);
  }

  /**
   * Deletes an experiment.
   * @param id - The unique identifier of the experiment.
   * @returns A promise that resolves when the experiment is deleted.
   */
  public async deleteExperiment(id: string): Promise<void> {
    this.ensureService(this.experimentService);
    return this.experimentService.deleteExperiment(id);
  }

  /**
   * Gets experiment metrics.
   * @param id - The unique identifier of the experiment.
   * @param metricsRequest - The experiment metrics request.
   * @returns A promise that resolves to the experiment metrics response.
   */
  public async getExperimentMetrics(
    id: string,
    projectId: string,
    metricsRequest: ExperimentMetricsRequest
  ): Promise<ExperimentMetricsResponse> {
    this.ensureService(this.experimentService);
    return this.experimentService.getExperimentMetrics(
      id,
      projectId,
      metricsRequest
    );
  }

  /**
   * Gets paginated experiments.
   * @param options - The pagination options.
   * @param options.startingToken - (Optional) The starting token for pagination (default: 0).
   * @param options.limit - (Optional) The maximum number of records to return (default: 100).
   * @param options.includeCounts - (Optional) Whether to include counts (default: false).
   * @returns A promise that resolves to the paginated experiments response.
   */
  public async getExperimentsPaginated(options?: {
    startingToken?: number;
    limit?: number;
    includeCounts?: boolean;
  }): Promise<ListExperimentResponse> {
    this.ensureService(this.experimentService);
    return this.experimentService.getExperimentsPaginated(options);
  }

  /**
   * Gets available columns for experiments.
   * @returns A promise that resolves to the available columns response.
   */
  public async getExperimentsAvailableColumns(): Promise<ExperimentsAvailableColumnsResponse> {
    this.ensureService(this.experimentService);
    return this.experimentService.getAvailableColumns();
  }

  /**
   * Gets all tags for a specific experiment.
   * @param experimentId - The unique identifier of the experiment.
   * @returns A promise that resolves to an array of experiment tags.
   */
  public async getExperimentTags(experimentId: string): Promise<RunTagDB[]> {
    this.ensureService(this.experimentTagsService);
    return this.experimentTagsService.getExperimentTags(experimentId);
  }

  /**
   * Upserts (creates or updates) a tag for a specific experiment.
   * @param experimentId - The unique identifier of the experiment.
   * @param key - The tag key.
   * @param value - The tag value.
   * @param tagType - (Optional) The type of tag (default: 'generic').
   * @returns A promise that resolves to the created or updated tag.
   */
  public async upsertExperimentTag(
    experimentId: string,
    key: string,
    value: string,
    tagType: string = 'generic'
  ): Promise<RunTagDB> {
    this.ensureService(this.experimentTagsService);
    return this.experimentTagsService.upsertExperimentTag(
      experimentId,
      key,
      value,
      tagType
    );
  }

  /**
   * Deletes a tag for a specific experiment.
   * @param experimentId - The unique identifier of the experiment.
   * @param tagId - The unique identifier of the tag to delete.
   * @returns A promise that resolves when the tag is deleted.
   */
  public async deleteExperimentTag(
    experimentId: string,
    tagId: string
  ): Promise<void> {
    this.ensureService(this.experimentTagsService);
    return this.experimentTagsService.deleteExperimentTag(experimentId, tagId);
  }

  public async createJob(options: {
    projectId: string;
    name: string;
    runId: string;
    datasetId: string;
    promptTemplateId: string;
    taskType: TaskType;
    promptSettings: PromptRunSettings;
    scorers?: ScorerConfig[];
  }): Promise<CreateJobResponse> {
    this.ensureService(this.jobsService);
    return this.jobsService.create({
      projectId: options.projectId,
      jobName: options.name,
      runId: options.runId,
      datasetId: options.datasetId,
      promptTemplateVersionId: options.promptTemplateId,
      taskType: options.taskType,
      promptSettings: options.promptSettings,
      scorers: options.scorers
    });
  }

  /**
   * Creates a new scorer.
   * @param options - The scorer creation options.
   * @param options.name - The name of the scorer.
   * @param options.scorerType - The type of the scorer.
   * @param options.description - (Optional) A description for the scorer.
   * @param options.tags - (Optional) Tags to associate with the scorer.
   * @param options.defaults - (Optional) Default settings for the scorer. Required for LLM scorers.
   * @param options.modelType - (Optional) The model type for the scorer.
   * @param options.defaultVersionId - (Optional) The default version ID for the scorer.
   * @param options.scoreableNodeTypes - (Optional) The node types that can be scored.
   * @param options.outputType - (Optional) The output type for the scorer.
   * @param options.inputType - (Optional) The input type for the scorer.
   * @returns A promise that resolves to the created scorer.
   */
  public async createScorer(
    options: createScorerOptions
  ): Promise<ScorerResponse>;

  /**
   * Creates a new scorer.
   * @param name - The name of the scorer.
   * @param scorerType - The type of the scorer.
   * @param description - (Optional) A description for the scorer.
   * @param tags - (Optional) Tags to associate with the scorer.
   * @param defaults - (Optional) Default settings for the scorer. Required for LLM scorers.
   * @param modelType - (Optional) The model type for the scorer.
   * @param defaultVersionId - (Optional) The default version ID for the scorer.
   * @param scoreableNodeTypes - (Optional) The node types that can be scored.
   * @param outputType - (Optional) The output type for the scorer.
   * @param inputType - (Optional) The input type for the scorer.
   * @returns A promise that resolves to the created scorer.
   */
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
  ): Promise<ScorerResponse>;

  public async createScorer(
    nameOrOptions: string | createScorerOptions,
    scorerType?: ScorerTypes,
    description?: string,
    tags?: string[],
    defaults?: ScorerDefaults,
    modelType?: ModelType,
    defaultVersionId?: string,
    scoreableNodeTypes?: StepType[],
    outputType?: OutputType,
    inputType?: InputType
  ): Promise<ScorerResponse> {
    this.ensureService(this.scorerService);

    let requestOptions: CreateScorerRequest;
    if (typeof nameOrOptions === 'object') {
      requestOptions = nameOrOptions;
    } else {
      requestOptions = {
        name: nameOrOptions,
        scorerType: scorerType!,
        description,
        tags,
        defaults,
        modelType,
        defaultVersionId,
        scoreableNodeTypes,
        outputType,
        inputType
      };
    }

    return this.scorerService!.createScorer(requestOptions);
  }

  /**
   * Creates a new LLM scorer version.
   * @param scorerId - The unique identifier of the scorer.
   * @param options - The LLM scorer version creation options.
   * @param options.instructions - (Optional) Instructions for the LLM scorer.
   * @param options.chainPollTemplate - (Optional) Chain poll template configuration.
   * @param options.userPrompt - (Optional) User prompt for the LLM scorer.
   * @param options.cotEnabled - (Optional) Whether chain-of-thought is enabled.
   * @param options.modelName - (Optional) The model name to use.
   * @param options.numJudges - (Optional) The number of judges for consensus.
   * @returns A promise that resolves to the created scorer version.
   */
  public async createLlmScorerVersion(
    scorerId: string,
    options: {
      instructions?: string;
      chainPollTemplate?: ChainPollTemplate;
      userPrompt?: string;
      cotEnabled?: boolean;
      modelName?: string;
      numJudges?: number;
    }
  ): Promise<BaseScorerVersionResponse>;

  /**
   * Creates a new LLM scorer version.
   * @param scorerId - The unique identifier of the scorer.
   * @param instructions - (Optional) Instructions for the LLM scorer.
   * @param chainPollTemplate - (Optional) Chain poll template configuration.
   * @param userPrompt - (Optional) User prompt for the LLM scorer.
   * @param cotEnabled - (Optional) Whether chain-of-thought is enabled.
   * @param modelName - (Optional) The model name to use.
   * @param numJudges - (Optional) The number of judges for consensus.
   * @returns A promise that resolves to the created scorer version.
   */
  public async createLlmScorerVersion(
    scorerId: string,
    instructions?: string,
    chainPollTemplate?: ChainPollTemplate,
    userPrompt?: string,
    cotEnabled?: boolean,
    modelName?: string,
    numJudges?: number
  ): Promise<BaseScorerVersionResponse>;

  public async createLlmScorerVersion(
    scorerId: string,
    instructionsOrOptions?:
      | string
      | {
          instructions?: string;
          chainPollTemplate?: ChainPollTemplate;
          userPrompt?: string;
          cotEnabled?: boolean;
          modelName?: string;
          numJudges?: number;
        },
    chainPollTemplate?: ChainPollTemplate,
    userPrompt?: string,
    cotEnabled?: boolean,
    modelName?: string,
    numJudges?: number
  ): Promise<BaseScorerVersionResponse> {
    this.ensureService(this.scorerService);

    // Parse input into a single options object
    const options =
      typeof instructionsOrOptions === 'object'
        ? instructionsOrOptions
        : {
            instructions: instructionsOrOptions,
            chainPollTemplate,
            userPrompt,
            cotEnabled,
            modelName,
            numJudges
          };

    return this.scorerService!.createLLMScorerVersion(scorerId, options);
  }

  /**
   * Deletes a scorer by its unique identifier.
   * @param scorerId - The unique identifier of the scorer to delete.
   * @returns A promise that resolves to a response containing a success message.
   */
  public async deleteScorer(scorerId: string): Promise<DeleteScorerResponse> {
    this.ensureService(this.scorerService);
    return this.scorerService!.deleteScorer(scorerId);
  }

  /**
   * Creates a code-based scorer version.
   * @param scorerId - The unique identifier of the scorer.
   * @param codeContent - The Python code content for the scorer.
   * @param validationResult - (Optional) The validation result JSON string.
   * @returns A promise that resolves to the created scorer version.
   */
  public async createCodeScorerVersion(
    scorerId: string,
    codeContent: string,
    validationResult?: string
  ): Promise<BaseScorerVersionResponse> {
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

  public async getJob(jobId: string): Promise<JobDbType> {
    this.ensureService(this.jobProgressService);
    return this.jobProgressService.getJob(jobId);
  }

  // This method maintains backward compatibility but delegates to getRunScorerJobs
  public async getJobsForProjectRun(
    projectId: string,
    runId: string
  ): Promise<JobDbType[]> {
    this.ensureService(this.jobProgressService);
    return this.jobProgressService.getRunScorerJobs(projectId, runId);
  }

  public async getRunScorerJobs(
    projectId: string,
    runId: string
  ): Promise<JobDbType[]> {
    this.ensureService(this.jobProgressService);
    return this.jobProgressService.getRunScorerJobs(projectId, runId);
  }
}
