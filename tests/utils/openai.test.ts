/* eslint-disable @typescript-eslint/no-explicit-any */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

import { wrapOpenAI } from '../../src/openai';
import { GalileoSingleton } from '../../src/singleton';

// Mock dependencies
jest.mock('../../src/singleton');

describe('OpenAI Wrapper', () => {
  // Mock OpenAI client
  const mockResponse = {
    choices: [
      {
        message: {
          content: 'Hello world!',
          role: 'assistant'
        }
      }
    ],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 5
    }
  };

  const mockStreamingChunks = [
    {
      choices: [
        {
          delta: {
            role: 'assistant'
          }
        }
      ]
    },
    {
      choices: [
        {
          delta: {
            content: 'Hello '
          }
        }
      ]
    },
    {
      choices: [
        {
          delta: {
            content: 'world!'
          }
        }
      ]
    }
  ];

  const mockCreateMethod = jest.fn();
  const mockOpenAI = {
    chat: {
      completions: {
        create: mockCreateMethod
      }
    }
  };

  const mockLogger = {
    currentParent: jest.fn().mockReturnValue(undefined),
    startTrace: jest.fn(),
    addLlmSpan: jest.fn(),
    conclude: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    GalileoSingleton.getInstance = jest.fn().mockReturnValue({
      getClient: jest.fn().mockReturnValue(mockLogger)
    });
    Date.now = jest.fn().mockReturnValue(1000);
  });

  test('should correctly wrap OpenAI and handle non-streaming requests', async () => {
    // Setup
    mockCreateMethod.mockResolvedValueOnce(mockResponse);
    const wrappedOpenAI = wrapOpenAI(mockOpenAI as any, mockLogger as any);
    const requestData = {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Say hello world!' }]
    };

    // Execute
    const result = await wrappedOpenAI.chat.completions.create(requestData);

    // Assert
    expect(mockCreateMethod).toHaveBeenCalledWith(requestData);
    expect(result).toEqual(mockResponse);
    expect(mockLogger.startTrace).toHaveBeenCalledWith({
      createdAt: 1000,
      input: '[{"role":"user","content":"Say hello world!"}]',
      name: 'openai-client-generation',
      output: undefined
    });
    expect(mockLogger.addLlmSpan).toHaveBeenCalledWith({
      input: requestData.messages,
      output: [mockResponse.choices[0].message],
      name: 'openai-client-generation',
      model: 'gpt-4o',
      numInputTokens: 10,
      numOutputTokens: 5,
      durationNs: 0,
      metadata: {},
      statusCode: 200
    });
    expect(mockLogger.conclude).toHaveBeenCalledWith({
      output: JSON.stringify([mockResponse.choices[0].message]),
      durationNs: 0
    });
  });

  test('should handle streaming responses correctly', async () => {
    // Setup mock Date.now to simulate elapsed time
    const times = [1000, 1100, 1200, 1300];
    Date.now = jest
      .fn()
      .mockReturnValueOnce(times[0])
      .mockReturnValueOnce(times[1])
      .mockReturnValueOnce(times[2])
      .mockReturnValueOnce(times[3]);

    // Create async iterable for streaming response
    const mockStream = {
      [Symbol.asyncIterator]: () => {
        let index = 0;
        return {
          next: async () => {
            if (index < mockStreamingChunks.length) {
              return { done: false, value: mockStreamingChunks[index++] };
            }
            return { done: true, value: undefined };
          }
        };
      }
    };

    mockCreateMethod.mockResolvedValueOnce(mockStream);

    const wrappedOpenAI = wrapOpenAI(mockOpenAI as any, mockLogger as any);
    const requestData = {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Say hello world!' }],
      stream: true
    };

    // Execute
    const stream = await wrappedOpenAI.chat.completions.create(requestData);
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    // Assert
    expect(mockCreateMethod).toHaveBeenCalledWith(requestData);
    expect(chunks).toEqual(mockStreamingChunks);
    expect(mockLogger.startTrace).toHaveBeenCalledWith({
      createdAt: 1000,
      input: '[{"role":"user","content":"Say hello world!"}]',
      name: 'openai-client-generation',
      output: undefined
    });
    expect(mockLogger.addLlmSpan).toHaveBeenCalledWith({
      input: requestData.messages,
      output: {
        content: 'Hello world!',
        role: 'assistant'
      },
      name: 'openai-client-generation',
      model: 'gpt-4o',
      numInputTokens: 0, // Note: The wrapper doesn't calculate tokens for streaming responses
      numOutputTokens: 0,
      durationNs: times[3] - times[2], // completion start to end time
      metadata: {},
      statusCode: 200
    });
    expect(mockLogger.conclude).toHaveBeenCalledWith({
      output: JSON.stringify({
        content: 'Hello world!',
        role: 'assistant'
      }),
      durationNs: times[3] - times[1] // total duration from request to end
    });
  });

  test('should handle tool calls in streaming responses', async () => {
    // Setup mock Date.now
    const times = [1000, 1100, 1200, 1300];
    Date.now = jest
      .fn()
      .mockReturnValueOnce(times[0])
      .mockReturnValueOnce(times[1])
      .mockReturnValueOnce(times[2])
      .mockReturnValueOnce(times[3]);

    // Create streaming chunks with tool calls
    const mockToolCallChunks = [
      {
        choices: [
          {
            delta: {
              role: 'assistant'
            }
          }
        ]
      },
      {
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: 'tool_1',
                  function: {
                    name: 'get_weather'
                  }
                }
              ]
            }
          }
        ]
      },
      {
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  index: 0,
                  function: {
                    arguments: '{"location": "San '
                  }
                }
              ]
            }
          }
        ]
      },
      {
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  index: 0,
                  function: {
                    arguments: 'Francisco"}'
                  }
                }
              ]
            }
          }
        ]
      }
    ];

    const toolCallStream = {
      [Symbol.asyncIterator]: () => {
        let index = 0;
        return {
          next: async () => {
            if (index < mockToolCallChunks.length) {
              return { done: false, value: mockToolCallChunks[index++] };
            }
            return { done: true, value: undefined };
          }
        };
      }
    };

    mockCreateMethod.mockResolvedValueOnce(toolCallStream);

    const wrappedOpenAI = wrapOpenAI(mockOpenAI as any, mockLogger as any);
    const requestData = {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: "What's the weather?" }],
      stream: true
    };

    // Execute
    const stream = await wrappedOpenAI.chat.completions.create(requestData);
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    // Assert
    expect(mockCreateMethod).toHaveBeenCalledWith(requestData);
    expect(chunks).toEqual(mockToolCallChunks);

    // Check the expected output format with tool calls
    expect(mockLogger.addLlmSpan).toHaveBeenCalledWith(
      expect.objectContaining({
        output: {
          content: '',
          role: 'assistant',
          tool_calls: [
            {
              id: 'tool_1',
              function: {
                name: 'get_weather',
                arguments: '{"location": "San Francisco"}'
              }
            }
          ]
        }
      })
    );
  });

  test('should handle function calls (legacy format) in streaming responses', async () => {
    // Setup mock Date.now
    Date.now = jest.fn().mockReturnValue(1000);

    // Create streaming chunks with function call (legacy format)
    const mockFunctionCallChunks = [
      {
        choices: [
          {
            delta: {
              role: 'assistant',
              function_call: {
                name: 'get_weather'
              }
            }
          }
        ]
      },
      {
        choices: [
          {
            delta: {
              function_call: {
                arguments: '{"location": "New '
              }
            }
          }
        ]
      },
      {
        choices: [
          {
            delta: {
              function_call: {
                arguments: 'York"}'
              }
            }
          }
        ]
      }
    ];

    const functionCallStream = {
      [Symbol.asyncIterator]: () => {
        let index = 0;
        return {
          next: async () => {
            if (index < mockFunctionCallChunks.length) {
              return { done: false, value: mockFunctionCallChunks[index++] };
            }
            return { done: true, value: undefined };
          }
        };
      }
    };

    mockCreateMethod.mockResolvedValueOnce(functionCallStream);

    const wrappedOpenAI = wrapOpenAI(mockOpenAI as any, mockLogger as any);
    const requestData = {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: "What's the weather in NY?" }],
      stream: true
    };

    // Execute
    const stream = await wrappedOpenAI.chat.completions.create(requestData);
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    // Assert expected output format with legacy function call
    expect(mockLogger.addLlmSpan).toHaveBeenCalledWith(
      expect.objectContaining({
        output: {
          content: '',
          role: 'assistant',
          tool_calls: [
            {
              id: 'function_call_0',
              function: {
                name: 'get_weather',
                arguments: '{"location": "New York"}'
              }
            }
          ]
        }
      })
    );
  });

  test('should handle errors in non-streaming requests', async () => {
    // Setup
    const error = new Error('API Error');
    mockCreateMethod.mockRejectedValueOnce(error);

    const wrappedOpenAI = wrapOpenAI(mockOpenAI as any, mockLogger as any);
    const requestData = {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Say hello world!' }]
    };

    // Execute and assert
    await expect(
      wrappedOpenAI.chat.completions.create(requestData)
    ).rejects.toThrow('API Error');

    expect(mockLogger.startTrace).toHaveBeenCalled();
    expect(mockLogger.conclude).toHaveBeenCalledWith({
      output: 'Error: API Error',
      durationNs: 0
    });
  });

  test('should handle errors in streaming responses', async () => {
    // Setup mock stream that throws an error
    const errorStream = {
      [Symbol.asyncIterator]: () => {
        return {
          next: async () => {
            throw new Error('Stream Error');
          }
        };
      }
    };

    mockCreateMethod.mockResolvedValueOnce(errorStream);

    const wrappedOpenAI = wrapOpenAI(mockOpenAI as any, mockLogger as any);
    const requestData = {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Say hello world!' }],
      stream: true
    };

    // Execute
    const stream = await wrappedOpenAI.chat.completions.create(requestData);

    // Assert that using the stream throws the expected error
    await expect(async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of stream) {
        // This should throw
      }
    }).rejects.toThrow('Stream Error');
  });

  test('should use existing trace if there is a parent trace', async () => {
    // Setup with existing parent trace
    mockLogger.currentParent.mockReturnValueOnce('existing-trace-id');
    mockCreateMethod.mockResolvedValueOnce(mockResponse);

    const wrappedOpenAI = wrapOpenAI(mockOpenAI as any, mockLogger as any);
    const requestData = {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Say hello world!' }]
    };

    // Execute
    await wrappedOpenAI.chat.completions.create(requestData);

    // Assert that startTrace was not called (because there's already a parent)
    expect(mockLogger.startTrace).not.toHaveBeenCalled();
    expect(mockLogger.addLlmSpan).toHaveBeenCalled();
    // conclude shouldn't be called since we didn't start a trace
    expect(mockLogger.conclude).not.toHaveBeenCalled();
  });

  test('should handle metadata in the request', async () => {
    // Setup
    mockCreateMethod.mockResolvedValueOnce(mockResponse);

    const wrappedOpenAI = wrapOpenAI(mockOpenAI as any, mockLogger as any);
    const requestData = {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Say hello world!' }],
      metadata: { requestId: '123', userId: 'user-456' }
    };

    // Execute
    await wrappedOpenAI.chat.completions.create(requestData);

    // Assert metadata was passed correctly
    expect(mockLogger.addLlmSpan).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { requestId: '123', userId: 'user-456' }
      })
    );
  });
});
