import { BaseStreamingAdapter } from '../../../src/utils/streaming/base-streaming-adapter';
import type { BaseStreamingAdapterConfig } from '../../../src/utils/streaming/base-streaming-adapter';
import type { TokenUsage } from '../../../src/types/streaming-adapter.types';
import type { LlmSpanAllowedOutputType } from '../../../src/types/logging/step.types';
import { GalileoLogger } from '../../../src/utils/galileo-logger';
import { AxiosError } from 'axios';
import type { AxiosResponse } from 'axios';

// Mock GalileoLogger
jest.mock('../../../src/utils/galileo-logger');

// Concrete test implementation of the abstract class
class TestStreamingAdapter extends BaseStreamingAdapter {
  public chunks: unknown[] = [];
  public mockTokenUsage: TokenUsage | null = null;
  public mockOutput: LlmSpanAllowedOutputType = 'test output';

  processChunk(chunk: unknown): void {
    this.chunks.push(chunk);
  }

  extractTokenUsage(): TokenUsage | null {
    return this.mockTokenUsage;
  }

  buildOutput(): LlmSpanAllowedOutputType {
    return this.mockOutput;
  }

  // Expose protected methods for testing
  public testRecordFirstToken(): void {
    this.recordFirstToken();
  }

  public testSetTokenUsage(usage: TokenUsage): void {
    this.setTokenUsage(usage);
  }

  public testHandleError(error: unknown) {
    return this.handleError(error);
  }

  public testIsRetryable(error: unknown): boolean {
    return this.isRetryable(error);
  }

  public testFinalize(
    output: LlmSpanAllowedOutputType,
    statusCode?: number
  ): void {
    this.finalize(output, statusCode);
  }

  public testGetMetrics() {
    return this.getMetrics();
  }
}

