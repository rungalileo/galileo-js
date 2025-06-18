import { components } from './api.types';

export type Request = components['schemas']['Request'];
export type Response = components['schemas']['Response'];

type Payload = components['schemas']['Payload'];
type Ruleset = components['schemas']['Ruleset'];

export interface ProtectInvokeOptions {
  projectName: string;
  stageName?: string;
  stageId?: string;
  stageVersion?: number;
  payload: Payload;
  prioritizedRulesets?: Ruleset[];
  timeout?: number;
  metadata?: { [key: string]: string } | null;
  headers?: { [key: string]: string } | null;
}
