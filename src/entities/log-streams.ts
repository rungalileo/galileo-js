import { LogStreamType } from '../types/log-stream.types';
import { GalileoApiClient } from '../api-client';
import {
  GalileoMetrics,
  LocalMetricConfig,
  Metric
} from '../types/metrics.types';
import { Metrics } from '../utils/metrics';
import { Projects } from '../utils/projects';

/**
 * Represents a log stream instance with instance methods.
 */
export class LogStream {
  public id: string;
  public name: string;
  public projectId: string;
  public createdAt?: string;
  public updatedAt?: string;
  public createdBy?: string | null;
  public hasUserCreatedSessions?: boolean;

  constructor(logStream: LogStreamType) {
    this.id = logStream.id;
    this.name = logStream.name;
    this.projectId = logStream.projectId;
    this.createdAt = logStream.createdAt;
    this.updatedAt = logStream.updatedAt;
    this.createdBy = logStream.createdBy;
    this.hasUserCreatedSessions = logStream.hasUserCreatedSessions;
  }

  /**
   * Enables metrics directly on this log stream instance.
   * @param metrics - List of metrics to enable on this log stream. Can include GalileoMetrics const object values, string names, Metric objects, or LocalMetricConfig objects with scorerFn for client-side scoring.
   * @returns A promise that resolves to the list of local metric configurations that need client-side processing.
   */
  public async enableMetrics(
    metrics: (GalileoMetrics | Metric | LocalMetricConfig | string)[]
  ): Promise<LocalMetricConfig[]> {
    if (!metrics || metrics.length === 0) {
      throw new Error('At least one metric must be provided');
    }

    const [, localMetrics] = await new Metrics().createMetricConfigs(
      this.projectId,
      this.id,
      metrics
    );
    return localMetrics;
  }
}

/**
 * Class for managing log streams in the Galileo platform.
 * Contains all implementation logic for log stream operations.
 */
export class LogStreams {
  /**
   * Lists all log streams for a project.
   * @param options - The options for listing log streams.
   * @param options.projectId - (Optional) The ID of the project.
   * @param options.projectName - (Optional) The name of the project.
   * @returns A promise that resolves to an array of log streams.
   */
  public async list(options: {
    projectId?: string;
    projectName?: string;
  }): Promise<LogStream[]> {
    let projectId = options.projectId;
    let projectName = options.projectName;

    // Apply environment variable fallbacks
    projectId = projectId ?? process.env.GALILEO_PROJECT_ID;
    projectName = projectName ?? process.env.GALILEO_PROJECT;

    if (!projectId && !projectName) {
      throw new Error(
        'Either projectId or projectName must be provided, or set GALILEO_PROJECT_ID or GALILEO_PROJECT environment variable'
      );
    }

    if (projectId && projectName) {
      throw new Error('Provide only one of projectId or projectName');
    }

    const apiClient = new GalileoApiClient();
    if (projectId) {
      await apiClient.init({ projectScoped: true, projectId });
    } else {
      await apiClient.init({ projectScoped: true, projectName });
    }

    const logStreams = await apiClient.getLogStreams();
    return logStreams.map((ls) => new LogStream(ls));
  }

  /**
   * Retrieves a log stream by ID or name.
   * @param options - The options for retrieving a log stream.
   * @param options.id - (Optional) The ID of the log stream.
   * @param options.name - (Optional) The name of the log stream.
   * @param options.projectId - (Optional) The ID of the project.
   * @param options.projectName - (Optional) The name of the project.
   * @returns A promise that resolves to the log stream, or undefined if not found.
   */
  public async get(options: {
    id?: string;
    name?: string;
    projectId?: string;
    projectName?: string;
  }): Promise<LogStream | undefined> {
    if (!options.id && !options.name) {
      throw new Error('Either id or name must be provided');
    }

    if (options.id && options.name) {
      throw new Error('Provide only one of id or name');
    }

    // Apply environment variable fallbacks
    const projectId = options.projectId ?? process.env.GALILEO_PROJECT_ID;
    const projectName = options.projectName ?? process.env.GALILEO_PROJECT;

    if (!projectId && !projectName) {
      throw new Error(
        'Either projectId or projectName must be provided, or set GALILEO_PROJECT_ID or GALILEO_PROJECT environment variable'
      );
    }

    if (projectId && projectName) {
      throw new Error('Provide only one of projectId or projectName');
    }

    const apiClient = new GalileoApiClient();
    if (projectId) {
      await apiClient.init({ projectScoped: true, projectId });
    } else {
      await apiClient.init({ projectScoped: true, projectName });
    }

    let logStream: LogStreamType | undefined;
    if (options.id) {
      logStream = await apiClient.getLogStream(options.id);
    } else if (options.name) {
      logStream = await apiClient.getLogStreamByName(options.name);
    }

    return logStream ? new LogStream(logStream) : undefined;
  }