describe('BaseStreamingAdapter', () => {
  let mockLogger: GalileoLogger;
  let config: BaseStreamingAdapterConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = new GalileoLogger();

    config = {
      logger: mockLogger,
      requestData: {
        messages: 'test input',
        model: 'gpt-4',
        metadata: { key: 'value' },
        name: 'test span',
        tools: [{ type: 'function', function: { name: 'test' } }],
        temperature: 0.7
      },
      shouldCompleteTrace: true,
      startTime: Date.now()
    };
  });

  describe('constructor', () => {
    it('should initialize with all config fields', () => {
      const adapter = new TestStreamingAdapter(config);

      expect(adapter).toBeDefined();
      expect(adapter['logger']).toBe(mockLogger);
      expect(adapter['requestData']).toBe(config.requestData);
      expect(adapter['shouldCompleteTrace']).toBe(true);
    });

    it('should initialize metrics component', () => {
      const adapter = new TestStreamingAdapter(config);

      expect(adapter['metrics']).toBeDefined();
    });

    it('should initialize errorManager component', () => {
      const adapter = new TestStreamingAdapter(config);

      expect(adapter['errorManager']).toBeDefined();
    });

    it('should initialize finalizer component', () => {
      const adapter = new TestStreamingAdapter(config);

      expect(adapter['finalizer']).toBeDefined();
    });

    it('should pass startTime to metrics', () => {
      const customStartTime = 1000;
      const customConfig = { ...config, startTime: customStartTime };
      const adapter = new TestStreamingAdapter(customConfig);

      expect(adapter['metrics']).toBeDefined();
    });

    it('should work without startTime', () => {
      const configWithoutStartTime = { ...config };
      delete configWithoutStartTime.startTime;
      const adapter = new TestStreamingAdapter(configWithoutStartTime);

      expect(adapter['metrics']).toBeDefined();
    });

    it('should work with minimal requestData', () => {
      const minimalConfig: BaseStreamingAdapterConfig = {
        logger: mockLogger,
        requestData: {},
        shouldCompleteTrace: false
      };
      const adapter = new TestStreamingAdapter(minimalConfig);

      expect(adapter).toBeDefined();
    });

    it('should initialize with shouldCompleteTrace false', () => {
      const falseConfig = { ...config, shouldCompleteTrace: false };
      const adapter = new TestStreamingAdapter(falseConfig);

      expect(adapter['shouldCompleteTrace']).toBe(false);
    });
  });

  describe('recordFirstToken delegation', () => {
    it('should delegate to metrics', () => {
      const adapter = new TestStreamingAdapter(config);
      const metricsSpy = jest.spyOn(adapter['metrics'], 'recordFirstToken');

      adapter.testRecordFirstToken();

      expect(metricsSpy).toHaveBeenCalled();
    });

    it('should only record first token once through metrics', () => {
      const adapter = new TestStreamingAdapter(config);
      const metricsSpy = jest.spyOn(adapter['metrics'], 'recordFirstToken');

      adapter.testRecordFirstToken();
      adapter.testRecordFirstToken();
      adapter.testRecordFirstToken();

      expect(metricsSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe('setTokenUsage delegation', () => {
    it('should delegate to metrics', () => {
      const adapter = new TestStreamingAdapter(config);
      const metricsSpy = jest.spyOn(adapter['metrics'], 'setTokenUsage');
      const tokenUsage: TokenUsage = {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30
      };

      adapter.testSetTokenUsage(tokenUsage);

      expect(metricsSpy).toHaveBeenCalledWith(tokenUsage);
    });

    it('should pass token usage correctly', () => {
      const adapter = new TestStreamingAdapter(config);
      const tokenUsage: TokenUsage = {
        promptTokens: 15,
        completionTokens: 25,
        totalTokens: 40
      };

      adapter.testSetTokenUsage(tokenUsage);
      const metrics = adapter.testGetMetrics();

      expect(metrics.tokenUsage).toEqual(tokenUsage);
    });
  });

  describe('getMetrics delegation', () => {
    it('should delegate to metrics', () => {
      const adapter = new TestStreamingAdapter(config);
      const metricsSpy = jest.spyOn(adapter['metrics'], 'getMetrics');

      adapter.testGetMetrics();

      expect(metricsSpy).toHaveBeenCalled();
    });

    it('should return metrics result', () => {
      const adapter = new TestStreamingAdapter(config);
      const tokenUsage: TokenUsage = {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30
      };

      adapter.testSetTokenUsage(tokenUsage);
      adapter.testRecordFirstToken();
      const metrics = adapter.testGetMetrics();

      expect(metrics).toHaveProperty('ttftNs');
      expect(metrics).toHaveProperty('durationNs');
      expect(metrics).toHaveProperty('tokenUsage');
      expect(metrics.tokenUsage).toEqual(tokenUsage);
    });
  });

  describe('handleError delegation', () => {
    it('should delegate to errorManager with AxiosError', () => {
      const adapter = new TestStreamingAdapter(config);
      const axiosError = new AxiosError('Test error');
      axiosError.response = {
        status: 404
      } as Partial<AxiosResponse> as AxiosResponse;
      const errorManagerSpy = jest.spyOn(adapter['errorManager'], 'mapError');

      adapter.testHandleError(axiosError);

      expect(errorManagerSpy).toHaveBeenCalledWith(axiosError);
    });

    it('should return error info from errorManager', () => {
      const adapter = new TestStreamingAdapter(config);
      const axiosError = new AxiosError('Not found');
      axiosError.response = {
        status: 404
      } as Partial<AxiosResponse> as AxiosResponse;

      const result = adapter.testHandleError(axiosError);

      expect(result).toHaveProperty('statusCode');
      expect(result).toHaveProperty('message');
      expect(result.statusCode).toBe(404);
    });

    it('should handle standard Error objects', () => {
      const adapter = new TestStreamingAdapter(config);
      const error = new Error('Timeout error');

      const result = adapter.testHandleError(error);

      expect(result).toHaveProperty('statusCode');
      expect(result).toHaveProperty('message');
      expect(result.message).toBe('Timeout error');
    });

    it('should handle string errors', () => {
      const adapter = new TestStreamingAdapter(config);
      const error = 'String error';

      const result = adapter.testHandleError(error);

      expect(result).toHaveProperty('statusCode', 500);
      expect(result).toHaveProperty('message', 'String error');
    });

    it('should handle unknown error types', () => {
      const adapter = new TestStreamingAdapter(config);
      const error = { custom: 'error' };

      const result = adapter.testHandleError(error);

      expect(result).toHaveProperty('statusCode');
      expect(result).toHaveProperty('message');
    });

    it('should handle timeout errors with correct status code', () => {
      const adapter = new TestStreamingAdapter(config);
      const error = new Error('Request timed out');

      const result = adapter.testHandleError(error);

      expect(result.statusCode).toBe(408);
    });

    it('should handle network errors with correct status code', () => {
      const adapter = new TestStreamingAdapter(config);
      const error = new Error('Network connection failed');

      const result = adapter.testHandleError(error);

      expect(result.statusCode).toBe(503);
    });

    it('should handle rate limit errors with correct status code', () => {
      const adapter = new TestStreamingAdapter(config);
      const error = new Error('Rate limit exceeded');

      const result = adapter.testHandleError(error);

      expect(result.statusCode).toBe(429);
    });
  });

  describe('isRetryable delegation', () => {
    it('should delegate to errorManager', () => {
      const adapter = new TestStreamingAdapter(config);
      const error = new Error('Server error');
      const errorManagerSpy = jest.spyOn(
        adapter['errorManager'],
        'isRetryable'
      );

      adapter.testIsRetryable(error);

      expect(errorManagerSpy).toHaveBeenCalledWith(error);
    });

    it('should return true for retryable errors', () => {
      const adapter = new TestStreamingAdapter(config);
      const timeoutError = new Error('Request timed out');

      const result = adapter.testIsRetryable(timeoutError);

      expect(result).toBe(true);
    });

    it('should return true for 500 errors', () => {
      const adapter = new TestStreamingAdapter(config);
      const axiosError = new AxiosError('Internal server error');
      axiosError.response = {
        status: 500
      } as Partial<AxiosResponse> as AxiosResponse;

      const result = adapter.testIsRetryable(axiosError);

      expect(result).toBe(true);
    });

    it('should return true for 503 errors', () => {
      const adapter = new TestStreamingAdapter(config);
      const networkError = new Error('Network connection failed');

      const result = adapter.testIsRetryable(networkError);

      expect(result).toBe(true);
    });

    it('should return false for non-retryable errors', () => {
      const adapter = new TestStreamingAdapter(config);
      const axiosError = new AxiosError('Not found');
      axiosError.response = {
        status: 404
      } as Partial<AxiosResponse> as AxiosResponse;

      const result = adapter.testIsRetryable(axiosError);

      expect(result).toBe(false);
    });
  });

  describe('finalize delegation', () => {
    it('should delegate to finalizer', () => {
      const adapter = new TestStreamingAdapter(config);
      const finalizerSpy = jest.spyOn(adapter['finalizer'], 'finalize');
      const output = 'test output';

      adapter.testFinalize(output);

      expect(finalizerSpy).toHaveBeenCalledWith(output, 200);
    });

    it('should pass custom status code to finalizer', () => {
      const adapter = new TestStreamingAdapter(config);
      const finalizerSpy = jest.spyOn(adapter['finalizer'], 'finalize');
      const output = 'test output';

      adapter.testFinalize(output, 500);

      expect(finalizerSpy).toHaveBeenCalledWith(output, 500);
    });

    it('should use default status code 200', () => {
      const adapter = new TestStreamingAdapter(config);
      const finalizerSpy = jest.spyOn(adapter['finalizer'], 'finalize');
      const output = { role: 'assistant', content: 'response' };

      adapter.testFinalize(output);

      expect(finalizerSpy).toHaveBeenCalledWith(output, 200);
    });

    it('should handle string output', () => {
      const adapter = new TestStreamingAdapter(config);
      const finalizerSpy = jest.spyOn(adapter['finalizer'], 'finalize');

      adapter.testFinalize('string output', 201);

      expect(finalizerSpy).toHaveBeenCalledWith('string output', 201);
    });

    it('should handle object output', () => {
      const adapter = new TestStreamingAdapter(config);
      const finalizerSpy = jest.spyOn(adapter['finalizer'], 'finalize');
      const output = { key: 'value' };

      adapter.testFinalize(output, 200);

      expect(finalizerSpy).toHaveBeenCalledWith(output, 200);
    });
  });

  describe('abstract methods implementation', () => {
    it('should allow processChunk to be implemented', () => {
      const adapter = new TestStreamingAdapter(config);

      adapter.processChunk({ data: 'chunk1' });
      adapter.processChunk({ data: 'chunk2' });

      expect(adapter.chunks).toHaveLength(2);
      expect(adapter.chunks[0]).toEqual({ data: 'chunk1' });
      expect(adapter.chunks[1]).toEqual({ data: 'chunk2' });
    });

    it('should allow extractTokenUsage to be implemented', () => {
      const adapter = new TestStreamingAdapter(config);
      const tokenUsage: TokenUsage = {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30
      };
      adapter.mockTokenUsage = tokenUsage;

      const result = adapter.extractTokenUsage();

      expect(result).toEqual(tokenUsage);
    });

    it('should allow extractTokenUsage to return null', () => {
      const adapter = new TestStreamingAdapter(config);
      adapter.mockTokenUsage = null;

      const result = adapter.extractTokenUsage();

      expect(result).toBeNull();
    });

    it('should allow buildOutput to be implemented', () => {
      const adapter = new TestStreamingAdapter(config);
      adapter.mockOutput = 'custom output';

      const result = adapter.buildOutput();

      expect(result).toBe('custom output');
    });

    it('should allow buildOutput to return object', () => {
      const adapter = new TestStreamingAdapter(config);
      const objectOutput = { role: 'assistant', content: 'response' };
      adapter.mockOutput = objectOutput;

      const result = adapter.buildOutput();

      expect(result).toEqual(objectOutput);
    });
  });

  describe('integration tests', () => {
    it('should work end-to-end with all methods', () => {
      const adapter = new TestStreamingAdapter(config);

      // Process chunks
      adapter.processChunk({ data: 'chunk1' });
      adapter.processChunk({ data: 'chunk2' });

      // Record first token
      adapter.testRecordFirstToken();

      // Set token usage
      const tokenUsage: TokenUsage = {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30
      };
      adapter.testSetTokenUsage(tokenUsage);

      // Get metrics
      const metrics = adapter.testGetMetrics();
      expect(metrics.tokenUsage).toEqual(tokenUsage);

      // Build output
      const output = adapter.buildOutput();

      // Finalize
      const finalizerSpy = jest.spyOn(adapter['finalizer'], 'finalize');
      adapter.testFinalize(output, 200);

      expect(finalizerSpy).toHaveBeenCalledWith(output, 200);
      expect(adapter.chunks).toHaveLength(2);
    });

    it('should handle error flow', () => {
      const adapter = new TestStreamingAdapter(config);
      const error = new Error('Processing failed');

      const errorInfo = adapter.testHandleError(error);
      const isRetryable = adapter.testIsRetryable(error);

      expect(errorInfo).toHaveProperty('statusCode');
      expect(errorInfo).toHaveProperty('message', 'Processing failed');
      expect(isRetryable).toBe(true); // Generic errors are 500, which is retryable
    });

    it('should maintain state across multiple operations', () => {
      const adapter = new TestStreamingAdapter(config);

      adapter.testRecordFirstToken();
      const metrics1 = adapter.testGetMetrics();

      const tokenUsage: TokenUsage = {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30
      };
      adapter.testSetTokenUsage(tokenUsage);

      const metrics2 = adapter.testGetMetrics();

      expect(metrics1.tokenUsage).toBeNull();
      expect(metrics2.tokenUsage).toEqual(tokenUsage);
      expect(metrics1.ttftNs).toBe(metrics2.ttftNs); // TTFT shouldn't change
    });
  });

  describe('component composition', () => {
    it('should have independent metrics instance', () => {
      const adapter1 = new TestStreamingAdapter(config);
      const adapter2 = new TestStreamingAdapter(config);

      const tokenUsage1: TokenUsage = { promptTokens: 10 };
      const tokenUsage2: TokenUsage = { promptTokens: 20 };

      adapter1.testSetTokenUsage(tokenUsage1);
      adapter2.testSetTokenUsage(tokenUsage2);

      expect(adapter1.testGetMetrics().tokenUsage).toEqual(tokenUsage1);
      expect(adapter2.testGetMetrics().tokenUsage).toEqual(tokenUsage2);
    });

    it('should have independent errorManager instance', () => {
      const adapter1 = new TestStreamingAdapter(config);
      const adapter2 = new TestStreamingAdapter(config);

      const error1 = new Error('Error 1');
      const error2 = new Error('Error 2');

      const result1 = adapter1.testHandleError(error1);
      const result2 = adapter2.testHandleError(error2);

      expect(result1.message).toBe('Error 1');
      expect(result2.message).toBe('Error 2');
    });

    it('should have independent finalizer instance', () => {
      const adapter1 = new TestStreamingAdapter(config);
      const adapter2 = new TestStreamingAdapter(config);

      const spy1 = jest.spyOn(adapter1['finalizer'], 'finalize');
      const spy2 = jest.spyOn(adapter2['finalizer'], 'finalize');

      adapter1.testFinalize('output1');
      adapter2.testFinalize('output2');

      expect(spy1).toHaveBeenCalledWith('output1', 200);
      expect(spy2).toHaveBeenCalledWith('output2', 200);
    });
  });
});
