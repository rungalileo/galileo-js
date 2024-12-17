import { decode } from 'jsonwebtoken';

import axios, { AxiosRequestConfig, AxiosResponse, Method } from 'axios';
import FormData from 'form-data';
import { createReadStream } from 'fs';
import { Project, ProjectTypes } from './types/project.types.js';
import { Routes } from './types/routes.types.js';

import querystring from 'querystring';
import {
  Dataset,
  DatasetResponse,
  DatasetRow,
  DatasetContentResponse
} from './types/dataset.types';
import { PaginatedResponse } from './types/api.types';

export enum RequestMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE'
}

export class GalileoApiClient {
  public type: ProjectTypes | undefined = undefined;
  public projectId: string = '';
  public runId: string = '';
  private datasetId: string = '';
  private apiUrl: string = '';
  private token: string = '';

  public async init(
    projectName: string | undefined = undefined,
    datasetId: string | undefined = undefined
  ): Promise<void> {
    this.apiUrl = this.getApiUrl();
    if (await this.healthCheck()) {
      this.token = await this.getToken();

      if (projectName) {
        try {
          this.projectId = await this.getProjectIdByName(projectName);
          // eslint-disable-next-line no-console
          console.log(`✅ Using ${projectName}`);
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

      if (datasetId) {
        this.datasetId = datasetId;
      }
    }
  }

  private getApiUrl(): string {
    const consoleUrl = process.env.GALILEO_CONSOLE_URL;

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

  private async getProjectIdByName(project_name: string): Promise<string> {
    const projects = await this.makeRequest<Project[]>(
      RequestMethod.GET,
      Routes.projects,
      null,
      {
        project_name,
        type: this.type
      }
    );

    if (projects.length < 1) {
      throw new Error(`Galileo project ${project_name} not found`);
    }

    return projects[0].id;
  }

  private async createProject(project_name: string): Promise<{ id: string }> {
    return await this.makeRequest<{ id: string }>(
      RequestMethod.POST,
      Routes.projects,
      {
        name: project_name,
        type: this.type
      }
    );
  }

  public async createDataset(
    filePath: string,
    format: string
  ): Promise<Dataset> {
    const formData = new FormData();
    formData.append('file', createReadStream(filePath));

    try {
      const dataset = await this.makeRequest<Dataset>(
        RequestMethod.POST,
        Routes.datasets,
        formData,
        { format }
      );

      // eslint-disable-next-line no-console
      console.log(
        `✅  Dataset '${dataset.name}' with ${dataset.num_rows} rows uploaded.`
      );

      return dataset;
    } catch (error: unknown) {
      const err = error as Error;
      // eslint-disable-next-line no-console
      console.error(`❗ Failed to upload dataset: ${err.message}`);
      throw error;
    }
  }

  private async fetchAllPaginatedItems<T, R extends PaginatedResponse>(
    endpoint: Routes,
    extractItems: (response: R) => T[],
    params: Record<string, unknown> = {},
    limit = 100
  ): Promise<T[]> {
    let items: T[] = [];
    let startingToken: number | null = 0;

    do {
      const response: R = await this.makeRequest<R>(
        RequestMethod.GET,
        endpoint,
        null,
        { ...params, starting_token: startingToken, limit }
      );

      items = items.concat(extractItems(response));
      startingToken = response.next_starting_token;
    } while (startingToken !== null);

    return items;
  }

  public async getDatasets(): Promise<Dataset[]> {
    return (
      await this.fetchAllPaginatedItems<Dataset, DatasetResponse>(
        Routes.datasets,
        (response) => response.datasets
      )
    ).map((dataset: Dataset) => ({
      id: dataset.id,
      name: dataset.name,
      created_at: dataset.created_at,
      updated_at: dataset.updated_at,
      project_count: dataset.project_count,
      num_rows: dataset.num_rows,
      column_names: dataset.column_names
    }));
  }

  public async getDatasetRows(): Promise<DatasetRow[]> {
    return (
      await this.fetchAllPaginatedItems<DatasetRow, DatasetContentResponse>(
        Routes.datasetContent,
        (response) => response.rows
      )
    ).map((row: DatasetRow) => ({
      index: row.index,
      values: row.values
    }));
  }

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

  public async makeRequest<T>(
    request_method: Method,
    endpoint: Routes,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data?: string | Record<string, any> | null,
    params?: Record<string, unknown>
  ): Promise<T> {
    // Check to see if our token is expired before making a request
    // and refresh token if it's expired
    if (endpoint !== Routes.login && this.token) {
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
        .replace('{project_id}', this.projectId)
        .replace('{run_id}', this.runId)
        .replace('{dataset_id}', this.datasetId)}`,
      params,
      headers,
      data
    };

    const response = await axios.request<T>(config);

    this.validateResponse(response);

    return response.data;
  }
}
