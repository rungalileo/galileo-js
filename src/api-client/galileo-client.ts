/* eslint-disable @typescript-eslint/no-explicit-any */
import { Scorer, ScorerTypes } from '../types/scorer.types';
import { ProjectTypes } from '../types/project.types';
import { BaseClient } from './base-client';
import { AuthService } from './services/auth-service';
import { ProjectService } from './services/project-service';
import { ProtectService } from './services/protect-service';
import { LogStreamService } from './services/logstream-service';
import { PromptTemplateService } from './services/prompt-template-service';
import { DatasetService, DatasetAppendRow } from './services/dataset-service';
import { TraceService } from './services/trace-service';
import { ExperimentService } from './services/experiment-service';
import { StageService } from './services/stage-service';
import { SessionCreateResponse } from '../types/log.types';
import {
  CreateJobResponse,
  PromptRunSettings
} from '../types/experiment.types';
import {
  Request,
} from '../types/protect.types';
import { Message } from '../types/message.types';
import {
  StageDB,
  StageCreationPayload,
  GetStageParams,
  UpdateStagePayload,
} from '../types/stage.types';

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
  private authService?: AuthService;
  private projectService?: ProjectService;
  private protectService?: ProtectService;
  private logStreamService?: LogStreamService;
  private promptTemplateService?: PromptTemplateService;
  private datasetService?: DatasetService;
  private traceService?: TraceService;
  private experimentService?: ExperimentService;
  private stageService?: StageService;

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
        this.protectService = new ProtectService(
          this.apiUrl,
          this.token,
          this.projectId
        );
        this.stageService = new StageService(
          this.apiUrl,
          this.token,
          this.projectId,
        );
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

  public async appendRowsToDatasetContent(
    datasetId: string,
    rows: DatasetAppendRow[]
  ): Promise<void> {
    this.ensureService(this.datasetService);
    return this.datasetService!.appendRowsToDatasetContent(datasetId, rows);
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
    this.ensureService(this.experimentService);
    return this.experimentService!.getScorers(type);
  }

  public async createRunScorerSettings(
    experimentId: string,
    projectId: string,
    scorers: Scorer[]
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
    scorers?: Scorer[],
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

  // Protect methods - delegate to ProtectService
  public async invoke(request: Request) {
    this.ensureService(this.protectService);
    return this.protectService!.invoke(request);
  }

  // Stage methods - delegate to StageService
  public async createStage(payload: StageCreationPayload): Promise<StageDB> {
    this.ensureService(this.stageService);
    this.ensureProjectId();
    return this.stageService!.createStage(this.projectId, payload);
  }

  public async getStage(params: GetStageParams): Promise<StageDB> {
    this.ensureService(this.stageService);
    this.ensureProjectId();
    return this.stageService!.getStage(this.projectId, params);
  }

  public async updateStage(
    stageId: string,
    payload: UpdateStagePayload,
  ): Promise<StageDB> {
    this.ensureService(this.stageService);
    this.ensureProjectId();
    return this.stageService!.updateStage(this.projectId, stageId, payload);
  }

  public async pauseStage(stageId: string): Promise<StageDB> {
    this.ensureService(this.stageService);
    this.ensureProjectId();
    return this.stageService!.pauseStage(this.projectId, stageId);
  }

  public async resumeStage(stageId: string): Promise<StageDB> {
    this.ensureService(this.stageService);
    this.ensureProjectId();
    return this.stageService!.resumeStage(this.projectId, stageId);
  }

  // Helper to ensure projectId is available for stage operations
  private ensureProjectId(): void {
    if (!this.projectId) {
      throw new Error(
        'Project ID is not set. Ensure GalileoApiClient is initialized with a project context for stage operations.',
      );
    }
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
