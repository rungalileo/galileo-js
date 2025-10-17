import GalileoEvaluateApiClient from './evaluate/api-client';
import GalileoEvaluateWorkflow from './evaluate/workflow';
import GalileoObserveApiClient from './observe/api-client';
import GalileoObserveCallback from './observe/callback';
import GalileoObserveWorkflow from './observe/workflow';
import { GalileoApiClient } from './api-client';
import {
  GalileoScorers,
  RootType,
  LLMExportFormat,
  LogRecordsTextFilter,
  Metric,
  LocalMetricConfig
} from './types';
import {
  addRowsToDataset,
  createDataset,
  createDatasetRecord,
  deleteDataset,
  deserializeInputFromString,
  getDatasets,
  getDatasetContent,
  getDataset,
  getDatasetMetadata,
  extendDataset
} from './utils/datasets';
import { getMetrics, getTraces, getSpans, getSessions } from './utils/search';
import { exportRecords } from './utils/export';
import {
  createCustomLlmMetric,
  deleteMetric,
  createMetricConfigs
} from './utils/metrics';
import {
  getJobProgress,
  getScorerJobs,
  getScorerJobsStatus
} from './utils/jobs';
import {
  getPromptTemplate,
  getPromptTemplates,
  createPromptTemplate,
  createPrompt,
  getPrompts,
  getPrompt,
  deletePrompt
} from './utils/prompt-templates';
import { getProjects, createProject, getProject } from './utils/projects';
import {
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
import { updateScorerSettings } from './utils/runs';
import { getScorers } from './utils/scorers';
import { GalileoLogger } from './utils/galileo-logger';
import { init, flush, getLogger } from './singleton';
import { log } from './wrappers';
import { wrapOpenAI } from './openai';
import { GalileoCallback } from './handlers/langchain';
export {
  // Legacy clients
  GalileoObserveApiClient,
  GalileoObserveCallback,
  GalileoObserveWorkflow,
  GalileoEvaluateApiClient,
  GalileoEvaluateWorkflow,
  // Galileo 2.0 client and methods
  GalileoApiClient,
  GalileoLogger,
  GalileoCallback,
  GalileoScorers,
  Metric,
  LocalMetricConfig,
  RootType,
  LLMExportFormat,
  LogRecordsTextFilter,
  // OpenAI
  wrapOpenAI,
  // Datasets
  getDatasets,
  createDataset,
  getDatasetContent,
  getDataset,
  deleteDataset,
  addRowsToDataset,
  createDatasetRecord,
  deserializeInputFromString,
  getDatasetMetadata,
  extendDataset,
  // Prompt templates
  getPromptTemplate,
  getPromptTemplates,
  createPromptTemplate,
  getPrompts,
  getPrompt,
  createPrompt,
  deletePrompt,
  // Experiments
  getExperiments,
  createExperiment,
  getExperiment,
  runExperiment,
  // Projects
  getProjects,
  createProject,
  getProject,
  // Log streams
  getLogStreams,
  createLogStream,
  getLogStream,
  enableMetrics,
  // Logging
  log,
  init,
  flush,
  getLogger,
  // Metrics
  createCustomLlmMetric,
  deleteMetric,
  createMetricConfigs,
  getMetrics,
  // Jobs
  getJobProgress,
  getScorerJobs,
  getScorerJobsStatus,
  // Traces
  getTraces,
  getSpans,
  getSessions,
  exportRecords,
  // Runs
  updateScorerSettings,
  // Scorers
  getScorers
};
