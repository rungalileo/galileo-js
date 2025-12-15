import { LogStream } from '../types/log-stream.types';
import { GalileoApiClient } from '../api-client';
import {
  GalileoMetrics,
  LocalMetricConfig,
  Metric
} from '../types/metrics.types';
import { createMetricConfigs } from './metrics';
import { getProject } from './projects';

/*
 * Gets all log streams.
 */
export const getLogStreams = async (
  projectName: string
): Promise<LogStream[]> => {
  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectName });
  return await apiClient.getLogStreams();
};

/*
 * Creates a new log stream.
 */
export const createLogStream = async (
  name: string,
  projectName: string
): Promise<LogStream> => {
  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectName });
  return await apiClient.createLogStream(name);
};

/*
 * Gets a log stream by id or name.
 */
export const getLogStream = async ({
  id,
  name,
  projectName
}: {
  id?: string;
  name?: string;
  projectName: string;
}): Promise<LogStream> => {
  if (!id && !name) {
    throw new Error(
      'To fetch a log stream with `getLogStream`, either id or name must be provided'
    );
  }

  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectName });
  if (id) {
    return await apiClient.getLogStream(id);
  }

  return await apiClient.getLogStreamByName(name!);
};

/**
 * Enable metrics for a log stream.
 *
 * Supports explicit parameters or environment variables (GALILEO_PROJECT/GALILEO_LOG_STREAM).
 *
 * @param options - Configuration options
 * @param options.logStreamName - Log stream name (overrides env var)
 * @param options.projectName - Project name (overrides env var)
 * @param options.metrics - Metrics to enable. Accepts:
 *   - GalileoMetrics const object values (e.g., GalileoMetrics.correctness)
 *   - String names (e.g., 'toxicity')
 *   - Metric objects (e.g., { name: 'custom', version: 2 })
 *   - LocalMetricConfig objects with scorerFn for client-side scoring
 *
 * @returns LocalMetricConfig[] - Client-side metrics that need local processing.
 *          Server-side metrics are automatically registered.
 *
 * @throws Error if project/log stream not found or metrics don't exist
 *
 * @example
 * ```typescript
 * const localMetrics = await enableMetrics({
 *   projectName: 'My Project',
 *   logStreamName: 'Production',
 *   metrics: [GalileoMetrics.correctness, 'toxicity']
 * });
 * ```
 */
export const enableMetrics = async ({
  logStreamName,
  projectName,
  metrics
}: {
  logStreamName?: string;
  projectName?: string;
  metrics: (GalileoMetrics | Metric | LocalMetricConfig | string)[];
}): Promise<LocalMetricConfig[]> => {
  // Validate metrics array
  if (!metrics || metrics.length === 0) {
    throw new Error('At least one metric must be provided');
  }

  // Apply environment variable fallbacks
  const finalProjectName =
    projectName ||
    process.env.GALILEO_PROJECT ||
    process.env.GALILEO_PROJECT_NAME;
  const finalLogStreamName =
    logStreamName ||
    process.env.GALILEO_LOG_STREAM ||
    process.env.GALILEO_LOG_STREAM_NAME;

  if (!finalProjectName) {
    throw new Error(
      'Project name must be provided via projectName parameter or GALILEO_PROJECT/GALILEO_PROJECT_NAME environment variable'
    );
  }

  if (!finalLogStreamName) {
    throw new Error(
      'Log stream name must be provided via logStreamName parameter or GALILEO_LOG_STREAM/GALILEO_LOG_STREAM_NAME environment variable'
    );
  }

  // Get project
  const project = await getProject({ name: finalProjectName });
  if (!project || !project.id) {
    throw new Error(`Project '${finalProjectName}' not found`);
  }

  // Get log stream
  const logStream = await getLogStream({
    name: finalLogStreamName,
    projectName: finalProjectName
  });
  if (!logStream || !logStream.id) {
    throw new Error(
      `Log stream '${finalLogStreamName}' not found in project '${finalProjectName}'`
    );
  }

  // Create metric configurations
  const [, localMetrics] = await createMetricConfigs(
    project.id,
    logStream.id,
    metrics
  );
  return localMetrics;
};
