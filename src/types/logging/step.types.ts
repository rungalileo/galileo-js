import { Document } from '../document.types';
import { Message } from '../message.types';
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

export enum StepType {
  trace = 'trace',
  workflow = 'workflow',
  llm = 'llm',
  retriever = 'retriever',
  tool = 'tool',
  agent = 'agent'
}

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
          result[key] = value;
        }
      }
    }
    return result;
  }
}

export interface BaseStepOptions {
  input?: StepAllowedInputType;
  output?: StepAllowedOutputType;
  name?: string;
  createdAt?: number;
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
  output?: StepAllowedOutputType;
  name: string = '';
  createdAt: number = Date.now() * 1000000; // Convert to nanoseconds
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
    this.output = data.output;
    this.name = data.name || type;
    this.createdAt =
      data.createdAt !== undefined ? data.createdAt : Date.now() * 1000000;
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
    this.validateInputOutputSerializable(this.output);
  }

  validateInputOutputSerializable<
    T = StepAllowedInputType | StepAllowedOutputType
  >(val: T): T {
    // Make sure we can serialize input/output to JSON string
    JSON.stringify(val);
    return val;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toJSON(): Record<string, any> {
    return {
      type: this.type,
      input: this.input,
      output: this.output,
      name: this.name,
      created_at: this.createdAt,
      user_metadata: this.userMetadata,
      tags: this.tags,
      status_code: this.statusCode,
      metrics: this.metrics.toJSON(),
      external_id: this.externalId,
      dataset_input: this.datasetInput,
      dataset_output: this.datasetOutput,
      dataset_metadata: this.datasetMetadata
    };
  }
}
