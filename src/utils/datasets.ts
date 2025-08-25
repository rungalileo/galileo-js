import { DatasetRow, GalileoApiClient } from '../api-client';
import {
  Dataset,
  DatasetRecord,
  DatasetRecordOptions
} from '../types/dataset.types';
import { existsSync, PathLike, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { RunExperimentParams } from './experiments';

export const getDatasets = async (): Promise<Dataset[]> => {
  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectScoped: false });

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

export type DatasetType =
  | PathLike
  | string
  | Record<string, string[] | Record<string, string>[]> // column name -> values list
  | Array<Record<string, string | Record<string, string>>>; // rows, each row is a dictionary of column name -> value

enum DatasetFormat {
  CSV = 'csv',
  JSONL = 'jsonl',
  FEATHER = 'feather'
}

function stringify_value(value: string | Record<string, string>): string {
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return value;
}

function transposeDictToRows(
  dataset: Record<string, string[]>
): Array<Record<string, string>> {
  const keyRows = Object.entries(dataset).map(([key, values]) =>
    values.map((value) => ({ [key]: stringify_value(value) }))
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
    const tempFilePath = join(tmpdir(), `temp.${DatasetFormat.JSONL}`);
    const rows = datasetRows.map((row) => stringify_value(row)).join('\n');
    writeFileSync(tempFilePath, rows, { encoding: 'utf-8' });
    datasetPath = tempFilePath;
  } else if (Array.isArray(dataset)) {
    const tempFilePath = join(tmpdir(), `temp.${DatasetFormat.JSONL}`);
    const rows = dataset
      .map((item) => {
        const jsonifiedInner: Record<string, string> = {};
        for (const key in item) {
          jsonifiedInner[key] = stringify_value(item[key]);
        }
        return stringify_value(jsonifiedInner);
      })
      .join('\n');
    writeFileSync(tempFilePath, rows, { encoding: 'utf-8' });
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
  name: string
): Promise<Dataset> => {
  const [datasetPath, datasetFormat] = parseDataset(dataset);

  if (!name) {
    // use file name
    name = datasetPath.toString().split('/').pop() ?? datasetPath.toString();
  }

  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectScoped: false });

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
export const getDataset = async ({
  id,
  name
}: {
  id?: string;
  name?: string;
}): Promise<Dataset> => {
  if (!id && !name) {
    throw new Error('Either id or name must be provided');
  }

  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectScoped: false });

  if (id) {
    return await apiClient.getDataset(id);
  }

  return await apiClient.getDatasetByName(name!);
};

export const getDatasetContent = async ({
  datasetId,
  datasetName
}: {
  datasetId?: string;
  datasetName?: string;
}): Promise<DatasetRow[]> => {
  if (!datasetId && !datasetName) {
    throw new Error('Either datasetId or datasetName must be provided');
  }

  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectScoped: false });

  if (datasetName) {
    const dataset = await apiClient.getDatasetByName(datasetName);
    if (!dataset) {
      throw new Error(`Dataset not found: ${datasetName}`);
    }
    datasetId = dataset.id;
  }

  return await apiClient.getDatasetContent(datasetId!);
};

export const createDatasetRecord = ({
  id,
  input,
  output,
  metadata
}: DatasetRecordOptions): DatasetRecord => {
  let resultMetadata: Record<string, string> | undefined = undefined;
  if (metadata != null) {
    // checks null & undefined
    let record: Record<string, unknown> = {};
    if (typeof metadata === 'string') {
      try {
        record = JSON.parse(metadata);
      } catch (error) {
        if (isJsonParseError(error)) {
          record = { metadata: metadata };
        } else {
          throw error;
        }
      }
    } else if (typeof metadata === 'object') {
      record = metadata as Record<string, unknown>;
    } else {
      throw new Error('Dataset metadata must be a string or object');
    }
    for (const value of Object.values(record)) {
      if (typeof value !== 'string') {
        throw new Error('Dataset metadata values must be strings');
      }
    }
    resultMetadata = record as Record<string, string>;
  }

  return {
    id,
    input: serializeToString(input),
    output: output === undefined ? undefined : serializeToString(output),
    metadata: resultMetadata
  };
};

const serializeToString = (value: unknown): string => {
  return typeof value === 'string' ? value : JSON.stringify(value);
};

export const deserializeInputFromString = (
  value?: string
): Record<string, unknown> => {
  if (value === undefined) {
    return {};
  }
  try {
    return JSON.parse(value);
  } catch (error) {
    if (isJsonParseError(error)) {
      return { value: value };
    } else {
      throw error;
    }
  }
};

