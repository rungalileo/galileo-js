import { BaseClient, RequestMethod } from '../base-client';
import { Routes } from '../../types/routes.types';
import type {
  CreateJobResponseType,
  CreateJobRequestType,
  CreateJobResponseOpenAPI,
  CreateJobRequestOpenAPI
} from '../../types/job.types';

/**
 * Internal JobsService for job creation functionality.
 * Not exposed publicly - use Jobs class from utils/jobs.ts instead.
 */
export class JobsService extends BaseClient {
  constructor(apiUrl: string, token: string) {
    super();
    this.apiUrl = apiUrl;
    this.token = token;
    this.initializeClient();
  }

  public async create(
    options: CreateJobRequestType
  ): Promise<CreateJobResponseType> {
    const requestBody = this.convertToSnakeCase<
      CreateJobRequestType,
      CreateJobRequestOpenAPI
    >(options);

    try {
      const response = await this.makeRequest<CreateJobResponseOpenAPI>(
        RequestMethod.POST,
        Routes.jobs,
        requestBody
      );

      if (!response || !response.job_id) {
        throw new Error(
          `Create job failed: ${JSON.stringify(response || 'No response')}`
        );
      }

      return this.convertToCamelCase<
        CreateJobResponseOpenAPI,
        CreateJobResponseType
      >(response);
    } catch (error: unknown) {
      let errorMessage = 'Create job failed';

      if (error && typeof error === 'object') {
        const err = error as {
          response?: { data?: { detail?: string } };
          message?: string;
        };
        errorMessage =
          err.response?.data?.detail || err.message || errorMessage;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      throw new Error(`Create job failed: ${errorMessage}`);
    }
  }
}
