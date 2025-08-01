/* eslint-disable @typescript-eslint/no-explicit-any */
import axios, { AxiosRequestConfig, AxiosResponse, Method } from 'axios';
import createClient, { Client } from 'openapi-fetch';
import { decode } from 'jsonwebtoken';
import type { paths } from '../types/api.types';
import { Routes } from '../types/routes.types';

export enum RequestMethod {
  GET = 'GET',
  PATCH = 'PATCH',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE'
}

export const GENERIC_ERROR_MESSAGE =
  'This error has been automatically tracked. Please try again.';

export const parseApiErrorMessage = (error: any) => {
  const errorMessage =
    typeof error?.detail === 'string'
      ? error?.detail
      : typeof error?.detail?.[0].msg === 'string'
        ? error?.detail?.[0].msg
        : GENERIC_ERROR_MESSAGE;

  return errorMessage;
};

export class BaseClient {
  protected apiUrl: string = '';
  protected token: string = '';
  protected client: Client<paths> | undefined = undefined;

  protected initializeClient(): void {
    if (this.apiUrl && this.token) {
      this.client = createClient({
        baseUrl: this.apiUrl,
        headers: {
          Authorization: `Bearer ${this.token}`,
          'client-type': 'sdk-js'
        }
      });
    }
  }

  protected getApiUrl(projectType: string): string {
    let consoleUrl = process.env.GALILEO_CONSOLE_URL;

    if (!consoleUrl && projectType === 'gen_ai') {
      return 'https://api.galileo.ai';
    }

    if (!consoleUrl) {
      throw new Error('❗ GALILEO_CONSOLE_URL must be set');
    }

    if (consoleUrl.includes('localhost') || consoleUrl.includes('127.0.0.1')) {
      return 'http://localhost:8088';
    }

    consoleUrl = consoleUrl
      .replace('app.galileo.ai', 'api.galileo.ai')
      .replace('console', 'api');

    // remove trailing slash
    if (consoleUrl.endsWith('/')) {
      consoleUrl = consoleUrl.slice(0, -1);
    }

    return consoleUrl;
  }

  protected async healthCheck(): Promise<boolean> {
    return await this.makeRequest<boolean>(
      RequestMethod.GET,
      Routes.healthCheck
    );
  }

  protected processResponse<T>(
    data: T | undefined,
    error: object | unknown
  ): T {
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

  protected getAuthHeader(token: string): { Authorization: string } {
    return { Authorization: `Bearer ${token}` };
  }

  protected validateResponse(response: AxiosResponse): void {
    if (response.status >= 300) {
      const errorMessage = parseApiErrorMessage(response.data);
      const msg = `❗ Something didn't go quite right. The API returned a non-ok status code ${response.status} with output: ${errorMessage}`;
      throw new Error(msg);
    }
  }

  protected async refreshTokenIfNeeded(endpoint: Routes): Promise<void> {
    if (![Routes.login, Routes.apiKeyLogin].includes(endpoint) && this.token) {
      const payload = decode(this.token, { json: true });
      if (payload?.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        // Will be implemented in auth service
        throw new Error(
          'Token expired - refreshToken not implemented in base class'
        );
      }
    }
  }

  /**
   * Make an HTTP request to the Galileo API and return the raw Axios response.
   */
  public async makeRequestRaw<T>(
    request_method: Method,
    endpoint: Routes,
    data?: string | Record<string, any> | null,
    params?: Record<string, unknown>,
    extraHeaders?: Record<string, string>
  ): Promise<AxiosResponse<T>> {
    await this.refreshTokenIfNeeded(endpoint);

    let headers: Record<string, any> = { 'client-type': 'sdk-js' };
    if (this.token) {
      headers = this.getAuthHeader(this.token);
    }

    headers = { ...headers, ...extraHeaders };

    const endpointPath = `${this.apiUrl}/${endpoint
      .replace(
        '{project_id}',
        params && 'project_id' in params ? (params.project_id as string) : ''
      )
      .replace(
        '{log_stream_id}',
        params && 'log_stream_id' in params
          ? (params.log_stream_id as string)
          : ''
      )
      .replace(
        '{run_id}',
        params && 'run_id' in params ? (params.run_id as string) : ''
      )
      .replace(
        '{dataset_id}',
        params && 'dataset_id' in params ? (params.dataset_id as string) : ''
      )
      .replace(
        '{experiment_id}',
        params && 'experiment_id' in params
          ? (params.experiment_id as string)
          : ''
      )
      .replace(
        '{template_id}',
        params && 'template_id' in params ? (params.template_id as string) : ''
      )
      .replace(
        '{version}',
        params && 'version' in params ? (params.version as string) : ''
      )}`;

    const config: AxiosRequestConfig = {
      method: request_method,
      url: endpointPath,
      params,
      headers,
      data
    };

    const response = await axios.request<T>(config);
    this.validateResponse(response);
    return response;
  }

  public async makeRequest<T>(
    request_method: Method,
    endpoint: Routes,
    data?: string | Record<string, any> | null,
    params?: Record<string, unknown>,
    extraHeaders?: Record<string, string>
  ): Promise<T> {
    try {
      const response = await this.makeRequestRaw<T>(
        request_method,
        endpoint,
        data,
        params,
        extraHeaders
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const response = error.response;
        this.validateResponse(response!);
      }
      return {} as T;
    }
  }
}
