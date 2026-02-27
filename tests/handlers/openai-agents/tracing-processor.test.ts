import { GalileoTracingProcessor } from '../../../src/handlers/openai-agents';
import type {
  AgentTrace,
  AgentSpan
} from '../../../src/handlers/openai-agents';

// Helper to build a mock AgentTrace
function makeTrace(overrides: Partial<AgentTrace> = {}): AgentTrace {
  return {
    traceId: 'trace-001',
    name: 'Test Agent Run',
    metadata: {},
    startedAt: new Date('2024-01-01T00:00:00Z').toISOString(),
    endedAt: new Date('2024-01-01T00:00:10Z').toISOString(),
    ...overrides
  };
}

// Helper to build a mock AgentSpan
function makeSpan(
  overrides: Partial<AgentSpan> & { spanData: AgentSpan['spanData'] }
): AgentSpan {
  return {
    spanId: 'span-001',
    traceId: 'trace-001',
    parentId: 'trace-001',
    startedAt: new Date('2024-01-01T00:00:01Z').toISOString(),
    endedAt: new Date('2024-01-01T00:00:05Z').toISOString(),
    error: null,
    ...overrides
  };
}

// Create a mock GalileoLogger for testing
function createMockLogger() {
  return {
    startTrace: jest.fn().mockReturnValue({}),
    addLlmSpan: jest.fn().mockReturnValue({}),
    addToolSpan: jest.fn().mockReturnValue({}),
    addWorkflowSpan: jest.fn().mockReturnValue({}),
    addAgentSpan: jest.fn().mockReturnValue({}),
    conclude: jest.fn().mockReturnValue(undefined),
    flush: jest.fn().mockResolvedValue(undefined)
  };
}

