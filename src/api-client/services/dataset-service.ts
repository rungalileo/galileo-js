import { BaseClient, RequestMethod } from '../base-client';
import { getSdkLogger } from 'galileo-generated';
import { Routes } from '../../types/routes.types';
import { promises as fs } from 'fs';
import {
  DatasetFormat,
  ListDatasetResponse,
  DatasetContent,
  DatasetDBType,
  DatasetRow,
  DatasetAppendRow,
  SyntheticDatasetExtensionRequest,
  SyntheticDatasetExtensionResponse,
  JobProgress,
  DatasetVersionHistory,
  ListDatasetProjectsResponse,
  ListDatasetParams,
  DatasetOpenAPI,
  ListDatasetProjectsResponseOpenAPI,
  DatasetContentOpenAPI,
  DatasetVersionHistoryOpenAPI,
  ListDatasetResponseOpenAPI,
  ListDatasetParamsOpenAPI,
  JobProgressOpenAPI,
  SyntheticDatasetExtensionResponseOpenAPI,
  SyntheticDatasetExtensionRequestOpenAPI,
  DatasetRowOpenAPI,
  DatasetAppendRowOpenAPI
} from '../../types/dataset.types';
import { BodyCreateDatasetDatasetsPost } from '../../types/openapi.types';

export class DatasetService extends BaseClient {
  constructor(apiUrl: string, token: string) {
    super();
    this.apiUrl = apiUrl;
    this.token = token;
    this.initializeClient();
  }

