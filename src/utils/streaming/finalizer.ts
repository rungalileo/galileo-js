import type { GalileoLogger } from '../galileo-logger';
import type { StreamingMetrics } from './metrics';
import type {
  LlmSpanAllowedInputType,
  LlmSpanAllowedOutputType
} from '../../types/logging/step.types';
import type { JsonObject } from '../../types/base.types';

/**
 * Configuration for streaming finalization
 */
export interface StreamingFinalizerConfig {
  logger: GalileoLogger;
  metrics: StreamingMetrics;
  requestData: {
    messages?: LlmSpanAllowedInputType;
    model?: string;
    metadata?: Record<string, string>;
    name?: string;
    tools?: JsonObject[];
    temperature?: number;
  };
  shouldCompleteTrace: boolean;
}

/**
 * Handles finalization of streaming spans including logging and trace conclusion
 */
export class StreamingFinalizer {
  private logger: GalileoLogger;
  private metrics: StreamingMetrics;
  private requestData: StreamingFinalizerConfig['requestData'];
  private shouldCompleteTrace: boolean;

  constructor(config: StreamingFinalizerConfig) {
    this.logger = config.logger;
    this.metrics = config.metrics;
    this.requestData = config.requestData;
    this.shouldCompleteTrace = config.shouldCompleteTrace;
  }

  /**
   * Finalize the streaming span with all collected metrics
   * @param output The final output from the stream
   * @param statusCode Optional status code (defaults to 200)
   */
  finalize(output: LlmSpanAllowedOutputType, statusCode: number = 200): void {
    const metrics = this.metrics.getMetrics();

    // Build metadata from request data
    const metadata: Record<string, string> = {};
    if (this.requestData.metadata) {
      Object.assign(metadata, this.requestData.metadata);
    }

    // Add LLM span with all metrics
    this.logger.addLlmSpan({
      input: this.requestData.messages || '',
      output,
      model: this.requestData.model || 'unknown',
      numInputTokens: metrics.tokenUsage?.promptTokens,
      numOutputTokens: metrics.tokenUsage?.completionTokens,
      totalTokens: metrics.tokenUsage?.totalTokens,
      durationNs: metrics.durationNs,
      timeToFirstTokenNs: metrics.ttftNs ?? undefined,
      statusCode,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      tools: this.requestData.tools,
      temperature: this.requestData.temperature,
      name: this.requestData.name
    });

    // Conclude the trace if this was the top-level call
    if (this.shouldCompleteTrace) {
      const outputString =
        typeof output === 'string' ? output : JSON.stringify(output);
      this.logger.conclude({
        output: outputString,
        durationNs: metrics.durationNs
      });
    }
  }
}
