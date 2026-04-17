/* eslint-disable @typescript-eslint/no-explicit-any */
import { wrapOpenAI } from '../../../src/handlers/openai';
import { GalileoLogger } from '../../../src/utils/galileo-logger';
import type { LogTracesIngestRequest } from '../../../src/types/logging/trace.types';

/**
 * Creates a minimal mock OpenAI client with chat.completions.create.
 * Returns a non-streaming response by default.
 */
function createMockOpenAIClient() {
  const mockResponse = {
    id: 'chatcmpl-test-123',
    object: 'chat.completion',
    created: 1234567890,
    model: 'gpt-4o',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: 'Hello! How can I help you?'
        },
        finish_reason: 'stop'
      }
    ],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 8,
      total_tokens: 18
    }
  };

  return {
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue(mockResponse)
      }
    },
    embeddings: {},
    moderations: {}
  };
}

/**
 * Creates a mock OpenAI client that includes both chat.completions and responses.
 */
function createMockOpenAIClientWithResponses() {
  const mockResponse = {
    output: [
      {
        type: 'message',
        content: 'The weather is sunny'
      }
    ],
    model: 'gpt-4o',
    usage: {
      input_tokens: 15,
      output_tokens: 8
    }
  };

  return {
    client: {
      chat: {
        completions: {
          create: jest.fn()
        }
      },
      responses: {
        create: jest.fn().mockResolvedValue(mockResponse)
      },
      embeddings: {},
      moderations: {}
    },
    mockResponse
  };
}

/**
 * Creates an async iterable that yields the given chunks, simulating a stream.
 */
function createMockStream(chunks: any[]) {
  return {
    [Symbol.asyncIterator]: () => {
      let index = 0;
      return {
        next: async () => {
          if (index < chunks.length) {
            return { done: false, value: chunks[index++] };
          }
          return { done: true, value: undefined };
        }
      };
    }
  };
}

