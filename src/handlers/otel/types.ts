/**
 * Configuration and shared type interfaces for Galileo OpenTelemetry integration.
 */

/**
 * Configuration for the GalileoOTLPExporter.
 */
export interface GalileoOTLPExporterConfig {
  /** Target Galileo project name. Falls back to GALILEO_PROJECT env var, then 'default'. */
  project?: string;
  /** Target logstream name. Falls back to GALILEO_LOG_STREAM env var, then 'default'. */
  logstream?: string;
  /** Galileo API key. Falls back to GALILEO_API_KEY env var. */
  apiKey?: string;
  /** Galileo API URL. Falls back to GALILEO_CONSOLE_URL env var, then 'https://app.galileo.ai'. */
  apiUrl?: string;
}

/**
 * Configuration for the GalileoSpanProcessor.
 */
export interface GalileoSpanProcessorConfig extends GalileoOTLPExporterConfig {
  /** Experiment ID for experiment mode. When set, logstream is not used. */
  experimentId?: string;
  /** Session ID for session tracking. */
  sessionId?: string;
}

/**
 * Galileo-specific span attribute keys set by the processor and read by the exporter.
 */
export const GALILEO_ATTRIBUTES = {
  PROJECT_NAME: 'galileo.project.name',
  LOGSTREAM_NAME: 'galileo.logstream.name',
  EXPERIMENT_ID: 'galileo.experiment.id',
  SESSION_ID: 'galileo.session.id',
  DATASET_INPUT: 'galileo.dataset.input',
  DATASET_OUTPUT: 'galileo.dataset.output',
  DATASET_METADATA: 'galileo.dataset.metadata'
} as const;

// --- Structural interfaces for optional OTel peer dependency types ---
// These allow the implementation to compile without requiring OTel at import time.
// At runtime, actual OTel objects are passed in.

export interface SpanLike {
  setAttribute(key: string, value: string | number | boolean): unknown;
}

export interface ReadableSpanLike {
  readonly name: string;
  readonly attributes: Record<string, unknown>;
  resource: { merge(other: unknown): unknown };
}

export interface ExportResultLike {
  code: number;
  error?: Error;
}

export interface ContextLike {
  getValue(key: symbol): unknown;
}

export interface SpanExporterLike {
  export(
    spans: ReadableSpanLike[],
    resultCallback: (result: ExportResultLike) => void
  ): void;
  shutdown(): Promise<void>;
  forceFlush?(): Promise<void>;
}

export interface SpanProcessorLike {
  onStart(span: SpanLike, parentContext: ContextLike): void;
  onEnd(span: ReadableSpanLike): void;
  shutdown(): Promise<void>;
  forceFlush(): Promise<void>;
}
