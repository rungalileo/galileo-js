import GalileoEvaluateApiClient from './evaluate/api-client';
import GalileoEvaluateWorkflow from './evaluate/workflow';
import GalileoObserveApiClient from './observe/api-client';
import GalileoObserveCallback from './observe/callback';
import GalileoObserveWorkflow from './observe/workflow';
import { GalileoApiClient } from './api-client';
import { GalileoConfig, type GalileoConfigInput } from 'galileo-generated';
import {
  GalileoMetrics,
  GalileoScorers,
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
  createDatasetRecord,
  deleteDataset,
  deserializeInputFromString,
  convertDatasetContentToRecords,
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
  createCustomCodeMetric,
  deleteMetric,
  createMetricConfigs,
  populateLocalMetrics,
  getMetrics
} from './utils/metrics';
import {
  getScorers,
  getScorerVersion,
  createScorer,
  createLlmScorerVersion,
  createCodeScorerVersion,
  deleteScorer,
  createRunScorerSettings,
  validateCodeScorer
} from './utils/scorers';
import { Scorers, ScorerSettings } from './entities/scorers';
import { exportRecords } from './utils/export';
import { Jobs } from './utils/jobs';
import {
  getJobProgress,
  logScorerJobsStatus,
  getRunScorerJobs,
  getScorerJobs,
  getScorerJobsStatus,
  PollJobOptions,
  JobProgressLogger,
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
  addProjectUserCollaborators,
  updateProjectUserCollaborator,
  removeProjectUserCollaborator,
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
  runExperiment,
  updateExperiment,
  deleteExperiment
} from './utils/experiments';
import { ExperimentTags } from './entities/experiment-tags';
import { Experiments } from './entities/experiments';
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
import { wrapOpenAI, wrapAzureOpenAI } from './openai';
import { GalileoCallback } from './handlers/langchain';
import { getSessions, getSpans, getTraces, RecordType } from './utils/search';
export {
  // Legacy clients
  GalileoObserveApiClient,
  GalileoObserveCallback,
  GalileoObserveWorkflow,
  GalileoEvaluateApiClient,
  GalileoEvaluateWorkflow,
  // Galileo 2.0 client and methods
  GalileoApiClient,
  GalileoConfig,
  type GalileoConfigInput,
  GalileoLogger,
  GalileoCallback,
  GalileoMetrics,
  GalileoScorers,
  // OpenAI
  wrapOpenAI,
  wrapAzureOpenAI,
  // Datasets
  Dataset,
  Datasets,
  getDatasets,
  createDataset,
  getDatasetContent,
  getDataset,
  deleteDataset,
  addRowsToDataset,
  createDatasetRecord,
  deserializeInputFromString,
  convertDatasetContentToRecords,
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
  updateExperiment,
  deleteExperiment,
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
  addProjectUserCollaborators,
  updateProjectUserCollaborator,
  removeProjectUserCollaborator,
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
  createCustomCodeMetric,
  getMetrics,
  deleteMetric,
  createMetricConfigs,
  populateLocalMetrics,
  // Scorers
  Scorers,
  ScorerSettings,
  getScorers,
  getScorerVersion,
  createScorer,
  createLlmScorerVersion,
  createCodeScorerVersion,
  deleteScorer,
  createRunScorerSettings,
  validateCodeScorer,
  // Jobs (legacy)
  getScorerJobs,
  getScorerJobsStatus,
  // Job Progress (new standardized API)
  getJobProgress,
  logScorerJobsStatus,
  getRunScorerJobs,
  PollJobOptions,
  JobProgressLogger,
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
  DatasetRow,
  DatasetContent,
  DatasetFormat,
  ListDatasetResponse,
  SyntheticDatasetExtensionRequest,
  JobProgress,
  RunExperimentParams
};

export {
  APIException,
  ExperimentAPIException,
  DatasetAPIException,
  ProjectAPIException
} from './utils/errors';
