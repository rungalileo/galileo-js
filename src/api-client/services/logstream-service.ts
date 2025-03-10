import { BaseClient, RequestMethod } from '../base-client';
import { LogStream } from '../../types/log-stream.types';
import { Routes } from '../../types/routes.types';

export class LogStreamService extends BaseClient {
  private projectId: string;

  constructor(apiUrl: string, token: string, projectId: string) {
    super();
    this.apiUrl = apiUrl;
    this.token = token;
    this.projectId = projectId;
    this.initializeClient();
  }

  public async getLogStreams(): Promise<LogStream[]> {
    if (!this.projectId) {
      throw new Error('Project ID not set');
    }

    return await this.makeRequest<LogStream[]>(
      RequestMethod.GET,
      Routes.logStreams,
      null,
      { project_id: this.projectId }
    );
  }

  public async getLogStream(id: string): Promise<LogStream> {
    return await this.makeRequest<LogStream>(
      RequestMethod.GET,
      Routes.logStream,
      null,
      { project_id: this.projectId, log_stream_id: id }
    );
  }

  public async getLogStreamByName(logStreamName: string): Promise<LogStream> {
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

  public async createLogStream(logStreamName: string): Promise<LogStream> {
    return await this.makeRequest<LogStream>(
      RequestMethod.POST,
      Routes.logStreams,
      {
        name: logStreamName
      },
      { project_id: this.projectId }
    );
  }
}
