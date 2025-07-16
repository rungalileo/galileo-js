/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Scorer,
  ScorerConfig,
  ScorerDefaults,
  ScorerTypes,
  ScorerVersion,
  ModelType,
  ChainPollTemplate
} from '../types/scorer.types';
import { ProjectTypes } from '../types/project.types';
import { BaseClient } from './base-client';
import { AuthService } from './services/auth-service';
import { ProjectService } from './services/project-service';
import { LogStreamService } from './services/logstream-service';
import {
  PromptTemplateService,
  GlobalPromptTemplateService
} from './services/prompt-template-service';
import { DatasetService, DatasetAppendRow } from './services/dataset-service';
import { TraceService } from './services/trace-service';
import { ExperimentService } from './services/experiment-service';
import { ScorerService } from './services/scorer-service';
import { JobService } from './services/job-service';
import { RunService } from './services/run-service';
import { SessionCreateResponse } from '../types/log.types';
import {
  CreateJobResponse,
  PromptRunSettings
} from '../types/experiment.types';
import {
  RunScorerSettingsResponse,
  SegmentFilter
} from '../types/run.types';
import { Message } from '../types/message.types';
import {
  MetricSearchRequest,
  MetricSearchResponse
} from '../types/search.types';
import {
  LogRecordsQueryRequest,
  LogRecordsQueryResponse
} from '../types/search.types';

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
  private jobService?: JobService;
  private authService?: AuthService;
  private projectService?: ProjectService;
  private logStreamService?: LogStreamService;
  private promptTemplateService?: PromptTemplateService;
  private globalPromptTemplateService?: GlobalPromptTemplateService;
  private datasetService?: DatasetService;
  private traceService?: TraceService;
  private experimentService?: ExperimentService;
  private scorerService?: ScorerService;
  private runService?: RunService;

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
              const project =
                await this.projectService.createProject(projectName);
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
        this.jobService = new JobService(this.apiUrl, this.token, this.projectId);
        this.scorerService = new ScorerService(this.apiUrl, this.token);
        this.runService = new RunService(this.apiUrl, this.token, this.projectId);
      }
    }
  }

  // Project methods - delegate to ProjectService
  public async getProjects() {
    this.ensureService(this.projectService);
    return this.projectService!.getProjects();
  }

  public async getProject(id: string) {
    this.ensureService(this.projectService);
    return this.projectService!.getProject(id);
  }

  public async getProjectByName(name: string) {
    this.ensureService(this.projectService);
    return this.projectService!.getProjectByName(name);
  }

  public async getProjectIdByName(name: string) {
    this.ensureService(this.projectService);
    return this.projectService!.getProjectIdByName(name);
  }

  public async createProject(name: string) {
    this.ensureService(this.projectService);
    return this.projectService!.createProject(name);
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

  // Trace methods - delegate to TraceService
  public async ingestTraces(traces: any[]) {
    this.ensureService(this.traceService);
    return this.traceService!.ingestTraces(traces);
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
    this.ensureService(this.traceService);
    return this.traceService!.createSession({
      name,
      previousSessionId,
      externalId
    });
  }

  public async searchTraces(
    request: LogRecordsQueryRequest
  ): Promise<LogRecordsQueryResponse> {
    this.ensureService(this.traceService);
    return this.traceService!.searchTraces(request);
  }

  public async searchSpans(
    request: LogRecordsQueryRequest
  ): Promise<LogRecordsQueryResponse> {
    this.ensureService(this.traceService);
    return this.traceService!.searchSpans(request);
  }

  public async searchSessions(
    request: LogRecordsQueryRequest
  ): Promise<LogRecordsQueryResponse> {
    this.ensureService(this.traceService);
    return this.traceService!.searchSessions(request);
  }

  public async searchMetrics(
    request: MetricSearchRequest
  ): Promise<MetricSearchResponse> {
    this.ensureService(this.traceService);
    return this.traceService!.searchMetrics(request);
  }

  // Job methods - delegate to JobService
  public async getJob(jobId: string): Promise<any> {
    this.ensureService(this.jobService);
    return this.jobService!.getJob(jobId);
  }

  public async getJobsForProjectRun(
    runId: string,
    status?: string
  ): Promise<any[]> {
    this.ensureService(this.jobService);
    return this.jobService!.getJobsForProjectRun(runId, status);
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

  // Experiment methods - delegate to ExperimentService
  public async getExperiments() {
    this.ensureService(this.experimentService);
    return this.experimentService!.getExperiments();
  }

  public async getExperiment(id: string) {
    this.ensureService(this.experimentService);
    return this.experimentService!.getExperiment(id);
  }

  public async createExperiment(name: string) {
    this.ensureService(this.experimentService);
    return this.experimentService!.createExperiment(name);
  }

  public async getScorers(type?: ScorerTypes): Promise<Scorer[]> {
    this.ensureService(this.scorerService);
    return this.scorerService!.getScorers(type);
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

  public async updateRunScorerSettings(
    runId: string,
    scorers: ScorerConfig[],
    segmentFilters?: SegmentFilter[]
  ): Promise<RunScorerSettingsResponse> {
    this.ensureService(this.runService);
    return this.runService!.updateScorerSettings(
      runId,
      scorers,
      segmentFilters
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

  public async createScorer(
    name: string,
    scorerType: ScorerTypes,
    description?: string,
    tags?: string[],
    defaults?: ScorerDefaults,
    modelType?: ModelType,
    defaultVersionId?: string
  ): Promise<Scorer> {
    this.ensureService(this.scorerService);
    return this.scorerService!.createScorer(
      name,
      scorerType,
      description,
      tags,
      defaults,
      modelType,
      defaultVersionId
    );
  }

  public async createLlmScorerVersion(
    scorerId: string,
    instructions: string,
    chainPollTemplate: ChainPollTemplate,
    modelName?: string,
    numJudges?: number
  ): Promise<ScorerVersion> {
    this.ensureService(this.scorerService);
    return this.scorerService!.createLLMScorerVersion(
      scorerId,
      instructions,
      chainPollTemplate,
      modelName,
      numJudges
    );
  }

  public async deleteScorer(scorerId: string): Promise<void> {
    this.ensureService(this.scorerService);
    return this.scorerService!.deleteScorer(scorerId);
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
}
