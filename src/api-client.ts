import { decode } from 'jsonwebtoken';

import axios, { AxiosRequestConfig, AxiosResponse, Method } from 'axios';

import { Project, ProjectTypes } from './types/project.types.js';
import { Routes } from './types/routes.types.js';

import querystring from 'querystring';

export enum RequestMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE'
}

export class GalileoApiClient {
  public type: ProjectTypes | undefined = undefined;
  public project_id: string = '';
  public run_id: string = '';
  private api_url: string = '';
  private token: string = '';

  public async init(project_name: string): Promise<void> {
    this.api_url = this.getApiUrl();
    if (await this.healthCheck()) {
      this.token = await this.getToken();

      try {
        this.project_id = await this.getProjectIdByName(project_name);
      }
      catch (err: unknown) {
        const error = err as Error;

        if (error.message.includes('not found')) {
          const project = await this.createProject(project_name);
          this.project_id = project.id;
          // eslint-disable-next-line no-console
          console.log(
            `🚀 Creating new project… project ${project_name} created!`
          );
        }
        else {
          throw err;
        }
      }
    }
  }

  private getApiUrl(): string {
    const console_url = process.env.GALILEO_CONSOLE_URL;

    if (!console_url) {
      throw new Error('GALILEO_CONSOLE_URL must be set');
    }

    if (
      console_url.includes('localhost') ||
      console_url.includes('127.0.0.1')
    ) {
      return 'http://localhost:8088';
    } else {
      return console_url.replace('console', 'api');
    }
  }

  private async healthCheck(): Promise<boolean> {
    return await this.makeRequest<boolean>(RequestMethod.GET, Routes.healthCheck);
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
      'GALILEO_API_KEY or GALILEO_USERNAME and GALILEO_PASSWORD must be set'
    );
  }

  private async apiKeyLogin(apiKey: string): Promise<{ access_token: string }> {
    return await this.makeRequest<{ access_token: string }>(RequestMethod.POST, Routes.apiKeyLogin, {
      api_key: apiKey
    })
  }

  private async usernameLogin(
    username: string,
    password: string
  ) {
    return await this.makeRequest<{ access_token: string }>(
      RequestMethod.POST,
      Routes.login,
      querystring.stringify({
        username,
        password
      })
    )
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
    return await this.makeRequest<{ id: string }>(RequestMethod.POST, Routes.projects, {
      name: project_name,
      type: this.type
    })
  }

  private getAuthHeader(
    token: string
  ): { Authorization: string } {
    return { Authorization: `Bearer ${token}` };
  }

  private validateResponse(response: AxiosResponse): void {
    if (response.status >= 300) {
      const msg = `Something didn't go quite right. The API returned a non-ok status code ${response.status} with output: ${response.data}`;
      // TODO: Better error handling
      throw new Error(msg);
    }
  }

  public async makeRequest<T>(
    request_method: Method,
    endpoint: Routes,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data?: string | Record<string, any> | null,
    params?: Record<string, unknown>,
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
      url: `${this.api_url}/${endpoint.replace('{project_id}', this.project_id).replace('{run_id}', this.run_id)}`,
      params,
      headers,
      data
    };

    const response = await axios.request<T>(config);
    this.validateResponse(response);
    return response.data;
  }
}