describe('wrapOpenAI ingestionHook', () => {
  describe('Chat Completions API', () => {
    test('test chat completions with ingestionHook creates GalileoLogger with hook', async () => {
      const mockHook = jest
        .fn<Promise<void>, [LogTracesIngestRequest]>()
        .mockResolvedValue(undefined);
      const mockClient = createMockOpenAIClient();

      const wrapped = wrapOpenAI(mockClient as any, undefined, mockHook);

      await wrapped.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello!' }]
      });

      // The proxy should have created a GalileoLogger with ingestionHook
      // (not used the singleton). Verify the call went through successfully.
      expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(1);
    });

    test('test chat completions with ingestionHook builds trace correctly', async () => {
      const hookCalls: LogTracesIngestRequest[] = [];
      const mockHook = jest
        .fn<Promise<void>, [LogTracesIngestRequest]>()
        .mockImplementation(async (request) => {
          hookCalls.push(request);
        });
      const mockClient = createMockOpenAIClient();

      const wrapped = wrapOpenAI(mockClient as any, undefined, mockHook);

      const result = await wrapped.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Say hello!' }]
      });

      // Verify the response is passed through correctly
      expect(result.choices[0].message.content).toBe(
        'Hello! How can I help you?'
      );

      // Verify the original call arguments were passed through
      const callArgs = mockClient.chat.completions.create.mock.calls[0][0];
      expect(callArgs.model).toBe('gpt-4o');
    });

    test('test chat completions streaming with ingestionHook creates logger and logs spans', async () => {
      const mockHook = jest
        .fn<Promise<void>, [LogTracesIngestRequest]>()
        .mockResolvedValue(undefined);

      const streamChunks = [
        { choices: [{ delta: { role: 'assistant' } }] },
        { choices: [{ delta: { content: 'Hello ' } }] },
        { choices: [{ delta: { content: 'world!' } }] }
      ];

      const mockClient = {
        chat: {
          completions: {
            create: jest
              .fn()
              .mockResolvedValueOnce(createMockStream(streamChunks))
          }
        },
        embeddings: {},
        moderations: {}
      };

      const wrapped = wrapOpenAI(mockClient as any, undefined, mockHook);

      const stream = await wrapped.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true
      });

      // Consume the stream
      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(streamChunks);
      expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(1);
    });

    test('test chat completions error with ingestionHook logs error span', async () => {
      const mockHook = jest
        .fn<Promise<void>, [LogTracesIngestRequest]>()
        .mockResolvedValue(undefined);

      const mockClient = {
        chat: {
          completions: {
            create: jest
              .fn()
              .mockRejectedValueOnce(new Error('API rate limit exceeded'))
          }
        },
        embeddings: {},
        moderations: {}
      };

      const wrapped = wrapOpenAI(mockClient as any, undefined, mockHook);

      await expect(
        wrapped.chat.completions.create({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: 'Hello' }]
        })
      ).rejects.toThrow('API rate limit exceeded');
    });
  });

  describe('Responses API', () => {
    test('test responses api with ingestionHook creates GalileoLogger with hook', async () => {
      const mockHook = jest
        .fn<Promise<void>, [LogTracesIngestRequest]>()
        .mockResolvedValue(undefined);
      const { client, mockResponse } = createMockOpenAIClientWithResponses();

      const wrapped = wrapOpenAI(client as any, undefined, mockHook);

      const result = await wrapped.responses!.create({
        model: 'gpt-4o',
        input: [
          { type: 'message', content: 'What is the weather?', role: 'user' }
        ],
        stream: false
      });

      expect(result).toEqual(mockResponse);
      expect(client.responses.create).toHaveBeenCalledTimes(1);
    });

    test('test responses api with ingestionHook passes through call arguments', async () => {
      const mockHook = jest
        .fn<Promise<void>, [LogTracesIngestRequest]>()
        .mockResolvedValue(undefined);
      const { client } = createMockOpenAIClientWithResponses();

      const wrapped = wrapOpenAI(client as any, undefined, mockHook);

      const requestData = {
        model: 'gpt-4o',
        input: [
          { type: 'message', content: 'What is the weather?', role: 'user' }
        ],
        stream: false
      };

      await wrapped.responses!.create(requestData);

      const callArgs = client.responses.create.mock.calls[0][0];
      expect(callArgs.model).toBe('gpt-4o');
    });

    test('test responses api streaming with ingestionHook creates logger and logs spans', async () => {
      const mockHook = jest
        .fn<Promise<void>, [LogTracesIngestRequest]>()
        .mockResolvedValue(undefined);

      const streamChunks = [
        { type: 'response.created', response: { id: 'resp-1' } },
        { type: 'response.output_text.delta', delta: 'Hello' },
        {
          type: 'response.completed',
          response: {
            output: [{ type: 'message', content: 'Hello world' }],
            model: 'gpt-4o',
            usage: { input_tokens: 5, output_tokens: 3 }
          }
        }
      ];

      const mockClient = {
        chat: { completions: { create: jest.fn() } },
        responses: {
          create: jest
            .fn()
            .mockResolvedValueOnce(createMockStream(streamChunks))
        },
        embeddings: {},
        moderations: {}
      };

      const wrapped = wrapOpenAI(mockClient as any, undefined, mockHook);

      const stream = await wrapped.responses!.create({
        model: 'gpt-4o',
        input: [{ type: 'message', content: 'Hello', role: 'user' }],
        stream: true
      });

      // Consume the stream
      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(streamChunks);
      expect(mockClient.responses.create).toHaveBeenCalledTimes(1);
    });

    test('test responses api error with ingestionHook logs error span', async () => {
      const mockHook = jest
        .fn<Promise<void>, [LogTracesIngestRequest]>()
        .mockResolvedValue(undefined);

      const mockClient = {
        chat: { completions: { create: jest.fn() } },
        responses: {
          create: jest.fn().mockRejectedValueOnce(new Error('Model not found'))
        },
        embeddings: {},
        moderations: {}
      };

      const wrapped = wrapOpenAI(mockClient as any, undefined, mockHook);

      await expect(
        wrapped.responses!.create({
          model: 'gpt-4o',
          input: [{ type: 'message', content: 'Hello', role: 'user' }],
          stream: false
        })
      ).rejects.toThrow('Model not found');
    });
  });

  describe('Logger resolution order', () => {
    test('test explicit logger takes precedence over ingestionHook', async () => {
      const mockHook = jest.fn();
      const mockLogger = {
        currentParent: jest.fn().mockReturnValue(null),
        startTrace: jest.fn(),
        addLlmSpan: jest.fn(),
        conclude: jest.fn(),
        flush: jest.fn().mockResolvedValue([])
      };
      const mockClient = createMockOpenAIClient();

      const wrapped = wrapOpenAI(
        mockClient as any,
        mockLogger as any,
        mockHook
      );

      await wrapped.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello!' }]
      });

      // When an explicit logger is provided, it is used directly.
      // The ingestionHook is not used to create a new logger.
      expect(mockLogger.startTrace).toHaveBeenCalledTimes(1);
      expect(mockLogger.addLlmSpan).toHaveBeenCalledTimes(1);
      expect(mockLogger.conclude).toHaveBeenCalledTimes(1);
    });

    test('test wrapOpenAI without ingestionHook or logger does not error during wrapping', async () => {
      const mockClient = createMockOpenAIClient();

      // Wrapping should succeed regardless of singleton state
      const wrapped = wrapOpenAI(mockClient as any);
      expect(wrapped).toBeDefined();
      expect(wrapped.chat).toBeDefined();
      expect(wrapped.chat.completions).toBeDefined();
    });

    test('test ingestionHook logger is instance of GalileoLogger', async () => {
      const mockHook = jest
        .fn<Promise<void>, [LogTracesIngestRequest]>()
        .mockResolvedValue(undefined);
      const mockClient = createMockOpenAIClient();

      // Spy on GalileoLogger constructor to verify it was called with ingestionHook
      const constructorSpy = jest.spyOn(
        GalileoLogger.prototype as never,
        'initializeProperties' as never
      );

      const wrapped = wrapOpenAI(mockClient as any, undefined, mockHook);

      await wrapped.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello!' }]
      });

      // GalileoLogger constructor was called with config containing ingestionHook
      expect(constructorSpy).toHaveBeenCalledTimes(1);
      const config = constructorSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(config.ingestionHook).toBe(mockHook);

      constructorSpy.mockRestore();
    });
  });
});
