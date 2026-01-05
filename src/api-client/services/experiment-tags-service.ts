import { BaseClient, RequestMethod } from '../base-client';
import { Routes } from '../../types/routes.types';
import type { RunTagDB } from '../../types/experiment.types';
import { ExperimentTagsAPIException } from '../../utils/errors';
import type { HTTPValidationError } from '../../types/errors.types';

export class ExperimentTagsService extends BaseClient {
  private projectId: string;
  constructor(apiUrl: string, token: string, projectId: string) {
    super();
    this.apiUrl = apiUrl;
    this.token = token;
    this.projectId = projectId;
    this.initializeClient();
  }

  /**
   * Gets all tags for a specific experiment.
   * @param experimentId - The unique identifier of the experiment.
   * @returns A promise that resolves to an array of experiment tags.
   */
  public getExperimentTags = async (
    experimentId: string
  ): Promise<RunTagDB[]> => {
    try {
      return await this.makeRequest<RunTagDB[]>(
        RequestMethod.GET,
        Routes.experimentTags,
        null,
        {
          project_id: this.projectId,
          experiment_id: experimentId
        }
      );
    } catch (error) {
      // Check if it's an HTTPValidationError
      if (this.isHTTPValidationError(error)) {
        throw new ExperimentTagsAPIException(
          `Failed to get experiment tags: ${this.extractErrorDetail(error)}`
        );
      }
      // Re-throw as typed exception
      throw new ExperimentTagsAPIException(
        error instanceof Error ? error.message : String(error)
      );
    }
  };

  private isHTTPValidationError(error: unknown): error is HTTPValidationError {
    return typeof error === 'object' && error !== null && 'detail' in error;
  }

  private extractErrorDetail(error: unknown): string {
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

  /**
   * Upserts (creates or updates) a tag for a specific experiment.
   * If a tag with the same key already exists, it will be updated.
   * Otherwise, a new tag will be created.
   * @param experimentId - The unique identifier of the experiment.
   * @param key - The tag key.
   * @param value - The tag value.
   * @param tagType - (Optional) The type of tag (default: 'generic').
   * @returns A promise that resolves to the created or updated tag.
   */
  public upsertExperimentTag = async (
    experimentId: string,
    key: string,
    value: string,
    tagType: string = 'generic'
  ): Promise<RunTagDB> => {
    try {
      // First, check if a tag with this key already exists
      const existingTags = await this.getExperimentTags(experimentId);
      const existingTag = existingTags.find((tag) => tag.key === key);

      if (existingTag) {
        // Tag exists - use PUT to update it
        const response = await this.makeRequest<RunTagDB>(
          RequestMethod.PUT,
          Routes.experimentTag,
          {
            key,
            value,
            tag_type: tagType
          },
          {
            project_id: this.projectId,
            experiment_id: experimentId,
            tag_id: existingTag.id
          }
        );
        if (!response) {
          throw new ExperimentTagsAPIException('No response received from API');
        }
        return response;
      } else {
        // Tag doesn't exist - use POST to create it
        const response = await this.makeRequest<RunTagDB>(
          RequestMethod.POST,
          Routes.experimentTags,
          {
            key,
            value,
            tag_type: tagType
          },
          {
            project_id: this.projectId,
            experiment_id: experimentId
          }
        );
        if (!response) {
          throw new ExperimentTagsAPIException('No response received from API');
        }
        return response;
      }
    } catch (error) {
      if (error instanceof ExperimentTagsAPIException) {
        throw error;
      }
      if (this.isHTTPValidationError(error)) {
        throw new ExperimentTagsAPIException(
          `Failed to upsert experiment tag: ${this.extractErrorDetail(error)}`
        );
      }
      throw new ExperimentTagsAPIException(
        error instanceof Error ? error.message : String(error)
      );
    }
  };

  /**
   * Deletes a tag for a specific experiment.
   * @param experimentId - The unique identifier of the experiment.
   * @param tagId - The unique identifier of the tag to delete.
   * @returns A promise that resolves when the tag is deleted.
   */
  public deleteExperimentTag = async (
    experimentId: string,
    tagId: string
  ): Promise<void> => {
    try {
      await this.makeRequest<void>(
        RequestMethod.DELETE,
        Routes.experimentTag,
        null,
        {
          project_id: this.projectId,
          experiment_id: experimentId,
          tag_id: tagId
        }
      );
    } catch (error) {
      if (this.isHTTPValidationError(error)) {
        throw new ExperimentTagsAPIException(
          `Failed to delete experiment tag: ${this.extractErrorDetail(error)}`
        );
      }
      throw new ExperimentTagsAPIException(
        error instanceof Error ? error.message : String(error)
      );
    }
  };
}
