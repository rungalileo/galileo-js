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

  public async init(options: {
    projectName?: string | undefined;
    logStreamName?: string | undefined;
    experimentId?: string | undefined;
    sessionId?: string | undefined;
    startNewSession?: boolean | undefined;
    sessionName?: string | undefined;
    previousSessionId?: string | undefined;
    externalId?: string | undefined;
  }) {
    this.client = new GalileoLogger({
      projectName: options.projectName,
      logStreamName: options.logStreamName,
      experimentId: options.experimentId
    });

    if (options.sessionId) {
      this.client.setSessionId(options.sessionId);
    } else if (options.startNewSession) {
      this.client.startSession({
        name: options.sessionName,
        previousSessionId: options.previousSessionId,
        externalId: options.externalId
      });
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
 * You can also continue an existing session by providing the session ID:
 *
 * ```typescript
 * import { init } from 'galileo';
 *
 * init({
 *   projectName: 'my-project',
 *   logStreamName: 'my-log-stream',
 *   sessionId: 'my-session-id'
 * });
 * ```
 * 
 * Sessions are created automatically for each new trace. If you'd like to start a session and use it for a batch of traces, you can specify the following options:
 *
 * ```typescript
 * import { init } from 'galileo';
 *
 * init({
 *   projectName: 'my-project',
 *   logStreamName: 'my-log-stream',
 *   startNewSession: true,
 *   sessionName: 'my-session-name', // Optional
 *   previousSessionId: 'my-previous-session-id', // Optional
 *   externalId: 'my-external-id' // Optional
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
  await GalileoSingleton.getInstance().init(options);
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
