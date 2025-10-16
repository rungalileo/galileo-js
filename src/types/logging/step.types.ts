import type { components } from '../api.types';
import { Document } from '../document.types';
import { isMessage, Message } from '../message.types';
import { MetricValueType } from '../metrics.types';

export type StepAllowedInputType =
  | string
  | string[]
  | Record<string, string>
  | Record<string, string>[]
  | Message
  | Message[];
export type StepAllowedOutputType =
  | string
  | string[]
  | Record<string, string>
  | Record<string, string>[]
  | Message
  | Document
  | Document[];
export type LlmSpanAllowedInputType =
  | string
  | string[]
  | Record<string, string>
  | Record<string, string>[]
  | Message
  | Message[];
export type LlmSpanAllowedOutputType =
  | string
  | Record<string, string>
  | Message;
export type RetrieverSpanAllowedOutputType =
  | string
  | Record<string, string>
  | Document
  | string[]
  | Record<string, string>[]
  | Document[];

// Use API type as source of truth
export type StepType = components['schemas']['StepType'];

// Convert enum to const object with compile-time validation
export const StepType = {
  session: 'session',
  trace: 'trace',
  workflow: 'workflow',
  llm: 'llm',
  retriever: 'retriever',
  tool: 'tool',
  agent: 'agent'
} as const satisfies Record<StepType, StepType>;

export interface MetricsOptions {
  durationNs?: number;
  [key: string]: MetricValueType | undefined;
}

export class Metrics {
  durationNs?: number;
  // eslint-disable-next-line no-undef
  [key: string]:
    | MetricValueType
    | undefined
    | (() => Record<string, MetricValueType | undefined>);

  constructor(options: MetricsOptions) {
    for (const key in options) {
      this[key] = options[key];
    }
  }

  toJSON(): Record<string, MetricValueType | undefined> {
    const result: Record<string, MetricValueType | undefined> = {};
    for (const key in this) {
      if (Object.prototype.hasOwnProperty.call(this, key)) {
        const value = this[key];
        // Ensure that we only serialize data properties, not methods.
        if (typeof value !== 'function') {
          switch (key) {
            case 'durationNs':
              result['duration_ns'] = value;
              break;
            default:
              result[key] = value;
          }
        }
      }
    }
    return result;
  }
}

export interface BaseStepOptions {
  input?: StepAllowedInputType;
  redactedInput?: StepAllowedInputType;
  output?: StepAllowedOutputType;
  redactedOutput?: StepAllowedOutputType;
  name?: string;
  createdAt?: Date;
  metadata?: Record<string, string>;
  tags?: string[];
  statusCode?: number;
  metrics?: Metrics;
  externalId?: string;
  stepNumber?: number;
  datasetInput?: string;
  datasetOutput?: string;
  datasetMetadata?: Record<string, string>;
}

export class BaseStep {
  type: StepType;
  input?: StepAllowedInputType;
  redactedInput?: StepAllowedInputType;
  output?: StepAllowedOutputType;
  redactedOutput?: StepAllowedOutputType;
  name: string = '';
  createdAt: Date = new Date();
  userMetadata: Record<string, string> = {};
  tags?: string[];
  statusCode?: number;
  metrics: Metrics = new Metrics({});
  externalId?: string;
  stepNumber?: number;
  datasetInput?: string;
  datasetOutput?: string;
  datasetMetadata?: Record<string, string> = {};

  constructor(type: StepType, data: BaseStepOptions) {
    this.type = type;
    this.input = data.input;
    this.redactedInput = data.redactedInput;
    this.output = data.output;
    this.redactedOutput = data.redactedOutput;
    this.name = data.name || type;
    this.createdAt = data.createdAt || new Date();
    this.userMetadata = data.metadata || {};
    this.tags = data.tags || [];
    this.statusCode = data.statusCode;
    this.metrics = data.metrics || new Metrics({});
    this.externalId = data.externalId;
    this.stepNumber = data.stepNumber;
    this.datasetInput = data.datasetInput;
    this.datasetOutput = data.datasetOutput;
    this.datasetMetadata = data.datasetMetadata || {};

    // Validate serializable
    this.validateInputOutputSerializable(this.input);
    this.validateInputOutputSerializable(this.redactedInput);
    this.validateInputOutputSerializable(this.output);
    this.validateInputOutputSerializable(this.redactedOutput);
  }

  validateInputOutputSerializable<
    T = StepAllowedInputType | StepAllowedOutputType
  >(val: T): T {
    try {
      JSON.stringify(val);
      return val;
    } catch (e) {
      throw new Error(
        `Input/output is not serializable. Please use a different format. Received: ${val}`
      );
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toJSON(): Record<string, any> {
    return {
      type: this.type,
      input: this.input,
      redactedInput: this.redactedInput,
      output: this.output,
      redactedOutput: this.redactedOutput,
      name: this.name,
      created_at: this.createdAt.toISOString(),
      user_metadata: this.userMetadata,
      tags: this.tags,
      status_code: this.statusCode,
      metrics: this.metrics.toJSON(),
      external_id: this.externalId,
      step_number: this.stepNumber,
      dataset_input: this.datasetInput,
      dataset_output: this.datasetOutput,
      dataset_metadata: this.datasetMetadata
    };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isDocument(obj: any): obj is Document {
  return obj instanceof Document;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isStepAllowedInputType(obj: any): obj is StepAllowedInputType {
  if (typeof obj === 'string') return true;
  if (Array.isArray(obj)) {
    return obj.every(
      (item) =>
        typeof item === 'string' ||
        isMessage(item) ||
        isRecordStringString(item)
    );
  }
  if (isMessage(obj)) return true;
  if (isRecordStringString(obj)) return true;
  return false;
}

export function isStepAllowedOutputType(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  obj: any
): obj is StepAllowedOutputType {
  if (typeof obj === 'string') return true;
  if (Array.isArray(obj)) {
    return obj.every(
      (item) =>
        typeof item === 'string' ||
        isDocument(item) ||
        isRecordStringString(item)
    );
  }
  if (isMessage(obj)) return true;
  if (isDocument(obj)) return true;
  if (isRecordStringString(obj)) return true;
  return false;
}

export function isLlmSpanAllowedInputType(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  obj: any
): obj is LlmSpanAllowedInputType {
  return isStepAllowedInputType(obj);
}

export function isLlmSpanAllowedOutputType(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  obj: any
): obj is LlmSpanAllowedOutputType {
  if (typeof obj === 'string') return true;
  if (isMessage(obj)) return true;
  if (isRecordStringString(obj)) return true;
  return false;
}

export function isRetrieverSpanAllowedOutputType(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  obj: any
): obj is RetrieverSpanAllowedOutputType {
  if (typeof obj === 'string') return true;
  if (isDocument(obj)) return true;
  if (isRecordStringString(obj)) return true;
  if (Array.isArray(obj)) {
    return obj.every(
      (item) =>
        typeof item === 'string' ||
        isDocument(item) ||
        isRecordStringString(item)
    );
  }
  return false;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isRecordStringString(obj: any): obj is Record<string, string> {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return false;
  }

  // Ensure that the object is not a Message
  if (isMessage(obj)) {
    return false;
  }

  for (const key in obj) {
    if (typeof key !== 'string' || typeof obj[key] !== 'string') {
      return false;
    }
  }
  return true;
}
