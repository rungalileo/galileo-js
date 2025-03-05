declare global {
  namespace NodeJS {
    interface ProcessEnv {
      GALILEO_CONSOLE_URL?: string;
      GALILEO_API_KEY?: string;
      GALILEO_USERNAME?: string;
      GALILEO_PASSWORD?: string;
      GALILEO_PROJECT?: string;
      GALILEO_LOG_STREAM?: string;
    }
  }
}

export {};
