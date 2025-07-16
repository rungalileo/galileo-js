import {
  GalileoLogger,
  LlmSpan,
  RetrieverSpan,
  ToolSpan,
  Trace,
  WorkflowSpan
} from '../../src/utils/galileo-logger';
import { Message, MessageRole } from '../../src/types/message.types';
import { Document } from '../../src/types/document.types';
import { randomUUID } from 'crypto';
import { AgentSpan } from '../../src/types';

const mockProjectId = '9b9f20bd-2544-4e7d-ae6e-cdbad391b0b5';
const mockSessionId = '6c4e3f7e-4a9a-4e7e-8c1f-3a9a3a9a3a9e';
const mockPreviousSessionId = '11678e93-b5b9-4215-bd33-9fd4480c3c45';

// Mock the GalileoApiClient
jest.mock('../../src/api-client', () => ({
  GalileoApiClient: jest.fn().mockImplementation(() => ({
    init: jest.fn(),
    ingestTraces: jest.fn(),
    createSession: jest.fn().mockReturnValue({
      id: mockSessionId,
      name: 'test-session',
      project_id: mockProjectId,
      project_name: 'test-project',
      previous_session_id: mockPreviousSessionId,
      external_id: 'test-external-id'
    })
  }))
}));

describe('GalileoLogger', () => {
  let originalEnv: Record<string, string | undefined>;
  let logger: GalileoLogger;

  beforeEach(() => {
    // Store original env variables
    originalEnv = { ...process.env };

    // Set required env variables
    process.env.GALILEO_PROJECT = 'test-project';
    process.env.GALILEO_LOG_STREAM = 'test-log-stream';
  });

  afterEach(() => {
    // Restore original env variables
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should create logger with env variables', () => {
      logger = new GalileoLogger();
      expect(logger).toBeTruthy();
    });

    it('should not throw an error if project or log stream is missing', () => {
      delete process.env.GALILEO_PROJECT;

      logger = new GalileoLogger();
      expect(logger).toBeTruthy();

      process.env.GALILEO_PROJECT = 'test-project';
      delete process.env.GALILEO_LOG_STREAM;

      logger = new GalileoLogger();
      expect(logger).toBeTruthy();

      delete process.env.GALILEO_PROJECT;

      logger = new GalileoLogger();
      expect(logger).toBeTruthy();
    });

    it('should allow custom project and log stream names', () => {
      logger = new GalileoLogger({
        projectName: 'custom-project',
        logStreamName: 'custom-log-stream'
      });
      expect(logger).toBeTruthy();
    });
  });

  describe('GALILEO_DISABLE_LOGGING Environment Variable', () => {
    beforeEach(() => {
      delete process.env.GALILEO_DISABLE_LOGGING;
    });

    it('should enable logging by default when GALILEO_DISABLE_LOGGING is undefined', () => {
      logger = new GalileoLogger();
      expect(logger.isLoggingDisabled()).toBeFalsy();
    });

    it('should enable logging when GALILEO_DISABLE_LOGGING is set to "0"', () => {
      process.env.GALILEO_DISABLE_LOGGING = '0';
      logger = new GalileoLogger();
      expect(logger.isLoggingDisabled()).toBeFalsy();
    });

    it('should enable logging when GALILEO_DISABLE_LOGGING is set to "false"', () => {
      process.env.GALILEO_DISABLE_LOGGING = 'false';
      logger = new GalileoLogger();
      expect(logger.isLoggingDisabled()).toBeFalsy();
    });

    it('should enable logging when GALILEO_DISABLE_LOGGING is set to "FALSE" (case insensitive)', () => {
      process.env.GALILEO_DISABLE_LOGGING = 'FALSE';
      logger = new GalileoLogger();
      expect(logger.isLoggingDisabled()).toBeFalsy();
    });

    it('should disable logging when GALILEO_DISABLE_LOGGING is set to "1"', () => {
      process.env.GALILEO_DISABLE_LOGGING = '1';
      logger = new GalileoLogger();
      expect(logger.isLoggingDisabled()).toBeTruthy();
    });

    it('should disable logging when GALILEO_DISABLE_LOGGING is set to "true"', () => {
      process.env.GALILEO_DISABLE_LOGGING = 'true';
      logger = new GalileoLogger();
      expect(logger.isLoggingDisabled()).toBeTruthy();
    });

    it('should not disable logging when GALILEO_DISABLE_LOGGING is set to an empty string', () => {
      process.env.GALILEO_DISABLE_LOGGING = '';
      logger = new GalileoLogger();
      expect(logger.isLoggingDisabled()).toBeFalsy();
    });

    it('should not disable logging when GALILEO_DISABLE_LOGGING is set to whitespace string', () => {
      process.env.GALILEO_DISABLE_LOGGING = ' ';
      logger = new GalileoLogger();
      expect(logger.isLoggingDisabled()).toBeFalsy();
    });

    it('should disable logging when GALILEO_DISABLE_LOGGING is set to any other string', () => {
      process.env.GALILEO_DISABLE_LOGGING = 'yes';
      logger = new GalileoLogger();
      expect(logger.isLoggingDisabled()).toBeTruthy();
    });
  });

  describe('Logger behavior when logging is disabled', () => {
    beforeEach(() => {
      process.env.GALILEO_DISABLE_LOGGING = 'true';
      logger = new GalileoLogger();
    });

    it('should return empty objects for startTrace when logging is disabled', () => {
      const trace = logger.startTrace({ input: 'test input' });
      expect(trace).toBeInstanceOf(Trace);
      expect(trace.input).toBe('');
      expect(logger['traces'].length).toBe(0); // Verify no trace was added
    });

    it('should return empty objects for addSingleLlmSpanTrace when logging is disabled', () => {
      const trace = logger.addSingleLlmSpanTrace({
        input: 'test input',
        output: 'test output',
        model: 'gpt-4'
      });
      expect(trace).toBeInstanceOf(Trace);
      expect(trace.input).toBe('');
      expect(logger['traces'].length).toBe(0); // Verify no trace was added
    });

    it('should return empty objects for addLlmSpan when logging is disabled', () => {
      // First create a trace (which will be a no-op due to disabled logging)
      logger.startTrace({ input: 'test input' });

      const span = logger.addLlmSpan({
        input: 'test input',
        output: 'test output',
        model: 'gpt-4'
      });

      expect(span).toBeInstanceOf(LlmSpan);
      expect(span.input).toStrictEqual([
        { content: '', role: 'user' } as Message
      ]);
      expect(span.output).toStrictEqual({
        content: '',
        role: 'assistant'
      } as Message);
    });

    it('should return empty objects for addRetrieverSpan when logging is disabled', () => {
      // First create a trace (which will be a no-op due to disabled logging)
      logger.startTrace({ input: 'test input' });

      const span = logger.addRetrieverSpan({
        input: 'test input',
        output: []
      });

      expect(span).toBeInstanceOf(RetrieverSpan);
      expect(span.input).toBe('');
    });

    it('should return empty objects for addToolSpan when logging is disabled', () => {
      // First create a trace (which will be a no-op due to disabled logging)
      logger.startTrace({ input: 'test input' });

      const span = logger.addToolSpan({
        input: 'test input',
        output: 'test output'
      });

      expect(span).toBeInstanceOf(ToolSpan);
      expect(span.input).toBe('');
    });

    it('should return empty objects for addWorkflowSpan when logging is disabled', () => {
      // First create a trace (which will be a no-op due to disabled logging)
      logger.startTrace({ input: 'test input' });

      const span = logger.addWorkflowSpan({
        input: 'test input',
        output: 'test output'
      });

      expect(span).toBeInstanceOf(WorkflowSpan);
      expect(span.input).toBe('');
    });

    it('should return empty objects for addAgentSpan when logging is disabled', () => {
      // First create a trace (which will be a no-op due to disabled logging)
      logger.startTrace({ input: 'test input' });

      const span = logger.addAgentSpan({
        input: 'test input',
        output: 'test output'
      });

      expect(span).toBeInstanceOf(AgentSpan);
      expect(span.input).toBe('');
    });

    it('should return undefined for conclude when logging is disabled', () => {
      // First create a trace (which will be a no-op due to disabled logging)
      logger.startTrace({ input: 'test input' });

      const result = logger.conclude({ output: 'test output' });
      expect(result).toBeUndefined();
    });

    it('should return empty array for flush when logging is disabled', async () => {
      const result = await logger.flush();
      expect(result).toEqual([]);
    });

    it('should not throw error for terminate when logging is disabled', async () => {
      await expect(logger.terminate()).resolves.toBeUndefined();
    });
  });

  describe('Logger behavior when logging is enabled', () => {
    beforeEach(() => {
      process.env.GALILEO_DISABLE_LOGGING = 'false'; // Explicitly enable logging
      logger = new GalileoLogger();
    });

    it('should properly create and store traces when logging is enabled', () => {
      const trace = logger.startTrace({ input: 'test input' });
      expect(trace).toBeInstanceOf(Trace);
      expect(trace.input).toBe('test input');
      expect(logger['traces'].length).toBe(1); // Verify trace was added
    });

    it('should properly create and store LLM spans when logging is enabled', () => {
      logger.startTrace({ input: 'test input' });

      const span = logger.addLlmSpan({
        input: 'test input',
        output: 'test output',
        model: 'gpt-4'
      });

      expect(span).toBeInstanceOf(LlmSpan);
      expect(span.input).toStrictEqual([
        { content: 'test input', role: 'user' } as Message
      ]);
      expect(span.output).toStrictEqual({
        content: 'test output',
        role: 'assistant'
      } as Message);
      expect(span.model).toBe('gpt-4');
    });
  });

  describe('Trace and Span Management', () => {
    beforeEach(() => {
      logger = new GalileoLogger();
    });

    it('should start a trace', () => {
      const trace = logger.startTrace({ input: 'test input' });
      expect(trace).toBeInstanceOf(Trace);
      expect(logger['traces'].length).toBe(1);
    });

    it('should throw error when adding trace while another is in progress', () => {
      logger.startTrace({ input: 'first input' });
      expect(() => logger.startTrace({ input: 'second input' })).toThrow(
        'You must conclude the existing trace'
      );
    });

    it('should add LLM span to trace', () => {
      logger.startTrace({ input: 'test input' });
      const input: Message[] = [{ role: MessageRole.user, content: 'Hello' }];
      const output: Message = {
        role: MessageRole.assistant,
        content: 'Hi there'
      };

      const llmSpan = logger.addLlmSpan({
        input,
        output,
        model: 'test-model'
      });

      expect(llmSpan).toBeInstanceOf(LlmSpan);
    });

    it('should maintain message history integrity when adding LLM spans', () => {
      logger.startTrace({ input: 'test input' });

      // Initial messages
      const messages: Message[] = [
        { role: MessageRole.system, content: 'System message' },
        { role: MessageRole.user, content: 'First user message' }
      ];

      // Add first LLM span
      const firstOutput: Message = {
        role: MessageRole.assistant,
        content: 'First assistant response'
      };
      const firstSpan = logger.addLlmSpan({
        input: messages,
        output: firstOutput,
        model: 'test-model'
      });

      // Modify the original messages array
      messages.push(firstOutput);
      messages.push({ role: MessageRole.user, content: 'Second user message' });

      // Add second LLM span
      const secondOutput: Message = {
        role: MessageRole.assistant,
        content: 'Second assistant response'
      };
      const secondSpan = logger.addLlmSpan({
        input: messages,
        output: secondOutput,
        model: 'test-model'
      });

      // Verify that the first span's input wasn't affected by the modifications
      expect(firstSpan.input).toHaveLength(2);
      expect(firstSpan.input[0].content).toBe('System message');
      expect(firstSpan.input[1].content).toBe('First user message');

      // Verify that the second span has the complete history
      expect(secondSpan.input).toHaveLength(4);
      expect(secondSpan.input[0].content).toBe('System message');
      expect(secondSpan.input[1].content).toBe('First user message');
      expect(secondSpan.input[2].content).toBe('First assistant response');
      expect(secondSpan.input[3].content).toBe('Second user message');
    });

    it('should add retriever span', () => {
      logger.startTrace({ input: 'test input' });
      const document = new Document({ content: 'test content' });

      const retrieverSpan = logger.addRetrieverSpan({
        input: 'search query',
        output: [document]
      });
      expect(retrieverSpan).toBeInstanceOf(RetrieverSpan);
    });

    it('should add tool span', () => {
      logger.startTrace({ input: 'test input' });

      const toolSpan = logger.addToolSpan({
        input: 'tool input',
        output: 'tool output'
      });
      expect(toolSpan).toBeInstanceOf(ToolSpan);
    });

    it('should add workflow span', () => {
      logger.startTrace({ input: 'test input' });

      const workflowSpan = logger.addWorkflowSpan({ input: 'workflow input' });
      expect(workflowSpan).toBeInstanceOf(WorkflowSpan);
    });

    it('should add agent span', () => {
      logger.startTrace({ input: 'test input' });

      const agentSpan = logger.addAgentSpan({ input: 'workflow input' });
      expect(agentSpan).toBeInstanceOf(AgentSpan);
    });
  });

  describe('Trace Conclusion', () => {
    beforeEach(() => {
      logger = new GalileoLogger();
    });

    it('should conclude trace', () => {
      logger.startTrace({ input: 'test input' });
      const concluded = logger.conclude({ output: 'test output' });

      expect(concluded).toBeUndefined();
      expect(logger['parentStack'].length).toBe(0);
    });

    it('should throw error when concluding without an active trace', () => {
      expect(() => logger.conclude({})).toThrow(
        'No existing workflow to conclude'
      );
    });
  });

  describe('Flush Mechanism', () => {
    beforeEach(() => {
      logger = new GalileoLogger();
    });

    it('should flush traces', async () => {
      // Add a trace
      const trace = logger.startTrace({ input: 'test input' });
      const input: Message[] = [{ role: MessageRole.user, content: 'Hello' }];
      const output: Message = {
        role: MessageRole.assistant,
        content: 'Hi there'
      };

      logger.addLlmSpan({ input, output });
      logger.conclude({ output: 'test output' });

      // Mock the API client methods
      const mockInit = jest.spyOn(logger['client'], 'init');
      const mockIngestTraces = jest.spyOn(logger['client'], 'ingestTraces');

      // Flush traces
      const flushedTraces = await logger.flush();

      // Assertions
      expect(mockInit).toHaveBeenCalledWith({
        projectName: undefined,
        logStreamName: undefined,
        experimentId: undefined
      });
      expect(mockIngestTraces).toHaveBeenCalledWith([trace]);
      expect(flushedTraces.length).toBe(1);
      expect(logger['traces'].length).toBe(0);
    });

    it('should handle empty traces during flush', async () => {
      const flushedTraces = await logger.flush();
      expect(flushedTraces.length).toBe(0);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      logger = new GalileoLogger();
    });

    it('should throw error when adding child span without a parent', () => {
      expect(() => {
        const span = new Trace({ input: 'test' });
        logger.addChildSpanToParent(span);
      }).toThrow('A trace needs to be created in order to add a span');
    });
  });

  describe('Single LLM Span Trace', () => {
    beforeEach(() => {
      logger = new GalileoLogger();
    });

    it('should create a single LLM span trace', () => {
      const input: Message[] = [{ role: MessageRole.user, content: 'Hello' }];
      const output: Message = {
        role: MessageRole.assistant,
        content: 'Hi there'
      };

      const trace = logger.addSingleLlmSpanTrace({
        input,
        output,
        model: 'test-model',
        tools: [],
        name: 'test-trace'
      });

      expect(trace).toBeInstanceOf(Trace);
      expect(trace.spans.length).toBe(1);
      expect(trace.spans[0]).toBeInstanceOf(LlmSpan);
      expect(logger['parentStack'].length).toBe(0);
    });

    it('should throw error when creating single LLM span trace with active parent', () => {
      logger.startTrace({ input: 'parent trace' });

      const input: Message[] = [{ role: MessageRole.user, content: 'Hello' }];
      const output: Message = {
        role: MessageRole.assistant,
        content: 'Hi there'
      };

      expect(() => {
        logger.addSingleLlmSpanTrace({ input, output });
      }).toThrow('A trace cannot be created within a parent trace or span');
    });
  });

  describe('Concluding Traces With Open Nested Spans', () => {
    beforeEach(() => {
      logger = new GalileoLogger();
    });

    it('should conclude all open spans when called with concludeAll', async () => {
      logger.startTrace({ input: 'test input' });
      logger.addWorkflowSpan({
        input: 'workflow input 1'
      });
      logger.addWorkflowSpan({
        input: 'workflow input 2'
      });
      logger.addLlmSpan({
        input: 'llm input',
        output: 'llm output'
      });

      const lastOutput = GalileoLogger.getLastOutput(logger.currentParent());
      expect(lastOutput).toBe('{"content":"llm output","role":"assistant"}');

      logger.conclude({ output: lastOutput, concludeAll: true }); // This will conclude both workflow spans and the trace

      const trace = logger.traces[0];

      expect(trace.spans.length).toBe(1);
      expect(trace.spans[0]).toBeInstanceOf(WorkflowSpan);
      expect((trace.spans[0] as WorkflowSpan).spans[0]).toBeInstanceOf(
        WorkflowSpan
      );
      expect((trace.spans[0] as WorkflowSpan).spans[0].output).toBe(lastOutput);
      expect(trace.spans[0].output).toBe(lastOutput);
      expect(trace.output).toBe(lastOutput);
    });

    it('should conclude only the current span with called without concludeAll', async () => {
      logger.startTrace({ input: 'test input' });
      logger.addWorkflowSpan({
        input: 'workflow input 1'
      });
      logger.addWorkflowSpan({
        input: 'workflow input 2'
      });
      logger.addLlmSpan({
        input: 'llm input',
        output: 'llm output'
      });

      const lastOutput = GalileoLogger.getLastOutput(logger.currentParent());
      expect(lastOutput).toBe('{"content":"llm output","role":"assistant"}');

      logger.conclude({ output: lastOutput }); // This will conclude only the current span

      const trace = logger.traces[0];

      expect(trace.spans.length).toBe(1);
      expect(trace.spans[0]).toBeInstanceOf(WorkflowSpan);
      expect((trace.spans[0] as WorkflowSpan).spans[0]).toBeInstanceOf(
        WorkflowSpan
      );
      expect((trace.spans[0] as WorkflowSpan).spans[0].output).toBe(lastOutput);
      expect(trace.spans[0].output).toBe(undefined);
      expect(trace.output).toBe(undefined);
    });

    it('should conclude the trace with concludeAll even when a child span has an undefined output', async () => {
      logger.startTrace({ input: 'test input' });
      logger.addToolSpan({
        input: 'tool input 1'
      });
      const lastOutput = GalileoLogger.getLastOutput(logger.currentParent());
      expect(lastOutput).toBe(undefined);

      logger.conclude({ output: lastOutput, concludeAll: true }); // This will conclude only the current span

      const trace = logger.traces[0];

      expect(trace.spans.length).toBe(1);
      expect(trace.spans[0]).toBeInstanceOf(ToolSpan);
      expect(trace.spans[0].output).toBe(undefined);
      expect(trace.output).toBe(undefined);
    });

    it('should conclude all open spans with concludeAll even when current leaf span has a null output', async () => {
      logger.startTrace({ input: 'test input' });
      logger.addWorkflowSpan({
        input: 'workflow input 1'
      });
      logger.addRetrieverSpan({
        input: 'retriever input',
        output: 'retriever output'
      });
      logger.conclude({ output: 'retriever output' });

      logger.addWorkflowSpan({
        input: 'workflow input 2'
      });

      logger.addWorkflowSpan({
        input: 'workflow input 3'
      });

      const lastOutput = GalileoLogger.getLastOutput(logger.currentParent());
      expect(lastOutput).toBe(undefined);

      logger.conclude({ output: lastOutput, concludeAll: true }); // This will conclude only the current span

      const trace = logger.traces[0];

      expect(trace.spans.length).toBe(2);
      expect(trace.spans[0]).toBeInstanceOf(WorkflowSpan);
      expect((trace.spans[0] as WorkflowSpan).spans[0]).toBeInstanceOf(
        RetrieverSpan
      );
      expect(trace.spans[0].output).toBe('retriever output');
      expect(trace.spans[1]).toBeInstanceOf(WorkflowSpan);
      expect((trace.spans[1] as WorkflowSpan).spans[0]).toBeInstanceOf(
        WorkflowSpan
      );
      expect((trace.spans[1] as WorkflowSpan).spans[0].output).toBe(undefined);
      expect(trace.spans[1].output).toBe(undefined);
      expect(trace.output).toBe(undefined);
    });

    it('should conclude all open spans with concludeAll when flushing', async () => {
      logger.startTrace({ input: 'test input' });
      logger.addWorkflowSpan({
        input: 'workflow input 1'
      });
      logger.addWorkflowSpan({
        input: 'workflow input 2'
      });
      logger.addLlmSpan({
        input: 'llm input',
        output: 'llm output'
      });

      const lastOutput = GalileoLogger.getLastOutput(logger.currentParent());
      expect(lastOutput).toBe('{"content":"llm output","role":"assistant"}');

      const flushedTraces = await logger.flush();
      expect(flushedTraces.length).toBe(1);

      const trace = flushedTraces[0];

      expect(trace.spans.length).toBe(1);
      expect(trace.spans[0]).toBeInstanceOf(WorkflowSpan);
      expect((trace.spans[0] as WorkflowSpan).spans[0]).toBeInstanceOf(
        WorkflowSpan
      );
      expect((trace.spans[0] as WorkflowSpan).spans[0].output).toBe(lastOutput);
      expect(trace.spans[0].output).toBe(lastOutput);
      expect(trace.output).toBe(lastOutput);
    });

    it('should throw error when concluding without an active trace', () => {
      expect(() => logger.conclude({ output: 'test output' })).toThrow(
        'No existing workflow to conclude'
      );
    });
  });

  describe('Validating data on flush', () => {
    beforeEach(() => {
      logger = new GalileoLogger();
    });

    it('should validate trace and span data on flush', async () => {
      const createdAt = new Date();
      logger.startTrace({
        input: 'test input',
        name: 'test trace',
        createdAt,
        durationNs: 1000,
        metadata: { test: 'trace test' },
        tags: ['trace test'],
        datasetInput: 'dataset input',
        datasetOutput: 'dataset output',
        datasetMetadata: { test: 'dataset test' }
      });
      logger.addWorkflowSpan({
        input: 'workflow input',
        name: 'workflow span',
        createdAt,
        durationNs: 1000,
        metadata: { test: 'workflow test' },
        tags: ['workflow test'],
        stepNumber: 1
      });
      logger.addRetrieverSpan({
        input: 'retriever input',
        output: 'retriever output',
        name: 'retriever span',
        createdAt,
        durationNs: 1000,
        metadata: { test: 'retriever test' },
        tags: ['retriever test'],
        statusCode: 200,
        stepNumber: 2
      });
      logger.addLlmSpan({
        input: 'llm input',
        output: 'llm output',
        name: 'llm span',
        createdAt,
        durationNs: 1000,
        metadata: { test: 'llm test' },
        tags: ['llm test'],
        numInputTokens: 1,
        numOutputTokens: 1,
        totalTokens: 2,
        timeToFirstTokenNs: 1000,
        temperature: 0.7,
        statusCode: 200,
        stepNumber: 3
      });

      logger.conclude({ output: 'workflow output', statusCode: 200 });
      logger.conclude({ output: 'trace output', statusCode: 200 });

      const flushedTraces = await logger.flush();
      expect(flushedTraces.length).toBe(1);

      const trace = flushedTraces[0];
      expect(trace.input).toBe('test input');
      expect(trace.output).toBe('trace output');
      expect(trace.name).toBe('test trace');
      expect(trace.createdAt).toBe(createdAt);
      expect(trace.metrics.durationNs).toBe(1000);
      expect(trace.userMetadata).toEqual({ test: 'trace test' });
      expect(trace.tags).toEqual(['trace test']);
      expect(trace.statusCode).toBe(200);
      expect(trace.datasetInput).toBe('dataset input');
      expect(trace.datasetOutput).toBe('dataset output');
      expect(trace.datasetMetadata).toEqual({ test: 'dataset test' });

      expect(trace.spans.length).toBe(1);
      expect(trace.spans[0]).toBeInstanceOf(WorkflowSpan);

      const workflowSpan = trace.spans[0] as WorkflowSpan;
      expect(workflowSpan.input).toBe('workflow input');
      expect(workflowSpan.output).toBe('workflow output');
      expect(workflowSpan.name).toBe('workflow span');
      expect(workflowSpan.createdAt).toBe(createdAt);
      expect(workflowSpan.metrics.durationNs).toBe(1000);
      expect(workflowSpan.userMetadata).toEqual({ test: 'workflow test' });
      expect(workflowSpan.tags).toEqual(['workflow test']);
      expect(workflowSpan.statusCode).toBe(200);
      expect(workflowSpan.stepNumber).toBe(1);
      expect(workflowSpan.datasetInput).toBe('dataset input');
      expect(workflowSpan.datasetOutput).toBe('dataset output');
      expect(workflowSpan.datasetMetadata).toEqual({ test: 'dataset test' });

      expect(workflowSpan.spans.length).toBe(2);

      const retrieverSpan = workflowSpan.spans[0] as RetrieverSpan;
      expect(retrieverSpan.input).toBe('retriever input');
      expect(retrieverSpan.output).toEqual([
        { content: 'retriever output', metadata: {} }
      ]);
      expect(retrieverSpan.name).toBe('retriever span');
      expect(retrieverSpan.createdAt).toBe(createdAt);
      expect(retrieverSpan.metrics.durationNs).toBe(1000);
      expect(retrieverSpan.userMetadata).toEqual({ test: 'retriever test' });
      expect(retrieverSpan.tags).toEqual(['retriever test']);
      expect(retrieverSpan.statusCode).toBe(200);
      expect(retrieverSpan.stepNumber).toBe(2);
      expect(retrieverSpan.datasetInput).toBe('dataset input');
      expect(retrieverSpan.datasetOutput).toBe('dataset output');
      expect(retrieverSpan.datasetMetadata).toEqual({ test: 'dataset test' });

      const llmSpan = workflowSpan.spans[1] as LlmSpan;
      expect(llmSpan.input).toEqual([{ content: 'llm input', role: 'user' }]);
      expect(llmSpan.output).toEqual({
        content: 'llm output',
        role: 'assistant'
      });
      expect(llmSpan.name).toBe('llm span');
      expect(llmSpan.createdAt).toBe(createdAt);
      expect(llmSpan.metrics.durationNs).toBe(1000);
      expect(llmSpan.metrics.numInputTokens).toBe(1);
      expect(llmSpan.metrics.numOutputTokens).toBe(1);
      expect(llmSpan.metrics.numTotalTokens).toBe(2);
      expect(llmSpan.metrics.timeToFirstTokenNs).toBe(1000);
      expect(llmSpan.userMetadata).toEqual({ test: 'llm test' });
      expect(llmSpan.tags).toEqual(['llm test']);
      expect(llmSpan.statusCode).toBe(200);
      expect(llmSpan.stepNumber).toBe(3);
      expect(llmSpan.datasetInput).toBe('dataset input');
      expect(llmSpan.datasetOutput).toBe('dataset output');
      expect(llmSpan.datasetMetadata).toEqual({ test: 'dataset test' });
    });
  });

  describe('Serializing spans', () => {
    beforeEach(() => {
      logger = new GalileoLogger();
    });

    it('should serialize token values correctly', () => {
      const createdAt = new Date();

      logger.startTrace({
        input: 'test input',
        name: 'test trace',
        createdAt,
        durationNs: 1000,
        metadata: { test: 'trace test' },
        tags: ['trace test']
      });

      const llmSpan = logger.addLlmSpan({
        input: 'llm input',
        output: 'llm output',
        name: 'llm span',
        createdAt,
        durationNs: 1000,
        metadata: { test: 'llm test' },
        tags: ['llm test'],
        numInputTokens: 1,
        numOutputTokens: 1,
        totalTokens: 2,
        timeToFirstTokenNs: 1000,
        temperature: 0.7,
        statusCode: 200,
        stepNumber: 3
      });

      logger.conclude({ output: 'trace output', statusCode: 200 });

      const serializedSpan = llmSpan.toJSON();
      expect(serializedSpan['metrics']['num_input_tokens']).toBe(1);
      expect(serializedSpan['metrics']['num_output_tokens']).toBe(1);
      expect(serializedSpan['metrics']['num_total_tokens']).toBe(2);
      expect(serializedSpan['metrics']['time_to_first_token_ns']).toBe(1000);
      expect(serializedSpan['metrics']['duration_ns']).toBe(1000);
    });

    it('should serialize duration values correctly', () => {
      const createdAt = new Date();

      logger.startTrace({
        input: 'test input',
        name: 'test trace',
        createdAt,
        durationNs: 1000,
        metadata: { test: 'trace test' },
        tags: ['trace test']
      });

      const workflowSpan = logger.addWorkflowSpan({
        input: 'workflow input',
        name: 'workflow span',
        createdAt,
        durationNs: 1000
      });

      const agentSpan = logger.addAgentSpan({
        input: 'agent input',
        output: 'agent output',
        name: 'agent span',
        createdAt,
        durationNs: 2000
      });

      const llmSpan = logger.addLlmSpan({
        input: 'llm input',
        output: 'llm output',
        name: 'llm span',
        createdAt,
        durationNs: 3000
      });

      const retrieverSpan = logger.addRetrieverSpan({
        input: 'retriever input',
        output: 'retriever output',
        name: 'retriever span',
        createdAt,
        durationNs: 4000
      });

      const toolSpan = logger.addToolSpan({
        input: 'tool input',
        output: 'tool output',
        name: 'tool span',
        createdAt,
        durationNs: 5000
      });

      logger.conclude({ output: 'Workflow span output', statusCode: 200 });
      logger.conclude({ output: 'trace output', statusCode: 200 });

      const serializedWorkflowSpan = workflowSpan.toJSON();
      expect(serializedWorkflowSpan['metrics']['duration_ns']).toBe(1000);

      const serializedAgentSpan = agentSpan.toJSON();
      expect(serializedAgentSpan['metrics']['duration_ns']).toBe(2000);

      const serializedLlmSpan = llmSpan.toJSON();
      expect(serializedLlmSpan['metrics']['duration_ns']).toBe(3000);

      const serializedRetrieverSpan = retrieverSpan.toJSON();
      expect(serializedRetrieverSpan['metrics']['duration_ns']).toBe(4000);

      const serializedToolSpan = toolSpan.toJSON();
      expect(serializedToolSpan['metrics']['duration_ns']).toBe(5000);
    });
  });

  describe('Session Management', () => {
    beforeEach(() => {
      logger = new GalileoLogger({
        projectName: 'test-project',
        logStreamName: 'test-log-stream'
      });
    });

    it('should create a new session when startSession is called', async () => {
      expect(logger.currentSessionId()).toBeUndefined();
      const sessionId = await logger.startSession({
        name: 'test session',
        previousSessionId: '6c4e3f7e-4a9a-4e7e-8c1f-3a9a3a9a3a9d',
        externalId: 'test'
      });
      expect(logger.currentSessionId()).toBe(sessionId);
      expect(logger.currentSessionId()).toBe(
        '6c4e3f7e-4a9a-4e7e-8c1f-3a9a3a9a3a9e'
      );
    });

    it('should clear the current session when clearSession is called', async () => {
      expect(logger.currentSessionId()).toBeUndefined();
      await logger.startSession({
        name: 'test session',
        previousSessionId: '6c4e3f7e-4a9a-4e7e-8c1f-3a9a3a9a3a9d',
        externalId: 'test'
      });
      expect(logger.currentSessionId()).toBe(
        '6c4e3f7e-4a9a-4e7e-8c1f-3a9a3a9a3a9e'
      );
      logger.clearSession();
      expect(logger.currentSessionId()).toBeUndefined();
    });

    it('should include the session ID when flushing traces', async () => {
      const mockInit = jest.spyOn(logger['client'], 'init');
      const mockIngestTraces = jest.spyOn(logger['client'], 'ingestTraces');

      expect(logger.currentSessionId()).toBeUndefined();
      await logger.startSession({
        name: 'test session',
        previousSessionId: mockPreviousSessionId,
        externalId: 'test'
      });

      logger.startTrace({ input: 'trace input' });
      logger.addWorkflowSpan({ input: 'test input' });
      logger.conclude({ output: 'test output', concludeAll: true });

      await logger.flush();
      expect(mockInit).toHaveBeenCalledWith({
        projectName: 'test-project',
        logStreamName: 'test-log-stream',
        experimentId: undefined,
        sessionId: mockSessionId
      });
      expect(mockIngestTraces).toHaveBeenCalledWith(expect.any(Array));
    });

    it('should allow setting the session ID manually', async () => {
      const mockInit = jest.spyOn(logger['client'], 'init');
      const mockIngestTraces = jest.spyOn(logger['client'], 'ingestTraces');
      expect(logger.currentSessionId()).toBeUndefined();

      // Instead of starting a session, we set the session ID directly
      const sessionId = randomUUID();
      logger.setSessionId(sessionId);

      logger.startTrace({ input: 'trace input' });
      logger.addWorkflowSpan({ input: 'test input' });
      logger.conclude({ output: 'test output', concludeAll: true });

      await logger.flush();
      expect(mockInit).toHaveBeenCalledWith({
        projectName: 'test-project',
        logStreamName: 'test-log-stream',
        experimentId: undefined,
        sessionId: sessionId
      });
      expect(mockIngestTraces).toHaveBeenCalledWith(expect.any(Array));
    });
  });
});
