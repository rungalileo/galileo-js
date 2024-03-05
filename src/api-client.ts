import jwt from 'jsonwebtoken';

import axios, { AxiosRequestConfig, AxiosResponse, Method } from 'axios';

import { Routes } from './constants/routes.constants';
import type { TransactionRecordBatch } from './types/transaction.types';

interface Project {
  id: string;
  name: string;
  type: string;
}

enum RequestMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE'
}

class HttpHeaders {
  accept = 'accept';
  content_type = 'Content-Type';
  application_json = 'application/json';

  static acceptJson(): Record<string, string> {
    const headers = new HttpHeaders();
    return { [headers.accept]: headers.application_json };
  }

  static json(): Record<string, string> {
    return { ...HttpHeaders.acceptJson(), ...HttpHeaders.contentTypeJson() };
  }

  static contentTypeJson(): Record<string, string> {
    const headers = new HttpHeaders();
    return { [headers.content_type]: headers.application_json };
  }
}

export class ApiClient {
  private project_id: string;
  private api_url: string;
  private token: string;

  constructor() {
    this.project_id = '';
    this.api_url = '';
    this.token = '';
  }

  public async init(project_name: string): Promise<void> {
    this.api_url = await this.getApiUrl();
    if (await this.healthcheck()) {
      this.token = await this.getToken();
      try {
        this.project_id = await this.getProjectIdByName(project_name);
      } catch (e: any) {
        if (e.message.includes('not found')) {
          await this.createProject(project_name);
          console.log(
            `🚀 Creating new project... project ${project_name} created!`
          );
        } else {
          throw e;
        }
      }
    }
  }

  private async getApiUrl(): Promise<string> {
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

  private async getToken(): Promise<string> {
    const username = process.env.GALILEO_USERNAME;
    const password = process.env.GALILEO_PASSWORD;
    if (!username || !password) {
      throw new Error('GALILEO_USERNAME and GALILEO_PASSWORD must be set');
    }
    const loginResponse = await this.usernameLogin(username, password);
    return loginResponse.access_token || '';
  }

  private async healthcheck(): Promise<boolean> {
    await this.makeRequest(RequestMethod.GET, this.api_url, Routes.healthcheck);
    return true;
  }

  private async usernameLogin(
    username: string,
    password: string
  ): Promise<{ access_token: string }> {
    return await this.makeRequest(
      RequestMethod.POST,
      this.api_url,
      Routes.login,
      {
        username,
        password,
        auth_method: 'email'
      }
    );
  }

  private async get_auth_header(): Promise<{ Authorization: string }> {
    return { Authorization: `Bearer ${this.token}` };
  }

  private async validateResponse(response: AxiosResponse): Promise<void> {
    if (response.status >= 300) {
      const msg = `Something didn't go quite right. The API returned a non-ok status code ${response.status} with output: ${response.data}`;
      // TODO: Better error handling.
      throw new Error(msg);
    }
  }

  private async makeRequest(
    request_method: Method,
    endpoint: string,
    body?: any,
    data?: any,
    files?: any,
    params?: any,
    timeout?: number | null,
    json_request_only?: boolean
  ): Promise<any> {
    // Check to see if our token is expired before making a request
    // and refresh token if it's expired
    if (endpoint !== Routes.login && this.token) {
      const claims: any = jwt.decode(this.token, { complete: true });
      if (claims.payload.exp < Math.floor(Date.now() / 1000)) {
        this.token = await this.getToken();
      }
    }

    const headers = {
      ...this.get_auth_header(),
      ...(json_request_only ? HttpHeaders.acceptJson() : HttpHeaders.json())
    };
    const config: AxiosRequestConfig = {
      method: request_method,
      url: `${this.api_url}${endpoint}`,
      headers,
      timeout,
      params,
      data,
      ...(body && { body }),
      ...(files && { files })
    };

    const response = await axios.request(config);
    await this.validateResponse(response);
    return response.data;
  }

  public async ingestBatch(
    transaction_batch: TransactionRecordBatch
  ): Promise<any> {
    return await this.makeRequest(
      RequestMethod.POST,
      Routes.ingest.replace('{project_id}', this.project_id),
      transaction_batch
    );
  }

  private async getProjectIdByName(project_name: string): Promise<string> {
    const projects: Project[] = await this.makeRequest(
      RequestMethod.GET,
      Routes.projects,
      {
        project_name,
        type: 'llm_monitor'
      }
    );
    if (projects.length < 1) {
      throw new Error(`Galileo project ${project_name} not found`);
    }
    return projects[0].id;
  }

  private async createProject(
    project_name: string
  ): Promise<{ [key: string]: string }> {
    return await this.makeRequest(RequestMethod.POST, Routes.projects, {
      name: project_name,
      type: 'llm_monitor'
    });
  }
}
