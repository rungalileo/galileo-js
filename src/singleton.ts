import { GalileoLogger, GalileoLoggerConfig } from './utils/galileo-logger';
import { LocalMetricConfig } from './types/metrics.types';

/**
 * Options for identifying a logger by its key (project, logstream/experimentId, mode).
 *
 * @property {string} [projectName] - The project name. If not provided, will use the
 *   GALILEO_PROJECT or GALILEO_PROJECT_NAME environment variable, or default to 'default'.
 * @property {string} [logstream] - The log stream name. Used when experimentId is not provided.
 *   If not provided, will use the GALILEO_LOG_STREAM or GALILEO_LOG_STREAM_NAME environment
 *   variable, or default to 'default'. Ignored if experimentId is specified.
 * @property {string} [experimentId] - The experiment ID. Takes precedence over logstream when
 *   determining the logger key. If provided, logstream will be ignored.
 * @property {string} [mode] - The logger mode. Defaults to 'batch' if not specified.
 *   Common values: 'batch', 'streaming'. Different modes create different logger instances
 *   even with the same project/logstream combination.
 */
export interface LoggerKeyOptions {
  /** The project name */
  projectName?: string;
  /** The log stream name (used when experimentId is not provided) */
  logstream?: string;
  /** The experiment ID (takes precedence over logstream) */
  experimentId?: string;
  /** The logger mode (defaults to 'batch') */
  mode?: string;
}

/**
 * Extends LoggerKeyOptions with localMetrics, to configure new logger instances.
 *
 * @extends LoggerKeyOptions
 * @property {LocalMetricConfig[]} [localMetrics] - Local metrics to run on traces/spans.
 *   These are client-side metrics that are computed locally before ingestion. Only used when
 *   initializing a new logger instance. If a logger with the same key already exists, this
 *   parameter is ignored.
 */
