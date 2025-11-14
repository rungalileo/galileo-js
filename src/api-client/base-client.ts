/* eslint-disable @typescript-eslint/no-explicit-any */
import axios, { AxiosRequestConfig, AxiosResponse, Method } from 'axios';
import { Readable } from 'stream';
import createClient, { Client } from 'openapi-fetch';
import { decode } from 'jsonwebtoken';
import type { paths } from '../types/api.types';
import { Routes } from '../types/routes.types';
import { getSdkIdentifier } from '../utils/version';
import {
  objectToCamel,
  objectToSnake,
  ObjectToSnake,
  ObjectToCamel
} from 'ts-case-convert';

// Type guards for snake_case and camelCase conversion
type ValidatedSnakeCase<T extends object, TTarget> =
  ObjectToSnake<T> extends TTarget ? TTarget : never;
type ValidatedCamelCase<T extends object, TTarget> =
  ObjectToCamel<T> extends TTarget ? TTarget : never;

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
          'X-Galileo-SDK': getSdkIdentifier()
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
    if (error) {
      let statusCode: number | undefined;
      let errorData: any = error;

      if (typeof error === 'object' && error !== null) {
        if ('status' in error && typeof error.status === 'number') {
          statusCode = error.status;
        }

        if ('data' in error) {
          errorData = error.data;
        } else if ('response' in error && typeof error.response === 'object') {
          const response = error.response as any;
          if (response?.status) {
            statusCode = response.status;
          }
          if (response?.data) {
            errorData = response.data;
          }
        }
      }

      // Use parseApiErrorMessage for consistent error message formatting
      const errorMessage = parseApiErrorMessage(errorData);

      // Format error message similar to validateResponse
      if (statusCode) {
        const msg = `❗ Something didn't go quite right. The API returned a non-ok status code ${statusCode} with output: ${errorMessage}`;
        throw new Error(msg);
      }

      throw new Error(`Request failed: ${errorMessage}`);
    }

    if (data) {
      return data;
    }
    throw new Error('Request failed: No data received from API');
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
    if (
      ![
        Routes.login,
        Routes.apiKeyLogin,
        Routes.socialLogin,
        Routes.refreshToken
      ].includes(endpoint) &&
      this.token
    ) {
      const payload = decode(this.token, { json: true });
      if (payload?.exp && payload.exp < Math.floor(Date.now() / 1000)) {
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

    let headers: Record<string, any> = {
      'X-Galileo-SDK': getSdkIdentifier()
    };
    if (this.token) {
      headers = { ...this.getAuthHeader(this.token), ...headers };
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
        '{job_id}',
        params && 'job_id' in params ? (params.job_id as string) : ''
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
      )
      .replace(
        '{trace_id}',
        params && 'trace_id' in params ? (params.trace_id as string) : ''
      )
      .replace(
        '{session_id}',
        params && 'session_id' in params ? (params.session_id as string) : ''
      )
      .replace(
        '{span_id}',
        params && 'span_id' in params ? (params.span_id as string) : ''
      )
      .replace(
        '{user_id}',
        params && 'user_id' in params ? (params.user_id as string) : ''
      )
      .replace(
        '{group_id}',
        params && 'group_id' in params ? (params.group_id as string) : ''
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
        if (error.response) {
          this.validateResponse(error.response);
        }

        // Throw if validateResponse doesn't identify status code
        const errorMessage = error.message || GENERIC_ERROR_MESSAGE;
        throw new Error(`Request failed: ${errorMessage}`);
      }

      // Re-throw non-axios errors
      throw error;
    }
  }

  public async makeStreamingRequest(
    request_method: Method,
    endpoint: Routes,
    data?: string | Record<string, any> | null,
    params?: Record<string, unknown>,
    extraHeaders?: Record<string, string>
  ): Promise<Readable> {
    await this.refreshTokenIfNeeded(endpoint);

    let headers: Record<string, any> = {
      'X-Galileo-SDK': getSdkIdentifier()
    };
    if (this.token) {
      headers = { ...this.getAuthHeader(this.token), ...headers };
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
      )
      .replace(
        '{user_id}',
        params && 'user_id' in params ? (params.user_id as string) : ''
      )
      .replace(
        '{group_id}',
        params && 'group_id' in params ? (params.group_id as string) : ''
      )}`;

    const response = await axios.request<Readable>({
      method: request_method,
      url: endpointPath,
      params,
      headers,
      data,
      responseType: 'stream'
    });

    if (response.status >= 300) {
      const errorMessage = `Streaming request failed with status ${response.status}`;
      throw new Error(errorMessage);
    }

    return response.data;
  }

  public convertToSnakeCase<T extends object, TTarget>(
    obj: T
  ): ValidatedSnakeCase<T, TTarget> {
    return objectToSnake<T>(obj) as ValidatedSnakeCase<T, TTarget>;
  }

  public convertToCamelCase<T extends object, TTarget>(
    obj: T
  ): ValidatedCamelCase<T, TTarget> {
    return objectToCamel<T>(obj) as ValidatedCamelCase<T, TTarget>;
  }
}
