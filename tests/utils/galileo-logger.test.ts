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

    it('should throw error if project or log stream is missing', () => {
      delete process.env.GALILEO_PROJECT;
      expect(() => new GalileoLogger()).toThrow(
        'User must provide projectName to GalileoLogger, or set it as an environment variable.'
      );

      process.env.GALILEO_PROJECT = 'test-project';
      delete process.env.GALILEO_LOG_STREAM;
      expect(() => new GalileoLogger()).toThrow(
        'User must provide projectName and logStreamName to GalileoLogger, or set them as environment variables.'
      );
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
      const trace = logger.startTrace('test input');
      expect(trace).toBeInstanceOf(Trace);
      expect(logger['traces'].length).toBe(1);
    });

    it('should throw error when adding trace while another is in progress', () => {
      logger.startTrace('first input');
      expect(() => logger.startTrace('second input')).toThrow(
        'You must conclude the existing trace'
      );
    });

    it('should add LLM span to trace', () => {
      logger.startTrace('test input');
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
      logger.startTrace('test input');
      const document = new Document({ content: 'test content' });

      const retrieverSpan = logger.addRetrieverSpan('search query', [document]);
      expect(retrieverSpan).toBeInstanceOf(RetrieverSpan);
    });

    it('should add tool span', () => {
      logger.startTrace('test input');

      const toolSpan = logger.addToolSpan('tool input', 'tool output');
      expect(toolSpan).toBeInstanceOf(ToolSpan);
    });

    it('should add workflow span', () => {
      logger.startTrace('test input');

      const workflowSpan = logger.addWorkflowSpan('workflow input');
      expect(workflowSpan).toBeInstanceOf(WorkflowSpan);
    });
  });

  describe('Trace Conclusion', () => {
    beforeEach(() => {
      logger = new GalileoLogger();
    });

    it('should conclude trace', () => {
      logger.startTrace('test input');
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
      const trace = logger.startTrace('test input');
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
        projectType: 'gen_ai',
        projectName: 'test-project',
        logStreamName: 'test-log-stream'
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

      const trace = logger.addSingleLlmSpanTrace(
        input,
        output,
        'test-model',
        [],
        'test-trace'
      );

      expect(trace).toBeInstanceOf(Trace);
      expect(trace.spans.length).toBe(1);
      expect(trace.spans[0]).toBeInstanceOf(LlmSpan);
      expect(logger['parentStack'].length).toBe(0);
    });

    it('should throw error when creating single LLM span trace with active parent', () => {
      logger.startTrace('parent trace');

      const input: Message[] = [{ role: MessageRole.user, content: 'Hello' }];
      const output: Message = {
        role: MessageRole.assistant,
        content: 'Hi there'
      };

      expect(() => {
        logger.addSingleLlmSpanTrace(input, output);
      }).toThrow('A trace cannot be created within a parent trace or span');
    });
  });
});
