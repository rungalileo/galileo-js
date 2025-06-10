import { components } from './api.types';

// TODO missing headers in the Request object yet available in the api (and python version)?
export type Request =
  components['schemas']['Request'];

// TODO using InvokeResponse here at all?
export type Response =
  components['schemas']['Response'];