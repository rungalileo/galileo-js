import { BaseClient, RequestMethod } from '../base-client';
import { Routes } from '../../types/routes.types';
import type { RunTagDB, RunTagDBOpenAPI } from '../../types/experiment.types';
import { ExperimentTagsAPIException } from '../../utils/errors';

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
  public async getExperimentTags(experimentId: string): Promise<RunTagDB[]> {
    const response = await this.makeRequest<RunTagDBOpenAPI[]>(
      RequestMethod.GET,
      Routes.experimentTags,
      null,
      {
        project_id: this.projectId,
        experiment_id: experimentId
      }
    );

    return response.map((item) =>
      this.convertToCamelCase<RunTagDBOpenAPI, RunTagDB>(item)
    );
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
  public async upsertExperimentTag(
    experimentId: string,
    key: string,
    value: string,
    tagType: string = 'generic'
  ): Promise<RunTagDB> {
    // First, check if a tag with this key already exists
    const existingTags = await this.getExperimentTags(experimentId);
    const existingTag = existingTags.find((tag) => tag.key === key);

    if (existingTag) {
      // Tag exists - use PUT to update it
      const response = await this.makeRequest<RunTagDBOpenAPI>(
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

      return this.convertToCamelCase<RunTagDBOpenAPI, RunTagDB>(response);
    } else {
      // Tag doesn't exist - use POST to create it
      const response = await this.makeRequest<RunTagDBOpenAPI>(
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

      return this.convertToCamelCase<RunTagDBOpenAPI, RunTagDB>(response);
    }
  }

  /**
   * Deletes a tag for a specific experiment.
   * @param experimentId - The unique identifier of the experiment.
   * @param tagId - The unique identifier of the tag to delete.
   * @returns A promise that resolves when the tag is deleted.
   */
  public async deleteExperimentTag(
    experimentId: string,
    tagId: string
  ): Promise<void> {
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
  }
}
