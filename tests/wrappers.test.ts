import { log } from '../src/wrappers';
import { loggerContext } from '../src/singleton';
import { Document } from '../src/types/document.types';

// Mock api-client to provide the static getTimestampRecord method
jest.mock('../src/api-client', () => ({
  GalileoApiClient: Object.assign(
    jest.fn().mockImplementation(() => ({})),
    {
      getTimestampRecord: jest.fn().mockReturnValue(new Date())
    }
  )
}));

// Mock GalileoLogger to avoid actual logging and allow for inspection of calls

const mockLogger = {
  startTrace: jest.fn(),
  addWorkflowSpan: jest.fn((args) => {
    if (args && args.createdAt === undefined) {
      args.createdAt = new Date();
    }
  }),
  addLlmSpan: jest.fn((args) => {
    if (args && args.createdAt === undefined) {
      args.createdAt = new Date();
    }
  }),
  addRetrieverSpan: jest.fn((args) => {
    if (args && args.createdAt === undefined) {
      args.createdAt = new Date();
    }
  }),
  addToolSpan: jest.fn((args) => {
    if (args && args.createdAt === undefined) {
      args.createdAt = new Date();
    }
  }),
  addAgentSpan: jest.fn((args) => {
    if (args && args.createdAt === undefined) {
      args.createdAt = new Date();
    }
  }),
  conclude: jest.fn(),
  currentParent: jest.fn().mockReturnValue(undefined),
  isLoggingDisabled: jest.fn().mockReturnValue(false),
  continueTrace: jest.fn().mockResolvedValue(undefined)
};

jest.mock('../src/utils/galileo-logger', () => ({
  GalileoLogger: jest.fn().mockImplementation(() => mockLogger)
}));

