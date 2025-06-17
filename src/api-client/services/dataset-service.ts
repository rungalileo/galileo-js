import { BaseClient, RequestMethod } from '../base-client';
import { Routes } from '../../types/routes.types';
import { components, paths } from '../../types/api.types';
import { promises as fs } from 'fs';

export type DatasetFormat = components['schemas']['DatasetFormat'];
export type ListDatasetResponse = components['schemas']['ListDatasetResponse'];
export type DatasetContent = components['schemas']['DatasetContent'];
export type Dataset = components['schemas']['DatasetDB'];
export type DatasetRow = components['schemas']['DatasetRow'];
export type DatasetAppendRow = components['schemas']['DatasetAppendRow'];

type CollectionPaths =
  | paths['/datasets']
  | paths['/datasets/{dataset_id}/content'];
type CollectionResponse = ListDatasetResponse | DatasetContent;

export class DatasetService extends BaseClient {
  constructor(apiUrl: string, token: string) {
    super();
    this.apiUrl = apiUrl;
    this.token = token;
    this.initializeClient();
  }

  private async fetchAllPaginatedItems<
    Path extends CollectionPaths,
    Response extends CollectionResponse,
    Item
  >(
    path: '/datasets' | '/datasets/{dataset_id}/content',
    extractItems: (response: Response) => Item[],
    params: Path['get']['parameters']
  ): Promise<Item[]> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    let items: Item[] = [];
    let startingToken: number | null = 0;

    do {
      const updatedParams: Record<string, unknown> = {
        path: params.path,
        query: { ...params.query, starting_token: startingToken }
      };

      const { data, error } = await this.client.GET(path, {
        params: updatedParams
      });

      const collection = this.processResponse(data as Response, error);
      items = items.concat(extractItems(collection));
      startingToken = collection.next_starting_token ?? null;
    } while (startingToken !== null);

    return items;
  }

  public getDatasets = async (): Promise<Dataset[]> => {
    return await this.fetchAllPaginatedItems<
      paths['/datasets'],
      ListDatasetResponse,
      Dataset
    >(
      '/datasets',
      (response: ListDatasetResponse) => response.datasets ?? [],
      {}
    );
  };

  public getDataset = async (id: string): Promise<Dataset> => {
    return await this.makeRequest<Dataset>(
      RequestMethod.GET,
      Routes.dataset,
      null,
      { dataset_id: id }
    );
  };

  public getDatasetByName = async (name: string): Promise<Dataset> => {
    const { datasets } = await this.makeRequest<{ datasets: Dataset[] }>(
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

    if (!datasets.length) {
      throw new Error(`Galileo dataset ${name} not found`);
    }

    if (datasets.length > 1) {
      throw new Error(`Multiple Galileo datasets found with name: ${name}`);
    }

    return datasets[0];
  };

  public async createDataset(
    name: string,
    filePath: string,
    format: DatasetFormat
  ): Promise<Dataset> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    const fileBuffer: Buffer = await fs.readFile(filePath);
    const blob: Blob = new Blob([fileBuffer]);
    const formdata = new FormData();
    formdata.append('file', blob, name);

    const { data, error } = await this.client.POST('/datasets', {
      params: { query: { format } },
      // @ts-expect-error openapi-typescript does not properly translate FormData for uploading files
      body: formdata,
      bodySerializer: (body) => {
        // define a custom serializer to prevent openapi-fetch from serializing the FormData object as JSON
        return body;
      }
    });

    const dataset = this.processResponse(data, error) as Dataset;
    // eslint-disable-next-line no-console
    console.log(
      `✅  Dataset '${dataset.name}' with ${dataset.num_rows} rows uploaded.`
    );
    return dataset;
  }

  public async getDatasetContent(datasetId: string): Promise<DatasetRow[]> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    return await this.fetchAllPaginatedItems<
      paths['/datasets/{dataset_id}/content'],
      DatasetContent,
      DatasetRow
    >(
      `/datasets/{dataset_id}/content`,
      (response: DatasetContent) => response.rows ?? [],
      { path: { dataset_id: datasetId } }
    );
  }

  public async appendRowsToDatasetContent(
    datasetId: string,
    rows: DatasetAppendRow[]
  ): Promise<void> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    await this.makeRequest<void>(
      RequestMethod.POST,
      Routes.datasetContent,
      { rows },
      { dataset_id: datasetId }
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
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    const path = Routes.dataset.replace('{dataset_id}', id!);

    await this.makeRequest<void>(RequestMethod.DELETE, path as Routes);
  }
}