const isJsonParseError = (error: unknown): boolean => {
  return (
    error instanceof SyntaxError &&
    // ts 20+
    (error.message.includes('is not valid JSON') ||
      // ts 18
      (error.message.includes('Unexpected token') &&
        error.message.includes('in JSON')))
  );
};

export const getRecordsForDataset = async ({
  datasetId,
  datasetName
}: {
  datasetId?: string;
  datasetName?: string;
}): Promise<DatasetRecord[]> => {
  const datasetRows = await getDatasetContent({ datasetId, datasetName });
  return Promise.all(
    datasetRows.map((row) => convertDatasetRowToRecord({ datasetRow: row }))
  );
};

export const getDatasetRecordsFromArray = async (
  recordsArray: Record<string, unknown>[]
): Promise<DatasetRecord[]> => {
  return Promise.all(
    recordsArray.map((row) =>
      createDatasetRecord({
        input: row['input'],
        output: row['output'],
        metadata: row['metadata']
      })
    )
  );
};

export const convertDatasetRowToRecord = async ({
  datasetRow
}: {
  datasetRow: DatasetRow;
}): Promise<DatasetRecord> => {
  const valuesDict = datasetRow.values_dict;
  if (!('input' in valuesDict)) {
    throw new Error('DatasetRow must have an "input" field');
  }
  return createDatasetRecord({
    id: datasetRow.row_id,
    input: valuesDict['input'],
    output: valuesDict['output'],
    metadata: valuesDict['metadata']
  });
};

/*
 * Appends rows to a dataset.
 *
 * @param datasetId - The ID of the dataset to which rows will be appended.
 * @param rows - An array of rows to append to the dataset.
 * @returns A Promise that resolves when the rows have been appended.
 *
 * @example
 * ```typescript
 * await addRowsToDataset(datasetId, [{ input: 'value1', output: 'value2' }]);
 * ```
 */
export const addRowsToDataset = async ({
  datasetId,
  rows
}: {
  datasetId: string;
  rows: Record<string, string | Record<string, string>>[];
}): Promise<void> => {
  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectScoped: false });
  const etag = await apiClient.getDatasetEtag(datasetId);
  const stringifiedRows = rows.map((row) => {
    const stringifiedRow: Record<string, string> = {};
    for (const key in row) {
      stringifiedRow[key] = stringify_value(row[key]);
    }
    return stringifiedRow;
  });

  await apiClient.appendRowsToDatasetContent(
    datasetId,
    etag,
    stringifiedRows.map((row) => ({
      edit_type: 'append_row',
      values: row
    }))
  );
};

// TODO: Remove this once the datasets team adds a dictionary field to DatasetRow
export const convertDatasetContentToRecords = async (
  dataset: Dataset,
  datasetContent: DatasetRow[]
): Promise<Record<string, string>[]> => {
  if (!dataset.column_names) {
    throw new Error('Column names not found in dataset');
  }
  return datasetContent.map((row) => {
    const record: Record<string, string> = {};
    for (let i = 0; i < dataset.column_names!.length; i++) {
      record[dataset.column_names![i]] = (row.values[i] || '') as string;
    }
    return record;
  });
};

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
 * @throws Error if neither id nor name is provided, or if the dataset cannot be found.
 */
export const deleteDataset = async ({
  id,
  name
}: {
  id?: string;
  name?: string;
}): Promise<void> => {
  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectScoped: false });
  if (!id && !name) {
    throw new Error('Either id or name must be provided');
  }

  if (name && !id) {
    const dataset = await apiClient.getDatasetByName(name);
    id = dataset.id;
  }

  await apiClient.deleteDataset(id!);
};

export const loadDataset = async <T extends Record<string, unknown>>(
  params: RunExperimentParams<T>,
  projectName: string
): Promise<Dataset | undefined> => {
  if ('dataset' in params && params.dataset) {
    if (!(params.dataset instanceof Array)) {
      return params.dataset as Dataset;
    }
  } else if ('datasetId' in params) {
    const apiClient = new GalileoApiClient();
    await apiClient.init({ projectName });
    return await apiClient.getDataset(params.datasetId);
  } else if ('datasetName' in params) {
    const apiClient = new GalileoApiClient();
    await apiClient.init({ projectName });
    return await apiClient.getDatasetByName(params.datasetName);
  }
};
