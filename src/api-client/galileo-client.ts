/* eslint-disable @typescript-eslint/no-explicit-any */
import { ProjectTypes } from '../types/project.types';
import { BaseClient } from './base-client';
import { AuthService } from './services/auth-service';
import { ProjectService } from './services/project-service';
import { LogStreamService } from './services/logstream-service';
import { PromptTemplateService } from './services/prompt-template-service';
import { DatasetService } from './services/dataset-service';
import { TraceService } from './services/trace-service';

export class GalileoApiClientParams {
  public projectType: ProjectTypes = ProjectTypes.genAI;
  public projectName?: string | undefined = process.env.GALILEO_PROJECT;
  public projectId?: string | undefined = undefined;
  public logStreamName?: string | undefined = process.env.GALILEO_LOG_STREAM;
  public logStreamId?: string | undefined = undefined;
  public runId?: string | undefined = undefined;
  public datasetId?: string | undefined = undefined;
}

export class GalileoApiClient extends BaseClient {
  public projectType: ProjectTypes = ProjectTypes.genAI;
  public projectId: string = '';
  public logStreamId: string = '';
  public runId: string = '';
  public datasetId: string = '';

  // Service instances
  private authService?: AuthService;
  private projectService?: ProjectService;
  private logStreamService?: LogStreamService;
  private promptTemplateService?: PromptTemplateService;
  private datasetService?: DatasetService;
  private traceService?: TraceService;

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
      datasetId = defaultParams.datasetId
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
          console.log(`✅ Using ${projectName}`);
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

      if (logStreamId) {
        this.logStreamId = logStreamId;
      } else if (logStreamName) {
        try {
          const logStream =
            await this.logStreamService.getLogStreamByName(logStreamName);
          this.logStreamId = logStream.id;
          // eslint-disable-next-line no-console
          console.log(`✅ Using ${logStreamName}`);
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

      // Initialize dataset and trace services
      this.datasetService = new DatasetService(this.apiUrl, this.token);
      this.traceService = new TraceService(
        this.apiUrl,
        this.token,
        this.projectId,
        this.logStreamId
      );

      this.promptTemplateService = new PromptTemplateService(
        this.apiUrl,
        this.token,
        this.projectId
      );

      console.log('🚀 ~ GalileoApiClient ~ this.projectId:', this.projectId);
    }
  }

  // Project methods - delegate to ProjectService
  public async getProjects() {
    this.ensureService(this.projectService, 'Project');
    return this.projectService!.getProjects();
  }

  public async getProject(id: string) {
    this.ensureService(this.projectService, 'Project');
    return this.projectService!.getProject(id);
  }

  public async getProjectByName(name: string) {
    this.ensureService(this.projectService, 'Project');
    return this.projectService!.getProjectByName(name);
  }

  public async getProjectIdByName(name: string) {
    this.ensureService(this.projectService, 'Project');
    return this.projectService!.getProjectIdByName(name);
  }

  public async createProject(name: string) {
    this.ensureService(this.projectService, 'Project');
    return this.projectService!.createProject(name);
  }

  // LogStream methods - delegate to LogStreamService
  public async getLogStreams() {
    this.ensureService(this.logStreamService, 'LogStream');
    return this.logStreamService!.getLogStreams();
  }

  public async getLogStream(id: string) {
    this.ensureService(this.logStreamService, 'LogStream');
    return this.logStreamService!.getLogStream(id);
  }

  public async getLogStreamByName(name: string) {
    this.ensureService(this.logStreamService, 'LogStream');
    return this.logStreamService!.getLogStreamByName(name);
  }

  public async createLogStream(name: string) {
    this.ensureService(this.logStreamService, 'LogStream');
    return this.logStreamService!.createLogStream(name);
  }

  // Dataset methods - delegate to DatasetService
  public async getDatasets() {
    this.ensureService(this.datasetService, 'Dataset');
    return this.datasetService!.getDatasets();
  }

  public async getDataset(id: string) {
    this.ensureService(this.datasetService, 'Dataset');
    return this.datasetService!.getDataset(id);
  }

  public async getDatasetByName(name: string) {
    this.ensureService(this.datasetService, 'Dataset');
    return this.datasetService!.getDatasetByName(name);
  }

  public async createDataset(name: string, filePath: string, format: any) {
    this.ensureService(this.datasetService, 'Dataset');
    return this.datasetService!.createDataset(name, filePath, format);
  }

  public async getDatasetContent(datasetId: string) {
    this.ensureService(this.datasetService, 'Dataset');
    return this.datasetService!.getDatasetContent(datasetId);
  }

  // Trace methods - delegate to TraceService
  public async ingestTraces(traces: any[]) {
    this.ensureService(this.traceService, 'Trace');
    return this.traceService!.ingestTraces(traces);
  }

  // PromptTemplate methods - delegate to PromptTemplateService
  public async getPromptTemplates() {
    this.ensureService(this.promptTemplateService, 'PromptTemplate');
    return this.promptTemplateService!.getPromptTemplates();
  }

  public async createPromptTemplate(
    template: string,
    version: string,
    name: string
  ) {
    console.log('🚀 ~ GalileoApiClient ~ template:', template);
    this.ensureService(this.promptTemplateService, 'PromptTemplate');
    return this.promptTemplateService!.createPromptTemplate({
      template,
      version,
      name
    });
  }

  // Helper to ensure service is initialized
  private ensureService(service: any, serviceName: string): void {
    if (!service) {
      throw new Error(
        `${serviceName} service not initialized. Did you call init()?`
      );
    }
  }
}
