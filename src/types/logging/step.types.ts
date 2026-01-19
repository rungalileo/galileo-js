import { randomUUID } from 'crypto';
import type { components } from '../api.types';
import { Document } from '../document.types';
import { isMessage, type Message } from '../message.types';
import type { MetricValueType } from '../metrics.types';
import type { JsonArray } from './span.types';

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
export type SerializedMetrics = MetricsOptions;

export class Metrics {
  durationNs?: number;
  // eslint-disable-next-line no-undef
  [key: string]:
    | MetricValueType
    | undefined
    | (() => Record<string, MetricValueType | undefined>);

  constructor(options: MetricsOptions | Metrics) {
    const source =
      options instanceof Metrics
        ? Object.fromEntries(
            Object.entries(options).filter(
              ([, value]) => typeof value !== 'function'
            )
          )
        : options;

    for (const key in source) {
      this[key] = source[key];
    }
  }

  toJSON(): SerializedMetrics {
    return Object.keys(this).reduce((result, key) => {
      const value = this[key];
      if (typeof value !== 'function') {
        result[key] = value;
      }
      return result;
    }, {} as SerializedMetrics);
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
  id?: string;
}

export interface SerializedStep extends Omit<
  BaseStepOptions,
  'metrics' | 'createdAt' | 'output' | 'redactedOutput'
> {
  metrics?: SerializedMetrics;
  type: StepType;
  createdAt: string;
  userMetadata: Record<string, string>;
  datasetMetadata?: Record<string, string>;
  output?: StepAllowedOutputType | JsonArray;
  redactedOutput?: StepAllowedOutputType | JsonArray;
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
  id: string;

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
    // Generate UUID if not provided (matching Python behavior)
    this.id = data.id || randomUUID();

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
    } catch (_error) {
      throw new Error(
        `Input/output is not serializable. Please use a different format. Received: ${val}`
      );
    }
  }

  toJSON(): SerializedStep {
    return {
      type: this.type,
      input: this.input,
      redactedInput: this.redactedInput,
      output: this.output,
      redactedOutput: this.redactedOutput,
      name: this.name,
      createdAt: this.createdAt.toISOString(),
      userMetadata: this.userMetadata,
      tags: this.tags,
      statusCode: this.statusCode,
      metrics: this.metrics.toJSON(),
      externalId: this.externalId,
      stepNumber: this.stepNumber,
      datasetInput: this.datasetInput,
      datasetOutput: this.datasetOutput,
      datasetMetadata: this.datasetMetadata,
      id: this.id
    };
  }
}

export function isDocument(obj: unknown): obj is Document {
  return obj instanceof Document;
}

export function isStepAllowedInputType(
  obj: unknown
): obj is StepAllowedInputType {
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
  obj: unknown
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
  obj: unknown
): obj is LlmSpanAllowedInputType {
  return isStepAllowedInputType(obj);
}

export function isLlmSpanAllowedOutputType(
  obj: unknown
): obj is LlmSpanAllowedOutputType {
  if (typeof obj === 'string') return true;
  if (isMessage(obj)) return true;
  if (isRecordStringString(obj)) return true;
  return false;
}

export function isRetrieverSpanAllowedOutputType(
  obj: unknown
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

function isRecordStringString(obj: unknown): obj is Record<string, string> {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return false;
  }

  // Ensure that the object is not a Message
  if (isMessage(obj)) {
    return false;
  }

  const record = obj as Record<string, unknown>;
  for (const key in record) {
    if (typeof key !== 'string' || typeof record[key] !== 'string') {
      return false;
    }
  }
  return true;
}
