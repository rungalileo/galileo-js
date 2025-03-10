import { decode } from 'jsonwebtoken';

import axios, { AxiosRequestConfig, AxiosResponse, Method } from 'axios';
import { LogStream } from './types/log-stream.types';
import { Project, ProjectTypes } from './types/project.types';
import { Routes } from './types/routes.types';
import { Trace } from './types/log.types';
import { ScorerTypes } from './types/scorer.types';

import querystring from 'querystring';
import createClient, { Client } from 'openapi-fetch';
import type { components, paths } from './types/api.types';
export enum RequestMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE'
}
import { promises as fs } from 'fs';
import { Experiment } from './types/experiment.types';
import { Scorer } from './types/scorer.types';

type DatasetFormat = components['schemas']['DatasetFormat'];
export type ListDatasetResponse = components['schemas']['ListDatasetResponse'];
export type DatasetContent = components['schemas']['DatasetContent'];
export type Dataset = components['schemas']['DatasetDB'];
export type DatasetRow = components['schemas']['DatasetRow'];
export type DatasetAppendRow = components['schemas']['DatasetAppendRow'];

type CollectionPaths =
  | paths['/datasets']
  | paths['/datasets/{dataset_id}/content'];
type CollectionResponse = ListDatasetResponse | DatasetContent;

class GalileoApiClientParams {
  public projectType: ProjectTypes = ProjectTypes.genAI;
  public projectName?: string = process.env.GALILEO_PROJECT;
  public projectId?: string = undefined;
  public logStreamName?: string = process.env.GALILEO_LOG_STREAM;
  public logStreamId?: string = undefined;
  public runId?: string = undefined;
  public datasetId?: string = undefined;
  public experimentId?: string = undefined;
}

