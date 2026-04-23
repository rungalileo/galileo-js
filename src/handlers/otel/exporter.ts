import type {
  GalileoOTLPExporterConfig,
  ReadableSpanLike,
  ExportResultLike,
  SpanExporterLike
} from './types';
import { GALILEO_ATTRIBUTES } from './types';
import { GalileoConfig, getSdkLogger } from 'galileo-generated';

const sdkLogger = getSdkLogger();

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
      const mod = require('@opentelemetry/exporter-trace-otlp-http');
      OTLPTraceExporter = mod.OTLPTraceExporter;
    } catch {
      throw new Error(
        '@opentelemetry/exporter-trace-otlp-http is not installed. ' +
          'Install it with: npm install @opentelemetry/exporter-trace-otlp-http'
      );
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
    let isExperiment = false;

    for (const span of spans) {
      const attrs = span.attributes;
      const project = attrs[GALILEO_ATTRIBUTES.PROJECT_NAME] as
        | string
        | undefined;
      const logstream = attrs[GALILEO_ATTRIBUTES.LOGSTREAM_NAME] as
        | string
        | undefined;
      const sessionId = attrs[GALILEO_ATTRIBUTES.SESSION_ID] as
        | string
        | undefined;
      const experimentId = attrs[GALILEO_ATTRIBUTES.EXPERIMENT_ID] as
        | string
        | undefined;
      const datasetInput = attrs[GALILEO_ATTRIBUTES.DATASET_INPUT] as
        | string
        | undefined;
      const datasetOutput = attrs[GALILEO_ATTRIBUTES.DATASET_OUTPUT] as
        | string
        | undefined;
      const datasetMetadata = attrs[GALILEO_ATTRIBUTES.DATASET_METADATA] as
        | string
        | undefined;

      const resourceAttrs: Record<string, string> = {};
      let hasResourceAttrs = false;

      if (project) {
        resourceAttrs[GALILEO_ATTRIBUTES.PROJECT_NAME] = project;
        hasResourceAttrs = true;
      }
      if (logstream && !experimentId) {
        resourceAttrs[GALILEO_ATTRIBUTES.LOGSTREAM_NAME] = logstream;
        hasResourceAttrs = true;
      }
      if (sessionId) {
        resourceAttrs[GALILEO_ATTRIBUTES.SESSION_ID] = sessionId;
        hasResourceAttrs = true;
      }
      if (experimentId) {
        resourceAttrs[GALILEO_ATTRIBUTES.EXPERIMENT_ID] = experimentId;
        isExperiment = true;
        hasResourceAttrs = true;
      }
      if (datasetInput) {
        resourceAttrs[GALILEO_ATTRIBUTES.DATASET_INPUT] = datasetInput;
        hasResourceAttrs = true;
      }
      if (datasetOutput) {
        resourceAttrs[GALILEO_ATTRIBUTES.DATASET_OUTPUT] = datasetOutput;
        hasResourceAttrs = true;
      }
      if (datasetMetadata) {
        resourceAttrs[GALILEO_ATTRIBUTES.DATASET_METADATA] = datasetMetadata;
        hasResourceAttrs = true;
      }

      if (hasResourceAttrs && this._ResourceClass) {
        try {
          const newResource = span.resource.merge(
            new this._ResourceClass(resourceAttrs)
          );
          // _resource is an internal property on OTel SDK's Span (verified against @opentelemetry/sdk-trace-base ^1.x)
          if ('_resource' in span) {
            (span as { _resource?: unknown })._resource = newResource;
          }
        } catch (err) {
          sdkLogger.warn('Failed to merge resource attributes:', err);
        }
      }
    }

    if (spans.length > 0) {
      const lastSpan = spans[spans.length - 1];
      const batchProject = lastSpan.attributes[
        GALILEO_ATTRIBUTES.PROJECT_NAME
      ] as string | undefined;
      const batchLogstream = lastSpan.attributes[
        GALILEO_ATTRIBUTES.LOGSTREAM_NAME
      ] as string | undefined;

      const innerHeaders = (
        this._innerExporter as unknown as {
          headers: Record<string, string>;
        }
      ).headers;

      if (batchProject) innerHeaders['project'] = batchProject;

      if (isExperiment) {
        const experimentId = lastSpan.attributes[
          GALILEO_ATTRIBUTES.EXPERIMENT_ID
        ] as string | undefined;
        if (experimentId) {
          innerHeaders['experimentid'] = experimentId;
        }
        delete innerHeaders['logstream'];
      } else {
        if (batchLogstream) innerHeaders['logstream'] = batchLogstream;
        delete innerHeaders['experimentid'];
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
