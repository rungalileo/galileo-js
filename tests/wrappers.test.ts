import { log } from '../src/wrappers';
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
  isLoggingDisabled: jest.fn().mockReturnValue(false)
};

jest.mock('../src/utils/galileo-logger', () => ({
  GalileoLogger: jest.fn().mockImplementation(() => mockLogger)
}));

describe('log wrapper', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
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

      expect(mockLogger.addToolSpan).toHaveBeenCalledWith(
        expect.objectContaining({ createdAt })
      );
      expect(mockLogger.conclude).toHaveBeenCalledTimes(1);
      const conclusion = mockLogger.conclude.mock.calls[0][0];
      expect(conclusion.durationNs).toBeGreaterThan(0);
    });

    test('should handle createdAt as a number (timestamp)', async () => {
      const createdAtTimestamp = 1672531200000; // 2023-01-01T00:00:00.000Z
      const expectedDate = new Date(createdAtTimestamp);
      const func = async (input: string, createdAt: number) =>
        `processed: ${input}, ${createdAt}`;
      const wrappedFunc = log({ spanType: 'tool' }, func);

      await wrappedFunc('test', createdAtTimestamp);

      expect(mockLogger.addToolSpan).toHaveBeenCalledWith(
        expect.objectContaining({ createdAt: expectedDate })
      );
    });

    test('should handle createdAt as a string', async () => {
      const createdAtString = '2023-01-01T00:00:00.000Z';
      const expectedDate = new Date(createdAtString);
      const func = async (input: string, createdAt: string) =>
        `processed: ${input}, ${createdAt}`;
      const wrappedFunc = log({ spanType: 'tool' }, func);

      await wrappedFunc('test', createdAtString);

      expect(mockLogger.addToolSpan).toHaveBeenCalledWith(
        expect.objectContaining({ createdAt: expectedDate })
      );
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
          output: JSON.stringify(output)
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
});
