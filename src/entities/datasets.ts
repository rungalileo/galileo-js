import { GalileoApiClient } from '../api-client';
import type {
  DatasetFormat,
  DatasetRow,
  SyntheticDatasetExtensionRequest,
  DatasetVersionHistory,
  DatasetContent,
  DatasetProject,
  DatasetDBType
} from '../types/dataset.types';
import { UserInfo } from '../types/openapi.types';

/**
 * Dataset entity for working with dataset metadata and content.
 */
export class Dataset {
  private client: GalileoApiClient | null = null;
  private _content: DatasetRow[] | null = null;

  // Properties from DatasetDB
  public readonly id: string;
  public readonly name: string;
  public readonly columnNames: string[];
  public readonly numRows: number;
  public readonly createdAt: string;
  public readonly updatedAt: string;
  public readonly draft: boolean;
  public readonly projectCount: number;
  public readonly currentVersionIndex: number;
  public readonly createdByUser: UserInfo;

  constructor(datasetDb: DatasetDBType) {
    this.id = datasetDb.id;
    this.name = datasetDb.name;
    this.columnNames = datasetDb.columnNames ?? [];
    this.numRows = datasetDb.numRows ?? 0;
    this.createdAt = datasetDb.createdAt;
    this.updatedAt = datasetDb.updatedAt;
    this.draft = datasetDb.draft ?? false;
    this.projectCount = datasetDb.projectCount ?? 0;
    this.currentVersionIndex = datasetDb.currentVersionIndex ?? 0;
    this.createdByUser = datasetDb.createdByUser ?? { id: '', email: '' };
  }

  private async ensureClient(): Promise<GalileoApiClient> {
    if (!this.client) {
      this.client = new GalileoApiClient();
      await this.client.init({ projectScoped: false });
    }
    return this.client;
  }

  /**
   * Gets the content of the dataset and caches it locally.
   * @returns A promise that resolves to the rows of the dataset.
   */
  async getContent(): Promise<DatasetRow[]> {
    const client = await this.ensureClient();
    this._content = await client.getDatasetContent(this.id);
    return this._content;
  }

  /**
   * Gets the cached content without making an API call.
   * @returns The cached dataset rows or null if not loaded.
   */
  get content(): DatasetRow[] | null {
    return this._content;
  }

  /**
   * Adds rows to the dataset and refreshes the cached content.
   * @param rows - The rows to append to the dataset.
   * @returns A promise that resolves to the updated dataset.
   */
  async addRows(
    rows: Record<string, string | Record<string, string>>[]
  ): Promise<Dataset> {
    const client = await this.ensureClient();
    const etag = await client.getDatasetEtag(this.id);

    const stringifiedRows = rows.map((row) => {
      const stringifiedRow: Record<string, string> = {};
      for (const key in row) {
        const value = row[key];
        stringifiedRow[key] =
          typeof value === 'object' ? JSON.stringify(value) : value;
      }
      return stringifiedRow;
    });

    await client.appendRowsToDatasetContent(
      this.id,
      etag,
      stringifiedRows.map((row) => ({
        editType: 'append_row' as const,
        values: row
      }))
    );

    // Refresh content
    await this.getContent();
    return this;
  }

  /**
   * Gets the version history of this dataset.
   * @returns A promise that resolves to the version history for this dataset.
   */
  async getVersionHistory(): Promise<DatasetVersionHistory> {
    const client = await this.ensureClient();
    return await client.getDatasetVersionHistory(this.id);
  }

  /**
   * Loads the content for a specific version of this dataset.
   * @param versionIndex - The index of the version to load.
   * @returns A promise that resolves to the content of the specified version.
   */
  async loadVersion(versionIndex: number): Promise<DatasetContent> {
    const client = await this.ensureClient();
    return await client.getDatasetVersionContent(this.id, versionIndex);
  }

  /**
   * Lists all projects that use this dataset.
   * @param limit - (Optional) The maximum number of projects to return.
   * @returns A promise that resolves to the list of projects that use this dataset.
   */
  async listProjects(limit: number = 100): Promise<DatasetProject[]> {
    const client = await this.ensureClient();
    const response = await client.listDatasetProjects(this.id, limit);
    return response.projects ?? [];
  }

  /**
   * Returns the underlying dataset database representation.
   * @returns The dataset database object.
   */
  toDatasetDB(): DatasetDBType {
    return {
      id: this.id,
      createdByUser: this.createdByUser,
      name: this.name,
      columnNames: this.columnNames,
      numRows: this.numRows,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      draft: this.draft,
      projectCount: this.projectCount,
      currentVersionIndex: this.currentVersionIndex
    };
  }
}

/**
 * Service class for dataset operations used by dataset utilities.
 */
