import { StreamingFinalizer } from '../../../src/utils/streaming/finalizer';
import type { StreamingFinalizerConfig } from '../../../src/utils/streaming/finalizer';
import type { GalileoLogger } from '../../../src/utils/galileo-logger';
import type { StreamingMetrics } from '../../../src/utils/streaming/metrics';
import type { JsonObject } from '../../../src/types/base.types';

describe('StreamingFinalizer', () => {
  let mockLogger: GalileoLogger;
  let mockMetrics: StreamingMetrics;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = {
      addLlmSpan: jest.fn(),
      conclude: jest.fn()
    } as unknown as GalileoLogger;

    mockMetrics = {
      getMetrics: jest.fn().mockReturnValue({
        ttftNs: 50000000, // 50ms in ns
        durationNs: 100000000, // 100ms in ns
        tokenUsage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30
        }
      })
    } as unknown as StreamingMetrics;
  });

  describe('constructor', () => {
    it('should initialize with all config fields', () => {
      const config: StreamingFinalizerConfig = {
        logger: mockLogger,
        metrics: mockMetrics,
        requestData: {
          messages: 'test input',
          model: 'gpt-4',
          metadata: { key: 'value' },
          name: 'test span',
          tools: [{ type: 'function', function: { name: 'test' } }],
          temperature: 0.7
        },
        shouldCompleteTrace: true
      };

      const finalizer = new StreamingFinalizer(config);

      expect(finalizer).toBeDefined();
    });

    it('should initialize with minimal config', () => {
      const config: StreamingFinalizerConfig = {
        logger: mockLogger,
        metrics: mockMetrics,
        requestData: {},
        shouldCompleteTrace: false
      };

      const finalizer = new StreamingFinalizer(config);

      expect(finalizer).toBeDefined();
    });

    it('should initialize with partial requestData', () => {
      const config: StreamingFinalizerConfig = {
        logger: mockLogger,
        metrics: mockMetrics,
        requestData: {
          model: 'gpt-4'
        },
        shouldCompleteTrace: true
      };

      const finalizer = new StreamingFinalizer(config);

      expect(finalizer).toBeDefined();
    });
  });

  describe('finalize', () => {
    it('should call addLlmSpan with minimal data', () => {
      const config: StreamingFinalizerConfig = {
        logger: mockLogger,
        metrics: mockMetrics,
        requestData: {},
        shouldCompleteTrace: false
      };

      const finalizer = new StreamingFinalizer(config);
      finalizer.finalize('test output');

      expect(mockLogger.addLlmSpan).toHaveBeenCalledWith({
        input: '',
        output: 'test output',
        model: 'unknown',
        numInputTokens: 10,
        numOutputTokens: 20,
        totalTokens: 30,
        durationNs: 100000000,
        timeToFirstTokenNs: 50000000,
        statusCode: 200,
        metadata: undefined,
        tools: undefined,
        temperature: undefined,
        name: undefined
      });
    });

    it('should call addLlmSpan with complete data', () => {
      const tools: JsonObject[] = [
        { type: 'function', function: { name: 'test' } }
      ];
      const config: StreamingFinalizerConfig = {
        logger: mockLogger,
        metrics: mockMetrics,
        requestData: {
          messages: 'test input',
          model: 'gpt-4',
          metadata: { key1: 'value1', key2: 'value2' },
          name: 'test span',
          tools: tools,
          temperature: 0.7
        },
        shouldCompleteTrace: true
      };

      const finalizer = new StreamingFinalizer(config);
      finalizer.finalize({ role: 'assistant', content: 'response' }, 201);

      expect(mockLogger.addLlmSpan).toHaveBeenCalledWith({
        input: 'test input',
        output: { role: 'assistant', content: 'response' },
        model: 'gpt-4',
        numInputTokens: 10,
        numOutputTokens: 20,
        totalTokens: 30,
        durationNs: 100000000,
        timeToFirstTokenNs: 50000000,
        statusCode: 201,
        metadata: { key1: 'value1', key2: 'value2' },
        tools: tools,
        temperature: 0.7,
        name: 'test span'
      });
    });

    it('should use default status code 200', () => {
      const config: StreamingFinalizerConfig = {
        logger: mockLogger,
        metrics: mockMetrics,
        requestData: { model: 'gpt-4' },
        shouldCompleteTrace: false
      };

      const finalizer = new StreamingFinalizer(config);
      finalizer.finalize('output');

      expect(mockLogger.addLlmSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 200
        })
      );
    });

    it('should use custom status code', () => {
      const config: StreamingFinalizerConfig = {
        logger: mockLogger,
        metrics: mockMetrics,
        requestData: {},
        shouldCompleteTrace: false
      };

      const finalizer = new StreamingFinalizer(config);
      finalizer.finalize('output', 500);

      expect(mockLogger.addLlmSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 500
        })
      );
    });

    it('should merge metadata from requestData', () => {
      const config: StreamingFinalizerConfig = {
        logger: mockLogger,
        metrics: mockMetrics,
        requestData: {
          metadata: { key1: 'value1', key2: 'value2' }
        },
        shouldCompleteTrace: false
      };

      const finalizer = new StreamingFinalizer(config);
      finalizer.finalize('output');

      expect(mockLogger.addLlmSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { key1: 'value1', key2: 'value2' }
        })
      );
    });

    it('should not include metadata when empty', () => {
      const config: StreamingFinalizerConfig = {
        logger: mockLogger,
        metrics: mockMetrics,
        requestData: {},
        shouldCompleteTrace: false
      };

      const finalizer = new StreamingFinalizer(config);
      finalizer.finalize('output');

      expect(mockLogger.addLlmSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: undefined
        })
      );
    });

    it('should call conclude when shouldCompleteTrace is true', () => {
      const config: StreamingFinalizerConfig = {
        logger: mockLogger,
        metrics: mockMetrics,
        requestData: {},
        shouldCompleteTrace: true
      };

      const finalizer = new StreamingFinalizer(config);
      finalizer.finalize('test output');

      expect(mockLogger.conclude).toHaveBeenCalledWith({
        output: 'test output',
        durationNs: 100000000
      });
    });

    it('should not call conclude when shouldCompleteTrace is false', () => {
      const config: StreamingFinalizerConfig = {
        logger: mockLogger,
        metrics: mockMetrics,
        requestData: {},
        shouldCompleteTrace: false
      };

      const finalizer = new StreamingFinalizer(config);
      finalizer.finalize('test output');

      expect(mockLogger.conclude).not.toHaveBeenCalled();
    });

    it('should stringify object output for conclude', () => {
      const config: StreamingFinalizerConfig = {
        logger: mockLogger,
        metrics: mockMetrics,
        requestData: {},
        shouldCompleteTrace: true
      };

      const finalizer = new StreamingFinalizer(config);
      const objectOutput = { role: 'assistant', content: 'response' };
      finalizer.finalize(objectOutput);

      expect(mockLogger.conclude).toHaveBeenCalledWith({
        output: JSON.stringify(objectOutput),
        durationNs: 100000000
      });
    });

    it('should pass string output as-is for conclude', () => {
      const config: StreamingFinalizerConfig = {
        logger: mockLogger,
        metrics: mockMetrics,
        requestData: {},
        shouldCompleteTrace: true
      };

      const finalizer = new StreamingFinalizer(config);
      finalizer.finalize('string output');

      expect(mockLogger.conclude).toHaveBeenCalledWith({
        output: 'string output',
        durationNs: 100000000
      });
    });

    it('should handle undefined optional fields correctly', () => {
      const config: StreamingFinalizerConfig = {
        logger: mockLogger,
        metrics: mockMetrics,
        requestData: {
          messages: 'input',
          model: 'gpt-4'
        },
        shouldCompleteTrace: false
      };

      const finalizer = new StreamingFinalizer(config);
      finalizer.finalize('output');

      expect(mockLogger.addLlmSpan).toHaveBeenCalledWith({
        input: 'input',
        output: 'output',
        model: 'gpt-4',
        numInputTokens: 10,
        numOutputTokens: 20,
        totalTokens: 30,
        durationNs: 100000000,
        timeToFirstTokenNs: 50000000,
        statusCode: 200,
        metadata: undefined,
        tools: undefined,
        temperature: undefined,
        name: undefined
      });
    });

    it('should include all metrics from getMetrics', () => {
      mockMetrics.getMetrics = jest.fn().mockReturnValue({
        ttftNs: 25000000,
        durationNs: 150000000,
        tokenUsage: {
          promptTokens: 15,
          completionTokens: 35,
          totalTokens: 50
        }
      });

      const config: StreamingFinalizerConfig = {
        logger: mockLogger,
        metrics: mockMetrics,
        requestData: {},
        shouldCompleteTrace: false
      };

      const finalizer = new StreamingFinalizer(config);
      finalizer.finalize('output');

      expect(mockLogger.addLlmSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          numInputTokens: 15,
          numOutputTokens: 35,
          totalTokens: 50,
          durationNs: 150000000,
          timeToFirstTokenNs: 25000000
        })
      );
    });

    it('should handle null TTFT in metrics', () => {
      mockMetrics.getMetrics = jest.fn().mockReturnValue({
        ttftNs: null,
        durationNs: 100000000,
        tokenUsage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30
        }
      });

      const config: StreamingFinalizerConfig = {
        logger: mockLogger,
        metrics: mockMetrics,
        requestData: {},
        shouldCompleteTrace: false
      };

      const finalizer = new StreamingFinalizer(config);
      finalizer.finalize('output');

      expect(mockLogger.addLlmSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          timeToFirstTokenNs: undefined
        })
      );
    });

    it('should handle null tokenUsage in metrics', () => {
      mockMetrics.getMetrics = jest.fn().mockReturnValue({
        ttftNs: 50000000,
        durationNs: 100000000,
        tokenUsage: null
      });

      const config: StreamingFinalizerConfig = {
        logger: mockLogger,
        metrics: mockMetrics,
        requestData: {},
        shouldCompleteTrace: false
      };

      const finalizer = new StreamingFinalizer(config);
      finalizer.finalize('output');

      expect(mockLogger.addLlmSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          numInputTokens: undefined,
          numOutputTokens: undefined,
          totalTokens: undefined
        })
      );
    });

    it('should use empty string for input when messages not provided', () => {
      const config: StreamingFinalizerConfig = {
        logger: mockLogger,
        metrics: mockMetrics,
        requestData: {},
        shouldCompleteTrace: false
      };

      const finalizer = new StreamingFinalizer(config);
      finalizer.finalize('output');

      expect(mockLogger.addLlmSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          input: ''
        })
      );
    });

    it('should use "unknown" for model when not provided', () => {
      const config: StreamingFinalizerConfig = {
        logger: mockLogger,
        metrics: mockMetrics,
        requestData: {},
        shouldCompleteTrace: false
      };

      const finalizer = new StreamingFinalizer(config);
      finalizer.finalize('output');

      expect(mockLogger.addLlmSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'unknown'
        })
      );
    });

    it('should handle array input messages', () => {
      const config: StreamingFinalizerConfig = {
        logger: mockLogger,
        metrics: mockMetrics,
        requestData: {
          messages: ['message1', 'message2']
        },
        shouldCompleteTrace: false
      };

      const finalizer = new StreamingFinalizer(config);
      finalizer.finalize('output');

      expect(mockLogger.addLlmSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          input: ['message1', 'message2']
        })
      );
    });

    it('should handle object input messages', () => {
      const config: StreamingFinalizerConfig = {
        logger: mockLogger,
        metrics: mockMetrics,
        requestData: {
          messages: { role: 'user', content: 'hello' }
        },
        shouldCompleteTrace: false
      };

      const finalizer = new StreamingFinalizer(config);
      finalizer.finalize('output');

      expect(mockLogger.addLlmSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          input: { role: 'user', content: 'hello' }
        })
      );
    });

    it('should call getMetrics once per finalize call', () => {
      const config: StreamingFinalizerConfig = {
        logger: mockLogger,
        metrics: mockMetrics,
        requestData: {},
        shouldCompleteTrace: true
      };

      const finalizer = new StreamingFinalizer(config);
      finalizer.finalize('output');

      expect(mockMetrics.getMetrics).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple finalize calls', () => {
      const config: StreamingFinalizerConfig = {
        logger: mockLogger,
        metrics: mockMetrics,
        requestData: {},
        shouldCompleteTrace: false
      };

      const finalizer = new StreamingFinalizer(config);
      finalizer.finalize('output1');
      finalizer.finalize('output2');

      expect(mockLogger.addLlmSpan).toHaveBeenCalledTimes(2);
      expect(mockMetrics.getMetrics).toHaveBeenCalledTimes(2);
    });
  });
});
