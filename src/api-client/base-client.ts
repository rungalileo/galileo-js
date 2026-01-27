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
import {
  HTTPValidationError,
  GalileoAPIError,
  GalileoAPIStandardErrorData,
  isGalileoAPIStandardErrorData
} from '../types/errors.types';

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

export class BaseClient {
  protected apiUrl: string = '';
  protected token: string = '';
  protected client: Client<paths> | undefined = undefined;

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
        '{scorer_id}',
        params && 'scorer_id' in params ? (params.scorer_id as string) : ''
      )
      .replace(
        '{group_id}',
        params && 'group_id' in params ? (params.group_id as string) : ''
      )
      .replace(
        '{tag_id}',
        params && 'tag_id' in params ? (params.tag_id as string) : ''
      )
      .replace(
        '{version_index}',
        params && 'version_index' in params
          ? (params.version_index as string)
          : ''
      )}`;

    const config: AxiosRequestConfig = {
      method: request_method,
      url: endpointPath,
      params,
      headers,
      data
    };

    const response = await axios.request<T>(config);
    return response;
  }

  public async makeRequestWithConversion<
    SourceCamelType extends object,
    SourceSnakeType extends object,
    ResponseSnakeType extends object,
    ResponseCamelType extends object
  >(
    request_method: Method,
    endpoint: Routes,
    data: SourceCamelType,
    params?: Record<string, unknown>
  ) {
    const request = this.convertToSnakeCase<SourceCamelType, SourceSnakeType>(
      data
    );
    const response = await this.makeRequest<ResponseSnakeType>(
      request_method,
      endpoint,
      request,
      params
    );

    return this.convertToCamelCase<ResponseSnakeType, ResponseCamelType>(
      response
    );
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

      this.validateAxiosResponse(response);
      return response.data;
    } catch (error) {
      this.validateError(error);
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

    try {
      const response = await axios.request<Readable>({
        method: request_method,
        url: endpointPath,
        params,
        headers,
        data,
        responseType: 'stream'
      });

      this.validateAxiosResponse(response);
      return response.data;
    } catch (error) {
      this.validateError(error);
    }
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

  protected getAuthHeader(token: string): { Authorization: string } {
    return { Authorization: `Bearer ${token}` };
  }

  protected validateAxiosResponse(response: AxiosResponse): void {
    if (response.status >= 300) {
      this.generateApiError(response.data, response.status);
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

  protected isHTTPValidationError(
    error: unknown
  ): error is HTTPValidationError {
    return typeof error === 'object' && error !== null && 'detail' in error;
  }

  protected extractErrorDetail(error: unknown): string {
    if (this.isHTTPValidationError(error)) {
      const httpError = error as HTTPValidationError;
      if (typeof httpError.detail === 'string') {
        return httpError.detail;
      }
      // Handle array of validation errors
      if (Array.isArray(httpError.detail)) {
        return httpError.detail
          .map((err) => {
            const loc = err.loc ? err.loc.join('.') : 'unknown';
            const msg = err.msg || 'validation error';
            return `${loc}: ${msg}`;
          })
          .join('; ');
      }
      return JSON.stringify(httpError.detail);
    }
    return error instanceof Error ? error.message : String(error);
  }

  private validateError(error: unknown): never {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        this.validateAxiosResponse(error.response);
      }

      const errorMessage = error.message || GENERIC_ERROR_MESSAGE;
      throw new Error(`Request failed: ${errorMessage}`);
    }

    throw error;
  }

  private generateApiError(error: unknown, statusCode?: number): never {
    if (error && typeof error === 'object') {
      if ('standard_error' in error) {
        if (isGalileoAPIStandardErrorData(error.standard_error)) {
          throw new GalileoAPIError(error.standard_error);
        } else {
          throw new Error(
            `❗ Something didn't go quite right. The API returned an error, but the details could not be parsed.`
          );
        }
      } else if ('detail' in error) {
        const errorMessage =
          typeof error.detail === 'string'
            ? error.detail
            : Array.isArray(error.detail) &&
                typeof error.detail[0]?.msg === 'string'
              ? error.detail?.[0]?.msg
              : GENERIC_ERROR_MESSAGE;

        if (statusCode) {
          throw new Error(
            `❗ Something didn't go quite right. The API returned a non-ok status code ${statusCode} with output: ${errorMessage}`
          );
        } else {
          throw new Error(
            `❗ Something didn't go quite right. ${errorMessage}`
          );
        }
      } else {
        throw new Error(GENERIC_ERROR_MESSAGE);
      }
    } else {
      throw new Error(GENERIC_ERROR_MESSAGE);
    }
  }
}
