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

function loadOTLPTraceExporter(): new (
  config: Record<string, unknown>
) => SpanExporterLike {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('@opentelemetry/exporter-trace-otlp-proto')
      .OTLPTraceExporter;
  } catch {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return require('@opentelemetry/exporter-trace-otlp-http')
        .OTLPTraceExporter;
    } catch {
      throw new Error(
        '@opentelemetry/exporter-trace-otlp-proto (or @opentelemetry/exporter-trace-otlp-http) is not installed. ' +
          'Install it with: npm install @opentelemetry/exporter-trace-otlp-proto'
      );
    }
  }
}

function loadResourceClass():
  | (new (attrs: Record<string, unknown>) => unknown)
  | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('@opentelemetry/resources').Resource ?? null;
  } catch {
    return null;
  }
}

/**
 * OpenTelemetry OTLP span exporter preconfigured for Galileo platform integration.
 *
 * Extends the standard OTLPTraceExporter with Galileo-specific configuration,
 * authentication, per-batch header overrides, and resource attribute merging.
 * The class is created dynamically at runtime since the base OTLPTraceExporter
 * is loaded via require().
 *
 * @example
 * ```typescript
 * import { GalileoOTLPExporter } from 'galileo';
 * import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-node';
 *
 * const exporter = new GalileoOTLPExporter({ project: 'my-project' });
 * const processor = new SimpleSpanProcessor(exporter);
 * ```
 */
export class GalileoOTLPExporter implements SpanExporterLike {
  private _inner: SpanExporterLike;
  private _headerOverrides: Record<string, string | null> = {};
  private _hooked = false;
  private _ResourceClass:
    | (new (attrs: Record<string, unknown>) => unknown)
    | null;

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
    const OTLPTraceExporter = loadOTLPTraceExporter();
    this._ResourceClass = loadResourceClass();

    this._inner = new OTLPTraceExporter({
      url: endpoint,
      headers: {
        'Galileo-API-Key': apiKey,
        project: this.project,
        logstream: this.logstream
      }
    });
  }

  /**
   * Replace the static headers function on the inner transport with a
   * dynamic one that merges per-batch overrides at send time.
   */
  private _installHeadersHook(): void {
    if (this._hooked) return;
    this._hooked = true;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const exp = this._inner as any;

      const applyOverrides = (base: Record<string, string>) => {
        const merged = { ...base };
        for (const [k, v] of Object.entries(this._headerOverrides)) {
          if (v === null) {
            delete merged[k];
          } else {
            merged[k] = v;
          }
        }
        return merged;
      };

      // Modern OTEL SDK (0.200+): headers are a function on transport params
      const params = exp?._delegate?._transport?._transport?._parameters;
      if (params && typeof params.headers === 'function') {
        const originalHeadersFn = params.headers.bind(params);
        params.headers = () => applyOverrides(originalHeadersFn());
        return;
      }

      // Legacy OTEL SDK: direct .headers property
      if (
        exp.headers &&
        typeof exp.headers === 'object' &&
        !Object.isFrozen(exp.headers)
      ) {
        const originalHeaders = { ...exp.headers };
        Object.defineProperty(exp, 'headers', {
          get: () => applyOverrides(originalHeaders)
        });
        return;
      }
    } catch {
      // Transport structure not recognized
    }

    sdkLogger.warn(
      'Could not install dynamic headers hook on the inner exporter. ' +
        'Per-batch header overrides will not be applied.'
    );
  }

  export(
    spans: ReadableSpanLike[],
    resultCallback: (result: ExportResultLike) => void
  ): void {
    this._installHeadersHook();

    let batchProject: string | undefined;
    let batchLogstream: string | undefined;
    let batchExperimentId: string | undefined;

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

      if (project) batchProject = project;
      if (logstream) batchLogstream = logstream;
      if (experimentId) batchExperimentId = experimentId;

      // Merge galileo attributes into span resource (matches Python SDK behavior)
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

    // Update per-batch header overrides.
    // Always set both logstream and experimentid so the merge fully replaces
    // construction-time values — they are mutually exclusive for routing.
    if (spans.length > 0) {
      const overrides: Record<string, string | null> = {
        project: batchProject ?? this.project
      };

      if (batchExperimentId) {
        overrides['experimentid'] = batchExperimentId;
        overrides['logstream'] = null;
      } else {
        overrides['logstream'] = batchLogstream ?? this.logstream;
        overrides['experimentid'] = null;
      }

      this._headerOverrides = overrides;
    }

    this._inner.export(spans, resultCallback);
  }

  async shutdown(): Promise<void> {
    return this._inner.shutdown();
  }

  async forceFlush(): Promise<void> {
    return this._inner.forceFlush?.();
  }
}
