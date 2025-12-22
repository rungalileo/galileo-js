import { BaseClient, RequestMethod } from '../base-client';
import {
  LogStreamType,
  LogStreamTypeOpenAPI
} from '../../types/log-stream.types';
import { Routes } from '../../types/routes.types';
import { ScorerConfig } from '../../types/scorer.types';

/**
 * Service class for managing log streams in the Galileo platform.
 */
export class LogStreamService extends BaseClient {
  private projectId: string;

  /**
   * Creates a new LogStreamService instance.
   * @param apiUrl - The base URL for the Galileo API.
   * @param token - The authentication token.
   * @param projectId - The ID of the project to manage log streams for.
   */
  constructor(apiUrl: string, token: string, projectId: string) {
    super();
    this.apiUrl = apiUrl;
    this.token = token;
    this.projectId = projectId;
    this.initializeClient();
  }

  /**
   * Retrieves all log streams for the project.
   * @returns A promise that resolves to an array of log streams.
   */
  public async getLogStreams(): Promise<LogStreamType[]> {
    if (!this.projectId) {
      throw new Error('Project ID not set');
    }

    const response = await this.makeRequest<LogStreamTypeOpenAPI[]>(
      RequestMethod.GET,
      Routes.logStreams,
      null,
      { project_id: this.projectId }
    );

    return response.map((logstream: LogStreamTypeOpenAPI) =>
      this.convertToCamelCase<LogStreamTypeOpenAPI, LogStreamType>(logstream)
    );
  }

  /**
   * Retrieves a log stream by ID.
   * @param id - The ID of the log stream to retrieve.
   * @returns A promise that resolves to the log stream.
   */
  public async getLogStream(id: string): Promise<LogStreamType> {
    const response = await this.makeRequest<LogStreamTypeOpenAPI>(
      RequestMethod.GET,
      Routes.logStream,
      null,
      { project_id: this.projectId, log_stream_id: id }
    );

    return this.convertToCamelCase<LogStreamTypeOpenAPI, LogStreamType>(
      response
    );
  }

  /**
   * Retrieves a log stream by name.
   * @param logStreamName - The name of the log stream to retrieve.
   * @returns A promise that resolves to the log stream.
   */
  public async getLogStreamByName(
    logStreamName: string
  ): Promise<LogStreamType> {
    const logStreams = await this.getLogStreams();

    if (!logStreams.length) {
      throw new Error(`Galileo log stream ${logStreamName} not found`);
    }

    // Return the first matching log stream by name (`logStreams` contains all of the log streams)
    const logStream = logStreams.find((ls) => ls.name === logStreamName);

    if (!logStream) {
      throw new Error(`Galileo log stream ${logStreamName} not found`);
    }

    return logStream;
  }

  /**
   * Creates a new log stream.
   * @param logStreamName - The name of the log stream to create.
   * @returns A promise that resolves to the created log stream.
   */
  public async createLogStream(logStreamName: string): Promise<LogStreamType> {
    const response = await this.makeRequest<LogStreamTypeOpenAPI>(
      RequestMethod.POST,
      Routes.logStreams,
      {
        name: logStreamName
      },
      { project_id: this.projectId }
    );

    return this.convertToCamelCase<LogStreamTypeOpenAPI, LogStreamType>(
      response
    );
  }

  /**
   * Creates scorer settings for a log stream.
   * @param logStreamId - The ID of the log stream to configure scorers for.
   * @param scorers - Array of scorer configurations to apply.
   * @returns A promise that resolves when the scorer settings are created.
   */
  public async createScorerSettings(
    logStreamId: string,
    scorers: ScorerConfig[]
  ): Promise<void> {
    return await this.makeRequest<void>(
      RequestMethod.POST,
      Routes.runScorerSettings,
      { run_id: logStreamId, scorers },
      {
        project_id: this.projectId,
        experiment_id: logStreamId
      }
    );
  }
}