  /**
   * Creates a new log stream.
   * @param name - The name of the log stream.
   * @param options - (Optional) The options for creating the log stream.
   * @param options.projectId - (Optional) The ID of the project.
   * @param options.projectName - (Optional) The name of the project.
   * @returns A promise that resolves to the created log stream.
   */
  public async create(
    name: string,
    options?: {
      projectId?: string;
      projectName?: string;
    }
  ): Promise<LogStream> {
    let projectId = options?.projectId;
    let projectName = options?.projectName;

    // Apply environment variable fallbacks
    projectId = projectId ?? process.env.GALILEO_PROJECT_ID;
    projectName = projectName ?? process.env.GALILEO_PROJECT;

    if (!projectId && !projectName) {
      throw new Error(
        'Either projectId or projectName must be provided, or set GALILEO_PROJECT_ID or GALILEO_PROJECT environment variable'
      );
    }

    if (projectId && projectName) {
      throw new Error('Provide only one of projectId or projectName');
    }

    const apiClient = new GalileoApiClient();
    if (projectId) {
      await apiClient.init({ projectScoped: true, projectId });
    } else {
      await apiClient.init({ projectScoped: true, projectName });
    }

    const logStream = await apiClient.createLogStream(name);
    return new LogStream(logStream);
  }

  /**
   * Enables metrics for a log stream.
   * @param options - The options for enabling metrics.
   * @param options.logStreamName - (Optional) The name of the log stream.
   * @param options.projectName - (Optional) The name of the project.
   * @param options.metrics - List of metrics to enable. Can include GalileoMetrics const object values, string names, Metric objects, or LocalMetricConfig objects with scorerFn for client-side scoring.
   * @returns A promise that resolves to the list of local metric configurations that need client-side processing.
   */
  public async enableMetrics(options: {
    logStreamName?: string;
    projectName?: string;
    metrics: (GalileoMetrics | Metric | LocalMetricConfig | string)[];
  }): Promise<LocalMetricConfig[]> {
    if (!options.metrics || options.metrics.length === 0) {
      throw new Error('At least one metric must be provided');
    }

    // Apply environment variable fallbacks
    const finalProjectName =
      options.projectName ??
      process.env.GALILEO_PROJECT ??
      process.env.GALILEO_PROJECT_NAME;
    const finalLogStreamName =
      options.logStreamName ??
      process.env.GALILEO_LOG_STREAM ??
      process.env.GALILEO_LOG_STREAM_NAME;

    if (!finalProjectName) {
      throw new Error(
        'Project name must be provided via projectName parameter or GALILEO_PROJECT/GALILEO_PROJECT_NAME environment variable'
      );
    }

    if (!finalLogStreamName) {
      throw new Error(
        'Log stream name must be provided via logStreamName parameter or GALILEO_LOG_STREAM/GALILEO_LOG_STREAM_NAME environment variable'
      );
    }

    // Get project using environment fallbacks
    const project = await new Projects().getWithEnvFallbacks({
      name: finalProjectName
    });
    if (!project || !project.id) {
      throw new Error(`Project '${finalProjectName}' not found`);
    }

    // Get log stream
    const logStream = await this.get({
      name: finalLogStreamName,
      projectName: finalProjectName
    });
    if (!logStream || !logStream.id) {
      throw new Error(
        `Log stream '${finalLogStreamName}' not found in project '${finalProjectName}'`
      );
    }

    // Create metric configurations
    const [, localMetrics] = await new Metrics().createMetricConfigs(
      project.id,
      logStream.id,
      options.metrics
    );
    return localMetrics;
  }
}
