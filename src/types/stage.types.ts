import { components } from './api.types';


export type StageType = components['schemas']['StageType'];
export type RuleOperator = components['schemas']['RuleOperator'];
export type ExecutionStatus = components['schemas']['ExecutionStatus'];

export interface Rule {
  metric: string;
  operator: RuleOperator;
  target_value: string | number | unknown[] | null;
}

export interface SubscriptionConfig {
  statuses?: ExecutionStatus[];
  url: string;
}

export interface OverrideAction {
  type: 'OVERRIDE';
  subscriptions?: SubscriptionConfig[];
  choices: string[];
}

export interface PassthroughAction {
  type: 'PASSTHROUGH';
  subscriptions?: SubscriptionConfig[];
}

export interface Ruleset {
  rules?: Rule[];
  action?: OverrideAction | PassthroughAction;
  description?: string | null;
}

export interface RulesetsMixin {
  prioritized_rulesets?: Ruleset[];
}

// TODO why redefine these when existing in api.types.ts?
export interface StageDB {
  name: string;
  project_id: string;
  description?: string | null;
  type?: StageType;
  paused?: boolean;
  created_by: string;
  id: string;
  version?: number | null;
}

// `project_id` is handled as a path parameter in the API call, so it's omitted here.
export interface StageCreationPayload {
  prioritized_rulesets?: Ruleset[];
  name: string;
  description?: string | null;
  type?: StageType;
  paused?: boolean;
}

export interface GetStageParams {
  stageId?: string;
  stageName?: string;
}

export type UpdateStagePayload = RulesetsMixin;