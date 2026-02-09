import { AsyncLocalStorage } from 'async_hooks';
import { GalileoLogger } from './utils/galileo-logger';
import type { GalileoLoggerConfig } from './types/logging/logger.types';
import type { LocalMetricConfig } from './types/metrics.types';
import { StepWithChildSpans } from './types/logging/span.types';

/**
 * Context information that is automatically propagated through async execution chains.
 */
export interface ExperimentContext {
  /** (Optional) The project ID */
  projectId?: string;
  /** (Optional) The experiment ID currently being executed */
  experimentId?: string;
  /** (Optional) The project name for the current experiment */
  projectName?: string;
  /** The parent stack for nested spans (trace, workflow, agent spans) */
  parentStack?: StepWithChildSpans[];
  /** The session ID for the current logger context */
  sessionId?: string;
  /** The log stream name for the current logger context */
  logStreamName?: string;
}

/**
 * AsyncLocalStorage instance for propagating experiment context through async execution chains.
 */
export const experimentContext = new AsyncLocalStorage<ExperimentContext>();

/**
 * Logger context information that is automatically propagated through async execution chains.
 * This allows logger state (parent stack, session) to be available across async boundaries.
 */
export interface LoggerContext {
  /** The parent stack for nested spans (trace, workflow, agent spans) */
  parentStack?: StepWithChildSpans[];
  /** The session ID for the current logger context */
  sessionId?: string;
  /** The log stream name for the current logger context */
  logStreamName?: string;
}

/**
 * AsyncLocalStorage instance for propagating logger context through async execution chains.
 * This ensures that parent stack and session information are available across async boundaries.
 */
export const loggerContext = new AsyncLocalStorage<LoggerContext>();

/**
 * Options for identifying a logger by its key (project, logstream/experimentId, mode).
 */
export interface LoggerKeyOptions {
  /** (Optional) The project name */
  projectName?: string;
  /** (Optional) The project ID */
  projectId?: string;
  /** (Optional) The log stream name (used when experimentId is not provided) */
  logstream?: string;
  /** (Optional) The experiment ID (takes precedence over logstream) */
  experimentId?: string;
  /** (Optional) The logger mode (defaults to 'batch') */
  mode?: string;
}

/**
 * Extends LoggerKeyOptions with localMetrics to configure new logger instances.
 */
export interface GetLoggerOptions extends LoggerKeyOptions {
  /** (Optional) Local metrics to run on traces/spans (only used when initializing a new logger) */
  localMetrics?: LocalMetricConfig[];
}

/**
 * A singleton class that manages a collection of GalileoLogger instances.
 */
export class GalileoSingleton {
  private static instance: GalileoSingleton;
  private galileoLoggers: Map<string, GalileoLogger> = new Map();
  private lastAvailableLogger: GalileoLogger | null = null;

  private constructor() {}

  /**
   * Gets the singleton instance of GalileoSingleton.
   * @returns The singleton instance
   */
  public static getInstance(): GalileoSingleton {
    if (!GalileoSingleton.instance) {
      GalileoSingleton.instance = new GalileoSingleton();
    }
    return GalileoSingleton.instance;
  }

  /**
   * Returns the last available logger instance, or creates a new one if no logger is available.
   * @deprecated Use getLogger() method instead. This method is kept for backwards compatibility.
   * @returns An instance of GalileoLogger
   */
  public getClient(): GalileoLogger {
    return this.lastAvailableLogger ?? this.getLogger();
  }

  /**
   * Generates a key string based on project, logstream/experimentId, and mode parameters.
   * @param projectName - (Optional) The project name
   * @param logstream - (Optional) The log stream name (used when experimentId is not provided)
   * @param experimentId - (Optional) The experiment ID (takes precedence over logstream)
   * @param mode - (Optional) The logger mode (defaults to "batch")
   * @returns A string key used for caching
   */
  private static _getKey(
    projectName?: string,
    logstream?: string,
    experimentId?: string,
    mode?: string
  ): string {
    // Get context from AsyncLocalStorage
    const context = experimentContext.getStore();

    // Apply fallbacks: explicit parameter -> context -> environment variable -> default
    const finalProjectName =
      projectName ??
      context?.projectName ??
      process.env.GALILEO_PROJECT ??
      process.env.GALILEO_PROJECT_NAME ??
      'default';
    const finalLogStream =
      logstream ??
      process.env.GALILEO_LOG_STREAM ??
      process.env.GALILEO_LOG_STREAM_NAME ??
      'default';

    // Use experimentId if provided, otherwise check context, otherwise use log_stream
    const identifier = experimentId ?? context?.experimentId ?? finalLogStream;

    // Return a string key: "project:identifier:mode"
    return `${finalProjectName}:${identifier}:${mode || 'batch'}`;
  }

