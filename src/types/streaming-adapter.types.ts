/**
 * Token usage information from streaming responses
 */
export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

/**
 * Result containing all streaming metrics
 */
export interface StreamingMetricsResult {
  ttftNs: number | null;
  durationNs: number;
  tokenUsage: TokenUsage | null;
}
