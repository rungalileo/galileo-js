import type {
  DatasetDb as DatasetDBType,
  DatasetRow,
  DatasetFormat,
  ListDatasetResponse,
  DatasetContent,
  DatasetAppendRow,
  SyntheticDatasetExtensionRequest,
  SyntheticDatasetExtensionResponse,
  JobProgress,
  ListDatasetVersionResponse as DatasetVersionHistory,
  DatasetProject,
  ListDatasetProjectsResponse,
  ListDatasetParams
} from './new-api.types';

import { DatasetFormat as DatasetFormatObject } from './new-api.types';

import type {
  DatasetDb as DatasetOpenAPI,
  DatasetRow as DatasetRowOpenAPI,
  DatasetFormat as DatasetFormatOpenAPI,
  ListDatasetResponse as ListDatasetResponseOpenAPI,
  DatasetContent as DatasetContentOpenAPI,
  DatasetAppendRow as DatasetAppendRowOpenAPI,
  SyntheticDatasetExtensionRequest as SyntheticDatasetExtensionRequestOpenAPI,
  SyntheticDatasetExtensionResponse as SyntheticDatasetExtensionResponseOpenAPI,
  JobProgress as JobProgressOpenAPI,
  ListDatasetVersionResponse as DatasetVersionHistoryOpenAPI,
  DatasetProject as DatasetProjectOpenAPI,
  ListDatasetProjectsResponse as ListDatasetProjectsResponseOpenAPI,
  ListDatasetParams as ListDatasetParamsOpenAPI
} from './openapi.types';

export {
  DatasetFormatObject,
  DatasetDBType,
  DatasetRow,
  DatasetFormat,
  ListDatasetResponse,
  DatasetContent,
  DatasetAppendRow,
  SyntheticDatasetExtensionRequest,
  SyntheticDatasetExtensionResponse,
  JobProgress,
  DatasetVersionHistory,
  DatasetProject,
  ListDatasetProjectsResponse,
  ListDatasetParams,
  DatasetOpenAPI,
  DatasetRowOpenAPI,
  DatasetFormatOpenAPI,
  ListDatasetResponseOpenAPI,
  DatasetContentOpenAPI,
  DatasetAppendRowOpenAPI,
  SyntheticDatasetExtensionRequestOpenAPI,
  SyntheticDatasetExtensionResponseOpenAPI,
  JobProgressOpenAPI,
  DatasetVersionHistoryOpenAPI,
  DatasetProjectOpenAPI,
  ListDatasetProjectsResponseOpenAPI,
  ListDatasetParamsOpenAPI
};

/**
 * Normalized row from a dataset: input, expected output, model output, and metadata.
 * @property id - (Optional) The unique identifier of the record.
 * @property input - (Optional) The serialized input value.
 * @property output - (Optional) The expected output or ground truth for API payloads.
 * @property groundTruth - (Optional) On records from createDatasetRecord, getDatasetRecordsFromArray, and related helpers, read-only alias for output (non-enumerable; omitted from Object.keys, for...in, and JSON.stringify). Hand-built objects may use a normal enumerable property instead.
 * @property generatedOutput - (Optional) The model-generated output; an enumerable own property included in JSON.stringify when defined.
 * @property metadata - (Optional) Additional metadata as string key-value pairs.
 */
export interface DatasetRecord {
  id?: string;
  input?: string;
  output?: string;
  readonly groundTruth?: string;
  generatedOutput?: string;
  metadata?: Record<string, string>;
}

export interface DatasetRecordOptions {
  id?: string;
  input: unknown;
  output?: unknown;
  groundTruth?: unknown;
  generatedOutput?: unknown;
  metadata?: unknown;
}

export type DatasetType =
  | string
  | Record<string, string[] | Record<string, string>[]>
  | Array<Record<string, string | Record<string, string>>>;

export type CreateDatasetOptions = {
  name: string;
  content: DatasetType;
  projectId?: string;
  projectName?: string;
};
