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

export const init = (options: {
  projectName?: string | undefined;
  logStreamName?: string | undefined;
}) => {
  GalileoSingleton.getInstance().init(options);
};

export const flush = () => {
  GalileoSingleton.getInstance().getClient().flush();
};
