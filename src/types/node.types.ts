import { StepType } from "./step.types";

export interface Node {
  chain_id?: string;
  chain_root_id?: string;
  creation_timestamp: string;
  finish_reason?: string;
  has_children: boolean;
  inputs: Record<string, any>;
  latency?: number;
  node_id: string;
  node_input: string;
  node_name?: string;
  node_output: string;
  node_type: StepType;
  num_input_tokens?: number;
  num_output_tokens?: number;
  num_total_tokens?: number;
  output_logprobs?: Record<string, any>;
  params: Record<string, any>;
  prompt?: string;
  query_input_tokens: number;
  query_output_tokens: number;
  query_total_tokens: number;
  response?: string;
  step: number;
  target?: string;
}