  /**
   * Retrieves an existing GalileoLogger or creates a new one if it does not exist.
   * @param options - Configuration options
   * @param options.projectName - (Optional) The project name
   * @param options.logstream - (Optional) The log stream name (used when experimentId is not provided)
   * @param options.experimentId - (Optional) The experiment ID (takes precedence over logstream)
   * @param options.mode - (Optional) The logger mode (defaults to "batch")
   * @param options.localMetrics - (Optional) Local metrics to run on traces/spans (only used when initializing a new logger)
   * @returns An instance of GalileoLogger corresponding to the key
   */
  public getLogger(options: GetLoggerOptions = {}): GalileoLogger {
    // Get context from AsyncLocalStorage for fallback values
    const context = experimentContext.getStore();

    // Compute the key based on provided parameters, context, or environment variables
    const key = GalileoSingleton._getKey(
      options.projectName,
      options.logstream,
      options.experimentId,
      options.mode
    );

    // First check if logger already exists
    if (this.galileoLoggers.has(key)) {
      return this.galileoLoggers.get(key)!;
    }

    // Create new logger
    // Prepare initialization arguments, using context as fallback if not provided
    const config: GalileoLoggerConfig = {
      projectName:
        options.projectName ??
        context?.projectName ??
        process.env.GALILEO_PROJECT ??
        process.env.GALILEO_PROJECT_NAME,
      projectId: options.projectId ?? context?.projectId,
      logStreamName:
        options.logstream ??
        process.env.GALILEO_LOG_STREAM ??
        process.env.GALILEO_LOG_STREAM_NAME,
      experimentId: options.experimentId ?? context?.experimentId,
      localMetrics: options.localMetrics,
      mode: options.mode
    };

    const logger = new GalileoLogger(config);

    // Cache the newly created logger
    this.galileoLoggers.set(key, logger);
    this.lastAvailableLogger = logger;
    return logger;
  }

  /**
   * Retrieve a copy of the map containing all active loggers.
   *
   * @returns A map of keys to GalileoLogger instances
   */
  public getAllLoggers(): Map<string, GalileoLogger> {
    // Return a shallow copy to prevent external modifications
    return new Map(this.galileoLoggers);
  }

  /**
   * Resets (terminates and removes) a GalileoLogger instance.
   * @param options - Configuration options to identify which logger to reset
   * @param options.projectName - (Optional) The project name
   * @param options.logstream - (Optional) The log stream name
   * @param options.experimentId - (Optional) The experiment ID
   * @param options.mode - (Optional) The logger mode
   * @returns A promise that resolves when the logger is reset
   */
  public async reset(options: LoggerKeyOptions = {}): Promise<void> {
    const key = GalileoSingleton._getKey(
      options.projectName,
      options.logstream,
      options.experimentId,
      options.mode
    );

    const logger = this.galileoLoggers.get(key);
    if (logger) {
      await logger.terminate();
      this.galileoLoggers.delete(key);

      if (this.lastAvailableLogger === logger) {
        this.lastAvailableLogger = null;
      }
    }
  }

  /**
   * Resets (terminates and removes) all GalileoLogger instances.
   * @returns A promise that resolves when all loggers are reset
   */
  public async resetAll(): Promise<void> {
    const resetPromises = Array.from(this.galileoLoggers.values()).map(
      (logger) => logger.terminate()
    );
    await Promise.all(resetPromises);
    this.galileoLoggers.clear();
    this.lastAvailableLogger = null;
  }

  /**
   * Flushes (uploads) a GalileoLogger instance.
   * @param options - Configuration options to identify which logger to flush
   * @param options.projectName - (Optional) The project name
   * @param options.logstream - (Optional) The log stream name
   * @param options.experimentId - (Optional) The experiment ID
   * @param options.mode - (Optional) The logger mode
   * @returns A promise that resolves when the logger is flushed
   */
  public async flush(options: LoggerKeyOptions = {}): Promise<void> {
    const key = GalileoSingleton._getKey(
      options.projectName,
      options.logstream,
      options.experimentId,
      options.mode
    );

    const logger = this.galileoLoggers.get(key);
    if (logger) {
      await logger.flush();
    }
  }

  /**
   * Flushes (uploads) all GalileoLogger instances.
   * @returns A promise that resolves when all loggers are flushed
   */
  public async flushAll(): Promise<void> {
    const flushPromises = Array.from(this.galileoLoggers.values()).map(
      (logger) => logger.flush()
    );
    await Promise.all(flushPromises);
  }

  // Legacy methods for backward compatibility

  /**
   * Sets a client logger instance.
   * @deprecated Use getLogger() method instead. This maintains backward compatibility.
   * @param client - The GalileoLogger instance to set
   */
  public setClient(client: GalileoLogger): void {
    // Store with default key
    const key = GalileoSingleton._getKey();
    this.galileoLoggers.set(key, client);
    this.lastAvailableLogger = client;
  }
}

