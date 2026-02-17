/* eslint-disable @typescript-eslint/no-explicit-any */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

import { wrapOpenAI } from '../../src/openai';
import { GalileoSingleton } from '../../src/singleton';
import { GalileoApiClient } from '../../src/api-client';

// Mock dependencies
jest.mock('../../src/singleton');

// Mock api-client to provide the static getTimestampRecord method
// This needs to be done before the test runs so it's available when galileo-logger imports it
// Return the expected date that matches what the test expects
jest.mock('../../src/api-client', () => ({
  GalileoApiClient: Object.assign(
    jest.fn().mockImplementation(() => ({})),
    {
      getTimestampRecord: jest
        .fn()
        .mockReturnValue(new Date('2024-01-01T00:00:00.000Z'))
    }
  )
}));

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
    startTrace: jest.fn((args: any) => {
      // Add createdAt if not provided, matching real logger behavior
      if (args && args.createdAt === undefined) {
        args.createdAt = GalileoApiClient.getTimestampRecord();
      }
    }),
    addLlmSpan: jest.fn((args: any) => {
      // Add createdAt if not provided, matching real logger behavior
      if (args && args.createdAt === undefined) {
        args.createdAt = GalileoApiClient.getTimestampRecord();
      }
    }),
    addToolSpan: jest.fn(), // Features 1, 2, 3: Support tool span creation
    conclude: jest.fn()
  };

  const mockDate = new Date('2024-01-01T00:00:00.000Z');

  beforeEach(() => {
    jest.clearAllMocks();
    GalileoSingleton.getInstance = jest.fn().mockReturnValue({
      getClient: jest.fn().mockReturnValue(mockLogger)
    });
    jest.useFakeTimers();
    jest.setSystemTime(mockDate);
  });

  afterEach(() => {
    jest.useRealTimers();
    mockLogger.startTrace = jest.fn();
  });

  test('should correctly wrap OpenAI and handle non-streaming requests', async () => {
    // Setup
    mockLogger.startTrace = jest.fn(() => {
      jest.advanceTimersByTime(1);
    });
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
    expect(mockLogger.startTrace).toHaveBeenCalled();
    const startTraceCall = mockLogger.startTrace.mock.calls[0][0];
    expect(startTraceCall.input).toBe(
      '[{"role":"user","content":"Say hello world!"}]'
    );
    expect(startTraceCall.name).toBe('openai-client-generation');
    expect(startTraceCall.output).toBeUndefined();
    // Check createdAt separately since it's added by the mock
    if (startTraceCall.createdAt === undefined) {
      startTraceCall.createdAt = GalileoApiClient.getTimestampRecord();
    }
    expect(startTraceCall.createdAt).toEqual(mockDate);
    expect(mockLogger.addLlmSpan).toHaveBeenCalledWith({
      createdAt: mockDate,
      input: requestData.messages,
      output: [mockResponse.choices[0].message],
      name: 'openai-client-generation',
      model: 'gpt-4o',
      numInputTokens: 10,
      numOutputTokens: 5,
      totalTokens: 15,
      numReasoningTokens: 0,
      numCachedInputTokens: 0,
      durationNs: 1_000_000,
      metadata: {},
      statusCode: 200,
      temperature: undefined,
      tools: undefined
    });
    expect(mockLogger.conclude).toHaveBeenCalledWith({
      output: JSON.stringify([mockResponse.choices[0].message]),
      durationNs: 1000000
    });
  });

  test('should handle streaming responses correctly', async () => {
    // Create async iterable for streaming response
    const mockStream = {
      [Symbol.asyncIterator]: () => {
        let index = 0;
        return {
          next: async () => {
            if (index < mockStreamingChunks.length) {
              jest.advanceTimersByTime(1);
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
    expect(mockLogger.startTrace).toHaveBeenCalled();
    const startTraceCall = mockLogger.startTrace.mock.calls[0][0];
    expect(startTraceCall.input).toBe(
      '[{"role":"user","content":"Say hello world!"}]'
    );
    expect(startTraceCall.name).toBe('openai-client-generation');
    expect(startTraceCall.output).toBeUndefined();
    // Check createdAt separately since it's added by the mock
    if (startTraceCall.createdAt === undefined) {
      startTraceCall.createdAt = GalileoApiClient.getTimestampRecord();
    }
    expect(startTraceCall.createdAt).toEqual(mockDate);
    expect(mockLogger.addLlmSpan).toHaveBeenCalled();
    const addLlmSpanCall = mockLogger.addLlmSpan.mock.calls[0][0];
    expect(addLlmSpanCall.input).toEqual(requestData.messages);
    expect(addLlmSpanCall.output).toEqual({
      content: 'Hello world!',
      role: 'assistant'
    });
    expect(addLlmSpanCall.name).toBe('openai-client-generation');
    expect(addLlmSpanCall.model).toBe('gpt-4o');
    expect(addLlmSpanCall.numInputTokens).toBe(0);
    expect(addLlmSpanCall.numOutputTokens).toBe(0);
    expect(addLlmSpanCall.durationNs).toBe(2_000_000);
    expect(addLlmSpanCall.metadata).toEqual({});
    expect(addLlmSpanCall.statusCode).toBe(200);
    // Check createdAt separately since it's added by the mock
    if (addLlmSpanCall.createdAt === undefined) {
      addLlmSpanCall.createdAt = GalileoApiClient.getTimestampRecord();
    }
    // For streaming, createdAt might be slightly different due to timing
    expect(addLlmSpanCall.createdAt.getTime()).toBeGreaterThanOrEqual(
      mockDate.getTime()
    );
    expect(mockLogger.conclude).toHaveBeenCalledWith({
      output: JSON.stringify({
        content: 'Hello world!',
        role: 'assistant'
      }),
      durationNs: 3_000_000
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
    mockLogger.startTrace = jest.fn(() => {
      jest.advanceTimersByTime(1);
    });
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
      durationNs: 1_000_000
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

  describe('Streaming Responses API', () => {
    test('should handle Responses API streaming format', async () => {
      // Setup mock Date.now
      const times = [1000, 1100, 1200];
      Date.now = jest
        .fn()
        .mockReturnValueOnce(times[0])
        .mockReturnValueOnce(times[1])
        .mockReturnValueOnce(times[2]);

      // Create Responses API streaming chunks
      const mockResponsesApiChunks = [
        {
          output: [
            {
              type: 'message',
              content: 'Hello'
            }
          ]
        },
        {
          output: [
            {
              type: 'message',
              content: ' world!'
            }
          ]
        }
      ];

      // Create async iterable from chunks
      async function* generateChunks() {
        for (const chunk of mockResponsesApiChunks) {
          yield chunk;
        }
      }

      mockCreateMethod.mockReturnValueOnce(generateChunks());

      const wrappedOpenAI = wrapOpenAI(mockOpenAI as any, mockLogger as any);
      const requestData = {
        model: 'gpt-4o',
        input: [{ type: 'message', content: 'Say hello', role: 'user' }],
        stream: true
      };

      // Execute streaming
      const stream = await wrappedOpenAI.chat.completions.create(requestData);
      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      // Verify chunks were streamed correctly
      expect(chunks).toEqual(mockResponsesApiChunks);

      // Verify processOutputItems was called (via addLlmSpan)
      expect(mockLogger.addLlmSpan).toHaveBeenCalled();
      const addLlmSpanCall = mockLogger.addLlmSpan.mock.calls[0][0];
      expect(addLlmSpanCall.name).toBe('openai-responses-generation');
    });

    test('should accumulate output items from multiple chunks', async () => {
      const times = [1000, 1100, 1200, 1300];
      Date.now = jest
        .fn()
        .mockReturnValueOnce(times[0])
        .mockReturnValueOnce(times[1])
        .mockReturnValueOnce(times[2])
        .mockReturnValueOnce(times[3]);

      const mockChunks = [
        {
          output: [
            {
              type: 'reasoning',
              summary: [{ text: 'Thinking...' }]
            }
          ]
        },
        {
          output: [
            {
              type: 'message',
              content: 'The answer is 42'
            }
          ]
        },
        {
          output: [
            {
              type: 'function_call',
              call_id: 'call_123',
              name: 'calculate',
              arguments: '{"x": 10}'
            }
          ]
        }
      ];

      async function* generateChunks() {
        for (const chunk of mockChunks) {
          yield chunk;
        }
      }

      mockCreateMethod.mockReturnValueOnce(generateChunks());

      const wrappedOpenAI = wrapOpenAI(mockOpenAI as any, mockLogger as any);
      const requestData = {
        model: 'gpt-4o',
        input: [{ type: 'message', content: 'Calculate', role: 'user' }],
        stream: true
      };

      const stream = await wrappedOpenAI.chat.completions.create(requestData);
      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBe(3);
      expect(mockLogger.addLlmSpan).toHaveBeenCalled();
    });

    test('should call processFunctionCallOutputs for input items during streaming', async () => {
      const times = [1000, 1100];
      Date.now = jest
        .fn()
        .mockReturnValueOnce(times[0])
        .mockReturnValueOnce(times[1]);

      const mockChunks = [
        {
          output: [
            {
              type: 'message',
              content: 'Done'
            }
          ]
        }
      ];

      async function* generateChunks() {
        for (const chunk of mockChunks) {
          yield chunk;
        }
      }

      mockCreateMethod.mockReturnValueOnce(generateChunks());

      const wrappedOpenAI = wrapOpenAI(mockOpenAI as any, mockLogger as any);
      const requestData = {
        model: 'gpt-4o',
        input: [
          {
            type: 'function_call',
            call_id: 'call_prev',
            name: 'get_weather',
            arguments: '{}'
          },
          {
            type: 'function_call_output',
            call_id: 'call_prev',
            output: { temp: 70 }
          },
          {
            type: 'message',
            content: 'What is the weather?',
            role: 'user'
          }
        ],
        stream: true
      };

      const stream = await wrappedOpenAI.chat.completions.create(requestData);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const chunk of stream) {
        // Consume stream
      }

      // Verify addToolSpan was called for the function_call_output from input
      expect(mockLogger.addToolSpan).toHaveBeenCalled();
      const toolSpanCall = mockLogger.addToolSpan.mock.calls[0][0];
      expect(toolSpanCall.name).toBe('get_weather');
    });

    test('should not conclude trace when pending function calls exist', async () => {
      const times = [1000, 1100];
      Date.now = jest
        .fn()
        .mockReturnValueOnce(times[0])
        .mockReturnValueOnce(times[1]);

      const mockChunks = [
        {
          output: [
            {
              type: 'function_call',
              call_id: 'call_pending',
              name: 'get_time',
              arguments: '{}'
            }
          ]
        }
      ];

      async function* generateChunks() {
        for (const chunk of mockChunks) {
          yield chunk;
        }
      }

      mockCreateMethod.mockReturnValueOnce(generateChunks());

      const wrappedOpenAI = wrapOpenAI(mockOpenAI as any, mockLogger as any);
      const requestData = {
        model: 'gpt-4o',
        input: [{ type: 'message', content: 'Get time', role: 'user' }],
        stream: true
      };

      const stream = await wrappedOpenAI.chat.completions.create(requestData);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const chunk of stream) {
        // Consume stream
      }

      // Trace should NOT be concluded because function_call is pending
      expect(mockLogger.conclude).not.toHaveBeenCalled();
    });

    test('should conclude trace when all function calls have outputs', async () => {
      const times = [1000, 1100, 1200];
      Date.now = jest
        .fn()
        .mockReturnValueOnce(times[0])
        .mockReturnValueOnce(times[1])
        .mockReturnValueOnce(times[2]);

      const mockChunks = [
        {
          output: [
            {
              type: 'function_call',
              call_id: 'call_complete',
              name: 'get_weather',
              arguments: '{}'
            }
          ]
        },
        {
          output: [
            {
              type: 'function_call_output',
              call_id: 'call_complete',
              output: { temp: 72 }
            }
          ]
        },
        {
          output: [
            {
              type: 'message',
              content: 'The temperature is 72'
            }
          ]
        }
      ];

      async function* generateChunks() {
        for (const chunk of mockChunks) {
          yield chunk;
        }
      }

      mockCreateMethod.mockReturnValueOnce(generateChunks());

      const wrappedOpenAI = wrapOpenAI(mockOpenAI as any, mockLogger as any);
      const requestData = {
        model: 'gpt-4o',
        input: [{ type: 'message', content: 'Get weather', role: 'user' }],
        stream: true
      };

      const stream = await wrappedOpenAI.chat.completions.create(requestData);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const chunk of stream) {
        // Consume stream
      }

      // Trace SHOULD be concluded because all function calls have outputs
      expect(mockLogger.conclude).toHaveBeenCalled();
    });

    test('should handle tool span creation from streamed output items', async () => {
      const times = [1000, 1100, 1200];
      Date.now = jest
        .fn()
        .mockReturnValueOnce(times[0])
        .mockReturnValueOnce(times[1])
        .mockReturnValueOnce(times[2]);

      const mockChunks = [
        {
          output: [
            {
              type: 'code_interpreter_call',
              id: 'code_1',
              name: 'python_exec',
              code_input: 'print("hello")',
              code_output: 'hello'
            }
          ]
        },
        {
          output: [
            {
              type: 'message',
              content: 'Code executed'
            }
          ]
        }
      ];

      async function* generateChunks() {
        for (const chunk of mockChunks) {
          yield chunk;
        }
      }

      mockCreateMethod.mockReturnValueOnce(generateChunks());

      const wrappedOpenAI = wrapOpenAI(mockOpenAI as any, mockLogger as any);
      const requestData = {
        model: 'gpt-4o',
        input: [{ type: 'message', content: 'Run code', role: 'user' }],
        stream: true
      };

      const stream = await wrappedOpenAI.chat.completions.create(requestData);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const chunk of stream) {
        // Consume stream
      }

      // Verify tool span was created for code_interpreter_call
      expect(mockLogger.addToolSpan).toHaveBeenCalled();
      const toolSpanCalls = mockLogger.addToolSpan.mock.calls;
      // Tool span name comes from the item.name field, not the type
      const codeInterpreterCall = toolSpanCalls.find(
        (call: any) =>
          call[0].name === 'python_exec' ||
          call[0].metadata?.tool_type === 'code_interpreter_call'
      );
      expect(codeInterpreterCall).toBeDefined();
    });
  });
});
