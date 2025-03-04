// import { AsyncLocalStorage } from 'async_hooks';
import { GalileoLogger } from './utils/galileo-logger';

export class GalileoConfig {
  private static instance: GalileoConfig;
  private client: GalileoLogger | undefined;
  private constructor() {}
  public static getInstance(): GalileoConfig {
    // Ensure singleton instance across environments
    // const globalRef = (
    //   typeof globalThis !== 'undefined' ? globalThis : window
    // ) as any;
    // if (!globalRef.__GALILEO_CONFIG__) {
    //   globalRef.__GALILEO_CONFIG__ = new GalileoConfig();
    // }
    // this.instance = globalRef.__GALILEO_CONFIG__;

    if (!this.instance) {
      this.instance = new GalileoConfig();
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
  GalileoConfig.getInstance().init(options);
};

export const flush = () => {
  GalileoConfig.getInstance().getClient().flush();
};
