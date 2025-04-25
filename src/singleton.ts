import { GalileoLogger } from './utils/galileo-logger';

export class GalileoSingleton {
  private static instance: GalileoSingleton;
  private client: GalileoLogger | undefined;

  private constructor() {}

  public static getInstance(): GalileoSingleton {
    if (!this.instance) {
      this.instance = new GalileoSingleton();
    }
    return this.instance;
  }

  public getClient(): GalileoLogger {
    if (!this.client) {
      this.client = new GalileoLogger({});
    }

    return this.client!;
  }

  public setClient(client: GalileoLogger) {
    this.client = client;
  }

  public init(options: {
    projectName?: string | undefined;
    logStreamName?: string | undefined;
    experimentId?: string | undefined;
    sessionId?: string | undefined;
    startNewSession?: boolean | undefined;
  }) {
    this.client = new GalileoLogger({
      projectName: options.projectName,
      logStreamName: options.logStreamName,
      experimentId: options.experimentId,
      sessionId: options.sessionId
    });

    if (options.startNewSession) {
      this.client.startSession();
    }
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
export const init = (
  options: {
    projectName?: string | undefined;
    logStreamName?: string | undefined;
    experimentId?: string | undefined;
    sessionId?: string | undefined;
    startNewSession?: boolean | undefined;
  } = {}
) => {
  GalileoSingleton.getInstance().init(options);
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
export const flush = async () => {
  await GalileoSingleton.getInstance().getClient().flush();
};

/*
 * Returns the singleton client logger
 *
 * Example:
 *
 * ```typescript
 * import { init,getLogger } from 'galileo';
 *
 * // Initialize the global context
 * // If you have GALILEO_PROJECT and GALILEO_LOG_STREAM environment variables set, you can skip this step
 * init({
 *   projectName: 'my-project',
 *   logStreamName: 'my-log-stream'
 * });
 *
 * const logger = getLogger();
 * logger.info('Hello, world!');
 * ```
 */
export const getLogger = () => {
  return GalileoSingleton.getInstance().getClient();
};
