import type {
  GalileoOTLPExporterConfig,
  ReadableSpanLike,
  ExportResultLike,
  SpanExporterLike
} from './types';
import { GALILEO_ATTRIBUTES } from './types';
import { GalileoConfig, getSdkLogger } from 'galileo-generated';

const sdkLogger = getSdkLogger();

function strAttr(
  attrs: Record<string, unknown>,
  key: string
): string | undefined {
  const v = attrs[key];
  return typeof v === 'string' ? v : undefined;
}

/**
 * OpenTelemetry OTLP span exporter preconfigured for Galileo platform integration.
 *
 * This exporter wraps the standard OTLPTraceExporter with Galileo-specific
 * configuration and authentication. It injects Galileo resource attributes
 * and updates HTTP headers per export batch.
 *
 * For most applications, use GalileoSpanProcessor instead, which provides
 * a complete tracing solution including this exporter.
 *
 * @example
 * ```typescript
 * import { GalileoOTLPExporter } from 'galileo';
 * import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
 *
 * const exporter = new GalileoOTLPExporter({ project: 'my-project' });
 * const processor = new BatchSpanProcessor(exporter);
 * ```
 */
export class GalileoOTLPExporter implements SpanExporterLike {
  private _innerExporter: SpanExporterLike;
  private _ResourceClass:
    | (new (attrs: Record<string, unknown>) => unknown)
    | null = null;

  readonly project: string;
  readonly logstream: string;

  constructor(config?: GalileoOTLPExporterConfig) {
    const galileoConfig = GalileoConfig.get();
    const apiUrl = config?.apiUrl ?? galileoConfig.getApiUrl();
    const apiKey = config?.apiKey ?? galileoConfig.getAuthCredentials().apiKey;

    if (!apiKey) {
      throw new Error(
        'Galileo API key is required. Set GALILEO_API_KEY environment variable or pass apiKey in config.'
      );
    }

    this.project = config?.project ?? galileoConfig.projectName ?? 'default';
    this.logstream =
      config?.logstream ?? galileoConfig.logStreamName ?? 'default';

    const endpoint = `${apiUrl.replace(/\/$/, '')}/otel/traces`;

    let OTLPTraceExporter: new (
      config: Record<string, unknown>
    ) => SpanExporterLike;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require('@opentelemetry/exporter-trace-otlp-proto');
      OTLPTraceExporter = mod.OTLPTraceExporter;
    } catch {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = require('@opentelemetry/exporter-trace-otlp-http');
        OTLPTraceExporter = mod.OTLPTraceExporter;
      } catch {
        throw new Error(
          '@opentelemetry/exporter-trace-otlp-proto (or @opentelemetry/exporter-trace-otlp-http) is not installed. ' +
            'Install it with: npm install @opentelemetry/exporter-trace-otlp-proto'
        );
      }
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const resourcesMod = require('@opentelemetry/resources');
      this._ResourceClass = resourcesMod.Resource ?? null;
    } catch {
      sdkLogger.warn(
        '@opentelemetry/resources is not installed. ' +
          'Resource attributes will not be merged onto exported spans.'
      );
    }

    this._innerExporter = new OTLPTraceExporter({
      url: endpoint,
      headers: {
        'Galileo-API-Key': apiKey,
        project: this.project,
        logstream: this.logstream
      }
    });
  }

  /**
   * Export spans to Galileo, injecting resource attributes from span attributes.
   *
   * For each span, reads galileo.* attributes (set by GalileoSpanProcessor.onStart)
   * and merges them into the span's resource. Also updates HTTP headers per batch.
   */
  export(
    spans: ReadableSpanLike[],
    resultCallback: (result: ExportResultLike) => void
  ): void {
    let batchExperimentId: string | undefined;
    let batchProject: string | undefined;
    let batchLogstream: string | undefined;

    for (const span of spans) {
      const attrs = span.attributes;
      const project = strAttr(attrs, GALILEO_ATTRIBUTES.PROJECT_NAME);
      const logstream = strAttr(attrs, GALILEO_ATTRIBUTES.LOGSTREAM_NAME);
      const sessionId = strAttr(attrs, GALILEO_ATTRIBUTES.SESSION_ID);
      const experimentId = strAttr(attrs, GALILEO_ATTRIBUTES.EXPERIMENT_ID);
      const datasetInput = strAttr(attrs, GALILEO_ATTRIBUTES.DATASET_INPUT);
      const datasetOutput = strAttr(attrs, GALILEO_ATTRIBUTES.DATASET_OUTPUT);
      const datasetMetadata = strAttr(
        attrs,
        GALILEO_ATTRIBUTES.DATASET_METADATA
      );

      if (experimentId) batchExperimentId = experimentId;
      batchProject = project ?? batchProject;
      batchLogstream = logstream ?? batchLogstream;

      const resourceAttrs: Record<string, string> = {};
      if (project) resourceAttrs[GALILEO_ATTRIBUTES.PROJECT_NAME] = project;
      if (logstream && !experimentId)
        resourceAttrs[GALILEO_ATTRIBUTES.LOGSTREAM_NAME] = logstream;
      if (sessionId) resourceAttrs[GALILEO_ATTRIBUTES.SESSION_ID] = sessionId;
      if (experimentId)
        resourceAttrs[GALILEO_ATTRIBUTES.EXPERIMENT_ID] = experimentId;
      if (datasetInput)
        resourceAttrs[GALILEO_ATTRIBUTES.DATASET_INPUT] = datasetInput;
      if (datasetOutput)
        resourceAttrs[GALILEO_ATTRIBUTES.DATASET_OUTPUT] = datasetOutput;
      if (datasetMetadata)
        resourceAttrs[GALILEO_ATTRIBUTES.DATASET_METADATA] = datasetMetadata;

      if (Object.keys(resourceAttrs).length > 0 && this._ResourceClass) {
        try {
          (span as { resource: unknown }).resource = span.resource.merge(
            new this._ResourceClass(resourceAttrs)
          );
        } catch (err) {
          sdkLogger.warn('Failed to merge resource attributes:', err);
        }
      }
    }

    if (spans.length > 0) {
      const innerHeaders = (
        this._innerExporter as unknown as {
          headers: Record<string, string>;
        }
      ).headers;

      if (
        innerHeaders &&
        typeof innerHeaders === 'object' &&
        !Object.isFrozen(innerHeaders)
      ) {
        innerHeaders['project'] = batchProject ?? this.project;

        if (batchExperimentId) {
          innerHeaders['experimentid'] = batchExperimentId;
          delete innerHeaders['logstream'];
        } else {
          innerHeaders['logstream'] = batchLogstream ?? this.logstream;
          delete innerHeaders['experimentid'];
        }
      } else {
        sdkLogger.warn(
          'Could not update inner exporter headers — the OTLPTraceExporter implementation may have changed.'
        );
      }
    }

    this._innerExporter.export(spans, resultCallback);
  }

  async shutdown(): Promise<void> {
    return this._innerExporter.shutdown();
  }

  async forceFlush(): Promise<void> {
    return this._innerExporter.forceFlush?.();
  }
}