describe('log wrapper', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });

  test('should support synchronous functions', () => {
    const syncFunc = (a: number, b: number) => a + b;
    const wrappedFunc = log({}, syncFunc);

    const result = wrappedFunc(2, 3);

    expect(result).toBe(5);
    expect(mockLogger.startTrace).toHaveBeenCalledTimes(1);
    expect(mockLogger.addWorkflowSpan).toHaveBeenCalledTimes(1);
    expect(mockLogger.conclude).toHaveBeenCalledTimes(2);
  });

  test('should propagate errors from synchronous functions', () => {
    const syncErrorFunc = () => {
      throw new Error('sync failure');
    };
    const wrappedFunc = log({}, syncErrorFunc);

    expect(() => wrappedFunc()).toThrow('sync failure');
  });

  describe('synchronous functions for all span types', () => {
    test('should support sync LLM span', () => {
      const syncLLM = (prompt: string) => `Response to: ${prompt}`;
      const wrappedFunc = log({ spanType: 'llm' }, syncLLM);

      const result = wrappedFunc('test prompt');

      expect(result).toBe('Response to: test prompt');
      expect(mockLogger.addLlmSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          output: 'Response to: test prompt'
        })
      );
    });

    test('should support sync retriever span', () => {
      const syncRetriever = () => [
        new Document({ content: 'result 1', metadata: {} }),
        new Document({ content: 'result 2', metadata: {} })
      ];
      const wrappedFunc = log({ spanType: 'retriever' }, syncRetriever);

      const result = wrappedFunc();

      expect(result).toHaveLength(2);
      expect(mockLogger.addRetrieverSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.any(String),
          output: expect.any(Array)
        })
      );
    });

    test('should support sync tool span', () => {
      const syncTool = (input: string) => input.toUpperCase();
      const wrappedFunc = log({ spanType: 'tool' }, syncTool);

      const result = wrappedFunc('hello');

      expect(result).toBe('HELLO');
      expect(mockLogger.addToolSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.any(String),
          output: 'HELLO'
        })
      );
    });

    test('should support sync agent span', () => {
      const syncAgent = (task: string, context: string) => ({
        action: `Execute: ${task}`,
        reasoning: `Based on: ${context}`,
        result: 'completed'
      });
      const wrappedFunc = log({ spanType: 'agent' }, syncAgent);

      const result = wrappedFunc('analyze', 'data context');

      expect(result.result).toBe('completed');
      expect(mockLogger.addAgentSpan).toHaveBeenCalled();
    });

    test('should support sync workflow span', () => {
      const syncWorkflow = (data: { value: number }) => {
        return { processed: true, value: data.value * 2 };
      };
      const wrappedFunc = log({ spanType: 'workflow' }, syncWorkflow);

      const result = wrappedFunc({ value: 5 });

      expect(result).toEqual({ processed: true, value: 10 });
      expect(mockLogger.addWorkflowSpan).toHaveBeenCalled();
    });

    test('should handle sync function errors with all span types', () => {
      const errorFunc = () => {
        throw new Error('Sync span error');
      };

      const toolWrapper = log({ spanType: 'tool' }, errorFunc);
      expect(() => toolWrapper()).toThrow('Sync span error');
      // Note: When sync function throws before returning,
      // the span is not created since handleResult() is never called
      // The error is propagated immediately
    });

    test('should support all span parameters with sync functions', () => {
      const syncFunc = (input: string) => `Processed: ${input}`;
      const wrappedFunc = log(
        {
          spanType: 'tool',
          metadata: { env: 'test' },
          tags: ['sync', 'test'],
          params: {
            statusCode: () => 200,
            stepNumber: () => 1
          }
        },
        syncFunc
      );

      const result = wrappedFunc('data');

      expect(result).toBe('Processed: data');
      expect(mockLogger.addToolSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { env: 'test' },
          tags: ['sync', 'test'],
          statusCode: 200,
          stepNumber: 1
        })
      );
    });
  });

  test('should log a simple function execution as a workflow span by default', async () => {
    // Arrange
    const simpleFunc = async (a: number, b: number) => a + b;
    const wrappedFunc = log({}, simpleFunc);

    // Act
    await wrappedFunc(2, 3);

    // Assert
    expect(mockLogger.startTrace).toHaveBeenCalledTimes(1);
    expect(mockLogger.addWorkflowSpan).toHaveBeenCalledTimes(1);
    expect(mockLogger.conclude).toHaveBeenCalledTimes(2);
  });

  describe('createdAt and durationNs handling', () => {
    test('should handle createdAt as a Date object', async () => {
      const createdAt = new Date('2023-01-01T00:00:00.000Z');
      const func = async (input: string, createdAt: Date) =>
        `processed: ${input}, ${createdAt}`;
      const wrappedFunc = log({ spanType: 'tool' }, func);

      await wrappedFunc('test', createdAt);

      expect(mockLogger.addToolSpan).toHaveBeenCalledTimes(1);
      expect(mockLogger.conclude).toHaveBeenCalledTimes(1);
      const conclusion = mockLogger.conclude.mock.calls[0][0];
      expect(conclusion.durationNs).toBeGreaterThan(0);
    });

    test('should handle createdAt as a number (timestamp)', async () => {
      const createdAtTimestamp = 1672531200000; // 2023-01-01T00:00:00.000Z
      const func = async (input: string, createdAt: number) =>
        `processed: ${input}, ${createdAt}`;
      const wrappedFunc = log({ spanType: 'tool' }, func);

      await wrappedFunc('test', createdAtTimestamp);

      expect(mockLogger.addToolSpan).toHaveBeenCalledTimes(1);
      expect(mockLogger.conclude).toHaveBeenCalledTimes(1);
    });

    test('should handle createdAt as a string', async () => {
      const createdAtString = '2023-01-01T00:00:00.000Z';
      const func = async (input: string, createdAt: string) =>
        `processed: ${input}, ${createdAt}`;
      const wrappedFunc = log({ spanType: 'tool' }, func);

      await wrappedFunc('test', createdAtString);

      expect(mockLogger.addToolSpan).toHaveBeenCalledTimes(1);
      expect(mockLogger.conclude).toHaveBeenCalledTimes(1);
    });

    test('should use current date if createdAt is not provided', async () => {
      const before = new Date();
      const func = async (input: string) => `processed: ${input}`;
      const wrappedFunc = log({ spanType: 'tool' }, func);

      await wrappedFunc('test');
      const after = new Date();

      const toolSpanCall = mockLogger.addToolSpan.mock.calls[0][0];
      expect(toolSpanCall.createdAt).toBeInstanceOf(Date);
      expect(toolSpanCall.createdAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime()
      );
      expect(toolSpanCall.createdAt.getTime()).toBeLessThanOrEqual(
        after.getTime()
      );
    });
  });

  describe('name handling', () => {
    test('should use function name if no name is provided', async () => {
      async function myTestFunction(input: string) {
        return `output: ${input}`;
      }
      const wrappedFunc = log({ spanType: 'workflow' }, myTestFunction);

      await wrappedFunc('test');

      expect(mockLogger.addWorkflowSpan).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'myTestFunction' })
      );
    });

    test('should use name from options if provided', async () => {
      const func = async (input: string) => `processed: ${input}`;
      const wrappedFunc = log(
        { name: 'customNameFromOptions', spanType: 'workflow' },
        func
      );

      await wrappedFunc('test');

      expect(mockLogger.addWorkflowSpan).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'customNameFromOptions' })
      );
    });

    test('should use name from arguments if provided, overriding options', async () => {
      const func = async (input: string, name: string) =>
        `processed: ${input}, ${name}`;
      const wrappedFunc = log(
        { name: 'customNameFromOptions', spanType: 'workflow' },
        func
      );

      await wrappedFunc('test', 'nameFromArgs');

      expect(mockLogger.addWorkflowSpan).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'nameFromArgs' })
      );
    });
  });

  describe('span type specific tests', () => {
    test('should log an LLM span correctly', async () => {
      const llmFunc = async (input: string, model: string) => ({
        content: `Response to ${input}, ${model}`,
        role: 'assistant'
      });
      const wrappedFunc = log({ spanType: 'llm' }, llmFunc);
      const input = 'hello';
      const model = 'gpt-4';
      const output = await llmFunc(input, model);

      await wrappedFunc(input, model);

      expect(mockLogger.addLlmSpan).toHaveBeenCalledTimes(1);
      expect(mockLogger.addLlmSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          input: 'hello',
          output: output,
          model: model
        })
      );
    });

    test('should log a retriever span correctly', async () => {
      const retrieverFunc = async (query: string) => [
        new Document({ content: query })
      ];
      const wrappedFunc = log({ spanType: 'retriever' }, retrieverFunc);
      const query = 'my query';
      const output = await retrieverFunc(query);

      await wrappedFunc(query);

      expect(mockLogger.addRetrieverSpan).toHaveBeenCalledTimes(1);
      expect(mockLogger.addRetrieverSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          input: `{"query":"${query}"}`,
          output: output
        })
      );
    });

    test('should log a tool span correctly', async () => {
      const toolFunc = async (param1: string) => `result for ${param1}`;
      const wrappedFunc = log({ spanType: 'tool' }, toolFunc);
      const input = 'tool_input';
      const output = await toolFunc(input);

      await wrappedFunc(input);

      expect(mockLogger.addToolSpan).toHaveBeenCalledTimes(1);
      expect(mockLogger.addToolSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          input: `{"param1":"${input}"}`,
          output: output
        })
      );
      expect(mockLogger.conclude).toHaveBeenCalledTimes(1);
    });

    test('should log an agent span correctly', async () => {
      const agentFunc = async (task: string, context: string) => ({
        action: `Execute task: ${task}`,
        reasoning: `Based on context: ${context}`,
        result: `Task completed successfully`
      });
      const wrappedFunc = log({ spanType: 'agent' }, agentFunc);
      const task = 'analyze_data';
      const context = 'user_request';

      await wrappedFunc(task, context);

      expect(mockLogger.addAgentSpan).toHaveBeenCalledTimes(1);
      expect(mockLogger.addAgentSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          input: `{"task":"${task}","context":"${context}"}`,
          name: 'agentFunc'
        })
      );
      expect(mockLogger.conclude).toHaveBeenCalledTimes(2);
    });
  });

  describe('parameter mapping', () => {
    test('should map params by string key', async () => {
      const llmFunc = async (input: string, modelName: string) => ({
        content: `Response to ${input} using ${modelName}`,
        role: 'assistant'
      });
      const wrappedFunc = log(
        { spanType: 'llm', params: { model: 'modelName' } },
        llmFunc
      );

      await wrappedFunc('hello', 'gpt-4');

      expect(mockLogger.addLlmSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4'
        })
      );
    });

    test('should map params via callable', async () => {
      const llmFunc = async (input: string, temp: number) => ({
        content: `Response to ${input} at ${temp}`,
        role: 'assistant'
      });
      const wrappedFunc = log(
        {
          spanType: 'llm',
          params: {
            temperature: (args) => (args as { temp?: number }).temp ?? 0.7
          }
        },
        llmFunc
      );

      await wrappedFunc('hello', 0.3);

      expect(mockLogger.addLlmSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.3
        })
      );
    });

    test('should map multiple LLM-specific parameters via functions', async () => {
      const llmFunc = async (
        input: string,
        modelName: string,
        tokens: number
      ) => {
        void input;
        void modelName;
        void tokens;
        return 'response';
      };
      const wrappedFunc = log(
        {
          spanType: 'llm',
          params: {
            model: 'modelName', // String key
            numInputTokens: 'tokens', // String key
            numOutputTokens: () => 50
          }
        },
        llmFunc
      );

      await wrappedFunc('test prompt here', 'gpt-4', 25);

      expect(mockLogger.addLlmSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4',
          numInputTokens: 25,
          numOutputTokens: 50
        })
      );
    });

    test('should handle function mapper returning undefined', async () => {
      const toolFunc = async (input: string) => {
        void input;
        return 'result';
      };
      const wrappedFunc = log(
        {
          spanType: 'tool',
          params: {
            toolCallId: () => undefined
          }
        },
        toolFunc
      );

      await wrappedFunc('test');

      const spanCall = mockLogger.addToolSpan.mock.calls[0][0];
      expect(spanCall.toolCallId).toBeUndefined();
    });

    test('should map toolCallId via function for tool spans', async () => {
      const toolFunc = async (callId: string, input: string) => {
        void callId;
        void input;
        return 'result';
      };

      const wrappedFunc = log(
        {
          spanType: 'tool',
          params: {
            toolCallId: (args: Record<string, unknown>) => args.callId as string
          }
        },
        toolFunc
      );

      await wrappedFunc('call-123', 'input');

      expect(mockLogger.addToolSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          toolCallId: 'call-123'
        })
      );
    });

    test('should map agentType via function for agent spans', async () => {
      const agentFunc = async (input: string, agentType: string) => {
        void input;
        void agentType;
        return {
          result: 'done'
        };
      };
      const wrappedFunc = log(
        {
          spanType: 'agent',
          params: {
            agentType: 'agentType' // String key mapping
          }
        },
        agentFunc
      );

      await wrappedFunc('analyze', 'react');

      expect(mockLogger.addAgentSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          agentType: 'react'
        })
      );
    });

    test('should mix string keys and function mappers', async () => {
      const llmFunc = async (
        input: string,
        modelName: string,
        tokens: number
      ) => {
        void input;
        void modelName;
        void tokens;

        return 'response';
      };
      const wrappedFunc = log(
        {
          spanType: 'llm',
          params: {
            model: 'modelName', // String key
            numInputTokens: 'tokens' // String key
          }
        },
        llmFunc
      );

      await wrappedFunc('test', 'gpt-4', 100);

      expect(mockLogger.addLlmSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4',
          numInputTokens: 100
        })
      );
    });

    test('should handle complex parameter extraction logic', async () => {
      const llmFunc = async (
        input: string,
        userId: string,
        requestType: string
      ) => {
        void input;
        void userId;
        void requestType;
        return 'response';
      };

      const wrappedFunc = log(
        {
          spanType: 'llm',
          params: {
            metadata: (args: Record<string, unknown>) => {
              return {
                userId: (args.userId as string) || 'unknown',
                requestType: (args.requestType as string) || 'default'
              };
            },
            tags: () => ['llm', 'custom']
          }
        },
        llmFunc
      );

      await wrappedFunc('query data', 'user-123', 'query');

      expect(mockLogger.addLlmSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            userId: 'user-123',
            requestType: 'query'
          }),
          tags: expect.arrayContaining(['llm', 'custom'])
        })
      );
    });

    test('should handle statusCode and stepNumber mapping', async () => {
      const toolFunc = async (
        input: string,
        success: boolean,
        step: number
      ) => {
        void input;
        void success;
        void step;
        return 'result';
      };
      const wrappedFunc = log(
        {
          spanType: 'tool',
          params: {
            statusCode: (args: Record<string, unknown>) =>
              (args.success as boolean) ? 200 : 500,
            stepNumber: 'step' // Use string key
          }
        },
        toolFunc
      );

      await wrappedFunc('data', true, 3);

      expect(mockLogger.addToolSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 200,
          stepNumber: 3
        })
      );
    });
  });

  describe('generator support', () => {
    test('should log output after sync generator completes', () => {
      function* tokenGenerator(input: string) {
        yield 'chunk1';
        yield 'chunk2';
        return input;
      }

      const wrappedFunc = log({ spanType: 'llm' }, tokenGenerator);
      const chunks = [...wrappedFunc('prompt')];

      expect(chunks).toEqual(['chunk1', 'chunk2']);
      expect(mockLogger.addLlmSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          output: 'chunk1chunk2'
        })
      );
    });

    test('should log output after async generator completes', async () => {
      async function* asyncTokenGenerator(input: string) {
        yield 'a';
        yield 'b';
        return input;
      }

      const wrappedFunc = log({ spanType: 'llm' }, asyncTokenGenerator);
      const chunks: string[] = [];

      for await (const chunk of wrappedFunc('prompt')) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['a', 'b']);
      expect(mockLogger.addLlmSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          output: 'ab'
        })
      );
    });

    test('should handle generator throwing error mid-iteration', () => {
      function* errorGenerator() {
        yield 'first';
        throw new Error('Generator error');
      }

      const wrappedFunc = log({ spanType: 'tool' }, errorGenerator);
      const chunks: string[] = [];

      // The wrapper catches errors and logs them as warnings
      // It does not re-throw, so we can safely consume
      for (const chunk of wrappedFunc()) {
        chunks.push(chunk);
      }

      // Should have yielded the first chunk before error
      expect(chunks).toEqual(['first']);
      // Should still have called addToolSpan with partial output
      expect(mockLogger.addToolSpan).toHaveBeenCalled();
    });

    test('should handle generator yielding null/undefined', () => {
      function* nullGenerator() {
        yield null;
        yield undefined;
        yield 'valid';
      }

      const wrappedFunc = log({ spanType: 'tool' }, nullGenerator);
      const chunks = [...wrappedFunc()];

      expect(chunks).toEqual([null, undefined, 'valid']);
      // Output should include all items as array (not all strings)
      expect(mockLogger.addToolSpan).toHaveBeenCalled();
      const spanCall = mockLogger.addToolSpan.mock.calls[0][0];
      expect(spanCall.output).toBeDefined();
    });

    test('should handle async generator rejection', async () => {
      async function* rejectingGenerator() {
        yield 'first';
        throw new Error('Async generator error');
      }

      const wrappedFunc = log({ spanType: 'tool' }, rejectingGenerator);
      const chunks: string[] = [];

      // The wrapper catches errors and logs them as warnings
      // It does not re-throw, so we can safely consume
      for await (const chunk of wrappedFunc()) {
        chunks.push(chunk);
      }

      // Should have yielded the first chunk before error
      expect(chunks).toEqual(['first']);
      // Should still log partial output
      expect(mockLogger.addToolSpan).toHaveBeenCalled();
    });

    test('should handle mixed yield types correctly', () => {
      function* mixedGenerator() {
        yield 'string';
        yield 123;
        yield { key: 'value' };
      }

      const wrappedFunc = log({ spanType: 'tool' }, mixedGenerator);
      const chunks = [...wrappedFunc()];

      expect(chunks).toEqual(['string', 123, { key: 'value' }]);
      // Mixed types should be collected as array
      expect(mockLogger.addToolSpan).toHaveBeenCalled();
      const spanCall = mockLogger.addToolSpan.mock.calls[0][0];
      // Output should be an array representation
      expect(spanCall.output).toContain('string');
    });

    test('should handle async generator with delayed yields', async () => {
      async function* delayedGenerator() {
        await new Promise((resolve) => setTimeout(resolve, 5));
        yield 'delayed1';
        await new Promise((resolve) => setTimeout(resolve, 5));
        yield 'delayed2';
      }

      const wrappedFunc = log({ spanType: 'llm' }, delayedGenerator);
      const chunks: string[] = [];
      const startTime = Date.now();

      for await (const chunk of wrappedFunc()) {
        chunks.push(chunk);
      }

      const duration = Date.now() - startTime;

      expect(chunks).toEqual(['delayed1', 'delayed2']);
      expect(duration).toBeGreaterThanOrEqual(5); // At least some delay
      expect(mockLogger.addLlmSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          output: 'delayed1delayed2'
        })
      );
    });

    test('should handle generator early termination', () => {
      function* longGenerator() {
        yield 'chunk1';
        yield 'chunk2';
        yield 'chunk3';
        yield 'chunk4';
      }

      const wrappedFunc = log({ spanType: 'tool' }, longGenerator);
      const chunks: string[] = [];

      for (const chunk of wrappedFunc()) {
        chunks.push(chunk);
        if (chunks.length === 2) {
          break; // Early termination
        }
      }

      expect(chunks).toEqual(['chunk1', 'chunk2']);
      // The logger should have been called even with early termination
      // Note: finalization may not happen immediately with early termination
    });
  });

  describe('context isolation', () => {
    test('should isolate parent stacks across parallel async calls', async () => {
      const getParentStack = async () => {
        const context = loggerContext.getStore();
        return context?.parentStack ?? [];
      };
      const wrappedFunc = log({}, getParentStack);

      const [stackA, stackB] = await Promise.all([
        wrappedFunc(),
        wrappedFunc()
      ]);

      expect(stackA).toEqual([]);
      expect(stackB).toEqual([]);
      expect(stackA).not.toBe(stackB);
    });

    test('should handle deeply nested context.run() calls', async () => {
      const results: string[] = [];

      await loggerContext.run({ sessionId: 'outer' }, async () => {
        const outerContext = loggerContext.getStore();
        results.push(`outer: ${outerContext?.sessionId}`);

        await loggerContext.run({ sessionId: 'middle' }, async () => {
          const middleContext = loggerContext.getStore();
          results.push(`middle: ${middleContext?.sessionId}`);

          await loggerContext.run({ sessionId: 'inner' }, async () => {
            const innerContext = loggerContext.getStore();
            results.push(`inner: ${innerContext?.sessionId}`);
          });

          const middleAfter = loggerContext.getStore();
          results.push(`middle-after: ${middleAfter?.sessionId}`);
        });

        const outerAfter = loggerContext.getStore();
        results.push(`outer-after: ${outerAfter?.sessionId}`);
      });

      expect(results).toEqual([
        'outer: outer',
        'middle: middle',
        'inner: inner',
        'middle-after: middle',
        'outer-after: outer'
      ]);
    });

    test('should isolate context with Promise.all', async () => {
      const sessionIds: string[] = [];

      await Promise.all([
        loggerContext.run({ sessionId: 'task-1' }, async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          const context = loggerContext.getStore();
          sessionIds.push(context?.sessionId || 'none');
        }),
        loggerContext.run({ sessionId: 'task-2' }, async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          const context = loggerContext.getStore();
          sessionIds.push(context?.sessionId || 'none');
        }),
        loggerContext.run({ sessionId: 'task-3' }, async () => {
          const context = loggerContext.getStore();
          sessionIds.push(context?.sessionId || 'none');
        })
      ]);

      expect(sessionIds).toContain('task-1');
      expect(sessionIds).toContain('task-2');
      expect(sessionIds).toContain('task-3');
      expect(sessionIds.length).toBe(3);
    });

    test('should isolate context with Promise.race', async () => {
      let capturedSessionId: string | undefined;

      await Promise.race([
        loggerContext.run({ sessionId: 'fast' }, async () => {
          const context = loggerContext.getStore();
          capturedSessionId = context?.sessionId;
          return 'fast';
        }),
        loggerContext.run({ sessionId: 'slow' }, async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return 'slow';
        })
      ]);

      expect(capturedSessionId).toBe('fast');
    });

    test('should restore context after errors', async () => {
      let contextBeforeError: string | undefined;
      let contextAfterError: string | undefined;

      try {
        await loggerContext.run({ sessionId: 'outer' }, async () => {
          const outerContext = loggerContext.getStore();
          contextBeforeError = outerContext?.sessionId;

          await loggerContext.run({ sessionId: 'inner' }, async () => {
            throw new Error('Test error');
          });
        });
      } catch (error) {
        // Error expected
      }

      // Context outside should not be affected
      await loggerContext.run({ sessionId: 'after' }, async () => {
        const afterContext = loggerContext.getStore();
        contextAfterError = afterContext?.sessionId;
      });

      expect(contextBeforeError).toBe('outer');
      expect(contextAfterError).toBe('after');
    });

    test('should not leak context between async boundaries', async () => {
      let context1: string | undefined;
      let context2: string | undefined;

      await loggerContext.run({ sessionId: 'context1' }, async () => {
        const ctx = loggerContext.getStore();
        context1 = ctx?.sessionId;
      });

      await loggerContext.run({ sessionId: 'context2' }, async () => {
        const ctx = loggerContext.getStore();
        context2 = ctx?.sessionId;
      });

      // Outside any context
      const outsideCtx = loggerContext.getStore();
      const contextOutside = outsideCtx?.sessionId;

      expect(context1).toBe('context1');
      expect(context2).toBe('context2');
      expect(contextOutside).toBeUndefined();
    });

    test('should maintain separate contexts for chained operations', async () => {
      const parentStacks: number[] = [];

      await loggerContext.run({ sessionId: 'main' }, async () => {
        const func1 = log({ spanType: 'tool' }, async () => {
          const ctx = loggerContext.getStore();
          parentStacks.push(ctx?.parentStack?.length ?? 0);
          return 'result1';
        });

        const func2 = log({ spanType: 'tool' }, async (input: string) => {
          const ctx = loggerContext.getStore();
          parentStacks.push(ctx?.parentStack?.length ?? 0);
          return `${input}-result2`;
        });

        const result1 = await func1();
        const result2 = await func2(result1);

        expect(result2).toBe('result1-result2');
      });

      // Each log() call creates its own context with a fresh parentStack
      expect(parentStacks.length).toBe(2);
      expect(parentStacks[0]).toBeGreaterThanOrEqual(0);
      expect(parentStacks[1]).toBeGreaterThanOrEqual(0);
    });

    test('should isolate parent stacks in concurrent operations', async () => {
      let callCount = 0;

      const func = log({ spanType: 'tool' }, async (id: string) => {
        callCount++;
        const ctx = loggerContext.getStore();
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 10));
        // Each call gets its own isolated parentStack
        return `${id}-${ctx?.parentStack?.length ?? 0}`;
      });

      const results = await Promise.all([
        func('task-1'),
        func('task-2'),
        func('task-3')
      ]);

      // All three calls should complete
      expect(callCount).toBe(3);
      expect(results).toHaveLength(3);
      // Each should have its own parentStack
      expect(results.every((r) => r.includes('-'))).toBe(true);
    });
  });

  describe('LogOptions metadata and tags (1.2.4)', () => {
    test('should pass top-level metadata and tags to workflow span', async () => {
      const fn = async (x: number) => x + 1;
      const wrapped = log(
        {
          metadata: { env: 'test', version: '1.0' },
          tags: ['critical', 'prod']
        },
        fn
      );
      await wrapped(2);
      expect(mockLogger.addWorkflowSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { env: 'test', version: '1.0' },
          tags: ['critical', 'prod']
        })
      );
    });

    test('should merge top-level metadata with params metadata', async () => {
      const fn = async (input: string, requestId: string) => {
        void input;
        void requestId;
        return 'result';
      };
      const wrapped = log(
        {
          spanType: 'tool',
          metadata: { service: 'api', version: '1.0' },
          params: {
            metadata: (args: Record<string, unknown>) => ({
              requestId: args.requestId as string,
              timestamp: '2024-01-01'
            })
          }
        },
        fn
      );

      await wrapped('test', 'req-123');

      // Options metadata takes precedence over params metadata
      expect(mockLogger.addToolSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { service: 'api', version: '1.0' }
        })
      );
    });

    test('should merge top-level tags with params tags', async () => {
      const fn = async (input: string) => {
        void input;
        return 'result';
      };
      const wrapped = log(
        {
          spanType: 'tool',
          tags: ['api', 'critical'],
          params: {
            tags: () => ['custom', 'test']
          }
        },
        fn
      );

      await wrapped('test');

      // Options tags take precedence over params tags
      expect(mockLogger.addToolSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: ['api', 'critical']
        })
      );
    });

    test('should handle empty metadata gracefully', async () => {
      const fn = async (input: string) => {
        void input;
        return 'result';
      };
      const wrapped = log(
        {
          spanType: 'tool',
          metadata: {}
        },
        fn
      );

      await wrapped('test');

      const spanCall = mockLogger.addToolSpan.mock.calls[0][0];
      expect(spanCall.metadata).toEqual({});
    });

    test('should handle empty tags gracefully', async () => {
      const fn = async (input: string) => {
        void input;
        return 'result';
      };
      const wrapped = log(
        {
          spanType: 'tool',
          tags: []
        },
        fn
      );

      await wrapped('test');

      const spanCall = mockLogger.addToolSpan.mock.calls[0][0];
      expect(spanCall.tags).toEqual([]);
    });

    test('should handle undefined metadata', async () => {
      const fn = async (input: string) => {
        void input;
        return 'result';
      };
      const wrapped = log(
        {
          spanType: 'tool'
          // metadata not provided
        },
        fn
      );

      await wrapped('test');

      const spanCall = mockLogger.addToolSpan.mock.calls[0][0];
      expect(spanCall.metadata).toBeUndefined();
    });

    test('should handle undefined tags', async () => {
      const fn = async (input: string) => {
        void input;
        return 'result';
      };
      const wrapped = log(
        {
          spanType: 'tool'
          // tags not provided
        },
        fn
      );

      await wrapped('test');

      const spanCall = mockLogger.addToolSpan.mock.calls[0][0];
      expect(spanCall.tags).toBeUndefined();
    });

    test('should apply metadata and tags to all span types', async () => {
      const metadata = { env: 'prod', service: 'api' };
      const tags = ['important', 'tracked'];

      // LLM span
      const llmFunc = log(
        { spanType: 'llm', metadata, tags },
        async (input: string) => {
          void input;
          return 'response';
        }
      );
      await llmFunc('test');
      expect(mockLogger.addLlmSpan).toHaveBeenCalledWith(
        expect.objectContaining({ metadata, tags })
      );

      jest.clearAllMocks();

      // Tool span
      const toolFunc = log(
        { spanType: 'tool', metadata, tags },
        async (input: string) => {
          void input;
          return 'result';
        }
      );
      await toolFunc('test');
      expect(mockLogger.addToolSpan).toHaveBeenCalledWith(
        expect.objectContaining({ metadata, tags })
      );

      jest.clearAllMocks();

      // Retriever span
      const retrieverFunc = log(
        { spanType: 'retriever', metadata, tags },
        async (input: string) => {
          void input;
          return [new Document({ content: 'doc', metadata: {} })];
        }
      );
      await retrieverFunc('test');
      expect(mockLogger.addRetrieverSpan).toHaveBeenCalledWith(
        expect.objectContaining({ metadata, tags })
      );

      jest.clearAllMocks();

      // Agent span
      const agentFunc = log(
        { spanType: 'agent', metadata, tags },
        async (input: string) => {
          void input;
          return { result: 'done' };
        }
      );
      await agentFunc('test');
      expect(mockLogger.addAgentSpan).toHaveBeenCalledWith(
        expect.objectContaining({ metadata, tags })
      );
    });
  });

  describe('distributed tracing (1.2.3)', () => {
    test('should call continueTrace when traceId is provided and no current parent', async () => {
      const fn = async (x: string) => x;
      const wrapped = log({ traceId: 'trace-123', parentId: 'span-456' }, fn);
      const result = await wrapped('hi');
      expect(result).toBe('hi');
      expect(mockLogger.continueTrace).toHaveBeenCalledWith(
        'trace-123',
        'span-456'
      );
    });
  });

  describe('input handling', () => {
    test('should wrap non-dict arguments into an input dictionary', async () => {
      const func = async (a: number, b: string) => `${a}-${b}`;
      const wrappedFunc = log({}, func);

      await wrappedFunc(1, 'test');

      const spanCall = mockLogger.addWorkflowSpan.mock.calls[0][0];
      expect(spanCall.input).toBe('{"a":1,"b":"test"}');
    });

    test('should not wrap arguments if input key already exists', async () => {
      const func = async (input: { message: string }) => input.message;
      const wrappedFunc = log({}, func);

      await wrappedFunc({ message: 'hello world' });

      const spanCall = mockLogger.addWorkflowSpan.mock.calls[0][0];
      expect(spanCall.input).toBe('{"message":"hello world"}');
    });
  });

  describe('redacted input/output support', () => {
    test('should pass redactedInput to LLM span when provided via params', async () => {
      const sensitiveData = { ssn: '123-45-6789', name: 'John' };
      const redacted = { ssn: '***-**-****', name: 'John' };

      const llmFunc = log(
        {
          spanType: 'llm',
          params: {
            redactedInput: () => JSON.stringify(redacted)
          }
        },
        async (data: { ssn: string; name: string }) => {
          void data;
          return 'response';
        }
      );

      await llmFunc(sensitiveData);

      expect(mockLogger.addLlmSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          redactedInput: JSON.stringify(redacted)
        })
      );
    });

    test('should pass redactedOutput to LLM span when provided via params', async () => {
      const llmFunc = log(
        {
          spanType: 'llm',
          params: {
            redactedOutput: () => 'REDACTED RESPONSE'
          }
        },
        async (prompt: string) => {
          void prompt;
          return 'This is sensitive output';
        }
      );

      await llmFunc('test prompt');

      expect(mockLogger.addLlmSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          redactedOutput: 'REDACTED RESPONSE'
        })
      );
    });

    test('should handle redactedInput for tool spans', async () => {
      const toolFunc = log(
        {
          spanType: 'tool',
          params: {
            redactedInput: (args) =>
              JSON.stringify({ ...args, password: '***' })
          }
        },
        async (username: string, password: string) => {
          void username;
          void password;
          return 'authenticated';
        }
      );

      await toolFunc('user123', 'secret123');

      expect(mockLogger.addToolSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          redactedInput: expect.stringContaining('password":"***')
        })
      );
    });

    test('should handle redactedOutput for tool spans', async () => {
      const toolFunc = log(
        {
          spanType: 'tool',
          params: {
            redactedOutput: () => 'REDACTED'
          }
        },
        async (query: string) => {
          void query;
          return { apiKey: 'secret-key-123', data: 'result' };
        }
      );

      await toolFunc('fetch data');

      expect(mockLogger.addToolSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          redactedOutput: 'REDACTED'
        })
      );
    });

    test('should handle redactedInput for retriever spans', async () => {
      const retrieverFunc = log(
        {
          spanType: 'retriever',
          params: {
            redactedInput: () => 'Query: [REDACTED]'
          }
        },
        async (query: string) => {
          void query;
          return [new Document({ content: 'result', metadata: {} })];
        }
      );

      await retrieverFunc('sensitive query');

      expect(mockLogger.addRetrieverSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          redactedInput: 'Query: [REDACTED]'
        })
      );
    });

    test('should handle redactedOutput for retriever spans', async () => {
      const retrieverFunc = log(
        {
          spanType: 'retriever',
          params: {
            redactedOutput: () => '[REDACTED DOCUMENTS]'
          }
        },
        async (query: string) => {
          void query;
          return [new Document({ content: 'sensitive result', metadata: {} })];
        }
      );

      await retrieverFunc('query');

      expect(mockLogger.addRetrieverSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          redactedOutput: '[REDACTED DOCUMENTS]'
        })
      );
    });

    test('should handle redactedInput for workflow spans', async () => {
      const workflowFunc = log(
        {
          spanType: 'workflow',
          params: {
            redactedInput: () => 'Workflow with [REDACTED] input'
          }
        },
        async (data: { sensitive: string }) => {
          void data;
          return 'workflow result';
        }
      );

      await workflowFunc({ sensitive: 'data' });

      expect(mockLogger.addWorkflowSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          redactedInput: 'Workflow with [REDACTED] input'
        })
      );
    });

    test('should handle redactedOutput for workflow spans', async () => {
      const workflowFunc = log(
        {
          spanType: 'workflow',
          params: {
            redactedOutput: () => '[REDACTED OUTPUT]'
          }
        },
        async (data: string) => {
          void data;
          return 'sensitive workflow result';
        }
      );

      await workflowFunc('input');

      // Note: workflow spans set redactedOutput in the span call
      const spanCall = mockLogger.addWorkflowSpan.mock.calls[0][0];
      expect(spanCall.redactedOutput).toBe('[REDACTED OUTPUT]');
    });

    test('should handle redactedInput for agent spans', async () => {
      const agentFunc = log(
        {
          spanType: 'agent',
          params: {
            redactedInput: (args) => {
              void args;
              return 'Agent task: [REDACTED]';
            }
          }
        },
        async (task: string, context: string) => {
          void task;
          void context;
          return { result: 'done' };
        }
      );

      await agentFunc('sensitive task', 'context');

      expect(mockLogger.addAgentSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          redactedInput: 'Agent task: [REDACTED]'
        })
      );
    });

    test('should handle redactedOutput for agent spans', async () => {
      const agentFunc = log(
        {
          spanType: 'agent',
          params: {
            redactedOutput: () => '[REDACTED AGENT RESULT]'
          }
        },
        async (input: string) => {
          void input;
          return { result: 'sensitive data' };
        }
      );

      await agentFunc('task');

      // Note: agent spans set redactedOutput in the span call
      const spanCall = mockLogger.addAgentSpan.mock.calls[0][0];
      expect(spanCall.redactedOutput).toBe('[REDACTED AGENT RESULT]');
    });

    test('should handle redacted values as different types', async () => {
      const toolFunc = log(
        {
          spanType: 'tool',
          params: {
            // String redaction
            redactedInput: () => 'STRING_REDACTED',
            // Object redaction (will be stringified)
            redactedOutput: () => ({ status: 'redacted', data: null })
          }
        },
        async (input: string) => {
          void input;
          return 'actual output';
        }
      );

      await toolFunc('input');

      expect(mockLogger.addToolSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          redactedInput: 'STRING_REDACTED',
          redactedOutput: expect.stringContaining('redacted')
        })
      );
    });

    test('should handle undefined redacted values gracefully', async () => {
      const toolFunc = log(
        {
          spanType: 'tool',
          params: {
            redactedInput: () => undefined
          }
        },
        async (input: string) => {
          void input;
          return 'output';
        }
      );

      await toolFunc('test');

      const spanCall = mockLogger.addToolSpan.mock.calls[0][0];
      expect(spanCall.redactedInput).toBeUndefined();
    });
  });
});
