import { components } from './api.types';

// Original Request schema from API components
export type BackendRequest = components['schemas']['Request'];
// Response schema from API components
export type Response = components['schemas']['Response'];

// Extract Payload and Ruleset types for clarity in ProtectInvokeOptions
type Payload = components['schemas']['Payload'];
type Ruleset = components['schemas']['Ruleset'];

// Options for the user-facing utils/protect.invoke function
export interface ProtectInvokeOptions {
  // Contextual parameters
  projectName: string; // Mandatory for SDK utility consistency
  stageName?: string;
  stageId?: string;
  stageVersion?: number;

  // Core operational parameters from the backend 'Request' schema
  payload: Payload; // This is mandatory in the backend Request schema
  prioritized_rulesets?: Ruleset[];
  
  // Other optional fields from the backend 'Request' schema
  timeout?: number;
  metadata?: { [key: string]: string; } | null;
  headers?: { [key: string]: string; } | null;
}

// Re-exporting the original Request type if it's used elsewhere,
// though it might be superseded by ProtectInvokeOptions for SDK users of invoke.
// If it's only used internally by apiClient.invoke, then BackendRequest is fine.
export type Request = BackendRequest;