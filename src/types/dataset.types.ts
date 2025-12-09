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

export interface DatasetRecord {
  id?: string;
  input?: string;
  output?: string;
  metadata?: Record<string, string>;
}

export interface DatasetRecordOptions {
  id?: string;
  input: unknown;
  output?: unknown;
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