export class GalileoApiClient {
  public projectType: ProjectTypes = ProjectTypes.genAI;
  public projectId: string = '';
  public logStreamId: string = '';
  public runId: string = '';
  public datasetId: string = '';
  public experimentId: string = '';
  private apiUrl: string = '';
  private token: string = '';
  private client?: Client<paths> = undefined;

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
      experimentId = defaultParams.experimentId
    } = params;

    this.projectType = projectType;

    if (runId) {
      this.runId = runId;
    }

    if (datasetId) {
      this.datasetId = datasetId;
    }

    this.apiUrl = this.getApiUrl();
    if (await this.healthCheck()) {
      this.token = await this.getToken();

      this.client = createClient({
        baseUrl: this.apiUrl,
        headers: { Authorization: `Bearer ${this.token}` }
      });

      if (projectId) {
        this.projectId = projectId;
      } else if (projectName) {
        try {
          this.projectId = await this.getProjectIdByName(projectName);
          // eslint-disable-next-line no-console
          // console.log(`✅ Using ${projectName}`);
        } catch (err: unknown) {
          const error = err as Error;

          if (error.message.includes('not found')) {
            const project = await this.createProject(projectName);
            this.projectId = project.id;
            // eslint-disable-next-line no-console
            console.log(`✨ ${projectName} created.`);
          } else {
            throw err;
          }
        }
      }

      if (experimentId) {
        this.experimentId = experimentId;
      } else if (logStreamId) {
        this.logStreamId = logStreamId;
      } else if (logStreamName) {
        try {
          const logStream = await this.getLogStreamByName(logStreamName);
          this.logStreamId = logStream.id;
          // eslint-disable-next-line no-console
          // console.log(`✅ Using ${logStreamName}`);
        } catch (err: unknown) {
          const error = err as Error;

          if (error.message.includes('not found')) {
            const logStream = await this.createLogStream(logStreamName);
            this.logStreamId = logStream.id;
            // eslint-disable-next-line no-console
            console.log(`✨ ${logStreamName} created.`);
          } else {
            throw err;
          }
        }
      }
    }
  }

  private processResponse<T>(data: T | undefined, error: object | unknown): T {
    if (data) {
      return data;
    }

    if (error) {
      if (typeof error === 'object' && 'detail' in error) {
        throw new Error(`Request failed: ${JSON.stringify(error.detail)}`);
      }

      throw new Error(`Request failed: ${JSON.stringify(error)}`);
    }

    throw new Error('Request failed');
  }

  private async fetchAllPaginatedItems<
    Path extends CollectionPaths,
    Response extends CollectionResponse,
    Item
  >(
    path: '/datasets' | '/datasets/{dataset_id}/content',
    extractItems: (response: Response) => Item[],
    params: Path['get']['parameters']
  ): Promise<Item[]> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    let items: Item[] = [];
    let startingToken: number | null = 0;

    do {
      const updatedParams: Record<string, unknown> = {
        path: params.path,
        query: { ...params.query, starting_token: startingToken }
      };

      const { data, error } = await this.client.GET(path, {
        params: updatedParams
      });

      const collection = this.processResponse(data as Response, error);
      items = items.concat(extractItems(collection));
      startingToken = collection.next_starting_token ?? null;
    } while (startingToken !== null);

    return items;
  }

  private getApiUrl(): string {
    const consoleUrl = process.env.GALILEO_CONSOLE_URL;

    if (!consoleUrl && this.projectType === ProjectTypes.genAI) {
      return 'https://api.galileo.ai';
    }

    if (!consoleUrl) {
      throw new Error('❗ GALILEO_CONSOLE_URL must be set');
    }

    if (consoleUrl.includes('localhost') || consoleUrl.includes('127.0.0.1')) {
      return 'http://localhost:8088';
    } else {
      return consoleUrl.replace('console', 'api');
    }
  }

  private async healthCheck(): Promise<boolean> {
    return await this.makeRequest<boolean>(
      RequestMethod.GET,
      Routes.healthCheck
    );
  }

  private async getToken(): Promise<string> {
    const apiKey = process.env.GALILEO_API_KEY;

    if (apiKey) {
      const loginResponse = await this.apiKeyLogin(apiKey);
      return loginResponse.access_token || '';
    }

    const username = process.env.GALILEO_USERNAME;
    const password = process.env.GALILEO_PASSWORD;

    if (username && password) {
      const loginResponse = await this.usernameLogin(username, password);
      return loginResponse.access_token || '';
    }

    throw new Error(
      '❗ GALILEO_API_KEY or GALILEO_USERNAME and GALILEO_PASSWORD must be set'
    );
  }

  private async apiKeyLogin(
    api_key: string
  ): Promise<{ access_token: string }> {
    return await this.makeRequest<{ access_token: string }>(
      RequestMethod.POST,
      Routes.apiKeyLogin,
      {
        api_key
      }
    );
  }

  private async usernameLogin(username: string, password: string) {
    return await this.makeRequest<{ access_token: string }>(
      RequestMethod.POST,
      Routes.login,
      querystring.stringify({
        username,
        password
      })
    );
  }

  public async getProjects(): Promise<Project[]> {
    return await this.makeRequest<Project[]>(
      RequestMethod.GET,
      Routes.projects_all,
      null,
      this.projectType ? { project_type: this.projectType } : {}
    );
  }

  public async getProject(id: string): Promise<Project> {
    return await this.makeRequest<Project>(
      RequestMethod.GET,
      Routes.project,
      null,
      {
        project_id: id
      }
    );
  }

  public async getProjectByName(name: string): Promise<Project> {
    const projects = await this.makeRequest<Project[]>(
      RequestMethod.GET,
      Routes.projects,
      null,
      {
        project_name: name,
        type: this.projectType
      }
    );

    if (projects.length < 1) {
      throw new Error(`Galileo project ${name} not found`);
    }

    return projects[0];
  }

  public async getProjectIdByName(name: string): Promise<string> {
    return (await this.getProjectByName(name)).id;
  }

  public async createProject(project_name: string): Promise<Project> {
    return await this.makeRequest<Project>(
      RequestMethod.POST,
      Routes.projects,
      {
        name: project_name,
        type: this.projectType
      }
    );
  }

  public async getLogStreams(): Promise<LogStream[]> {
    if (!this.projectId) {
      throw new Error('Project not initialized');
    }
    return await this.makeRequest<LogStream[]>(
      RequestMethod.GET,
      Routes.logStreams
    );
  }

  public async getLogStream(id: string): Promise<LogStream> {
    return await this.makeRequest<LogStream>(
      RequestMethod.GET,
      Routes.logStream,
      null,
      {
        log_stream_id: id
      }
    );
  }

  public async getLogStreamByName(logStreamName: string): Promise<LogStream> {
    const logStreams = await this.getLogStreams();

    if (!logStreams.length) {
      throw new Error(`Galileo log stream ${logStreamName} not found`);
    }

    // Return the first matching log stream by name (`logStreams` contains all of the log streams)
    const logStream = logStreams.find((ls) => ls.name === logStreamName)!;

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
      }
    );
  }

  public getDatasets = async (): Promise<Dataset[]> => {
    return await this.fetchAllPaginatedItems<
      paths['/datasets'],
      ListDatasetResponse,
      Dataset
    >(
      '/datasets',
      (response: ListDatasetResponse) => response.datasets ?? [],
      {}
    );
  };

  public getDataset = async (id: string): Promise<Dataset> => {
    return await this.makeRequest<Dataset>(
      RequestMethod.GET,
      Routes.dataset,
      null,
      { dataset_id: id }
    );
  };

  public getDatasetByName = async (name: string): Promise<Dataset> => {
    const { datasets } = await this.makeRequest<{ datasets: Dataset[] }>(
      RequestMethod.POST,
      Routes.datasetsQuery,
      {
        filters: [
          {
            name: 'name',
            value: name,
            operator: 'eq'
          }
        ]
      }
    );

    if (!datasets.length) {
      throw new Error(`Galileo dataset ${name} not found`);
    }

    if (datasets.length > 1) {
      throw new Error(`Multiple Galileo datasets found with name: ${name}`);
    }

    return datasets[0];
  };

  public async createDataset(
    name: string,
    filePath: string,
    format: DatasetFormat
  ): Promise<Dataset> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    const fileBuffer: Buffer = await fs.readFile(filePath);
    const blob: Blob = new Blob([fileBuffer]);
    const formdata = new FormData();
    formdata.append('file', blob, name);

    const { data, error } = await this.client.POST('/datasets', {
      params: { query: { format } },
      // @ts-expect-error openapi-typescript does not properly translate FormData for uploading files - https://github.com/openapi-ts/openapi-typescript/issues/1214
      body: formdata,
      bodySerializer: (body) => {
        // define a custom serializer to prevent openapi-fetch from serializing the FormData object as JSON
        return body;
      }
    });

    const dataset = this.processResponse(data, error) as Dataset;
    // eslint-disable-next-line no-console
    console.log(
      `✅  Dataset '${dataset.name}' with ${dataset.num_rows} rows uploaded.`
    );
    return dataset;
  }

  public async getDatasetContent(datasetId: string): Promise<DatasetRow[]> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    return await this.fetchAllPaginatedItems<
      paths['/datasets/{dataset_id}/content'],
      DatasetContent,
      DatasetRow
    >(
      `/datasets/{dataset_id}/content`,
      (response: DatasetContent) => response.rows ?? [],
      { path: { dataset_id: datasetId } }
    );
  }

  public async appendRowsToDatasetContent(
    datasetId: string,
    rows: DatasetAppendRow[]
  ): Promise<void> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    await this.makeRequest<void>(
      RequestMethod.POST,
      Routes.datasetContent,
      { rows },
      { dataset_id: datasetId }
    );
  }

  public getExperiment = async (id: string): Promise<Experiment> => {
    return await this.makeRequest<Experiment>(
      RequestMethod.GET,
      Routes.experiment,
      null,
      {
        experiment_id: id
      }
    );
  };

  public getExperiments = async (): Promise<Experiment[]> => {
    return await this.makeRequest<Experiment[]>(
      RequestMethod.GET,
      Routes.experiments,
      null,
      {
        project_id: this.projectId
      }
    );
  };

  public createExperiment = async (name: string): Promise<Experiment> => {
    return await this.makeRequest<Experiment>(
      RequestMethod.POST,
      Routes.experiments,
      {
        name
      },
      {
        project_id: this.projectId
      }
    );
  };

  public getScorers = async (type?: ScorerTypes): Promise<Scorer[]> => {
    const response = await this.makeRequest<{ scorers: Scorer[] }>(
      RequestMethod.POST,
      Routes.scorers,
      type
        ? {
            filters: [
              {
                name: 'scorer_type',
                value: type,
                operator: 'eq'
              }
            ]
          }
        : {}
    );

    return response.scorers;
  };

  public createRunScorerSettings = async (
    experimentId: string,
    projectId: string,
    scorers: Scorer[]
  ): Promise<void> => {
    return await this.makeRequest<void>(
      RequestMethod.POST,
      Routes.runScorerSettings,
      { run_id: experimentId, scorers },
      {
        project_id: projectId,
        experiment_id: experimentId
      }
    );
  };

  private getAuthHeader(token: string): { Authorization: string } {
    return { Authorization: `Bearer ${token}` };
  }

  private validateResponse(response: AxiosResponse): void {
    if (response.status >= 300) {
      const msg = `❗ Something didn't go quite right. The API returned a non-ok status code ${response.status} with output: ${response.data}`;
      // TODO: Better error handling
      throw new Error(msg);
    }
  }

  public async ingestTraces(traces: Trace[]): Promise<void> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

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
        ...(!this.experimentId &&
          this.logStreamId && {
            log_stream_id: this.logStreamId
          })
      },
      { project_id: this.projectId }
    );
    // eslint-disable-next-line no-console
    console.log(
      `🚀 ${traces.length} Traces ingested for project ${this.projectId}.`
    );
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(traces));
  }

  public async makeRequest<T>(
    request_method: Method,
    endpoint: Routes,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data?: string | Record<string, any> | null,
    params?: Record<string, unknown>
  ): Promise<T> {
    // Check to see if our token is expired before making a request
    // and refresh token if it's expired
    if (![Routes.login, Routes.apiKeyLogin].includes(endpoint) && this.token) {
      const payload = decode(this.token, { json: true });
      if (payload?.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        this.token = await this.getToken();
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let headers: Record<string, any> = {};

    if (this.token) {
      headers = this.getAuthHeader(this.token);
    }

    const config: AxiosRequestConfig = {
      method: request_method,
      url: `${this.apiUrl}/${endpoint
        .replace(
          '{project_id}',
          params && 'project_id' in params
            ? (params.project_id as string)
            : this.projectId
        )
        .replace(
          '{log_stream_id}',
          params && 'log_stream_id' in params
            ? (params.log_stream_id as string)
            : this.logStreamId
        )
        .replace(
          '{run_id}',
          params && 'run_id' in params ? (params.run_id as string) : this.runId
        )
        .replace(
          '{dataset_id}',
          params && 'dataset_id' in params
            ? (params.dataset_id as string)
            : this.datasetId
        )
        .replace(
          '{experiment_id}',
          params && 'experiment_id' in params
            ? (params.experiment_id as string)
            : this.experimentId
        )}`,
      params,
      headers,
      data
    };

    const response = await axios.request<T>(config);

    this.validateResponse(response);

    return response.data;
  }
}