export class Datasets {
  private client: GalileoApiClient | null = null;

  private async ensureClient(
    options: {
      projectId?: string;
      projectName?: string;
    } = {}
  ): Promise<GalileoApiClient> {
    this.client = new GalileoApiClient();
    await this.client.init({
      projectId: options.projectId,
      projectName: options.projectName,
      projectScoped: options.projectId || options.projectName ? true : false
    });
    return this.client;
  }

  /**
   * Lists datasets with optional filtering and pagination.
   * Utility function getDatasets() delegates to this method.
   * @param options - (Optional) Options for listing datasets.
   * @param options.limit - (Optional) The maximum number of datasets to return.
   * @param options.projectId - (Optional) The ID of the project that uses the datasets.
   * @param options.projectName - (Optional) The name of the project that uses the datasets.
   * @returns A promise that resolves to the list of datasets.
   */
  async list(options?: {
    projectId?: string;
    projectName?: string;
    limit?: number;
  }): Promise<Dataset[]> {
    const client = await this.ensureClient();

    // Handle project filtering
    if (options?.projectId || options?.projectName) {
      const projectId =
        options.projectId ??
        (await this.resolveProjectId(options.projectName!));

      const allDatasets: DatasetDBType[] = [];
      let startingToken: number | null | undefined = 0;

      do {
        const response = await client.queryDatasets(
          {
            filters: [{ name: 'used_in_project', value: projectId }]
          },
          {
            startingToken: startingToken ?? undefined,
            limit: options.limit ?? 100
          }
        );

        if (response.datasets?.length) {
          allDatasets.push(...response.datasets);
        }

        startingToken = response.nextStartingToken;
      } while (startingToken);

      return allDatasets.map((db) => new Dataset(db));
    } else {
      const datasets = await client.getDatasets(options?.limit);
      return datasets.map((db) => new Dataset(db));
    }
  }

  /**
   * Gets a dataset by ID or name with optional content loading and project validation.
   * Utility function getDataset() delegates to this method.
   * @param options - The options used to locate the dataset.
   * @param options.id - (Optional) The ID of the dataset.
   * @param options.name - (Optional) The name of the dataset.
   * @param options.withContent - (Optional) Whether to load the dataset content.
   * @param options.projectId - (Optional) The ID of the project to validate against.
   * @param options.projectName - (Optional) The name of the project to validate against.
   * @returns A promise that resolves to the dataset, or null if it is not found.
   */
  async get(options: {
    id?: string;
    name?: string;
    withContent?: boolean;
    projectId?: string;
    projectName?: string;
  }): Promise<Dataset | null> {
    // Enforce mutual exclusivity
    if (!options.id && !options.name) {
      throw new Error('Either id or name must be provided');
    }
    if (options.id && options.name) {
      throw new Error('Only one of id or name should be provided');
    }
    if (options.projectId && options.projectName) {
      throw new Error(
        'Only one of projectId or projectName should be provided'
      );
    }

    const client = await this.ensureClient();

    let datasetDb: DatasetDBType;
    try {
      datasetDb = options.id
        ? await client.getDataset(options.id)
        : await client.getDatasetByName(options.name!);
    } catch {
      return null;
    }

    const dataset = new Dataset(datasetDb);

    // Validate project association if provided
    if (options.projectId || options.projectName) {
      await this.validateDatasetInProject(
        dataset.id,
        options.projectId,
        options.projectName
      );
    }

    // Load content if requested
    if (options.withContent) {
      await dataset.getContent();
    }

    return dataset;
  }

  /**
   * Creates a new dataset with optional project association.
   * Utility function createDataset() delegates to this method.
   * @param options - The options used to create the dataset.
   * @param options.name - The name of the dataset.
   * @param options.filePath - The path to the dataset file.
   * @param options.format - The format of the dataset file.
   * @param options.projectId - (Optional) The ID of the project that will use the dataset.
   * @param options.projectName - (Optional) The name of the project that will use the dataset.
   * @returns A promise that resolves to the created dataset.
   */
  async create(options: {
    name: string;
    filePath: string;
    format: DatasetFormat;
    projectId?: string;
    projectName?: string;
  }): Promise<Dataset> {
    const client = await this.ensureClient({
      projectId: options.projectId,
      projectName: options.projectName
    });
    if (options.projectName) {
      const project = await client.getGlobalProjectByName(options.projectName);
      options.projectId = project.id;
    }

    const datasetDb = await client.createDataset(options);
    return new Dataset(datasetDb);
  }