/**
 * Gets or creates a logger and optionally initializes a session.
 * @param options - Configuration options to initialize the logger
 * @param options.projectName - (Optional) The project name
 * @param options.logstream - (Optional) The log stream name
 * @param options.experimentId - (Optional) The experiment ID
 * @param options.mode - (Optional) The logger mode
 * @param options.localMetrics - (Optional) Local metrics to run on traces/spans (only used when initializing a new logger)
 * @param options.sessionId - (Optional) The session ID
 * @param options.startNewSession - (Optional) Whether to start a new session
 * @param options.sessionName - (Optional) The name of the session
 * @param options.previousSessionId - (Optional) The ID of a previous session to link to
 * @param options.externalId - (Optional) An external identifier for the session
 * @returns A promise that resolves when initialization is complete
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
 * Retrieves an existing GalileoLogger or creates a new one if it does not exist.
 * @param options - Configuration options
 * @param options.projectName - (Optional) The project name
 * @param options.logstream - (Optional) The log stream name (used when experimentId is not provided)
 * @param options.experimentId - (Optional) The experiment ID (takes precedence over logstream)
 * @param options.mode - (Optional) The logger mode (defaults to "batch")
 * @param options.localMetrics - (Optional) Local metrics to run on traces/spans (only used when initializing a new logger)
 * @returns An instance of GalileoLogger corresponding to the key
 */
export const getLogger = (options: GetLoggerOptions = {}) => {
  return GalileoSingleton.getInstance().getLogger(options);
};

/**
 * Returns the logger for the current async context (experimentContext + loggerContext).
 * Used by session helpers and the log() wrapper so they target the same logger.
 */
const getLoggerFromContext = (): GalileoLogger => {
  const exp = experimentContext.getStore();
  const logStore = loggerContext.getStore();
  return GalileoSingleton.getInstance().getLogger({
    projectName: exp?.projectName,
    experimentId: exp?.experimentId,
    logstream: logStore?.logStreamName ?? exp?.logStreamName
  });
};

/**
 * Starts a new session on the logger for the current context.
 *
 * @param options - (Optional) Session options.
 * @param options.name - (Optional) The session name.
 * @param options.previousSessionId - (Optional) The previous session ID to link to.
 * @param options.externalId - (Optional) External ID for the session.
 * @returns A promise that resolves to the session ID.
 */
export const startSession = async (options?: {
  name?: string;
  previousSessionId?: string;
  externalId?: string;
}): Promise<string> => {
  const logger = getLoggerFromContext();
  return logger.startSession(options);
};

/**
 * Sets the session ID on the logger for the current context.
 * Traces created via log() are associated with this session.
 *
 * @param sessionId - The session ID to set.
 * @returns Nothing.
 */
export const setSession = (sessionId: string): void => {
  getLoggerFromContext().setSessionId(sessionId);
};

/**
 * Clears the current session ID on the logger for the current context.
 * Subsequent traces are not associated with a session until startSession or setSession is called.
 *
 * @returns Nothing.
 */
export const clearSession = (): void => {
  getLoggerFromContext().clearSession();
};

/**
 * Retrieves a shallow copy of the map containing all active loggers.
 * @returns A map of keys to GalileoLogger instances
 */
export const getAllLoggers = () => {
  return GalileoSingleton.getInstance().getAllLoggers();
};

/**
 * Resets (terminates and removes) a specific logger instance.
 * @param options - Configuration options to identify which logger to reset
 * @param options.projectName - (Optional) The project name
 * @param options.logstream - (Optional) The log stream name
 * @param options.experimentId - (Optional) The experiment ID
 * @param options.mode - (Optional) The logger mode
 * @returns A promise that resolves when the logger is reset
 */
export const reset = async (options: LoggerKeyOptions = {}) => {
  await GalileoSingleton.getInstance().reset(options);
};

/**
 * Resets (terminates and removes) all logger instances.
 * @returns A promise that resolves when all loggers are reset
 */
export const resetAll = async () => {
  await GalileoSingleton.getInstance().resetAll();
};

/**
 * Flushes (uploads) traces from a specific logger to the Galileo platform.
 * @param options - Configuration options to identify which logger to flush
 * @param options.projectName - (Optional) The project name
 * @param options.logstream - (Optional) The log stream name
 * @param options.experimentId - (Optional) The experiment ID
 * @param options.mode - (Optional) The logger mode
 * @returns A promise that resolves when the logger is flushed
 */
export const flush = async (options: LoggerKeyOptions = {}) => {
  await GalileoSingleton.getInstance().flush(options);
};

/**
 * Flushes (uploads) all captured traces to the Galileo platform.
 * @returns A promise that resolves when all loggers are flushed
 */
export const flushAll = async () => {
  await GalileoSingleton.getInstance().flushAll();
};

/**
 * Lifecycle and context API for Galileo logging.
 * Groups init, flush, reset, and session methods for ergonomic use.
 */
export const galileoContext = {
  init,
  flush,
  flushAll,
  reset,
  resetAll,
  startSession,
  setSession,
  clearSession
};
