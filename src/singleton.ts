import { GalileoLogger, GalileoLoggerConfig } from './utils/galileo-logger';
import { LocalMetricConfig } from './types/metrics.types';

/**
 * A singleton class that manages a collection of GalileoLogger instances.
 *
 * This class ensures that only one instance exists across the application and
 * provides a way to retrieve or create GalileoLogger clients based on
 * the given 'project', 'log_stream'/'experiment_id', and 'mode' parameters.
 * If parameters are not provided, the class attempts to read values from
 * environment variables GALILEO_PROJECT and GALILEO_LOG_STREAM.
 */
export class GalileoSingleton {
  private static instance: GalileoSingleton;
  private _galileoLoggers: Map<string, GalileoLogger> = new Map();

  private constructor() {}

  public static getInstance(): GalileoSingleton {
    if (!this.instance) {
      this.instance = new GalileoSingleton();
    }
    return this.instance;
  }

  /**
   * @deprecated Use get() method instead. This method is kept for backwards compatibility.
   * Returns the default logger instance (uses environment variables or 'default' values).
   */
  public getClient(): GalileoLogger {
    return this.get();
  }

  /**
   * Generate a key string based on project, log_stream/experiment_id, and mode parameters.
   *
   * If project or log_stream are undefined, the method attempts to retrieve them
   * from environment variables (GALILEO_PROJECT and GALILEO_LOG_STREAM). If still
   * undefined, defaults to "default".
   *
   * @param project - The project name
   * @param log_stream - The log stream name (used when experimentId is not provided)
   * @param experiment_id - The experiment ID (takes precedence over log_stream)
   * @param mode - The logger mode (defaults to "batch")
   * @returns A string key used for caching
   */
  private static _getKey(
    project?: string | null,
    logstream?: string | null,
    experimentId?: string | null,
    mode: string = 'batch'
  ): string {
    // Apply environment variable fallbacks
    const projectName =
      project ??
      process.env.GALILEO_PROJECT ??
      process.env.GALILEO_PROJECT_NAME ??
      'default';
    const finalLogStream =
      logstream ??
      process.env.GALILEO_LOG_STREAM ??
      process.env.GALILEO_LOG_STREAM_NAME ??
      'default';

    // Use experimentId if provided, otherwise use log_stream
    const identifier = experimentId ?? finalLogStream;

    // Return a string key: "project:identifier:mode"
    return `${projectName}:${identifier}:${mode}`;
  }

  /**
   * Retrieve an existing GalileoLogger or create a new one if it does not exist.
   *
   * This method first computes the key from the parameters, checks if a logger
   * exists in the cache, and if not, creates a new GalileoLogger.
   *
   * @param options - Configuration options
   * @param options.project - The project name
   * @param options.log_stream - The log stream name (used when experiment_id is not provided)
   * @param options.experiment_id - The experiment ID (takes precedence over log_stream)
   * @param options.mode - The logger mode (defaults to "batch")
   * @param options.local_metrics - Local metrics to run on traces/spans (only used when initializing a new logger)
   * @returns An instance of GalileoLogger corresponding to the key
   */
  public get(
    options: {
      project?: string | null;
      logstream?: string | null;
      experimentId?: string | null;
      mode?: string;
      local_Metrics?: LocalMetricConfig[] | null;
    } = {}
  ): GalileoLogger {
    const {
      project = null,
      logstream = null,
      experimentId = null,
      mode = 'batch',
      local_Metrics = null
    } = options;

    // Compute the key based on provided parameters or environment variables
    const key = GalileoSingleton._getKey(
      project,
      logstream,
      experimentId,
      mode
    );

    // First check if logger already exists
    if (this._galileoLoggers.has(key)) {
      return this._galileoLoggers.get(key)!;
    }

    // Create new logger
    // Prepare initialization arguments, only including non-null values
    const config: GalileoLoggerConfig = {
      projectName: project ?? undefined,
      logStreamName: logstream ?? undefined,
      experimentId: experimentId ?? undefined,
      localMetrics: local_Metrics ?? undefined,
      mode: mode !== 'batch' ? mode : undefined
    };

    const logger = new GalileoLogger(config);

    // Cache the newly created logger
    this._galileoLoggers.set(key, logger);
    return logger;
  }