export interface GetLoggerOptions extends LoggerKeyOptions {
  /** Local metrics to run on traces/spans (only used when initializing a new logger) */
  localMetrics?: LocalMetricConfig[];
}

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
   * @deprecated Use getLogger() method instead. This method is kept for backwards compatibility.
   * Returns the default logger instance (uses environment variables or 'default' values).
   */
  public getClient(): GalileoLogger {
    return this.getLogger();
  }

  /**
   * Generate a key string based on project, logstream/experimentId, and mode parameters.
   *
   * If project or logstream are undefined, the method attempts to retrieve them
   * from environment variables (GALILEO_PROJECT and GALILEO_LOG_STREAM). If still
   * undefined, defaults to "default".
   *
   * @param [projectName] - The project name
   * @param [logstream] - The log stream name (used when experimentId is not provided)
   * @param [experimentId] - The experiment ID (takes precedence over logstream)
   * @param [mode] - The logger mode (defaults to "batch")
   * @returns A string key used for caching
   */
  private static _getKey(
    projectName?: string,
    logstream?: string,
    experimentId?: string,
    mode?: string
  ): string {
    // Apply environment variable fallbacks
    const finalProjectName =
      projectName ??
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
    return `${finalProjectName}:${identifier}:${mode || 'batch'}`;
  }

  /**
   * Retrieve an existing GalileoLogger or create a new one if it does not exist.
   *
   * This method first computes the key from the parameters, checks if a logger
   * exists in the cache, and if not, creates a new GalileoLogger.
   *
   * @param options - Configuration options
   * @param options.[projectName] - The project name
   * @param options.[logstream] - The log stream name (used when experiment_id is not provided)
   * @param options.[experimentId] - The experiment ID (takes precedence over log_stream)
   * @param options.[mode] - The logger mode (defaults to "batch")
   * @param options.[localMetrics] - Local metrics to run on traces/spans (only used when initializing a new logger)
   * @returns An instance of GalileoLogger corresponding to the key
   */
  public getLogger(options: GetLoggerOptions = {}): GalileoLogger {
    // Compute the key based on provided parameters or environment variables
    const key = GalileoSingleton._getKey(
      options.projectName,
      options.logstream,
      options.experimentId,
      options.mode
    );

    // First check if logger already exists
    if (this._galileoLoggers.has(key)) {
      return this._galileoLoggers.get(key)!;
    }

    // Create new logger
    // Prepare initialization arguments, only including non-null values
    const config: GalileoLoggerConfig = {
      projectName: options.projectName,
      logStreamName: options.logstream,
      experimentId: options.experimentId,
      localMetrics: options.localMetrics,
      mode: options.mode
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
  public getAllLoggers(): Map<string, GalileoLogger> {
    // Return a shallow copy to prevent external modifications
    return new Map(this._galileoLoggers);
  }

  /**
   * Reset (terminate and remove) a GalileoLogger instance.
   *
   * @param options - Configuration options to identify which logger to reset
   * @param options.[projectName] - The project name
   * @param options.[logstream] - The log stream name
   * @param options.[experimentId] - The experiment ID
   * @param options.[mode] - The logger mode
   */
  public async reset(options: LoggerKeyOptions = {}): Promise<void> {
    const key = GalileoSingleton._getKey(
      options.projectName,
      options.logstream,
      options.experimentId,
      options.mode
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
   * @param options.[projectName] - The project name
   * @param options.[logstream] - The log stream name
   * @param options.[experimentId] - The experiment ID
   * @param options.[mode] - The logger mode
   */
  public async flush(options: LoggerKeyOptions = {}): Promise<void> {
    const key = GalileoSingleton._getKey(
      options.projectName,
      options.logstream,
      options.experimentId,
      options.mode
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

  // Legacy methods for backward compatibility

  /**
   * @deprecated Use getLogger() method instead. This maintains backward compatibility.
   */
  public setClient(client: GalileoLogger): void {
    // Store with default key
    const key = GalileoSingleton._getKey();
    this._galileoLoggers.set(key, client);
  }
}

/**
 * Get/Create new logger (like getLogger()), but also provides session initialization.
 * If no options are provided, defaults to the following environment variables:
 * - GALILEO_PROJECT_NAME
 * - GALILEO_LOG_STREAM_NAME
 * @param options - Configuration options to initialize the logger
 * @param options.[projectName] - The project name
 * @param options.[logstream] - The log stream name
 * @param options.[experimentId] - The experiment ID
 * @param options.[mode] - The logger mode
 * @param options.[localMetrics] - Local metrics to run on traces/spans (only used when initializing a new logger)
 * @param options.[sessionId] - The session ID
 * @param options.[startNewSession] - Whether to start a new session
 * @param options.[sessionName] - The name of the session
 * @param options.[previousSessionId] - The ID of a previous session to link to
 * @param options.[externalId] - An external identifier for the session
 */
export const init = async (
  options: GetLoggerOptions & {
    sessionId?: string;
    startNewSession?: boolean;
    sessionName?: string;
    previousSessionId?: string;
    externalId?: string;
  } = {}
) => {
  const singleton = GalileoSingleton.getInstance();
  const logger = singleton.getLogger({
    projectName: options.projectName,
    logstream: options.logstream,
    experimentId: options.experimentId,
    mode: options.mode,
    localMetrics: options.localMetrics
  });

  if (options.startNewSession) {
    await logger.startSession({
      name: options.sessionName,
      previousSessionId: options.previousSessionId,
      externalId: options.externalId
    });
  }
};

/**
 * Utility function to retrieve an existing GalileoLogger or create a new one if it does not exist.
 *
 * This method first computes the key from the parameters, checks if a logger
 * exists in the cache, and if not, creates a new GalileoLogger.
 *
 * @param options - Configuration options
 * @param options.[projectName] - The project name
 * @param options.[logstream] - The log stream name (used when experiment_id is not provided)
 * @param options.[experimentId] - The experiment ID (takes precedence over log_stream)
 * @param options.[mode] - The logger mode (defaults to "batch")
 * @param options.[localMetrics] - Local metrics to run on traces/spans (only used when initializing a new logger)
 * @returns An instance of GalileoLogger corresponding to the key
 */
export const getLogger = (options: GetLoggerOptions = {}) => {
  return GalileoSingleton.getInstance().getLogger(options);
};

/**
 * Retrieve a shallow copy of the map containing all active loggers.
 *
 * Returns a shallow copy of the map to prevent external modifications to the map structure.
 * This means:
 * - Adding or removing entries from the returned map will NOT affect the singleton's internal map
 * - However, the logger instances themselves are still references, so modifying logger properties
 *   (e.g., calling logger methods) will affect the actual loggers
 *
 * The map keys are strings representing the logger identifier
 * (format: "project:identifier:mode"), and values are GalileoLogger instances.
 */
export const getAllLoggers = () => {
  return GalileoSingleton.getInstance().getAllLoggers();
};

/**
 * Reset (terminate and remove) a specific logger instance.
 *
 * @param options - Configuration options to identify which logger to reset
 * @param options.[projectName] - The project name
 * @param options.[logstream] - The log stream name
 * @param options.[experimentId] - The experiment ID
 * @param options.[mode] - The logger mode
 */
export const reset = async (options: LoggerKeyOptions = {}) => {
  await GalileoSingleton.getInstance().reset(options);
};

/*
 * Reset (terminate and remove) all logger instances.
 */
export const resetAll = async () => {
  await GalileoSingleton.getInstance().resetAll();
};

/**
 * Flush (upload) traces from a specific logger to the Galileo platform.
 *
 * Options provided determine which logger is flushed (no options means 'default' logger).
 * @param options - Configuration options to identify which logger to flush
 * @param options.[projectName] - The project name
 * @param options.[logstream] - The log stream name
 * @param options.[experimentId] - The experiment ID
 * @param options.[mode] - The logger mode
 */
export const flush = async (options: LoggerKeyOptions = {}) => {
  await GalileoSingleton.getInstance().flush(options);
};

/**
 * Uploads all captured traces to the Galileo platform
 *
 */
export const flushAll = async () => {
  await GalileoSingleton.getInstance().flushAll();
};
