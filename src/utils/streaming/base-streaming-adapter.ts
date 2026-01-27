import { GalileoLogger } from '../galileo-logger';
import { ErrorManager } from '../errors';
import { StreamingMetrics } from './metrics';
import { StreamingFinalizer, StreamingFinalizerConfig } from './finalizer';
import {
  TokenUsage,
  StreamingMetricsResult
} from '../../types/streaming-adapter.types';
import {
  LlmSpanAllowedInputType,
  LlmSpanAllowedOutputType
} from '../../types/logging/step.types';
import { JsonObject } from '../../types/base.types';

/**
 * Tool definition type (matches LlmSpan tools type)
 */
export type ToolDefinition = Record<string, unknown>;

/**
 * Configuration for base streaming adapter
 */
export interface BaseStreamingAdapterConfig {
  logger: GalileoLogger;
  requestData: {
    messages?: LlmSpanAllowedInputType;
    model?: string;
    metadata?: Record<string, string>;
    name?: string;
    tools?: JsonObject[];
    temperature?: number;
  };
  shouldCompleteTrace: boolean;
  startTime?: number;
}

/**
 * Abstract base class for streaming adapters
 * Uses composition to share common functionality (metrics, error handling, finalization)
 * while allowing adapter-specific implementations for chunk processing
 */
export abstract class BaseStreamingAdapter {
  protected metrics: StreamingMetrics;
  protected errorManager: ErrorManager;
  protected finalizer: StreamingFinalizer;
  protected logger: GalileoLogger;
  protected requestData: BaseStreamingAdapterConfig['requestData'];
  protected shouldCompleteTrace: boolean;

  constructor(config: BaseStreamingAdapterConfig) {
    this.logger = config.logger;
    this.requestData = config.requestData;
    this.shouldCompleteTrace = config.shouldCompleteTrace;

    // Initialize shared utilities via composition
    this.metrics = new StreamingMetrics(config.startTime);
    this.errorManager = new ErrorManager();

    // Initialize finalizer with configuration
    const finalizerConfig: StreamingFinalizerConfig = {
      logger: this.logger,
      metrics: this.metrics,
      requestData: this.requestData,
      shouldCompleteTrace: this.shouldCompleteTrace
    };
    this.finalizer = new StreamingFinalizer(finalizerConfig);
  }

  /**
   * Record when the first token/chunk arrives
   * Delegates to metrics tracker
   */
  protected recordFirstToken(): void {
    this.metrics.recordFirstToken();
  }

  /**
   * Set token usage information
   * Delegates to metrics tracker
   * @param usage Token usage object
   */
  protected setTokenUsage(usage: TokenUsage): void {
    this.metrics.setTokenUsage(usage);
  }

  /**
   * Handle errors using standardized error mapping
   * @param error The error to handle
   * @returns Standardized error information
   */
  protected handleError(error: unknown): {
    statusCode: number;
    message: string;
  } {
    return this.errorManager.mapError(error);
  }

  /**
   * Finalize the streaming span with all collected metrics
   * Delegates to finalizer
   * @param output The final output from the stream
   * @param statusCode Optional status code (defaults to 200)
   */
  protected finalize(
    output: LlmSpanAllowedOutputType,
    statusCode: number = 200
  ): void {
    this.finalizer.finalize(output, statusCode);
  }

  /**
   * Get current metrics
   * @returns Complete metrics result
   */
  protected getMetrics(): StreamingMetricsResult {
    return this.metrics.getMetrics();
  }

  /**
   * Check if an error is retryable
   * @param error The error to check
   * @returns True if the error is retryable
   */
  protected isRetryable(error: unknown): boolean {
    return this.errorManager.isRetryable(error);
  }

  // Abstract methods that must be implemented by concrete adapters

  /**
   * Process a chunk from the stream
   * Adapter-specific implementation required
   * @param chunk The chunk to process (adapter-specific structure)
   */
  abstract processChunk(chunk: unknown): void;

  /**
   * Extract token usage from the stream
   * Adapter-specific implementation required
   * @returns Token usage object or null if not available
   */
  abstract extractTokenUsage(): TokenUsage | null;

  /**
   * Build the final output from collected chunks
   * Adapter-specific implementation required
   * @returns The final output object
   */
  abstract buildOutput(): LlmSpanAllowedOutputType;
}
