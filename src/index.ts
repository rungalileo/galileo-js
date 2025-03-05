import GalileoEvaluateApiClient from './evaluate/api-client';
import GalileoEvaluateWorkflow from './evaluate/workflow';
import GalileoObserveApiClient from './observe/api-client';
import GalileoObserveCallback from './observe/callback';
import GalileoObserveWorkflow from './observe/workflow';
import {
  getDatasets,
  createDataset,
  getDatasetContent,
  getDataset
} from './utils/datasets';
import { getProjects, createProject, getProject } from './utils/projects';
import {
  getLogStreams,
  createLogStream,
  getLogStream
} from './utils/log-streams';
import { GalileoLogger } from './utils/galileo-logger';
import { init, flush } from './singleton';
import { log } from './wrappers';
export {
  // Legacy clients
  GalileoObserveApiClient,
  GalileoObserveCallback,
  GalileoObserveWorkflow,
  GalileoEvaluateApiClient,
  GalileoEvaluateWorkflow,
  // Galileo 2.0 client and methods
  GalileoLogger,
  getDatasets,
  createDataset,
  getDatasetContent,
  getDataset,
  getProjects,
  createProject,
  getProject,
  getLogStreams,
  createLogStream,
  getLogStream,
  log,
  init,
  flush
};
