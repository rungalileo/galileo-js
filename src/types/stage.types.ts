import { components } from './api.types';

export type StageType = components['schemas']['StageType'];
export type RuleOperator = components['schemas']['RuleOperator'];
export type ExecutionStatus = components['schemas']['ExecutionStatus'];
export type Rule = components['schemas']['Rule'];
export type SubscriptionConfig = components['schemas']['SubscriptionConfig'];
export type OverrideAction = components['schemas']['OverrideAction'];
export type PassthroughAction = components['schemas']['PassthroughAction'];
export type Ruleset = components['schemas']['Ruleset'];
export type RulesetsMixin = components['schemas']['RulesetsMixin'];
export type StageDB = components['schemas']['StageDB'];

/**
 * Payload for creating a new stage.
 * `project_id` is handled as a path parameter in the API call, so it's omitted here.
 *
 * Derived from: components['schemas']['StageWithRulesets']
 */
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