  /**
   * Retrieve a copy of the map containing all active loggers.
   *
   * @returns A map of keys to GalileoLogger instances
   */
  public getAll(): Map<string, GalileoLogger> {
    return this._galileoLoggers;
  }

  /**
   * Reset (terminate and remove) a GalileoLogger instance.
   *
   * @param options - Configuration options to identify which logger to reset
   * @param options.project - The project name
   * @param options.log_stream - The log stream name
   * @param options.experiment_id - The experiment ID
   * @param options.mode - The logger mode
   */
  public async reset(
    options: {
      project?: string | null;
      log_stream?: string | null;
      experiment_id?: string | null;
      mode?: string;
    } = {}
  ): Promise<void> {
    const {
      project = null,
      log_stream = null,
      experiment_id = null,
      mode = 'batch'
    } = options;
    const key = GalileoSingleton._getKey(
      project,
      log_stream,
      experiment_id,
      mode
    );

    const logger = this._galileoLoggers.get(key);
    if (logger) {
      await logger.terminate();
      this._galileoLoggers.delete(key);
    }
  }

  /**
   * Reset (terminate and remove) all GalileoLogger instances.
   */
  public async resetAll(): Promise<void> {
    const resetPromises = Array.from(this._galileoLoggers.values()).map(
      (logger) => logger.terminate()
    );
    await Promise.all(resetPromises);
    this._galileoLoggers.clear();
  }

  /**
   * Flush (upload) a GalileoLogger instance.
   *
   * @param options - Configuration options to identify which logger to flush
   * @param options.project - The project name
   * @param options.log_stream - The log stream name
   * @param options.experiment_id - The experiment ID
   * @param options.mode - The logger mode
   */
  public async flush(
    options: {
      project?: string | null;
      log_stream?: string | null;
      experiment_id?: string | null;
      mode?: string;
    } = {}
  ): Promise<void> {
    const {
      project = null,
      log_stream = null,
      experiment_id = null,
      mode = 'batch'
    } = options;
    const key = GalileoSingleton._getKey(
      project,
      log_stream,
      experiment_id,
      mode
    );

    const logger = this._galileoLoggers.get(key);
    if (logger) {
      await logger.flush();
    }
  }

  /**
   * Flush (upload) all GalileoLogger instances.
   */
  public async flushAll(): Promise<void> {
    const flushPromises = Array.from(this._galileoLoggers.values()).map(
      (logger) => logger.flush()
    );
    await Promise.all(flushPromises);
  }

  /**
   * Retrieve a copy of the map containing all active loggers.
   *
   * @returns A map of keys to GalileoLogger instances
   */
  public getAllLoggers(): Map<string, GalileoLogger> {
    // Return a shallow copy to prevent external modifications
    return new Map(this._galileoLoggers);
  }

  // Legacy methods for backward compatibility

  /**
   * @deprecated Use get() method instead. This maintains backward compatibility.
   */
  public setClient(client: GalileoLogger): void {
    // Store with default key
    const key = GalileoSingleton._getKey(null, null, null, 'batch');
    this._galileoLoggers.set(key, client);
  }
}

/*
 * Initializes the singleton client with the provided options.
 * If no options are provided, defaults to the following environment variables:
 * - GALILEO_PROJECT_NAME
 * - GALILEO_LOG_STREAM_NAME
 *
 * Example:
 *
 * ```typescript
 * import { init } from 'galileo';

 * init({
 *   projectName: 'my-project',
 *   logStreamName: 'my-log-stream'
 * });
 * ```
 */
export const init = async (
  options: {
    projectName?: string | undefined;
    logStreamName?: string | undefined;
    experimentId?: string | undefined;
    sessionId?: string | undefined;
    startNewSession?: boolean | undefined;
    sessionName?: string | undefined;
    previousSessionId?: string | undefined;
    externalId?: string | undefined;
  } = {}
) => {
  const singleton = GalileoSingleton.getInstance();
  const logger = singleton.get({
    project: options.projectName,
    logstream: options.logStreamName,
    experimentId: options.experimentId
  });

  if (options.startNewSession) {
    await logger.startSession({
      name: options.sessionName,
      previousSessionId: options.previousSessionId,
      externalId: options.externalId
    });
  }
};

