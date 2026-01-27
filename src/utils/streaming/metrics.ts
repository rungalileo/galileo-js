import type {
  TokenUsage,
  StreamingMetricsResult
} from '../../types/streaming-adapter.types';

/**
 * Tracks streaming metrics including TTFT, duration, and token usage
 */
export class StreamingMetrics {
  private startTime: number;
  private firstTokenTime: number | null = null;
  private tokenUsage: TokenUsage | null = null;

  constructor(startTime?: number) {
    this.startTime = startTime ?? Date.now();
  }

  /**
   * Record when the first token/chunk arrives
   */
  recordFirstToken(): void {
    if (this.firstTokenTime === null) {
      this.firstTokenTime = Date.now();
    }
  }

  /**
   * Get Time to First Token in nanoseconds
   * @returns TTFT in nanoseconds, or null if first token hasn't arrived yet
   */
  getTTFT(): number | null {
    if (this.firstTokenTime === null) {
      return null;
    }
    return (this.firstTokenTime - this.startTime) * 1e6; // Convert ms to ns
  }

  /**
   * Set token usage information
   * @param usage Token usage object
   */
  setTokenUsage(usage: TokenUsage): void {
    this.tokenUsage = usage;
  }

  /**
   * Get current token usage
   * @returns Token usage object or null
   */
  getTokenUsage(): TokenUsage | null {
    return this.tokenUsage;
  }

  /**
   * Get total duration in nanoseconds
   * @returns Duration in nanoseconds from start time to now
   */
  getDuration(): number {
    return (Date.now() - this.startTime) * 1e6; // Convert ms to ns
  }

  /**
   * Get all metrics
   * @returns Complete metrics result
   */
  getMetrics(): StreamingMetricsResult {
    return {
      ttftNs: this.getTTFT(),
      durationNs: this.getDuration(),
      tokenUsage: this.tokenUsage
    };
  }

  /**
   * Reset metrics (useful for testing or reuse)
   */
  reset(startTime?: number): void {
    this.startTime = startTime ?? Date.now();
    this.firstTokenTime = null;
    this.tokenUsage = null;
  }
}
