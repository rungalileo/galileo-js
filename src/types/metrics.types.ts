export interface Metrics {
  durationNs?: number;
}

export interface LlmMetrics extends Metrics {
  numInputTokens?: number;
  numOutputTokens?: number;
  numTotalTokens?: number;
  timeToFirstTokenNs?: number;
}
