import { GalileoApiClient } from '../api-client';
import type { RunTagDB } from '../types/experiment.types';
import type { TagType } from '../types/tag.types';

/**
 * Entity class for managing experiment tags.
 * Provides high-level methods for getting, creating, updating, and deleting experiment tags.
 */
export class ExperimentTags {
  private client: GalileoApiClient | null = null;

  private async ensureClient(): Promise<GalileoApiClient> {
    if (!this.client) {
      this.client = new GalileoApiClient();
      await this.client.init();
    }
    return this.client;
  }

  /**
   * Gets all tags for a specific experiment.
   * @param options - The options for getting experiment tags.
   * @param options.projectId - The unique identifier of the project.
   * @param options.experimentId - The unique identifier of the experiment.
   * @returns A promise that resolves to an array of experiment tags.
   */
  async getExperimentTags(options: {
    projectId: string;
    experimentId: string;
  }): Promise<RunTagDB[]> {
    const client = await this.ensureClient();
    await client.init({ projectId: options.projectId });
    return await client.getExperimentTags(options.experimentId);
  }

  /**
   * Upserts (creates or updates) a tag for a specific experiment.
   * @param options - The options for upserting an experiment tag.
   * @param options.projectId - The unique identifier of the project.
   * @param options.experimentId - The unique identifier of the experiment.
   * @param options.key - The tag key.
   * @param options.value - The tag value.
   * @param options.tagType - (Optional) The type of tag (default: 'generic').
   * @returns A promise that resolves to the created or updated tag.
   */
  async upsertExperimentTag(options: {
    projectId: string;
    experimentId: string;
    key: string;
    value: string;
    tagType?: TagType | string;
  }): Promise<RunTagDB> {
    const client = await this.ensureClient();
    await client.init({ projectId: options.projectId });
    return await client.upsertExperimentTag(
      options.experimentId,
      options.key,
      options.value,
      options.tagType || 'generic'
    );
  }

  /**
   * Deletes a tag for a specific experiment.
   * @param options - The options for deleting an experiment tag.
   * @param options.projectId - The unique identifier of the project.
   * @param options.experimentId - The unique identifier of the experiment.
   * @param options.tagId - The unique identifier of the tag to delete.
   * @returns A promise that resolves when the tag is deleted.
   */
  async deleteExperimentTag(options: {
    projectId: string;
    experimentId: string;
    tagId: string;
  }): Promise<void> {
    const client = await this.ensureClient();
    await client.init({ projectId: options.projectId });
    return await client.deleteExperimentTag(
      options.experimentId,
      options.tagId
    );
  }
}
