import { experimentContext } from '../../singleton';
import { GalileoOTLPExporter } from './exporter';
import type { GalileoSpanProcessorConfig } from './types';
import type {
  SpanLike,
  ReadableSpanLike,
  ContextLike,
  SpanProcessorLike
} from './types';
import { GALILEO_ATTRIBUTES } from './types';
import { getSdkLogger } from 'galileo-generated';

const sdkLogger = getSdkLogger();

/**
 * Complete OpenTelemetry span processor with integrated Galileo export functionality.
 *
 * This processor combines span processing and export capabilities into a single
 * component that can be directly attached to any OpenTelemetry TracerProvider.
 *
 * On span start, it reads Galileo context from AsyncLocalStorage (set by `init()`,
 * `galileoContext`, or experiment context) and stamps galileo.* attributes onto each span.
 * These attributes are then read by the GalileoOTLPExporter at export time.
 *
 * @example
 * ```typescript
 * import { GalileoSpanProcessor, addGalileoSpanProcessor } from 'galileo';
 * import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
 *
 * const provider = new NodeTracerProvider();
 * const processor = new GalileoSpanProcessor({ project: 'my-project' });
 * addGalileoSpanProcessor(provider, processor);
 * provider.register();
 *
 * const tracer = provider.getTracer('my-service');
 * const span = tracer.startSpan('my-operation');
 * span.end();
 * ```
 */
export class GalileoSpanProcessor implements SpanProcessorLike {
  private _processor: SpanProcessorLike;
  private _exporter: GalileoOTLPExporter;
  private _experimentId?: string;
  private _sessionId?: string;

  constructor(config?: GalileoSpanProcessorConfig) {
    this._experimentId = config?.experimentId;
    this._sessionId = config?.sessionId;

    this._exporter = new GalileoOTLPExporter({
      project: config?.project,
      logstream: config?.logstream,
      apiKey: config?.apiKey,
      apiUrl: config?.apiUrl
    });

    let BatchSpanProcessor: new (
      exporter: GalileoOTLPExporter
    ) => SpanProcessorLike;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require('@opentelemetry/sdk-trace-base');
      BatchSpanProcessor = mod.BatchSpanProcessor;
    } catch {
      throw new Error(
        '@opentelemetry/sdk-trace-base is not installed. ' +
          'Install it with: npm install @opentelemetry/sdk-trace-base'
      );
    }

    this._processor = new BatchSpanProcessor(this._exporter);
  }

  /**
   * Inject Galileo context attributes onto each span at creation time.
   *
   * Reads context from AsyncLocalStorage (experimentContext from singleton.ts),
   * falls back to constructor config, then environment variables.
   * Experiment ID takes priority over logstream when both are present.
   */
  onStart(span: SpanLike, parentContext: ContextLike): void {
    const ctx = experimentContext.getStore();

    const project = ctx?.projectName ?? this._exporter.project;
    const logStream = ctx?.logStreamName ?? this._exporter.logstream;
    const experimentId = ctx?.experimentId ?? this._experimentId;
    const sessionId = ctx?.sessionId ?? this._sessionId;

    if (project) {
      span.setAttribute(GALILEO_ATTRIBUTES.PROJECT_NAME, project);
    }
    if (logStream && !experimentId) {
      span.setAttribute(GALILEO_ATTRIBUTES.LOGSTREAM_NAME, logStream);
    }
    if (experimentId) {
      span.setAttribute(GALILEO_ATTRIBUTES.EXPERIMENT_ID, experimentId);
    }
    if (sessionId) {
      span.setAttribute(GALILEO_ATTRIBUTES.SESSION_ID, sessionId);
    }

    this._processor.onStart(span, parentContext);
  }

  onEnd(span: ReadableSpanLike): void {
    this._processor.onEnd(span);
  }

  async shutdown(): Promise<void> {
    await this._processor.shutdown();
    sdkLogger.info(
      `Galileo span processor shutdown for project "${this._exporter.project}" ` +
        `and logstream "${this._exporter.logstream}"`
    );
  }

  async forceFlush(): Promise<void> {
    return this._processor.forceFlush();
  }

  get exporter(): GalileoOTLPExporter {
    return this._exporter;
  }

  get processor(): SpanProcessorLike {
    return this._processor;
  }
}
