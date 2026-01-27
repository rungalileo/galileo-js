import { StreamingMetrics } from '../../../src/utils/streaming/metrics';
import type { TokenUsage } from '../../../src/types/streaming-adapter.types';

describe('StreamingMetrics', () => {
  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
  });

  describe('constructor', () => {
    it('should initialize with custom startTime', () => {
      const currentTime = Date.now();
      const metrics = new StreamingMetrics(currentTime);

      expect(metrics).toBeDefined();
      expect(metrics.getDuration()).toBe(0);
    });

    it('should initialize with Date.now() when startTime not provided', () => {
      const metrics = new StreamingMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.getDuration()).toBe(0);
    });

    it('should initialize with null firstTokenTime', () => {
      const metrics = new StreamingMetrics();

      expect(metrics.getTTFT()).toBeNull();
    });

    it('should initialize with null tokenUsage', () => {
      const metrics = new StreamingMetrics();

      expect(metrics.getTokenUsage()).toBeNull();
    });
  });

  describe('recordFirstToken', () => {
    it('should record first token time', () => {
      const metrics = new StreamingMetrics();

      expect(metrics.getTTFT()).toBeNull();

      jest.advanceTimersByTime(50); // Advance 50ms
      metrics.recordFirstToken();

      expect(metrics.getTTFT()).toBe(50 * 1e6); // 50ms in ns
    });

    it('should only record first token once', () => {
      const metrics = new StreamingMetrics();

      jest.advanceTimersByTime(50);
      metrics.recordFirstToken();
      const firstTTFT = metrics.getTTFT();

      jest.advanceTimersByTime(50);
      metrics.recordFirstToken(); // Second call should not update

      expect(metrics.getTTFT()).toBe(firstTTFT);
      expect(metrics.getTTFT()).toBe(50 * 1e6); // Still 50ms
    });

    it('should not update firstTokenTime on multiple calls', () => {
      const metrics = new StreamingMetrics();

      jest.advanceTimersByTime(30);
      metrics.recordFirstToken();

      jest.advanceTimersByTime(20);
      metrics.recordFirstToken();

      jest.advanceTimersByTime(50);
      metrics.recordFirstToken();

      expect(metrics.getTTFT()).toBe(30 * 1e6); // Still 30ms
    });
  });

  describe('getTTFT', () => {
    it('should return null before first token recorded', () => {
      const metrics = new StreamingMetrics();

      expect(metrics.getTTFT()).toBeNull();

      jest.advanceTimersByTime(100);
      expect(metrics.getTTFT()).toBeNull();
    });

    it('should return correct nanoseconds after first token', () => {
      const metrics = new StreamingMetrics();

      jest.advanceTimersByTime(75);
      metrics.recordFirstToken();

      expect(metrics.getTTFT()).toBe(75 * 1e6);
    });

    it('should correctly convert milliseconds to nanoseconds', () => {
      const metrics = new StreamingMetrics();

      jest.advanceTimersByTime(1);
      metrics.recordFirstToken();

      expect(metrics.getTTFT()).toBe(1000000); // 1ms = 1,000,000ns
    });

    it('should handle zero time difference', () => {
      const metrics = new StreamingMetrics();

      metrics.recordFirstToken(); // Immediate recording

      expect(metrics.getTTFT()).toBe(0);
    });
  });

  describe('setTokenUsage and getTokenUsage', () => {
    it('should set and get token usage', () => {
      const metrics = new StreamingMetrics();
      const tokenUsage: TokenUsage = {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30
      };

      metrics.setTokenUsage(tokenUsage);

      expect(metrics.getTokenUsage()).toEqual(tokenUsage);
    });

    it('should handle partial token usage', () => {
      const metrics = new StreamingMetrics();
      const tokenUsage: TokenUsage = {
        promptTokens: 10
      };

      metrics.setTokenUsage(tokenUsage);

      expect(metrics.getTokenUsage()).toEqual(tokenUsage);
    });

    it('should handle empty token usage object', () => {
      const metrics = new StreamingMetrics();
      const tokenUsage: TokenUsage = {};

      metrics.setTokenUsage(tokenUsage);

      expect(metrics.getTokenUsage()).toEqual(tokenUsage);
    });

    it('should overwrite previous token usage', () => {
      const metrics = new StreamingMetrics();
      const firstUsage: TokenUsage = {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30
      };
      const secondUsage: TokenUsage = {
        promptTokens: 15,
        completionTokens: 25,
        totalTokens: 40
      };

      metrics.setTokenUsage(firstUsage);
      metrics.setTokenUsage(secondUsage);

      expect(metrics.getTokenUsage()).toEqual(secondUsage);
    });

    it('should return null when token usage not set', () => {
      const metrics = new StreamingMetrics();

      expect(metrics.getTokenUsage()).toBeNull();
    });
  });

  describe('getDuration', () => {
    it('should return duration in nanoseconds', () => {
      const metrics = new StreamingMetrics();

      jest.advanceTimersByTime(100);

      expect(metrics.getDuration()).toBe(100 * 1e6);
    });

    it('should return increasing duration values', () => {
      const metrics = new StreamingMetrics();

      jest.advanceTimersByTime(50);
      const duration1 = metrics.getDuration();

      jest.advanceTimersByTime(50);
      const duration2 = metrics.getDuration();

      expect(duration2).toBeGreaterThan(duration1);
      expect(duration2).toBe(100 * 1e6);
      expect(duration1).toBe(50 * 1e6);
    });

    it('should correctly convert milliseconds to nanoseconds', () => {
      const metrics = new StreamingMetrics();

      jest.advanceTimersByTime(1);

      expect(metrics.getDuration()).toBe(1000000); // 1ms = 1,000,000ns
    });

    it('should return zero duration immediately after creation', () => {
      const metrics = new StreamingMetrics();

      expect(metrics.getDuration()).toBe(0);
    });

    it('should calculate duration from custom startTime', () => {
      const startTime = Date.now();
      const metrics = new StreamingMetrics(startTime);

      jest.advanceTimersByTime(100);

      expect(metrics.getDuration()).toBe(100 * 1e6); // 100ms from startTime
    });
  });

  describe('getMetrics', () => {
    it('should return complete metrics object', () => {
      const metrics = new StreamingMetrics();
      const tokenUsage: TokenUsage = {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30
      };

      jest.advanceTimersByTime(50);
      metrics.recordFirstToken();
      metrics.setTokenUsage(tokenUsage);

      jest.advanceTimersByTime(50);

      const result = metrics.getMetrics();

      expect(result).toEqual({
        ttftNs: 50 * 1e6,
        durationNs: 100 * 1e6,
        tokenUsage: tokenUsage
      });
    });

    it('should return metrics with null TTFT before first token', () => {
      const metrics = new StreamingMetrics();

      jest.advanceTimersByTime(100);

      const result = metrics.getMetrics();

      expect(result).toEqual({
        ttftNs: null,
        durationNs: 100 * 1e6,
        tokenUsage: null
      });
    });

    it('should return metrics with null tokenUsage when not set', () => {
      const metrics = new StreamingMetrics();

      jest.advanceTimersByTime(50);
      metrics.recordFirstToken();
      jest.advanceTimersByTime(50);

      const result = metrics.getMetrics();

      expect(result).toEqual({
        ttftNs: 50 * 1e6,
        durationNs: 100 * 1e6,
        tokenUsage: null
      });
    });

    it('should return current state without modifying metrics', () => {
      const metrics = new StreamingMetrics();

      jest.advanceTimersByTime(50);
      metrics.recordFirstToken();

      const result1 = metrics.getMetrics();

      jest.advanceTimersByTime(50);

      const result2 = metrics.getMetrics();

      expect(result1.ttftNs).toBe(50 * 1e6);
      expect(result2.ttftNs).toBe(50 * 1e6); // TTFT unchanged
      expect(result2.durationNs).toBeGreaterThan(result1.durationNs);
    });
  });

  describe('reset', () => {
    it('should reset all metrics to initial state', () => {
      const metrics = new StreamingMetrics();
      const tokenUsage: TokenUsage = {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30
      };

      jest.advanceTimersByTime(50);
      metrics.recordFirstToken();
      metrics.setTokenUsage(tokenUsage);

      jest.advanceTimersByTime(50);

      metrics.reset();

      expect(metrics.getTTFT()).toBeNull();
      expect(metrics.getTokenUsage()).toBeNull();
      expect(metrics.getDuration()).toBe(0);
    });

    it('should reset with custom startTime', () => {
      const metrics = new StreamingMetrics();

      jest.advanceTimersByTime(100);
      metrics.recordFirstToken();

      const newStartTime = Date.now();
      metrics.reset(newStartTime);

      jest.advanceTimersByTime(30);

      expect(metrics.getTTFT()).toBeNull();
      expect(metrics.getDuration()).toBe(30 * 1e6); // 30ms from newStartTime
    });

    it('should reset without custom startTime using Date.now()', () => {
      const metrics = new StreamingMetrics();

      jest.advanceTimersByTime(100);
      metrics.recordFirstToken();

      metrics.reset();

      jest.advanceTimersByTime(50);

      expect(metrics.getTTFT()).toBeNull();
      expect(metrics.getDuration()).toBe(50 * 1e6);
    });

    it('should allow recording first token after reset', () => {
      const metrics = new StreamingMetrics();

      jest.advanceTimersByTime(50);
      metrics.recordFirstToken();

      metrics.reset();

      jest.advanceTimersByTime(30);
      metrics.recordFirstToken();

      expect(metrics.getTTFT()).toBe(30 * 1e6);
    });

    it('should clear token usage after reset', () => {
      const metrics = new StreamingMetrics();
      const tokenUsage: TokenUsage = {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30
      };

      metrics.setTokenUsage(tokenUsage);
      expect(metrics.getTokenUsage()).toEqual(tokenUsage);

      metrics.reset();

      expect(metrics.getTokenUsage()).toBeNull();
    });
  });
});
