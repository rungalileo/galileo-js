/* eslint-disable @typescript-eslint/no-explicit-any */

import { Metrics } from './metrics.types';
import { Document } from './document.types';
import { Message } from './message.types';

enum NodeType {
  chain = 'chain',
  chat = 'chat',
  llm = 'llm',
  retriever = 'retriever',
  tool = 'tool',
  agent = 'agent',
  workflow = 'workflow',
  trace = 'trace',
  session = 'session'
}

// Type definitions

export type StepIOType =
  | string
  | Document
  | Message
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | Record<string, any>
  | string[]
  | Document[]
  | Message[]
  | Record<string, string>[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | Record<string, any>[];

export type LlmStepAllowedIOType =
  | string
  | Record<string, string>
  | Message
  | string[]
  | Record<string, string>[]
  | Message[];

export type RetrieverStepAllowedOutputType =
  | string
  | Record<string, string>
  | Document
  | string[]
  | Record<string, string>[]
  | Document[];

// Base classes
export class BaseStep {
  type: NodeType = NodeType.workflow;
  input: StepIOType;
  output: StepIOType = '';
  name: string = '';
  createdAtNs: number = Date.now() * 1000000; // Convert to nanoseconds
  durationNs: number = 0;
  userMetadata: Record<string, string> = {};
  statusCode?: number;
  groundTruth?: string;
  modelConfig?: Record<string, any>;
  tags?: string[];
  metrics: Metrics = {};
  externalId?: string;

  constructor(data: {
    type?: NodeType;
    input: StepIOType;
    output?: StepIOType;
    name?: string;
    createdAtNs?: number;
    durationNs?: number;
    metadata?: Record<string, string>;
    statusCode?: number;
    groundTruth?: string;
    tags?: string[];
    externalId?: string;
  }) {
    this.type = data.type || NodeType.workflow;
    this.input = data.input;
    this.output = data.output !== undefined ? data.output : '';
    this.name = data.name || data.type || NodeType.workflow;
    this.createdAtNs =
      data.createdAtNs !== undefined ? data.createdAtNs : Date.now() * 1000000;
    this.durationNs = data.durationNs !== undefined ? data.durationNs : 0;
    this.userMetadata = data.metadata || {};
    this.statusCode = data.statusCode;
    this.groundTruth = data.groundTruth;
    this.tags = data.tags || [];
    this.externalId = data.externalId;

    // Validate serializable
    this.validateInputOutputSerializable(this.input);
    this.validateInputOutputSerializable(this.output);
  }

  validateInputOutputSerializable(val: StepIOType): StepIOType {
    // Make sure we can serialize input/output to JSON string
    JSON.stringify(val);
    return val;
  }

  toJSON(): Record<string, any> {
    return {
      type: this.type,
      input: this.input,
      output: this.output,
      name: this.name,
      created_at_ns: this.createdAtNs,
      duration_ns: this.durationNs,
      userMetadata: this.userMetadata,
      status_code: this.statusCode,
      ground_truth: this.groundTruth,
      external_id: this.externalId
    };
  }
}

export abstract class BaseStepWithChildren extends BaseStep {
  abstract children(): BaseStep[];
}
