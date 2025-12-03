import type {
  DatasetFormat,
  DatasetDBType,
  DatasetRecord,
  DatasetRecordOptions,
  DatasetVersionHistory,
  DatasetContent,
  DatasetProject,
  DatasetType,
  DatasetRow,
  SyntheticDatasetExtensionRequest,
  CreateDatasetOptions
} from '../types/dataset.types';
import { DatasetFormatObject } from '../types/dataset.types';
import { existsSync, PathLike, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { RunExperimentParams } from './experiments';
import { Dataset, Datasets } from '../entities/datasets';

// Re-export types
export { Dataset, Datasets };

// ============================================================================
// Internal Helper Functions
// ============================================================================

function _isCreateDatasetOptions(
  value: DatasetType | CreateDatasetOptions
): value is CreateDatasetOptions {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    'name' in value &&
    'content' in value
  );
}

function _serializeToString(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function _isJsonParseError(error: unknown): boolean {
  return (
    error instanceof SyntaxError &&
    // ts 20+
    (error.message.includes('is not valid JSON') ||
      // ts 18
      (error.message.includes('Unexpected token') &&
        error.message.includes('in JSON')))
  );
}

function _stringifyValue(value: string | Record<string, string>): string {
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return value;
}

function _transposeDictToRows(
  dataset: Record<string, string[]>
): Array<Record<string, string>> {
  const keyRows = Object.entries(dataset).map(([key, values]) =>
    values.map((value) => ({ [key]: _stringifyValue(value) }))
  );
  return keyRows[0].map((_, i) =>
    Object.assign({}, ...keyRows.map((keyRow) => keyRow[i]))
  );
}

function _parseDataset(dataset: DatasetType): [PathLike, DatasetFormat] {
  let datasetPath: PathLike;
  let datasetFormat: DatasetFormat;

  if (typeof dataset === 'string') {
    datasetPath = dataset;
  } else if (typeof dataset === 'object' && !Array.isArray(dataset)) {
    const datasetRows = _transposeDictToRows(
      dataset as Record<string, string[]>
    );
    const tempFilePath = join(tmpdir(), `temp.${DatasetFormatObject.JSONL}`);
    const rows = datasetRows.map((row) => _stringifyValue(row)).join('\n');
    writeFileSync(tempFilePath, rows, { encoding: 'utf-8' });
    datasetPath = tempFilePath;
  } else if (Array.isArray(dataset)) {
    const tempFilePath = join(tmpdir(), `temp.${DatasetFormatObject.JSONL}`);
    const rows = dataset
      .map((item) => {
        const jsonifiedInner: Record<string, string> = {};
        for (const key in item) {
          jsonifiedInner[key] = _stringifyValue(item[key]);
        }
        return _stringifyValue(jsonifiedInner);
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
    case DatasetFormatObject.CSV:
      datasetFormat = DatasetFormatObject.CSV;
      break;
    case DatasetFormatObject.JSONL:
      datasetFormat = DatasetFormatObject.JSONL;
      break;
    case DatasetFormatObject.FEATHER:
      datasetFormat = DatasetFormatObject.FEATHER;
      break;
    default:
      throw new Error(
        `Dataset file ${datasetPath} must be a CSV, JSONL, or Feather file.`
      );
  }

  return [datasetPath, datasetFormat];
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Creates a normalized dataset record from the provided options.
 * @param options - The options used to create the dataset record.
 * @param options.id - (Optional) The unique identifier of the record.
 * @param options.input - The input value to serialize into the record.
 * @param options.output - (Optional) The output value to serialize into the record.
 * @param options.metadata - (Optional) Additional metadata for the record as a string or object.
 * @returns The normalized dataset record.
 */
export function createDatasetRecord(
  options: DatasetRecordOptions
): DatasetRecord {
  let resultMetadata: Record<string, string> | undefined = undefined;
  if (options.metadata != null) {
    // checks null & undefined
    let record: Record<string, unknown> = {};
    if (typeof options.metadata === 'string') {
      try {
        record = JSON.parse(options.metadata);
      } catch (error) {
        if (_isJsonParseError(error)) {
          record = { metadata: options.metadata };
        } else {
          throw error;
        }
      }
    } else if (typeof options.metadata === 'object') {
      record = options.metadata as Record<string, unknown>;
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
    id: options.id,
    input: _serializeToString(options.input),
    output: options.output ? _serializeToString(options.output) : undefined,
    metadata: resultMetadata
  };
}

/**
 * Converts dataset rows to their values dictionaries.
 * @param datasetContent - The dataset rows to convert.
 * @returns The array of values dictionaries for each row.
 * @deprecated Use datasetContent.map(row => row.valuesDict) instead.
 */
export function convertDatasetContentToRecords(
  datasetContent: DatasetRow[]
): DatasetRow['valuesDict'][] {
  return datasetContent.map((row) => row.valuesDict);
}

/**
 * Deserializes a JSON string into an object, with a fallback for non-JSON values.
 * @param value - (Optional) The string value to deserialize.
 * @returns An object parsed from JSON, an object wrapping the raw value, or an empty object.
 */
export function deserializeInputFromString(
  value?: string
): Record<string, unknown> {
  if (value === undefined) {
    return {};
  }
  try {
    return JSON.parse(value);
  } catch (error) {
    if (_isJsonParseError(error)) {
      return { value: value };
    } else {
      throw error;
    }
  }
}

/**
 * Gets dataset records for a dataset identified by ID or name.
 * @param options - The options used to locate the dataset.
 * @param options.datasetId - (Optional) The ID of the dataset.
 * @param options.datasetName - (Optional) The name of the dataset.
 * @returns A promise that resolves to the list of dataset records.
 */
export async function getRecordsForDataset(options: {
  datasetId?: string;
  datasetName?: string;
}): Promise<DatasetRecord[]> {
  const datasetRows = await getDatasetContent({
    datasetId: options.datasetId,
    datasetName: options.datasetName
  });
  return datasetRows.map((row) => convertDatasetRowToRecord(row));
}

/**
 * Converts an array of raw record objects into dataset records.
 * @param recordsArray - The raw records to convert.
 * @returns The list of dataset records created from the raw records.
 */
export function getDatasetRecordsFromArray(
  recordsArray: Record<string, unknown>[]
): DatasetRecord[] {
  return recordsArray.map((row) =>
    createDatasetRecord({
      input: row['input'],
      output: row['output'],
      metadata: row['metadata']
    })
  );
}

// ============================================================================
// Overloaded Utility Functions - Delegate to Class Methods
// ============================================================================

/**
 * @overload
 * Lists all datasets.
 * @returns A promise that resolves to the list of datasets.
 */
export function getDatasets(): Promise<DatasetDBType[]>;
/**
 * @overload
 * Lists datasets with optional filtering by project.
 * @param options - (Optional) Options for listing datasets.
 * @param options.limit - (Optional) The maximum number of datasets to return.
 * @param options.projectId - (Optional) The ID of the project that uses the datasets.
 * @param options.projectName - (Optional) The name of the project that uses the datasets.
 * @returns A promise that resolves to the list of datasets.
 */
export function getDatasets(options: {
  limit?: number;
  projectId?: string;
  projectName?: string;
}): Promise<DatasetDBType[]>;
export async function getDatasets(options?: {
  limit?: number;
  projectId?: string;
  projectName?: string;
}): Promise<DatasetDBType[]> {
  const datasetsService = new Datasets();
  const datasets = await datasetsService.list(options);
  return datasets.map((dataset) => dataset.toDatasetDB());
}

/**
 * @overload
 * Creates a new dataset from content and a name.
 * @param dataset - The dataset content as a path, object, or array.
 * @param name - The name of the dataset.
 * @returns A promise that resolves to the created dataset.
 */
export function createDataset(
  dataset: DatasetType,
  name: string
): Promise<DatasetDBType>;
/**
 * @overload
 * Creates a new dataset from an options object.
 * @param options - The options used to create the dataset.
 * @param options.name - The name of the dataset.
 * @param options.content - The dataset content as a path, object, or array.
 * @param options.projectId - (Optional) The ID of the project that will use the dataset.
 * @param options.projectName - (Optional) The name of the project that will use the dataset.
 * @returns A promise that resolves to the created dataset.
 */
export function createDataset(
  options: CreateDatasetOptions
): Promise<DatasetDBType>;
export async function createDataset(
  datasetOrOptions: DatasetType | CreateDatasetOptions,
  name?: string
): Promise<DatasetDBType> {
  // Resolve overloaded arguments
  let resolvedOptions: {
    name: string;
    filePath: string;
    format: DatasetFormat;
    projectId?: string;
    projectName?: string;
  };

  if (_isCreateDatasetOptions(datasetOrOptions)) {
    // New object signature
    const [datasetPath, datasetFormat] = _parseDataset(
      datasetOrOptions.content as DatasetType
    );
    resolvedOptions = {
      name: datasetOrOptions.name,
      filePath: datasetPath.toString(),
      format: datasetFormat,
      projectId: datasetOrOptions.projectId,
      projectName: datasetOrOptions.projectName
    };
  } else {
    // Old positional signature: createDataset(dataset, name)
    const [datasetPath, datasetFormat] = _parseDataset(
      datasetOrOptions as DatasetType
    );
    const resolvedName =
      name ?? datasetPath.toString().split('/').pop() ?? datasetPath.toString();
    resolvedOptions = {
      name: resolvedName,
      filePath: datasetPath.toString(),
      format: datasetFormat
    };
  }

  const datasetsService = new Datasets();
  const dataset = await datasetsService.create(resolvedOptions);
  return dataset.toDatasetDB();
}

/**
 * Gets a dataset database record by ID or name with optional content loading and project validation.
 * Delegates to Datasets.get().
 * @param options - The options used to locate the dataset.
 * @param options.id - (Optional) The ID of the dataset.
 * @param options.name - (Optional) The name of the dataset.
 * @param options.withContent - (Optional) Whether to load the dataset content.
 * @param options.projectId - (Optional) The ID of the project to validate against.
 * @param options.projectName - (Optional) The name of the project to validate against.
 * @returns A promise that resolves to the dataset database object.
 */
export async function getDataset(options: {
  id?: string;
  name?: string;
  withContent?: boolean;
  projectId?: string;
  projectName?: string;
}): Promise<DatasetDBType> {
  const datasetsService = new Datasets();
  const dataset = await datasetsService.get(options);
  if (!dataset) {
    throw new Error(`Dataset ${options.name ?? options.id} not found`);
  }
  return dataset.toDatasetDB();
}

/**
 * Gets dataset content for a dataset identified by ID or name.
 * @param options - The options used to locate the dataset.
 * @param options.datasetId - (Optional) The ID of the dataset.
 * @param options.datasetName - (Optional) The name of the dataset.
 * @returns A promise that resolves to the rows of the dataset.
 */
export async function getDatasetContent(options: {
  datasetId?: string;
  datasetName?: string;
}): Promise<DatasetRow[]> {
  if (!options.datasetId && !options.datasetName) {
    throw new Error('Either datasetId or datasetName must be provided');
  }

  const datasetsService = new Datasets();
  const dataset = await datasetsService.get({
    id: options.datasetId,
    name: options.datasetName
  });

  if (!dataset) {
    throw new Error(
      `Dataset not found: ${options.datasetName ?? options.datasetId}`
    );
  }

  return await dataset.getContent();
}

/**
 * Appends rows to a dataset identified by ID or name.
 * Delegates to Dataset.addRows().
 * @param options - The options used to locate the dataset and rows to append.
 * @param options.datasetId - (Optional) The ID of the dataset.
 * @param options.datasetName - (Optional) The name of the dataset.
 * @param options.rows - The rows to append to the dataset.
 * @returns A promise that resolves when the rows have been appended.
 */
export async function addRowsToDataset(options: {
  datasetId?: string;
  datasetName?: string;
  rows: Record<string, string | Record<string, string>>[];
}): Promise<void> {
  const datasetsService = new Datasets();
  const dataset = await datasetsService.get({
    id: options.datasetId,
    name: options.datasetName
  });
  if (!dataset) {
    throw new Error(
      `Dataset ${options.datasetName ?? options.datasetId} not found`
    );
  }
  await dataset.addRows(options.rows);
}

/**
 * Deletes a dataset by its unique identifier or name.
 * Delegates to Datasets.delete().
 * @param options - The options used to locate the dataset.
 * @param options.id - (Optional) The ID of the dataset.
 * @param options.name - (Optional) The name of the dataset.
 * @param options.projectId - (Optional) The ID of the project to validate against.
 * @param options.projectName - (Optional) The name of the project to validate against.
 * @returns A promise that resolves when the dataset has been deleted.
 */
export async function deleteDataset(options: {
  id?: string;
  name?: string;
  projectId?: string;
  projectName?: string;
}): Promise<void> {
  const datasetsService = new Datasets();
  return datasetsService.delete(options);
}

/**
 * Gets dataset metadata from experiment params.
 * Delegates to Datasets.get() for fetching by id or name.
 * @param params - Experiment parameters that may contain a dataset reference.
 * @param projectName - Project name used for dataset lookup when needed.
 * @returns A promise that resolves to the dataset or null if not found.
 */
export async function getDatasetMetadata<T extends Record<string, unknown>>(
  params: RunExperimentParams<T>,
  projectName: string
): Promise<Dataset | null> {
  // If dataset object is directly provided, return it as-is
  if ('dataset' in params && params.dataset) {
    if (!(params.dataset instanceof Array)) {
      return params.dataset as Dataset;
    }
    return null;
  }

  // Delegate to Datasets service for fetching
  const datasetsService = new Datasets();

  if ('datasetId' in params && params.datasetId) {
    const dataset = await datasetsService.get({
      id: params.datasetId,
      projectName
    });
    return dataset;
  }

  if ('datasetName' in params && params.datasetName) {
    const dataset = await datasetsService.get({
      name: params.datasetName,
      projectName
    });
    return dataset;
  }

  return null;
}

/**
 * Extends a dataset with synthetically generated data based on the provided parameters.
 * Delegates to Datasets.extend().
 * @param params - Configuration for synthetic data generation.
 * @returns A promise that resolves to the generated dataset rows.
 */
export async function extendDataset(
  params: SyntheticDatasetExtensionRequest
): Promise<DatasetRow[]> {
  const datasetsService = new Datasets();
  return await datasetsService.extend(params);
}

// ============================================================================
// New Utility Functions for Dataset Versioning and Projects
// ============================================================================

/**
 * Gets the version history of a dataset.
 * Delegates to Datasets.getVersionHistory().
 * @param options - The options used to locate the dataset.
 * @param options.datasetId - (Optional) The ID of the dataset.
 * @param options.datasetName - (Optional) The name of the dataset.
 * @returns A promise that resolves to the version history for the dataset.
 */
export async function getDatasetVersionHistory(options: {
  datasetId?: string;
  datasetName?: string;
}): Promise<DatasetVersionHistory> {
  const datasetsService = new Datasets();
  return datasetsService.getVersionHistory({
    datasetId: options.datasetId,
    datasetName: options.datasetName
  });
}

/**
 * Gets a specific version of a dataset.
 * Delegates to Datasets.getVersion().
 * @param options - The options used to locate the dataset version.
 * @param options.versionIndex - The version index to retrieve.
 * @param options.datasetId - (Optional) The ID of the dataset.
 * @param options.datasetName - (Optional) The name of the dataset.
 * @returns A promise that resolves to the dataset content at the specified version.
 */
export async function getDatasetVersion(options: {
  versionIndex: number;
  datasetId?: string;
  datasetName?: string;
}): Promise<DatasetContent> {
  const datasetsService = new Datasets();
  return datasetsService.getVersion(options);
}

/**
 * Lists all projects that use a dataset.
 * Delegates to Datasets.listProjects().
 * @param options - The options used to locate the dataset.
 * @param options.datasetId - (Optional) The ID of the dataset.
 * @param options.datasetName - (Optional) The name of the dataset.
 * @param options.limit - (Optional) The maximum number of projects to return.
 * @returns A promise that resolves to the list of projects that use the dataset.
 */
export async function listDatasetProjects(options: {
  datasetId?: string;
  datasetName?: string;
  limit?: number;
}): Promise<DatasetProject[]> {
  const datasetsService = new Datasets();
  return datasetsService.listProjects({
    datasetId: options.datasetId,
    datasetName: options.datasetName,
    limit: options.limit ?? 100
  });
}

/**
 * Converts a dataset row to a dataset record.
 * @param datasetRow - The dataset row to convert.
 * @returns The dataset record created from the row.
 */
export function convertDatasetRowToRecord(
  datasetRow: DatasetRow
): DatasetRecord {
  const valuesDict = datasetRow.valuesDict;
  if (!('input' in valuesDict)) {
    throw new Error('DatasetRow must have an input field');
  }
  return createDatasetRecord({
    id: datasetRow.rowId,
    input: valuesDict['input'],
    output: valuesDict['output'],
    metadata: valuesDict['metadata']
  });
}
