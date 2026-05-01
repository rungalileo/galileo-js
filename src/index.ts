import GalileoEvaluateApiClient from './evaluate/api-client';
import GalileoEvaluateWorkflow from './evaluate/workflow';
import { GalileoApiClient } from './api-client';
import { GalileoConfig, type GalileoConfigInput } from 'galileo-generated';
import {
  GalileoMetrics,
  LocalMetricConfig,
  Metric
} from './types/metrics.types';
import {
  LogRecordsFilter,
  LogRecordsExportRequest
} from './types/export.types';
import {
  LogRecordsQueryFilter,
  LogRecordsSortClause,
  LogRecordsMetricsQueryRequest
} from './types/search.types';
import {
  DatasetRow,
  DatasetContent,
  DatasetFormat,
  ListDatasetResponse,
  SyntheticDatasetExtensionRequest,
  JobProgress
} from './types/dataset.types';
import type { RunExperimentParams } from './types/experiment.types';
import {
  addRowsToDataset,
  createDataset,
  deleteDataset,
  deserializeInputFromString,
  getRecordsForDataset,
  getDatasetRecordsFromArray,
  getDatasets,
  getDatasetContent,
  getDataset,
  getDatasetMetadata,
  extendDataset,
  getDatasetVersionHistory,
  getDatasetVersion,
  listDatasetProjects,
  convertDatasetRowToRecord,
  Dataset,
  Datasets
} from './utils/datasets';
import {
  createCustomLlmMetric,
  deleteMetric,
  createMetricConfigs,
  populateLocalMetrics,
  getMetrics
} from './utils/metrics';
import {
  getScorers,
  getScorerVersion,
  getScorersByLabels,
  getScorersByIds,
  createScorer,
  createLlmScorerVersion,
  createCodeScorerVersion,
  deleteScorer,
  validateCodeScorer
} from './utils/scorers';
import { Scorers, ScorerSettings } from './entities/scorers';
import { exportRecords } from './utils/export';
import { Jobs } from './utils/jobs';
import {
  getJobProgress,
  logScorerJobsStatus,
  getRunScorerJobs,
  getScorerJobsStatus,
  getJob
} from './utils/job-progress';
import {
  getPromptTemplate,
  getPromptTemplates,
  createPromptTemplate,
  createPrompt,
  getPrompts,
  getPrompt,
  deletePrompt,
  updatePrompt,
  renderPrompt
} from './utils/prompt-templates';
import {
  Projects,
  getProjects,
  createProject,
  getProject,
  getProjectWithEnvFallbacks,
  deleteProject,
  listProjectUserCollaborators,
  updateProjectUserCollaborator,
  shareProjectWithUser,
  unshareProjectWithUser
} from './utils/projects';
import {
  LogStreams,
  LogStream,
  getLogStreams,
  createLogStream,
  getLogStream,
  enableMetrics
} from './utils/log-streams';
import {
  getExperiments,
  createExperiment,
  getExperiment,
  runExperiment
} from './utils/experiments';
import { ExperimentTags } from './entities/experiment-tags';
import { Experiments } from './entities/experiments';
import type { LogTracesIngestRequest } from './types/logging/trace.types';
import { GalileoLogger } from './utils/galileo-logger';
import {
  init,
  flush,
  flushAll,
  getAllLoggers,
  getLogger,
  reset,
  resetAll,
  startSession,
  setSession,
  clearSession,
  galileoContext
} from './singleton';
import { log } from './wrappers';
import { wrapOpenAI, wrapAzureOpenAI } from './handlers/openai';
import { GalileoCallback } from './handlers/langchain';
import {
  GalileoTracingProcessor,
  GalileoCustomSpan,
  registerGalileoTraceProcessor
} from './handlers/openai-agents';
import {
  GalileoSpanProcessor,
  GalileoOTLPExporter,
  addGalileoSpanProcessor,
  GALILEO_ATTRIBUTES
} from './handlers/otel';
import { getSessions, getSpans, getTraces, RecordType } from './utils/search';
export {
  GalileoEvaluateApiClient,
  GalileoEvaluateWorkflow,
  // Galileo 2.0 client and methods
  GalileoApiClient,
  GalileoConfig,
  type GalileoConfigInput,
  GalileoLogger,
  GalileoCallback,
  GalileoMetrics,
  // OpenAI
  wrapOpenAI,
  wrapAzureOpenAI,
  // OpenAI Agents
  GalileoTracingProcessor,
  GalileoCustomSpan,
  registerGalileoTraceProcessor,
  // OpenTelemetry
  GalileoSpanProcessor,
  GalileoOTLPExporter,
  addGalileoSpanProcessor,
  GALILEO_ATTRIBUTES,
  // Datasets
  Dataset,
  Datasets,
  getDatasets,
  createDataset,
  getDatasetContent,
  getDataset,
  deleteDataset,
  addRowsToDataset,
  deserializeInputFromString,
  getRecordsForDataset,
  getDatasetRecordsFromArray,
  getDatasetMetadata,
  extendDataset,
  getDatasetVersionHistory,
  getDatasetVersion,
  listDatasetProjects,
  convertDatasetRowToRecord,
  // Prompt templates
  getPromptTemplate,
  getPromptTemplates,
  createPromptTemplate,
  getPrompts,
  getPrompt,
  createPrompt,
  deletePrompt,
  updatePrompt,
  renderPrompt,
  // Experiments
  getExperiments,
  createExperiment,
  getExperiment,
  runExperiment,
  // Experiment entities
  ExperimentTags,
  Experiments,
  // Projects
  Projects,
  getProjects,
  createProject,
  getProject,
  getProjectWithEnvFallbacks,
  deleteProject,
  listProjectUserCollaborators,
  updateProjectUserCollaborator,
  shareProjectWithUser,
  unshareProjectWithUser,
  // Log streams
  LogStreams,
  LogStream,
  getLogStreams,
  createLogStream,
  getLogStream,
  enableMetrics,
  // Logging
  log,
  init,
  flush,
  getAllLoggers,
  getLogger,
  reset,
  resetAll,
  flushAll,
  startSession,
  setSession,
  clearSession,
  galileoContext,
  // Metrics
  createCustomLlmMetric,
  getMetrics,
  deleteMetric,
  createMetricConfigs,
  populateLocalMetrics,
  // Scorers
  Scorers,
  ScorerSettings,
  getScorers,
  getScorerVersion,
  getScorersByLabels,
  getScorersByIds,
  createScorer,
  createLlmScorerVersion,
  createCodeScorerVersion,
  deleteScorer,
  validateCodeScorer,
  // Jobs (legacy)
  getScorerJobsStatus,
  // Job Progress (new standardized API)
  getJobProgress,
  logScorerJobsStatus,
  getRunScorerJobs,
  getJob,
  // Jobs class
  Jobs,
  // Search
  RecordType,
  getTraces,
  getSpans,
  getSessions,
  // Export
  exportRecords
};

export type {
  LogRecordsQueryFilter,
  LogRecordsSortClause,
  Metric,
  LocalMetricConfig,
  LogRecordsFilter,
  LogRecordsExportRequest,
  LogRecordsMetricsQueryRequest,
  LogTracesIngestRequest,
  DatasetRow,
  DatasetContent,
  DatasetFormat,
  ListDatasetResponse,
  SyntheticDatasetExtensionRequest,
  JobProgress,
  RunExperimentParams
};

export type { StartSessionOptions } from './types/logging/logger.types';

export type {
  GalileoSpanProcessorConfig,
  GalileoOTLPExporterConfig
} from './handlers/otel';

export {
  APIException,
  DatasetAPIException,
  ProjectAPIException
} from './utils/errors';

export {
  enableLogging,
  disableLogging,
  setCustomLogger,
  resetSdkLogger
} from 'galileo-generated';
