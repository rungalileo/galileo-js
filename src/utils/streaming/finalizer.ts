import { GalileoLogger } from '../galileo-logger';
import { StreamingMetrics } from './metrics';
import {
  LlmSpanAllowedInputType,
  LlmSpanAllowedOutputType
} from '../../types/logging/step.types';
import { Span } from '../../types/logging/span.types';
import { Trace } from '../../types/logging/trace.types';
import type { ToolDefinition } from './base-streaming-adapter';

/**
 * Extended logger interface with streaming update methods
 * These methods are mocked and will be replaced when streaming mode PR is merged
 */
export interface GalileoLoggerWithStreaming extends GalileoLogger {
  _updateSpanStreaming?(span: Span, output: LlmSpanAllowedOutputType): void;
  _updateTraceStreaming?(
    trace: Trace,
    output: LlmSpanAllowedOutputType,
    isComplete?: boolean
  ): void;
}

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
    tools?: ToolDefinition[];
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

  /**
   * Update span incrementally during streaming (for real-time updates)
   * @param output Current output state (can be partial)
   * @param spanId Optional span ID if available (currently unused, reserved for future use)
   */
  updateSpanIncremental(
    output: LlmSpanAllowedOutputType,
    spanId?: string
  ): void {
    void spanId;
    // Get current parent span or trace
    const currentParent = this.logger.currentParent();

    if (!currentParent) {
      // No active span/trace, skip incremental update
      return;
    }

    // Type guard to check if logger has streaming methods
    const loggerWithStreaming = this.logger as GalileoLoggerWithStreaming;

    // TO-DO: After logger PR merged, substitute for actual implementation.
    if (currentParent instanceof Trace) {
      // Mock implementation - assumes _updateTraceStreaming exists in another branch/PR
      loggerWithStreaming._updateTraceStreaming?.(
        currentParent,
        output,
        false
      );
    } else {
      // Mock implementation - assumes _updateSpanStreaming exists in another branch/PR
      // currentParent is a Span (WorkflowSpan, AgentSpan, etc.)
      loggerWithStreaming._updateSpanStreaming?.(currentParent as Span, output);
    }
  }
}
