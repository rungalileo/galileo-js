/**
 * Streaming utilities for adapter implementations
 *
 * This module provides shared infrastructure for streaming adapters including:
 * - Metrics tracking (TTFT, duration, token usage)
 * - Error handling and mapping
 * - Finalization and logging
 * - Base adapter class for extension
 */

export { StreamingMetrics } from './metrics';
export { StreamingFinalizer } from './finalizer';
export { BaseStreamingAdapter } from './base-streaming-adapter';
export { ErrorManager, ErrorInfo } from '../errors';
export type { TokenUsage, StreamingMetricsResult } from '../../types/streaming-adapter.types';
export type { StreamingFinalizerConfig } from './finalizer';
export type {
  BaseStreamingAdapterConfig,
  ToolDefinition
} from './base-streaming-adapter';
