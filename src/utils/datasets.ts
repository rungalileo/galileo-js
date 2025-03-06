import { GalileoApiClient, DatasetRow } from '../api-client';
import { Dataset } from '../types/dataset.types';
import { existsSync, PathLike, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

export const getDatasets = async (): Promise<Dataset[]> => {
  const apiClient = new GalileoApiClient();
  await apiClient.init();

  const datasets = await apiClient.getDatasets();
  return datasets.map((dataset) => ({
    id: dataset.id,
    name: dataset.name,
    column_names: dataset.column_names,
    project_count: dataset.project_count,
    created_at: dataset.created_at,
    updated_at: dataset.updated_at,
    num_rows: dataset.num_rows,
    created_by_user: dataset.created_by_user,
    current_version_index: dataset.current_version_index,
    draft: dataset.draft
  }));
};

type DatasetType =
  | PathLike
  | string
  | Record<string, string[]>
  | Array<Record<string, string>>;

enum DatasetFormat {
  CSV = 'csv',
  JSONL = 'jsonl',
  FEATHER = 'feather'
}

function transposeDictToRows(
  dataset: Record<string, string[]>
): Array<Record<string, string>> {
  const keyRows = Object.entries(dataset).map(([key, values]) =>
    values.map((value) => ({ [key]: value }))
  );
  return keyRows[0].map((_, i) =>
    Object.assign({}, ...keyRows.map((keyRow) => keyRow[i]))
  );
}

function parseDataset(dataset: DatasetType): [PathLike, DatasetFormat] {
  let datasetPath: PathLike;
  let datasetFormat: DatasetFormat;

  if (typeof dataset === 'string') {
    datasetPath = dataset;
  } else if (typeof dataset === 'object' && !Array.isArray(dataset)) {
    const datasetRows = transposeDictToRows(
      dataset as Record<string, string[]>
    );
    const tempFilePath = join(tmpdir(), `temp.${DatasetFormat.CSV}`);
    const header = Object.keys(datasetRows[0]).join(',') + '\n';
    const rows = datasetRows
      .map((row) => Object.values(row).join(','))
      .join('\n');
    writeFileSync(tempFilePath, header + rows, { encoding: 'utf-8' });
    datasetPath = tempFilePath;
  } else if (Array.isArray(dataset)) {
    const tempFilePath = join(tmpdir(), `temp.${DatasetFormat.CSV}`);
    const header = Object.keys(dataset[0]).join(',') + '\n';
    const rows = dataset.map((row) => Object.values(row).join(',')).join('\n');
    writeFileSync(tempFilePath, header + rows, { encoding: 'utf-8' });
    datasetPath = tempFilePath;
  } else {
    throw new Error(
      'Dataset must be a path to a file, a string, an array of objects, or an object of arrays.'
    );
  }

  if (!existsSync(datasetPath)) {
    throw new Error(`Dataset file ${datasetPath} does not exist.`);
  }

  const suffix = datasetPath.toString().split('.').pop()?.toLowerCase();
  switch (suffix) {
    case DatasetFormat.CSV:
      datasetFormat = DatasetFormat.CSV;
      break;
    case DatasetFormat.JSONL:
      datasetFormat = DatasetFormat.JSONL;
      break;
    case DatasetFormat.FEATHER:
      datasetFormat = DatasetFormat.FEATHER;
      break;
    default:
      throw new Error(
        `Dataset file ${datasetPath} must be a CSV, JSONL, or Feather file.`
      );
  }

  return [datasetPath, datasetFormat];
}

export const createDataset = async (
  dataset: DatasetType,
  name?: string
): Promise<Dataset> => {
  const [datasetPath, datasetFormat] = parseDataset(dataset);

  if (!name) {
    // use file name
    name = datasetPath.toString().split('/').pop() ?? datasetPath.toString();
  }

  const apiClient = new GalileoApiClient();
  await apiClient.init();

  const createdDataset = await apiClient.createDataset(
    name,
    datasetPath.toString(),
    datasetFormat
  );

  return {
    id: createdDataset.id,
    name: createdDataset.name,
    column_names: createdDataset.column_names,
    project_count: createdDataset.project_count,
    created_at: createdDataset.created_at,
    updated_at: createdDataset.updated_at,
    num_rows: createdDataset.num_rows,
    created_by_user: createdDataset.created_by_user,
    current_version_index: createdDataset.current_version_index,
    draft: createdDataset.draft
  };
};

/*
 * Gets a dataset by id or name.
 */
export const getDataset = async (
  id?: string,
  name?: string
): Promise<Dataset> => {
  if (!id && !name) {
    throw new Error('Either id or name must be provided');
  }

  const apiClient = new GalileoApiClient();
  await apiClient.init();

  if (id) {
    return await apiClient.getDataset(id);
  }

  return await apiClient.getDatasetByName(name!);
};

export const getDatasetContent = async (
  datasetId?: string,
  datasetName?: string
): Promise<DatasetRow[]> => {
  if (!datasetId && !datasetName) {
    throw new Error('Either datasetId or datasetName must be provided');
  }

  if (datasetName) {
    const datasets = await getDatasets();
    const dataset = datasets.find((d) => d.name === datasetName);
    if (!dataset) {
      throw new Error(`Dataset not found: ${datasetName}`);
    }
    datasetId = dataset.id;
  }

  const apiClient = new GalileoApiClient();
  await apiClient.init();
  return await apiClient.getDatasetContent(datasetId!);
};
