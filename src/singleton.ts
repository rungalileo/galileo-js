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
  }) {
    this.client = new GalileoLogger({
      projectName: options.projectName,
      logStreamName: options.logStreamName
    });
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
  } = {}
) => {
  GalileoSingleton.getInstance().init(options);
};

/*
 * Uploads all captured traces to the Galileo platform
 */
export const flush = () => {
  GalileoSingleton.getInstance().getClient().flush();
};
