declare global {
  namespace NodeJS {
    interface ProcessEnv {
      MY_ENV_VAR: string;
      POSSIBLY_UNDEFINED_VAR?: string;
    }
  }
}

export {};