describe('GalileoTracingProcessor lifecycle', () => {
  test('test onTraceStart creates root node', async () => {
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, false);
    const trace = makeTrace();

    await processor.onTraceStart(trace);
    // No external observable yet — verify no calls to logger
    expect(mockLogger.startTrace).not.toHaveBeenCalled();
  });

  test('test full trace lifecycle calls startTrace', async () => {
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, false);
    const trace = makeTrace();

    await processor.onTraceStart(trace);
    await processor.onTraceEnd(trace);

    expect(mockLogger.startTrace).toHaveBeenCalledTimes(1);
    const startTraceCall = mockLogger.startTrace.mock.calls[0][0];
    expect(startTraceCall.name).toBe('Test Agent Run');
  });

  test('test full trace with llm span calls addLlmSpan', async () => {
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, false);
    const trace = makeTrace();
    const span = makeSpan({
      spanId: 'span-gen-001',
      parentId: 'trace-001',
      spanData: {
        type: 'generation',
        model: 'gpt-4o',
        input: [{ role: 'user', content: 'hello' }],
        output: [{ role: 'assistant', content: 'hi' }],
        usage: { input_tokens: 5, output_tokens: 3 }
      }
    });

    await processor.onTraceStart(trace);
    await processor.onSpanStart(span);
    await processor.onSpanEnd(span);
    await processor.onTraceEnd(trace);

    expect(mockLogger.addLlmSpan).toHaveBeenCalledTimes(1);
    const llmCall = mockLogger.addLlmSpan.mock.calls[0][0];
    expect(llmCall.model).toBe('gpt-4o');
    expect(llmCall.numInputTokens).toBe(5);
    expect(llmCall.numOutputTokens).toBe(3);
  });

  test('test full trace with tool span calls addToolSpan', async () => {
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, false);
    const trace = makeTrace();
    const span = makeSpan({
      spanId: 'span-func-001',
      parentId: 'trace-001',
      spanData: {
        type: 'function',
        name: 'search_tool',
        input: '{"query":"hello"}',
        output: 'results'
      }
    });

    await processor.onTraceStart(trace);
    await processor.onSpanStart(span);
    await processor.onSpanEnd(span);
    await processor.onTraceEnd(trace);

    expect(mockLogger.addToolSpan).toHaveBeenCalledTimes(1);
    const toolCall = mockLogger.addToolSpan.mock.calls[0][0];
    expect(toolCall.name).toBe('search_tool');
  });

  test('test full trace with workflow span calls addWorkflowSpan and conclude', async () => {
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, false);
    const trace = makeTrace();
    const span = makeSpan({
      spanId: 'span-agent-001',
      parentId: 'trace-001',
      spanData: {
        type: 'agent',
        name: 'PlannerAgent'
      }
    });

    await processor.onTraceStart(trace);
    await processor.onSpanStart(span);
    await processor.onSpanEnd(span);
    await processor.onTraceEnd(trace);

    expect(mockLogger.addWorkflowSpan).toHaveBeenCalledTimes(1);
    const workflowCall = mockLogger.addWorkflowSpan.mock.calls[0][0];
    expect(workflowCall.name).toBe('PlannerAgent');
    // conclude is called for workflow spans
    expect(mockLogger.conclude).toHaveBeenCalled();
  });

  test('test error span sets status 500 in metadata', async () => {
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, false);
    const trace = makeTrace();
    const span = makeSpan({
      spanId: 'span-err-001',
      parentId: 'trace-001',
      error: { message: 'Something went wrong', data: { code: 'ERR_001' } },
      spanData: { type: 'function', name: 'failing_tool', input: 'x' }
    });

    await processor.onTraceStart(trace);
    await processor.onSpanStart(span);
    await processor.onSpanEnd(span);
    await processor.onTraceEnd(trace);

    expect(mockLogger.addToolSpan).toHaveBeenCalledTimes(1);
    const toolCall = mockLogger.addToolSpan.mock.calls[0][0];
    expect(toolCall.statusCode).toBe(500);
    expect(toolCall.metadata.error_message).toBe('Something went wrong');
    expect(toolCall.metadata.error_type).toBe('SpanError');
  });

  test('test flushOnTraceEnd true calls flush', async () => {
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, true);
    const trace = makeTrace();

    await processor.onTraceStart(trace);
    await processor.onTraceEnd(trace);

    expect(mockLogger.flush).toHaveBeenCalledTimes(1);
  });

  test('test flushOnTraceEnd false does not call flush', async () => {
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, false);
    const trace = makeTrace();

    await processor.onTraceStart(trace);
    await processor.onTraceEnd(trace);

    expect(mockLogger.flush).not.toHaveBeenCalled();
  });

  test('test shutdown calls flush', async () => {
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, false);

    await processor.shutdown();

    expect(mockLogger.flush).toHaveBeenCalledTimes(1);
  });

  test('test forceFlush calls flush', async () => {
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, false);

    await processor.forceFlush();

    expect(mockLogger.flush).toHaveBeenCalledTimes(1);
  });

  test('test nested workflow span is logged as child', async () => {
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, false);
    const trace = makeTrace();

    const agentSpan = makeSpan({
      spanId: 'span-agent-outer',
      parentId: 'trace-001',
      spanData: { type: 'agent', name: 'OuterAgent' }
    });

    const llmSpan = makeSpan({
      spanId: 'span-llm-inner',
      parentId: 'span-agent-outer',
      spanData: {
        type: 'generation',
        model: 'gpt-4o',
        usage: { input_tokens: 2, output_tokens: 1 }
      }
    });

    await processor.onTraceStart(trace);
    await processor.onSpanStart(agentSpan);
    await processor.onSpanStart(llmSpan);
    await processor.onSpanEnd(llmSpan);
    await processor.onSpanEnd(agentSpan);
    await processor.onTraceEnd(trace);

    expect(mockLogger.addWorkflowSpan).toHaveBeenCalledTimes(1);
    expect(mockLogger.addLlmSpan).toHaveBeenCalledTimes(1);
    // conclude called for workflow span
    expect(mockLogger.conclude).toHaveBeenCalled();
  });

  test('test response span extracts embedded tool calls', async () => {
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, false);
    const trace = makeTrace();
    const span = makeSpan({
      spanId: 'span-resp-001',
      parentId: 'trace-001',
      spanData: {
        type: 'response',
        _input: 'test input',
        _response: {
          model: 'gpt-4o',
          usage: { input_tokens: 10, output_tokens: 5 },
          output: [
            {
              type: 'web_search_call',
              id: 'ws_001',
              action: { query: 'latest news' }
            }
          ]
        }
      }
    });

    await processor.onTraceStart(trace);
    await processor.onSpanStart(span);
    await processor.onSpanEnd(span);
    await processor.onTraceEnd(trace);

    expect(mockLogger.addLlmSpan).toHaveBeenCalledTimes(1);
    const llmCall = mockLogger.addLlmSpan.mock.calls[0][0];
    expect(llmCall.metadata.embedded_tool_calls).toBeDefined();
    const embedded = JSON.parse(llmCall.metadata.embedded_tool_calls);
    expect(embedded.length).toBe(1);
    expect(embedded[0].type).toBe('web_search_call');
  });

  test('test metadata values are stringified', async () => {
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, false);
    const trace = makeTrace({
      metadata: { run_id: 'abc123', count: 5 as unknown as string }
    });

    await processor.onTraceStart(trace);
    await processor.onTraceEnd(trace);

    expect(mockLogger.startTrace).toHaveBeenCalledTimes(1);
    const startCall = mockLogger.startTrace.mock.calls[0][0];
    // metadata values should all be strings
    if (startCall.metadata) {
      for (const v of Object.values(startCall.metadata)) {
        expect(typeof v).toBe('string');
      }
    }
  });

  test('test addGalileoCustomSpan creates a GalileoCustomSpanData', () => {
    const mockSpan = { id: 'span-xyz' };
    const result = GalileoTracingProcessor.addGalileoCustomSpan(
      mockSpan,
      'MyCustom'
    );
    expect(result.type).toBe('custom');
    expect(result.__galileoCustom).toBe(true);
    expect(result.data.galileoSpan).toBe(mockSpan);
    expect(result.name).toBe('MyCustom');
  });
});
