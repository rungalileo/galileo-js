import { LogStreams, LogStream } from '../entities/log-streams';
import {
  GalileoMetrics,
  GalileoMetrics,
  LocalMetricConfig,
  Metric
} from '../types/metrics.types';

// Re-export classes
export { LogStreams, LogStream };

/**
 * Lists all log streams for a project.
 * @param projectName - The name of the project.
 * @returns A promise that resolves to an array of log streams.
 */
export async function getLogStreams(projectName: string): Promise<LogStream[]>;
/**
 * Lists all log streams for a project.
 * @param options - The options for listing log streams.
 * @param options.projectId - (Optional) The ID of the project.
 * @param options.projectName - (Optional) The name of the project.
 * @returns A promise that resolves to an array of log streams.
 */
export async function getLogStreams(options: {
  projectId?: string;
  projectName?: string;
}): Promise<LogStream[]>;
export async function getLogStreams(
  optionsOrProjectName:
    | {
        projectId?: string;
        projectName?: string;
      }
    | string
): Promise<LogStream[]> {
  const logStreams = new LogStreams();
  if (typeof optionsOrProjectName === 'string') {
    return await logStreams.list({ projectName: optionsOrProjectName });
  }
  return await logStreams.list(optionsOrProjectName);
}

/**
 * Creates a new log stream.
 * @param name - The name of the log stream.
 * @param projectName - The name of the project.
 * @returns A promise that resolves to the created log stream.
 */
export async function createLogStream(
  name: string,
  projectName: string
): Promise<LogStream>;
/**
 * Creates a new log stream.
 * @param name - The name of the log stream.
 * @param options - (Optional) The options for creating the log stream.
 * @param options.projectId - (Optional) The ID of the project.
 * @param options.projectName - (Optional) The name of the project.
 * @returns A promise that resolves to the created log stream.
 */
export async function createLogStream(
  name: string,
  options?: {
    projectId?: string;
    projectName?: string;
  }
): Promise<LogStream>;
export async function createLogStream(
  name: string,
  optionsOrProjectName?:
    | {
        projectId?: string;
        projectName?: string;
      }
    | string
): Promise<LogStream> {
  const logStreams = new LogStreams();
  if (typeof optionsOrProjectName === 'string') {
    return await logStreams.create(name, { projectName: optionsOrProjectName });
  }
  return await logStreams.create(name, optionsOrProjectName);
}

/**
 * Retrieves a log stream by ID or name.
 * @param options - The options for retrieving a log stream.
 * @param options.id - (Optional) The ID of the log stream.
 * @param options.name - (Optional) The name of the log stream.
 * @param options.projectName - The name of the project.
 * @returns A promise that resolves to the log stream.
 */
export async function getLogStream(options: {
  id?: string;
  name?: string;
  projectName: string;
}): Promise<LogStream>;
/**
 * Retrieves a log stream by ID or name.
 * @param options - The options for retrieving a log stream.
 * @param options.id - (Optional) The ID of the log stream.
 * @param options.name - (Optional) The name of the log stream.
 * @param options.projectId - (Optional) The ID of the project.
 * @param options.projectName - (Optional) The name of the project.
 * @returns A promise that resolves to the log stream.
 */
export async function getLogStream(options: {
  id?: string;
  name?: string;
  projectId?: string;
  projectName?: string;
}): Promise<LogStream>;
export async function getLogStream(options: {
  id?: string;
  name?: string;
  projectId?: string;
  projectName?: string;
}): Promise<LogStream> {
  if (!options.id && !options.name) {
    throw new Error(
      'To fetch a log stream with `getLogStream`, either id or name must be provided'
    );
  }

  const logStreams = new LogStreams();
  const logStream = await logStreams.get(options);
  if (!logStream) {
    const identifier = options.id || options.name;
    throw new Error(`Log stream '${identifier}' not found`);
  }
  return logStream;
}

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
export const enableMetrics = async (options: {
  logStreamName?: string;
  projectName?: string;
  metrics: (GalileoMetrics | Metric | LocalMetricConfig | string)[];
  metrics: (GalileoMetrics | Metric | LocalMetricConfig | string)[];
}): Promise<LocalMetricConfig[]> => {
  const logStreams = new LogStreams();
  return await logStreams.enableMetrics(options);
};