  public async getDatasets(limit?: number): Promise<DatasetDBType[]> {
    const allDatasetsOpenAPI: DatasetOpenAPI[] = [];
    let pageNumber = 1;

    const params: Record<string, unknown> = {
      starting_token: 0,
      limit: limit ?? 100
    };

    do {
      try {
        const pageOpenAPI = await this.makeRequest<ListDatasetResponseOpenAPI>(
          RequestMethod.GET,
          Routes.datasets,
          null,
          params
        );

        if (pageOpenAPI.datasets?.length) {
          allDatasetsOpenAPI.push(...pageOpenAPI.datasets);
        }

        if (
          typeof pageOpenAPI.next_starting_token === 'number' &&
          pageOpenAPI.next_starting_token >= 0
        ) {
          params.starting_token = pageOpenAPI.next_starting_token;
          pageNumber++;
        } else {
          params.starting_token = undefined;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const contextInfo = `Failed to fetch datasets page ${pageNumber}`;
        throw new Error(`${contextInfo}. ${errorMessage}`);
      }
    } while (params.starting_token);

    return allDatasetsOpenAPI.map((ds) =>
      this.convertToCamelCase<DatasetOpenAPI, DatasetDBType>(ds)
    );
  }

  public async getDataset(datasetId: string): Promise<DatasetDBType> {
    const response = await this.makeRequest<DatasetOpenAPI>(
      RequestMethod.GET,
      Routes.dataset,
      null,
      { dataset_id: datasetId }
    );

    return this.convertToCamelCase<DatasetOpenAPI, DatasetDBType>(response);
  }

  public async getDatasetEtag(datasetId: string): Promise<string> {
    const response = await this.makeRequestRaw<DatasetDBType>(
      RequestMethod.GET,
      Routes.datasetContent,
      null,
      { dataset_id: datasetId, limit: 1 }
    );
    return response.headers['etag'];
  }

  public async getDatasetByName(name: string): Promise<DatasetDBType> {
    const response = await this.makeRequest<ListDatasetResponseOpenAPI>(
      RequestMethod.POST,
      Routes.datasetsQuery,
      {
        filters: [
          {
            name: 'name',
            value: name,
            operator: 'eq'
          }
        ]
      }
    );

    const formattedResponse = this.convertToCamelCase<
      ListDatasetResponseOpenAPI,
      ListDatasetResponse
    >(response);

    if (!formattedResponse.datasets?.length) {
      throw new Error(`Galileo dataset ${name} not found`);
    }

    if (formattedResponse.datasets?.length > 1) {
      throw new Error(`Multiple Galileo datasets found with name: ${name}`);
    }

    return formattedResponse.datasets[0];
  }

  public async createDataset(options: {
    name: string;
    filePath: string;
    format: DatasetFormat;
    projectId?: string | null;
    draft?: boolean;
    hidden?: boolean;
    appendSuffixIfDuplicate?: boolean;
    copyFromDatasetId?: string | null;
    copyFromDatasetVersionIndex?: number | null;
  }): Promise<DatasetDBType> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    let fileBuffer: Buffer;
    try {
      fileBuffer = await fs.readFile(options.filePath);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to read file '${options.filePath}' for dataset '${options.name}': ${errorMessage}`
      );
    }

    // Convert Buffer to Uint8Array for Blob compatibility
    const blob: Blob = new Blob([new Uint8Array(fileBuffer)]);

    const body: BodyCreateDatasetDatasetsPost = {
      name: options.name,
      project_id: options?.projectId ?? null,
      draft: options?.draft ?? false,
      hidden: options?.hidden ?? false,
      append_suffix_if_duplicate: options?.appendSuffixIfDuplicate ?? false,
      copy_from_dataset_id: options?.copyFromDatasetId ?? null,
      copy_from_dataset_version_index:
        options?.copyFromDatasetVersionIndex ?? null,
      file: blob
    };

    const formdata = new FormData();
    for (const [key, value] of Object.entries(body)) {
      if (value === undefined || value === null) continue;

      if (key === 'file' && value instanceof Blob) {
        // Include filename for consistency
        formdata.append('file', value, options.name);
      } else {
        // All non-file fields are sent as text parts
        formdata.append(key, String(value));
      }
    }

    try {
      const datasetOpenAPI = await this.makeRequest<DatasetOpenAPI>(
        RequestMethod.POST,
        Routes.datasets,
        // Send FormData directly; Axios will handle multipart encoding
        formdata,
        { format: options.format }
      );

      const dataset = this.convertToCamelCase<DatasetOpenAPI, DatasetDBType>(
        datasetOpenAPI
      );
      getSdkLogger().info(
        `✅  Dataset '${dataset.name}' with ${dataset.numRows} rows uploaded.`
      );

      return dataset;
    } catch (error) {
      // Enhance error with upload context
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const contextInfo = `Failed to create dataset '${options.name}'`;
      throw new Error(`${contextInfo}. ${errorMessage}`);
    }
  }

  public async getDatasetContent(datasetId: string): Promise<DatasetRow[]> {
    const allRows: DatasetRowOpenAPI[] = [];
    let pageNumber = 1;

    const params = { starting_token: 0, dataset_id: datasetId };

    do {
      try {
        // Fetch a single page in OpenAPI (snake_case) form
        const pageOpenAPI = await this.makeRequest<DatasetContentOpenAPI>(
          RequestMethod.GET,
          Routes.datasetContent,
          undefined,
          params
        );

        if (pageOpenAPI.rows?.length) {
          allRows.push(...pageOpenAPI.rows);
        }

        params.starting_token = pageOpenAPI.next_starting_token ?? 0;
        pageNumber++;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const contextInfo = `Failed to fetch dataset content for '${datasetId}' at page ${pageNumber}`;
        throw new Error(`${contextInfo}. ${errorMessage}`);
      }
    } while (params.starting_token);

    return allRows.map((row: DatasetRowOpenAPI) =>
      this.convertToCamelCase<DatasetRowOpenAPI, DatasetRow>(row)
    );
  }

  public async appendRowsToDatasetContent(
    datasetId: string,
    etag: string,
    rows: DatasetAppendRow[]
  ): Promise<void> {
    const extraHeaders = {
      'If-Match': etag
    };

    const rowsOpenAPI = rows.map((row) =>
      this.convertToSnakeCase<DatasetAppendRow, DatasetAppendRowOpenAPI>(row)
    );
    await this.makeRequest<void>(
      RequestMethod.PATCH,
      Routes.datasetContent,
      { edits: rowsOpenAPI },
      { dataset_id: datasetId },
      extraHeaders
    );
  }

  /**
   * Deletes a dataset by its unique identifier or name.
   *
   * If both `id` and `name` are provided, `id` takes precedence.
   * If only `name` is provided, the dataset will be looked up by name.
   * Throws an error if neither `id` nor `name` is provided, or if the dataset cannot be found.
   *
   * @param id - (Optional) The unique identifier of the dataset to delete.
   * @param name - (Optional) The name of the dataset to delete.
   * @returns A promise that resolves when the dataset is deleted.
   * @throws Error if the client is not initialized, neither id nor name is provided, or the dataset cannot be found.
   */
  public async deleteDataset(id: string): Promise<void> {
    await this.makeRequest<void>(RequestMethod.DELETE, Routes.dataset, null, {
      dataset_id: id
    });
  }

  public async extendDataset(
    params: SyntheticDatasetExtensionRequest
  ): Promise<SyntheticDatasetExtensionResponse> {
    const request = this.convertToSnakeCase<
      SyntheticDatasetExtensionRequest,
      SyntheticDatasetExtensionRequestOpenAPI
    >(params);

    const response =
      await this.makeRequest<SyntheticDatasetExtensionResponseOpenAPI>(
        RequestMethod.POST,
        Routes.datasetExtend,
        request
      );

    return this.convertToCamelCase<
      SyntheticDatasetExtensionResponseOpenAPI,
      SyntheticDatasetExtensionResponse
    >(response);
  }

  public getExtendDatasetStatus = async (
    datasetId: string
  ): Promise<JobProgress> => {
    const response = await this.makeRequest<JobProgressOpenAPI>(
      RequestMethod.GET,
      Routes.datasetExtendStatus,
      null,
      { dataset_id: datasetId }
    );

    return this.convertToCamelCase<JobProgressOpenAPI, JobProgress>(response);
  };

  /**
   * Queries datasets with filters.
   * Equivalent to Python's query_datasets_datasets_query_post.
   */
  public async queryDatasets(
    params: ListDatasetParams,
    query?: {
      startingToken?: number;
      limit?: number;
    }
  ): Promise<ListDatasetResponse> {
    const request = this.convertToSnakeCase<
      ListDatasetParams,
      ListDatasetParamsOpenAPI
    >(params);

    const queryRequest = query
      ? { starting_token: query.startingToken, limit: query.limit }
      : { limit: 100 };

    const response = await this.makeRequest<ListDatasetResponseOpenAPI>(
      RequestMethod.POST,
      Routes.datasetsQuery,
      request,
      queryRequest
    );

    return this.convertToCamelCase<
      ListDatasetResponseOpenAPI,
      ListDatasetResponse
    >(response);
  }

  /**
   * Gets the version history of a dataset.
   * Equivalent to Python's query_dataset_versions_datasets_dataset_id_versions_query_post.
   */
  public async getDatasetVersionHistory(
    datasetId: string
  ): Promise<DatasetVersionHistory> {
    const response = await this.makeRequest<DatasetVersionHistoryOpenAPI>(
      RequestMethod.POST,
      Routes.datasetVersionsQuery,
      undefined,
      { dataset_id: datasetId }
    );

    return this.convertToCamelCase<
      DatasetVersionHistoryOpenAPI,
      DatasetVersionHistory
    >(response);
  }

  /**
   * Gets the content of a specific version of a dataset.
   * Equivalent to Python's get_dataset_version_content_datasets_dataset_id_versions_version_index_content_get.
   */
  public async getDatasetVersionContent(
    datasetId: string,
    versionIndex: number
  ): Promise<DatasetContent> {
    const response = await this.makeRequest<DatasetContentOpenAPI>(
      RequestMethod.GET,
      Routes.datasetVersionContent,
      undefined,
      { dataset_id: datasetId, version_index: versionIndex.toString() }
    );

    return this.convertToCamelCase<DatasetContentOpenAPI, DatasetContent>(
      response
    );
  }

  /**
   * Lists all projects that use a dataset.
   * Equivalent to Python's list_dataset_projects_datasets_dataset_id_projects_get.
   */
  public async listDatasetProjects(
    datasetId: string,
    limit: number = 100
  ): Promise<ListDatasetProjectsResponse> {
    const response = await this.makeRequest<ListDatasetProjectsResponseOpenAPI>(
      RequestMethod.GET,
      Routes.datasetProjects,
      undefined,
      { dataset_id: datasetId, limit }
    );

    return this.convertToCamelCase<
      ListDatasetProjectsResponseOpenAPI,
      ListDatasetProjectsResponse
    >(response);
  }
}
