import GalileoEvaluateApiClient from './evaluate/api-client';
import GalileoEvaluateWorkflow from './evaluate/workflow';
import GalileoObserveApiClient from './observe/api-client';
import GalileoObserveCallback from './observe/callback';
import GalileoObserveWorkflow from './observe/workflow';
import { GalileoApiClient } from './api-client';
import { GalileoScorers } from './types/metrics.types';
import {
  addRowsToDataset,
  createDataset,
  createDatasetRecord,
  deleteDataset,
  deserializeInputFromString,
  getDatasets,
  getDatasetContent,
  getDataset
} from './utils/datasets';
import {
  getMetrics,
  getTraces,
  getSpans,
  getSessions
} from './utils/search';
import { createCustomLlmMetric, deleteMetric } from './utils/metrics';
import { getJobProgress, getScorerJobsStatus } from './utils/jobs';
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
  getLogStream
} from './utils/log-streams';
import {
  getExperiments,
  createExperiment,
  getExperiment,
  runExperiment
} from './utils/experiments';
import { updateScorerSettings } from './utils/runs';
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
  // Logging
  log,
  init,
  flush,
  getLogger,
  // Metrics
  createCustomLlmMetric,
  deleteMetric,
  getMetrics,
  // Jobs
  getJobProgress,
  getScorerJobsStatus,
  // Traces
  getTraces,
  getSpans,
  getSessions,
  // Runs
  updateScorerSettings,
};
