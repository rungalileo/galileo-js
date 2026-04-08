import type { GalileoSpanProcessor } from './processor';

export { GalileoSpanProcessor } from './processor';
export { GalileoOTLPExporter } from './exporter';
export type {
  GalileoSpanProcessorConfig,
  GalileoOTLPExporterConfig
} from './types';
export { GALILEO_ATTRIBUTES } from './types';

/**
 * Add a GalileoSpanProcessor to an OpenTelemetry TracerProvider.
 *
 * @example
 * ```typescript
 * import { addGalileoSpanProcessor, GalileoSpanProcessor } from 'galileo';
 * import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
 *
 * const provider = new NodeTracerProvider();
 * const processor = new GalileoSpanProcessor({ project: 'my-project' });
 * addGalileoSpanProcessor(provider, processor);
 * provider.register();
 * ```
 */
export function addGalileoSpanProcessor(
  tracerProvider: { addSpanProcessor(processor: unknown): void },
  processor: GalileoSpanProcessor
): void {
  tracerProvider.addSpanProcessor(processor);
}
