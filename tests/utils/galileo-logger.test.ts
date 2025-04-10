import {
  GalileoLogger,
  Trace,
  LlmSpan,
  RetrieverSpan,
  ToolSpan,
  WorkflowSpan
} from '../../src/utils/galileo-logger';
import { Message, MessageRole } from '../../src/types/message.types';
import { Document } from '../../src/types/document.types';

// Mock the GalileoApiClient
jest.mock('../../src/api-client', () => ({
  GalileoApiClient: jest.fn().mockImplementation(() => ({
    init: jest.fn(),
    ingestTraces: jest.fn()
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
});