  /**
   * Deletes a dataset with optional project validation.
   * Utility function deleteDataset() delegates to this method.
   * @param options - The options used to locate the dataset.
   * @param options.id - (Optional) The ID of the dataset.
   * @param options.name - (Optional) The name of the dataset.
   * @param options.projectId - (Optional) The ID of the project to validate against.
   * @param options.projectName - (Optional) The name of the project to validate against.
   * @returns A promise that resolves when the dataset has been deleted.
   */
  async delete(options: {
    id?: string;
    name?: string;
    projectId?: string;
    projectName?: string;
  }): Promise<void> {
    // Enforce mutual exclusivity
    if (!options.id && !options.name) {
      throw new Error('Either id or name must be provided');
    }
    if (options.id && options.name) {
      throw new Error('Only one of id or name should be provided');
    }

    const dataset = await this.get({
      id: options.id,
      name: options.name,
      projectId: options.projectId,
      projectName: options.projectName
    });

    if (!dataset) {
      throw new Error(`Dataset ${options.name ?? options.id} not found`);
    }

    const client = await this.ensureClient();
    await client.deleteDataset(dataset.id);
  }

  /**
   * Extends a dataset with synthetically generated data.
   * Utility function extendDataset() delegates to this method.
   * @param params - Configuration for synthetic data generation.
   * @returns A promise that resolves to the generated dataset rows.
   */
  async extend(
    params: SyntheticDatasetExtensionRequest
  ): Promise<DatasetRow[]> {
    const client = await this.ensureClient();
    const { datasetId } = await client.extendDataset(params);

    // Poll for completion
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const job = await client.getExtendDatasetStatus(datasetId);
      if (job.stepsCompleted === job.stepsTotal) {
        break;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }

    return await client.getDatasetContent(datasetId);
  }

  /**
   * Gets the version history of a dataset.
   * Utility function getDatasetVersionHistory() delegates to this method.
   * @param options - The options used to locate the dataset.
   * @param options.datasetId - (Optional) The ID of the dataset.
   * @param options.datasetName - (Optional) The name of the dataset.
   * @returns A promise that resolves to the version history for the dataset.
   */
  async getVersionHistory(options: {
    datasetId?: string;
    datasetName?: string;
  }): Promise<DatasetVersionHistory> {
    const dataset = await this.get({
      id: options.datasetId,
      name: options.datasetName
    });
    if (!dataset) {
      throw new Error(
        `Dataset ${options.datasetName ?? options.datasetId} not found`
      );
    }

    return await dataset.getVersionHistory();
  }

  /**
   * Gets a specific version of a dataset.
   * Utility function getDatasetVersion() delegates to this method.
   * @param options - The options used to locate the dataset version.
   * @param options.versionIndex - The version index to retrieve.
   * @param options.datasetId - (Optional) The ID of the dataset.
   * @param options.datasetName - (Optional) The name of the dataset.
   * @returns A promise that resolves to the dataset content at the specified version.
   */
  async getVersion(options: {
    versionIndex: number;
    datasetId?: string;
    datasetName?: string;
  }): Promise<DatasetContent> {
    const dataset = await this.get({
      id: options.datasetId,
      name: options.datasetName
    });
    if (!dataset) {
      throw new Error(
        `Dataset ${options.datasetName ?? options.datasetId} not found`
      );
    }

    return await dataset.loadVersion(options.versionIndex);
  }

  /**
   * Lists all projects that use a dataset.
   * Utility function listDatasetProjects() delegates to this method.
   * @param options - The options used to locate the dataset.
   * @param options.datasetId - (Optional) The ID of the dataset.
   * @param options.datasetName - (Optional) The name of the dataset.
   * @param options.limit - (Optional) The maximum number of projects to return.
   * @returns A promise that resolves to the list of projects that use the dataset.
   */
  async listProjects(options: {
    datasetId?: string;
    datasetName?: string;
    limit?: number;
  }): Promise<DatasetProject[]> {
    const dataset = await this.get({
      id: options.datasetId,
      name: options.datasetName
    });
    if (!dataset) {
      throw new Error(
        `Dataset ${options.datasetName ?? options.datasetId} not found`
      );
    }
    return await dataset.listProjects(options.limit ?? 100);
  }

  private async resolveProjectId(projectName: string): Promise<string> {
    const client = await this.ensureClient();
    const project = await client.getGlobalProjectByName(projectName);
    return project.id;
  }

  private async validateDatasetInProject(
    datasetId: string,
    projectId?: string,
    projectName?: string
  ): Promise<void> {
    const client = await this.ensureClient();
    const resolvedProjectId =
      projectId ?? (await this.resolveProjectId(projectName!));
    const response = await client.listDatasetProjects(datasetId);

    const projectIds = response.projects?.map((p) => p.id) ?? [];
    if (!projectIds.includes(resolvedProjectId)) {
      throw new Error('Dataset is not used in the specified project');
    }
  }
}