/*
 * Uploads all captured traces to the Galileo platform
 *
 * Example:
 *
 * ```typescript
 * import { init, flush } from 'galileo';
 *
 * // Initialize the global context
 * // If you have GALILEO_PROJECT and GALILEO_LOG_STREAM environment variables set, you can skip this step
 * init({
 *   projectName: 'my-project',
 *   logStreamName: 'my-log-stream'
 * });
 *
 * // Your application logging code here
 *
 * // Upload all captured traces
 * await flush();
 * ```
 */
export const flushAll = async () => {
  await GalileoSingleton.getInstance().flushAll();
};

/*
 * Flush (upload) traces from a specific logger to the Galileo platform.
 *
 * Options provided determine which logger is flushed (no options means 'default' logger).
 *
 * Example:
 *
 * ```typescript
 * import { init, flush } from 'galileo';
 *
 * // Initialize loggers
 * await init({
 *   projectName: 'my-project',
 *   logStreamName: 'my-log-stream'
 * });
 *
 * // Your application logging code here
 *
 * // Flush default logger
 * await flush();
 *
 * // Or flush a specific logger
 * await flush({
 *   project: 'my-project',
 *   log_stream: 'my-log-stream'
 * });
 * ```
 */
export const flush = async (
  options: {
    project?: string | null;
    log_stream?: string | null;
    experiment_id?: string | null;
    mode?: string;
  } = {}
) => {
  if (Object.keys(options).length === 0) {
    // No options provided - flush all loggers
    await GalileoSingleton.getInstance().flushAll();
  } else {
    // Options provided - flush specific logger
    await GalileoSingleton.getInstance().flush(options);
  }
};

/*
 * @deprecated Use `get()` method instead for better control and multiple logger support.
 * Returns the default logger instance (uses environment variables or 'default' values).
 *
 * This legacy method only returns a single logger instance based on default environment
 * variables (GALILEO_PROJECT, GALILEO_LOG_STREAM) or 'default' values. For multiple
 * loggers or specific project/log_stream combinations, use the `get()` method instead.
 *
 * Example:
 *
 * ```typescript
 * import { init, getLogger } from 'galileo';
 *
 * // Initialize the default logger context
 * // If you have GALILEO_PROJECT and GALILEO_LOG_STREAM environment variables set, you can skip this step
 * init({
 *   projectName: 'my-project',
 *   logStreamName: 'my-log-stream'
 * });
 *
 * const logger = getLogger(); // Returns the default logger
 * ```
 *
 * Recommended alternative:
 *
 * ```typescript
 * import { get } from 'galileo';
 *
 * // Get specific logger
 * const logger = get({
 *   project: 'my-project',
 *   log_stream: 'my-log-stream'
 * });
 * ```
 */
export const getLogger = () => {
  return GalileoSingleton.getInstance().get();
};

/*
 * Get a logger instance using the new API with snake_case parameters.
 * This is the recommended way to get a logger with specific project/log_stream/experiment_id.
 *
 * Example:
 *
 * ```typescript
 * import { get } from 'galileo';
 *
 * const logger = get({
 *   project: 'my-project',
 *   log_stream: 'my-log-stream'
 * });
 * ```
 */
export const get = (
  options: {
    project?: string | null;
    log_stream?: string | null;
    experiment_id?: string | null;
    mode?: string;
    local_metrics?: LocalMetricConfig[] | null;
  } = {}
) => {
  return GalileoSingleton.getInstance().get(options);
};

/*
 * Get a map of all active loggers.
 *
 * Example:
 *
 * ```typescript
 * import { getAll } from 'galileo';
 *
 * const loggers = getAll();
 * ```
 */
export const getAll = () => {
  return GalileoSingleton.getInstance().getAll();
};

/*
 * Reset (terminate and remove) a specific logger instance.
 *
 * Example:
 *
 * ```typescript
 * import { reset } from 'galileo';
 *
 * await reset({
 *   project: 'my-project',
 *   log_stream: 'my-log-stream'
 * });
 * ```
 */
export const reset = async (
  options: {
    project?: string | null;
    log_stream?: string | null;
    experiment_id?: string | null;
    mode?: string;
  } = {}
) => {
  await GalileoSingleton.getInstance().reset(options);
};

/*
 * Reset (terminate and remove) all logger instances.
 *
 * Example:
 *
 * ```typescript
 * import { resetAll } from 'galileo';
 *
 * await resetAll();
 * ```
 */
export const resetAll = async () => {
  await GalileoSingleton.getInstance().resetAll();
};
