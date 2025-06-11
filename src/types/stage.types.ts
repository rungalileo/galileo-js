// src/types/stage.types.ts
import { components } from './api.types';

/**
 * Defines the type of a stage, indicating if it's local to a specific context
 * or a central, reusable configuration.
 *
 * Based on: components['schemas']['StageType']
 */
export type StageType = components['schemas']['StageType']; // "local" | "central"

/**
 * Operators available for defining rules.
 *
 * Based on: components['schemas']['RuleOperator']
 */
export type RuleOperator = components['schemas']['RuleOperator'];
// "gt" | "lt" | "gte" | "lte" | "eq" | "neq" | "contains" | "all" | "any" | "empty" | "not_empty"

/**
 * Represents the various execution statuses of a ruleset or an individual rule.
 *
 * Based on: components['schemas']['ExecutionStatus']
 */
export type ExecutionStatus = components['schemas']['ExecutionStatus'];
// "triggered" | "failed" | "error" | "timeout" | "paused" | "not_triggered" | "skipped"

/**
 * Defines a single rule within a ruleset.
 *
 * Based on: components['schemas']['Rule']
 */
export interface Rule {
  metric: string;
  operator: RuleOperator;
  target_value: string | number | unknown[] | null;
}

/**
 * Configuration for a subscription, defining which statuses trigger a notification
 * to a specified URL.
 *
 * Based on: components['schemas']['SubscriptionConfig']
 */
export interface SubscriptionConfig {
  statuses?: ExecutionStatus[];
  url: string;
}

/**
 * Action to override the response with a predefined choice.
 *
 * Based on: components['schemas']['OverrideAction']
 */
export interface OverrideAction {
  type: 'OVERRIDE';
  subscriptions?: SubscriptionConfig[];
  choices: string[];
}

/**
 * Action to allow the original response to pass through, potentially with notifications.
 *
 * Based on: components['schemas']['PassthroughAction']
 */
export interface PassthroughAction {
  type: 'PASSTHROUGH';
  subscriptions?: SubscriptionConfig[];
}

/**
 * A collection of rules and an associated action to be taken if the rules are met.
 *
 * Based on: components['schemas']['Ruleset']
 */
export interface Ruleset {
  rules?: Rule[];
  action?: OverrideAction | PassthroughAction;
  description?: string | null;
}

/**
 * A mixin that adds a list of prioritized rulesets.
 * Used as a request body for updating stage rulesets.
 *
 * Based on: components['schemas']['RulesetsMixin']
 */
export interface RulesetsMixin {
  prioritized_rulesets?: Ruleset[];
}

/**
 * Represents a stage as stored in the database.
 * This is typically the response type for stage-related API calls.
 *
 * Based on: components['schemas']['StageDB']
 */
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

/**
 * Parameters for fetching a specific stage.
 * Either `stageId` or `stageName` must be provided.
 */
export interface GetStageParams {
  stageId?: string;
  stageName?: string;
}

/**
 * Payload for updating an existing stage's rulesets.
 * This is an alias for RulesetsMixin.
 */
export type UpdateStagePayload = RulesetsMixin;