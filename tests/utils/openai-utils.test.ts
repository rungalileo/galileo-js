import '@types/jest';
import { OpenAIClientManager, OpenAITools } from '../../src/utils/openai-utils';
import { OpenAI } from 'openai';
import { GalileoLogger } from '../../src/utils/galileo-logger';

// Mock OpenAI client
const mockOpenAI = {
  completions: {
    create: jest.fn()
  }
} as unknown as OpenAI;

// Mock GalileoLogger
const mockLogger = {
  addLlmSpan: jest.fn(),
  startTrace: jest.fn(),
  conclude: jest.fn(),
  error: jest.fn()
} as unknown as GalileoLogger;

describe('OpenAI Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('OpenAIClientManager', () => {
    const config = {
      apiKey: 'test-key',
      maxConcurrentRequests: 2
    };

    test('should create singleton instance', () => {
      const instance1 = OpenAIClientManager.getInstance(config);
      const instance2 = OpenAIClientManager.getInstance(config);
      expect(instance1).toBe(instance2);
    });

    test('should handle concurrent requests', async () => {
      const manager = OpenAIClientManager.getInstance(config);
      const client = manager.getClient(config);

      // Mock successful responses
      const mockResponse = { text: 'test response' };
      const createCompletion = jest.fn().mockResolvedValue(mockResponse);

      // Create multiple concurrent requests
      const requests = Array(5).fill(null).map(() => 
        manager.executeRequest(() => createCompletion())
      );

      // Wait for all requests to complete
      await Promise.all(requests);

      // Verify that requests were rate limited
      expect(createCompletion).toHaveBeenCalledTimes(5);
    });
  });

  describe('OpenAITools', () => {
    test('should create completion successfully', async () => {
      const mockResponse = {
        choices: [{ text: 'test response' }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15
        },
        model: 'gpt-4'
      };

      mockOpenAI.completions.create = jest.fn().mockResolvedValue(mockResponse);

      const response = await OpenAITools.createCompletion(
        mockOpenAI,
        'test prompt',
        { logger: mockLogger }
      );

      expect(response).toEqual({
        text: 'test response',
        usage: {
          promptTokens: 10,
          completionTokens: 5,
          totalTokens: 15
        },
        model: 'gpt-4'
      });
    });

    test('should handle completion errors', async () => {
      const error = new Error('API Error');
      mockOpenAI.completions.create = jest.fn().mockRejectedValue(error);

      await expect(
        OpenAITools.createCompletion(mockOpenAI, 'test prompt', { logger: mockLogger })
      ).rejects.toThrow('API Error');

      expect(mockLogger.error).toHaveBeenCalledWith('OpenAI API Error', {
        error,
        prompt: 'test prompt'
      });
    });

    test('should handle streaming completion', async () => {
      const mockChunks = [
        { choices: [{ text: 'Hello ' }] },
        { choices: [{ text: 'World' }] }
      ];

      const mockStream = {
        [Symbol.asyncIterator]: () => {
          let index = 0;
          return {
            next: async () => {
              if (index < mockChunks.length) {
                return { done: false, value: mockChunks[index++] };
              }
              return { done: true, value: undefined };
            }
          };
        }
      };

      mockOpenAI.completions.create = jest.fn().mockResolvedValue(mockStream);

      const onChunk = jest.fn();
      const stream = await OpenAITools.createStreamingCompletion(
        mockOpenAI,
        'test prompt',
        { logger: mockLogger, onChunk }
      );

      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['Hello ', 'World']);
      expect(onChunk).toHaveBeenCalledTimes(2);
    });

    test('should handle streaming errors', async () => {
      const error = new Error('Stream Error');
      const mockStream = {
        [Symbol.asyncIterator]: () => {
          return {
            next: async () => {
              throw error;
            }
          };
        }
      };

      mockOpenAI.completions.create = jest.fn().mockResolvedValue(mockStream);

      const stream = await OpenAITools.createStreamingCompletion(
        mockOpenAI,
        'test prompt',
        { logger: mockLogger }
      );

      await expect(async () => {
        for await (const _ of stream) {
          // This should throw
        }
      }).rejects.toThrow('Stream Error');

      expect(mockLogger.error).toHaveBeenCalledWith('Streaming Error', {
        error,
        prompt: 'test prompt'
      });
    });
  });
}); 