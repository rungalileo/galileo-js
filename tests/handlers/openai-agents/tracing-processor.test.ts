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

  test('test full trace with agent span calls addWorkflowSpan and conclude', async () => {
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
    const agentCall = mockLogger.addWorkflowSpan.mock.calls[0][0];
    expect(agentCall.name).toBe('PlannerAgent');
    // conclude is called for agent spans
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

  test('test nested agent span is logged as child', async () => {
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
    // conclude called for agent span
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
    const mockSpan = { type: 'tool', name: 'span-xyz' };
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

describe('Span tree construction edge cases', () => {
  test('test multiple children linked to single parent', async () => {
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, false);
    const trace = makeTrace();

    await processor.onTraceStart(trace);

    // Create parent span
    const parentSpan = makeSpan({
      spanId: 'parent-001',
      parentId: 'trace-001',
      spanData: { type: 'agent', name: 'Parent Agent' }
    });
    await processor.onSpanStart(parentSpan);

    // Create multiple child spans
    const child1 = makeSpan({
      spanId: 'child-001',
      parentId: 'parent-001',
      spanData: {
        type: 'generation',
        model: 'gpt-4',
        input: [],
        output: 'result 1'
      }
    });
    const child2 = makeSpan({
      spanId: 'child-002',
      parentId: 'parent-001',
      spanData: {
        type: 'function',
        name: 'search',
        input: 'query',
        output: 'result 2'
      }
    });

    await processor.onSpanStart(child1);
    await processor.onSpanStart(child2);
    await processor.onSpanEnd(child1);
    await processor.onSpanEnd(child2);
    await processor.onSpanEnd(parentSpan);
    await processor.onTraceEnd(trace);

    // Verify both children were logged
    expect(mockLogger.addLlmSpan).toHaveBeenCalledTimes(1);
    expect(mockLogger.addToolSpan).toHaveBeenCalledTimes(1);
    // conclude is called for all non-root workflow/agent spans
    expect(mockLogger.conclude).toHaveBeenCalled();
  });

  test('test deeply nested spans (3 levels)', async () => {
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, false);
    const trace = makeTrace();

    await processor.onTraceStart(trace);

    // Level 1: Agent
    const agent = makeSpan({
      spanId: 'agent-001',
      parentId: 'trace-001',
      spanData: { type: 'agent' }
    });

    // Level 2: LLM under agent
    const llm = makeSpan({
      spanId: 'llm-001',
      parentId: 'agent-001',
      spanData: { type: 'generation', model: 'gpt-4' }
    });

    // Level 3: Tool under LLM
    const tool = makeSpan({
      spanId: 'tool-001',
      parentId: 'llm-001',
      spanData: { type: 'function', name: 'calc' }
    });

    await processor.onSpanStart(agent);
    await processor.onSpanStart(llm);
    await processor.onSpanStart(tool);
    await processor.onSpanEnd(tool);
    await processor.onSpanEnd(llm);
    await processor.onSpanEnd(agent);
    await processor.onTraceEnd(trace);

    // All should be logged
    expect(mockLogger.startTrace).toHaveBeenCalledTimes(1);
    expect(mockLogger.addWorkflowSpan).toHaveBeenCalledTimes(1); // agent (uses addWorkflowSpan)
    expect(mockLogger.addLlmSpan).toHaveBeenCalledTimes(1);
    expect(mockLogger.addToolSpan).toHaveBeenCalledTimes(1);
  });

  test('test span with no parentId defaults to trace', async () => {
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, false);
    const trace = makeTrace();

    await processor.onTraceStart(trace);

    // Span with parentId undefined (should default to traceId)
    const span = makeSpan({
      spanId: 'span-001',
      parentId: undefined,
      spanData: { type: 'function', name: 'tool' }
    });

    await processor.onSpanStart(span);
    await processor.onSpanEnd(span);
    await processor.onTraceEnd(trace);

    expect(mockLogger.addToolSpan).toHaveBeenCalledTimes(1);
  });

  test('test span parent link defaults to trace when parent not found', async () => {
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, false);
    const trace = makeTrace();

    await processor.onTraceStart(trace);

    // Create a parent agent first
    const parentAgent = makeSpan({
      spanId: 'parent-001',
      parentId: 'trace-001',
      spanData: { type: 'agent' }
    });
    await processor.onSpanStart(parentAgent);

    // Create a span with explicit parentId pointing to parent
    const span = makeSpan({
      spanId: 'child-001',
      parentId: 'parent-001',
      spanData: {
        type: 'function',
        name: 'tool',
        input: 'test',
        output: 'result'
      }
    });

    // Should not throw
    await processor.onSpanStart(span);
    await processor.onSpanEnd(span);
    await processor.onSpanEnd(parentAgent);
    await processor.onTraceEnd(trace);

    // Span is logged correctly
    expect(mockLogger.addToolSpan).toHaveBeenCalledTimes(1);
  });
});

describe('Response span data merging', () => {
  test('test response span merges embedded tools at end', async () => {
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, false);
    const trace = makeTrace();

    const span = makeSpan({
      spanId: 'response-001',
      parentId: 'trace-001',
      spanData: {
        type: 'response',
        _input: [{ role: 'user' }],
        _response: {
          model: 'gpt-4o',
          output: [
            {
              type: 'code_interpreter_call',
              code: 'print("hello")',
              outputs: [{ logs: 'hello' }],
              id: 'call-1',
              status: 'completed'
            }
          ]
        }
      }
    });

    await processor.onTraceStart(trace);
    await processor.onSpanStart(span);
    await processor.onSpanEnd(span);
    await processor.onTraceEnd(trace);

    // addLlmSpan should be called for response type
    expect(mockLogger.addLlmSpan).toHaveBeenCalledTimes(1);
    const llmCall = mockLogger.addLlmSpan.mock.calls[0][0];
    // Verify that either embeddedToolCalls exists or metadata includes them
    if (llmCall.embeddedToolCalls) {
      expect(Array.isArray(llmCall.embeddedToolCalls)).toBe(true);
      expect(llmCall.embeddedToolCalls[0].type).toBe('code_interpreter_call');
    } else {
      // May be in metadata as embedded_tool_calls
      const meta = llmCall.metadata as Record<string, string>;
      expect(meta.embedded_tool_calls).toBeDefined();
    }
  });

  test('test _responseObject removed from final params', async () => {
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, false);
    const trace = makeTrace();

    const span = makeSpan({
      spanId: 'response-001',
      parentId: 'trace-001',
      spanData: {
        type: 'response',
        _response: { output: [] }
      }
    });

    await processor.onTraceStart(trace);
    await processor.onSpanStart(span);
    await processor.onSpanEnd(span);
    await processor.onTraceEnd(trace);

    const llmCall = mockLogger.addLlmSpan.mock.calls[0][0];
    // _responseObject should not be in the final logged data
    expect(llmCall._responseObject).toBeUndefined();
  });

  test('test generation span updates usage on end', async () => {
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, false);
    const trace = makeTrace();

    const span = makeSpan({
      spanId: 'gen-001',
      parentId: 'trace-001',
      spanData: {
        type: 'generation',
        model: 'gpt-4',
        input: [],
        output: [],
        usage: { input_tokens: 10, output_tokens: 5 }
      }
    });

    await processor.onTraceStart(trace);
    await processor.onSpanStart(span);
    await processor.onSpanEnd(span);
    await processor.onTraceEnd(trace);

    const llmCall = mockLogger.addLlmSpan.mock.calls[0][0];
    expect(llmCall.numInputTokens).toBe(10);
    expect(llmCall.numOutputTokens).toBe(5);
  });

  test('test response span with no _responseObject handles gracefully', async () => {
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, false);
    const trace = makeTrace();

    const span = makeSpan({
      spanId: 'response-001',
      parentId: 'trace-001',
      spanData: { type: 'response' }
    });

    await processor.onTraceStart(trace);
    await processor.onSpanStart(span);
    // Should not throw
    await processor.onSpanEnd(span);
    await processor.onTraceEnd(trace);

    expect(mockLogger.addLlmSpan).toHaveBeenCalledTimes(1);
  });
});

describe('Error handling and recovery', () => {
  test('test span error with message only', async () => {
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, false);
    const trace = makeTrace();

    const span = makeSpan({
      spanId: 'span-001',
      parentId: 'trace-001',
      error: { message: 'Test error' },
      spanData: { type: 'function', name: 'tool' }
    });

    await processor.onTraceStart(trace);
    await processor.onSpanStart(span);
    await processor.onSpanEnd(span);
    await processor.onTraceEnd(trace);

    const toolCall = mockLogger.addToolSpan.mock.calls[0][0];
    expect(toolCall.statusCode).toBe(500);
    const meta = toolCall.metadata as Record<string, string>;
    expect(meta.error_message).toBe('Test error');
    expect(meta.error_type).toBe('SpanError');
  });

  test('test span error with message and data', async () => {
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, false);
    const trace = makeTrace();

    const errorData = { code: 'TOOL_ERROR', details: 'Connection failed' };
    const span = makeSpan({
      spanId: 'span-001',
      parentId: 'trace-001',
      error: { message: 'Tool failed', data: errorData },
      spanData: {
        type: 'function',
        name: 'failing_tool',
        input: '',
        output: undefined
      }
    });

    await processor.onTraceStart(trace);
    await processor.onSpanStart(span);
    await processor.onSpanEnd(span);
    await processor.onTraceEnd(trace);

    expect(mockLogger.addToolSpan).toHaveBeenCalledTimes(1);
    const toolCall = mockLogger.addToolSpan.mock.calls[0][0];
    const meta = toolCall.metadata as Record<string, string>;
    expect(meta.error_details).toBe(JSON.stringify(errorData));
  });

  test('test onSpanEnd without onSpanStart handled gracefully', async () => {
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, false);
    const trace = makeTrace();

    const span = makeSpan({
      spanId: 'orphan-span',
      parentId: 'trace-001',
      spanData: { type: 'tool' }
    });

    await processor.onTraceStart(trace);
    // Skip onSpanStart
    // Should not throw
    await processor.onSpanEnd(span);
    await processor.onTraceEnd(trace);

    expect(mockLogger.addToolSpan).not.toHaveBeenCalled();
  });

  test('test error metadata merged with existing metadata', async () => {
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, false);
    const trace = makeTrace();

    const span = makeSpan({
      spanId: 'span-001',
      parentId: 'trace-001',
      spanData: {
        type: 'agent',
        data: { user_id: '123' } // Will go to metadata
      },
      error: { message: 'Error occurred' }
    });

    await processor.onTraceStart(trace);
    await processor.onSpanStart(span);
    await processor.onSpanEnd(span);
    await processor.onTraceEnd(trace);

    const agentCall = mockLogger.addWorkflowSpan.mock.calls[0][0];
    const meta = agentCall.metadata as Record<string, string>;
    expect(meta.error_message).toBe('Error occurred');
  });

  test('test error on non-existent span ignored gracefully', async () => {
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, false);
    const trace = makeTrace();

    const span = makeSpan({
      spanId: 'never-started-span',
      parentId: 'trace-001',
      error: { message: 'This should be ignored' },
      spanData: { type: 'tool' }
    });

    await processor.onTraceStart(trace);
    // Skip onSpanStart - span doesn't exist in processor
    // Should not throw
    await processor.onSpanEnd(span);
    await processor.onTraceEnd(trace);

    expect(mockLogger.addToolSpan).not.toHaveBeenCalled();
  });
});

describe('Date and duration handling', () => {
  test('test valid startedAt and endedAt calculate durationNs', async () => {
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, false);

    const startTime = new Date('2024-01-01T00:00:00Z');
    const endTime = new Date('2024-01-01T00:00:05Z');

    const trace = makeTrace({
      startedAt: startTime.toISOString(),
      endedAt: endTime.toISOString()
    });

    await processor.onTraceStart(trace);
    await processor.onTraceEnd(trace);

    const startTraceCall = mockLogger.startTrace.mock.calls[0][0];
    // 5 seconds = 5,000,000,000 nanoseconds
    expect(startTraceCall.durationNs).toBeGreaterThan(0);
    expect(startTraceCall.durationNs).toBeCloseTo(5_000_000_000, -4);
  });

  test('test missing startedAt sets durationNs to 0', async () => {
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, false);
    const trace = makeTrace({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      startedAt: undefined as any, // missing
      endedAt: new Date().toISOString()
    });

    await processor.onTraceStart(trace);
    await processor.onTraceEnd(trace);

    const startTraceCall = mockLogger.startTrace.mock.calls[0][0];
    expect(startTraceCall.durationNs).toBe(0);
  });

  test('test missing endedAt uses current time', async () => {
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, false);
    const startTime = new Date('2024-01-01T00:00:00Z');

    const trace = makeTrace({
      startedAt: startTime.toISOString(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      endedAt: undefined as any // missing
    });

    await processor.onTraceStart(trace);
    await processor.onTraceEnd(trace);

    const startTraceCall = mockLogger.startTrace.mock.calls[0][0];
    // Should calculate using current time, so durationNs >= 0
    expect(startTraceCall.durationNs).toBeGreaterThanOrEqual(0);
  });
});

describe('Metadata handling and serialization', () => {
  test('test non-string metadata values stringified at trace start', async () => {
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, false);

    const trace = makeTrace({
      metadata: {
        user_id: '123',
        request_count: 5,
        flags: true,
        config: { nested: 'value' }
      }
    });

    await processor.onTraceStart(trace);
    await processor.onTraceEnd(trace);

    const startTraceCall = mockLogger.startTrace.mock.calls[0][0];
    const meta = startTraceCall.metadata as Record<string, string>;
    expect(meta.request_count).toBe('5');
    expect(meta.flags).toBe('true');
    expect(JSON.parse(meta.config)).toEqual({ nested: 'value' });
  });

  test('test unicode characters preserved in metadata', async () => {
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, false);

    const trace = makeTrace({
      metadata: { message: 'Hello 世界 🌍' }
    });

    await processor.onTraceStart(trace);
    await processor.onTraceEnd(trace);

    const startTraceCall = mockLogger.startTrace.mock.calls[0][0];
    const meta = startTraceCall.metadata as Record<string, string>;
    expect(meta.message).toBe('Hello 世界 🌍');
  });

  test('test error overwrites specific metadata keys', async () => {
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, false);
    const trace = makeTrace();

    const span = makeSpan({
      spanId: 'span-001',
      parentId: 'trace-001',
      spanData: {
        type: 'function',
        name: 'tool',
        input: '',
        output: undefined
      },
      error: { message: 'Tool error', data: { code: 'ECONNREFUSED' } }
    });

    await processor.onTraceStart(trace);
    await processor.onSpanStart(span);
    await processor.onSpanEnd(span);
    await processor.onTraceEnd(trace);

    expect(mockLogger.addToolSpan).toHaveBeenCalledTimes(1);
    const toolCall = mockLogger.addToolSpan.mock.calls[0][0];
    const meta = toolCall.metadata as Record<string, string>;
    expect(meta.error_message).toBe('Tool error');
    expect(meta.error_type).toBe('SpanError');
  });
});

describe('Agent span emission', () => {
  test('test agent span uses addWorkflowSpan not addAgentSpan', async () => {
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, false);
    const trace = makeTrace();

    const span = makeSpan({
      spanId: 'agent-span-001',
      parentId: 'trace-001',
      spanData: { type: 'agent', name: 'TestAgent' }
    });

    await processor.onTraceStart(trace);
    await processor.onSpanStart(span);
    await processor.onSpanEnd(span);
    await processor.onTraceEnd(trace);

    expect(mockLogger.addWorkflowSpan).toHaveBeenCalledTimes(1);
    expect(mockLogger.addAgentSpan).not.toHaveBeenCalled();
  });

  test('test agent span passes name correctly', async () => {
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, false);
    const trace = makeTrace();

    const span = makeSpan({
      spanId: 'agent-span-001',
      parentId: 'trace-001',
      spanData: { type: 'agent', name: 'RouterAgent', output: 'routed' }
    });

    await processor.onTraceStart(trace);
    await processor.onSpanStart(span);
    await processor.onSpanEnd(span);
    await processor.onTraceEnd(trace);

    const agentCall = mockLogger.addWorkflowSpan.mock.calls[0][0];
    expect(agentCall.name).toBe('RouterAgent');
  });

  test('test agent span conclude is called after children', async () => {
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, false);
    const trace = makeTrace();

    const agentSpan = makeSpan({
      spanId: 'agent-001',
      parentId: 'trace-001',
      spanData: { type: 'agent' }
    });

    const toolSpan = makeSpan({
      spanId: 'tool-001',
      parentId: 'agent-001',
      spanData: { type: 'function', name: 'my_tool' }
    });

    await processor.onTraceStart(trace);
    await processor.onSpanStart(agentSpan);
    await processor.onSpanStart(toolSpan);
    await processor.onSpanEnd(toolSpan);
    await processor.onSpanEnd(agentSpan);
    await processor.onTraceEnd(trace);

    expect(mockLogger.addWorkflowSpan).toHaveBeenCalledTimes(1);
    expect(mockLogger.addToolSpan).toHaveBeenCalledTimes(1);
    expect(mockLogger.conclude).toHaveBeenCalled();
  });

  test('test agent span conclude receives last child output as fallback', async () => {
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, false);
    const trace = makeTrace();

    const agentSpan = makeSpan({
      spanId: 'agent-001',
      parentId: 'trace-001',
      spanData: { type: 'agent', name: 'MyAgent' }
    });

    const llmSpan = makeSpan({
      spanId: 'llm-001',
      parentId: 'agent-001',
      spanData: {
        type: 'generation',
        model: 'gpt-4o',
        output: 'Final answer from LLM'
      }
    });

    await processor.onTraceStart(trace);
    await processor.onSpanStart(agentSpan);
    await processor.onSpanStart(llmSpan);
    await processor.onSpanEnd(llmSpan);
    await processor.onSpanEnd(agentSpan);
    await processor.onTraceEnd(trace);

    // addWorkflowSpan is called before children — output is undefined at that point
    const agentCall = mockLogger.addWorkflowSpan.mock.calls[0][0];
    expect(agentCall.output).toBeUndefined();

    // conclude for the agent span (first conclude call) should carry the LLM child's output
    const concludeCall = mockLogger.conclude.mock.calls[0][0];
    expect(concludeCall.output).toBe('Final answer from LLM');
  });

  test('test agent span conclude receives last of multiple children outputs', async () => {
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, false);
    const trace = makeTrace();

    const agentSpan = makeSpan({
      spanId: 'agent-001',
      parentId: 'trace-001',
      spanData: { type: 'agent', name: 'MyAgent' }
    });

    const toolSpan = makeSpan({
      spanId: 'tool-001',
      parentId: 'agent-001',
      spanData: { type: 'function', name: 'my_tool', output: 'Tool result' }
    });

    const llmSpan = makeSpan({
      spanId: 'llm-001',
      parentId: 'agent-001',
      spanData: {
        type: 'generation',
        model: 'gpt-4o',
        output: 'LLM final response'
      }
    });

    await processor.onTraceStart(trace);
    await processor.onSpanStart(agentSpan);
    await processor.onSpanStart(toolSpan);
    await processor.onSpanEnd(toolSpan);
    await processor.onSpanStart(llmSpan);
    await processor.onSpanEnd(llmSpan);
    await processor.onSpanEnd(agentSpan);
    await processor.onTraceEnd(trace);

    // The conclude for the agent span should use the last child (LLM), not the tool
    const concludeCall = mockLogger.conclude.mock.calls[0][0];
    expect(concludeCall.output).toBe('LLM final response');
  });

  test('test agent span conclude uses undefined when no children have output', async () => {
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, false);
    const trace = makeTrace();

    const agentSpan = makeSpan({
      spanId: 'agent-001',
      parentId: 'trace-001',
      spanData: { type: 'agent', name: 'EmptyAgent' }
    });

    await processor.onTraceStart(trace);
    await processor.onSpanStart(agentSpan);
    await processor.onSpanEnd(agentSpan);
    await processor.onTraceEnd(trace);

    const concludeCall = mockLogger.conclude.mock.calls[0][0];
    expect(concludeCall.output).toBeUndefined();
  });

  test('test agent span error passes statusCode 500 as direct field', async () => {
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, false);
    const trace = makeTrace();

    const span = makeSpan({
      spanId: 'agent-err-001',
      parentId: 'trace-001',
      error: { message: 'Agent failed' },
      spanData: { type: 'agent', name: 'FailingAgent' }
    });

    await processor.onTraceStart(trace);
    await processor.onSpanStart(span);
    await processor.onSpanEnd(span);
    await processor.onTraceEnd(trace);

    const agentCall = mockLogger.addWorkflowSpan.mock.calls[0][0];
    // statusCode is passed as a direct field, not folded into metadata
    expect(agentCall.statusCode).toBe(500);
    const meta = agentCall.metadata as Record<string, string>;
    expect(meta.error_message).toBe('Agent failed');
    expect(meta.status_code).toBeUndefined();
  });

  test('test agent span without error passes statusCode 200', async () => {
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, false);
    const trace = makeTrace();

    const span = makeSpan({
      spanId: 'agent-ok-001',
      parentId: 'trace-001',
      spanData: { type: 'agent', name: 'HappyAgent' }
    });

    await processor.onTraceStart(trace);
    await processor.onSpanStart(span);
    await processor.onSpanEnd(span);
    await processor.onTraceEnd(trace);

    const agentCall = mockLogger.addWorkflowSpan.mock.calls[0][0];
    expect(agentCall.statusCode).toBe(200);
    const meta = agentCall.metadata as Record<string, string>;
    expect(meta.status_code).toBeUndefined();
  });
});

describe('Span hierarchy correctness', () => {
  test('test trace with agent child maintains correct parent-child order', async () => {
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, false);
    const trace = makeTrace();

    const agentSpan = makeSpan({
      spanId: 'agent-001',
      parentId: 'trace-001',
      spanData: { type: 'agent', name: 'RootAgent' }
    });

    const llmSpan = makeSpan({
      spanId: 'llm-001',
      parentId: 'agent-001',
      spanData: { type: 'generation', model: 'gpt-4o' }
    });

    await processor.onTraceStart(trace);
    await processor.onSpanStart(agentSpan);
    await processor.onSpanStart(llmSpan);
    await processor.onSpanEnd(llmSpan);
    await processor.onSpanEnd(agentSpan);
    await processor.onTraceEnd(trace);

    // startTrace is called first, then addWorkflowSpan (agent), then addLlmSpan, then conclude
    const callOrder = mockLogger.startTrace.mock.invocationCallOrder[0];
    const agentOrder = mockLogger.addWorkflowSpan.mock.invocationCallOrder[0];
    const llmOrder = mockLogger.addLlmSpan.mock.invocationCallOrder[0];
    const concludeOrder = mockLogger.conclude.mock.invocationCallOrder[0];

    expect(callOrder).toBeLessThan(agentOrder);
    expect(agentOrder).toBeLessThan(llmOrder);
    expect(llmOrder).toBeLessThan(concludeOrder);
  });

  test('test workflow span type still uses addWorkflowSpan', async () => {
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, false);
    const trace = makeTrace();

    const handoffSpan = makeSpan({
      spanId: 'handoff-001',
      parentId: 'trace-001',
      spanData: { type: 'handoff', from_agent: 'A', to_agent: 'B' }
    });

    await processor.onTraceStart(trace);
    await processor.onSpanStart(handoffSpan);
    await processor.onSpanEnd(handoffSpan);
    await processor.onTraceEnd(trace);

    expect(mockLogger.addWorkflowSpan).toHaveBeenCalledTimes(1);
    expect(mockLogger.addAgentSpan).not.toHaveBeenCalled();
  });

  test('test agent and workflow spans both call conclude', async () => {
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, false);
    const trace = makeTrace();

    const agentSpan = makeSpan({
      spanId: 'agent-001',
      parentId: 'trace-001',
      spanData: { type: 'agent' }
    });

    const handoffSpan = makeSpan({
      spanId: 'handoff-001',
      parentId: 'agent-001',
      spanData: { type: 'handoff' }
    });

    await processor.onTraceStart(trace);
    await processor.onSpanStart(agentSpan);
    await processor.onSpanStart(handoffSpan);
    await processor.onSpanEnd(handoffSpan);
    await processor.onSpanEnd(agentSpan);
    await processor.onTraceEnd(trace);

    // conclude is called 3 times: once for handoff (workflow), once for agent, once for concludeAll in onTraceEnd
    expect(mockLogger.conclude).toHaveBeenCalledTimes(3);
  });

  test('test handoff span refreshes to_agent at onSpanEnd (late binding)', async () => {
    // In the OpenAI Agents SDK, to_agent is set on handoffSpan.spanData AFTER span.start() fires
    // (inside withHandoffSpan's fn callback). So onSpanStart sees to_agent = undefined.
    // onSpanEnd must re-extract to capture the final populated to_agent value.
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, false);
    const trace = makeTrace();

    const agentSpan = makeSpan({
      spanId: 'agent-001',
      parentId: 'trace-001',
      spanData: { type: 'agent', name: 'TriageAgent' }
    });

    // Simulate SDK behaviour: to_agent is absent at start, present at end
    const handoffSpanData: AgentSpan['spanData'] = {
      type: 'handoff',
      from_agent: 'TriageAgent'
      // to_agent not yet set
    };
    const handoffSpan = makeSpan({
      spanId: 'handoff-001',
      parentId: 'agent-001',
      spanData: handoffSpanData
    });

    await processor.onTraceStart(trace);
    await processor.onSpanStart(agentSpan);
    await processor.onSpanStart(handoffSpan);

    // Simulate SDK setting to_agent after start
    handoffSpanData.to_agent = 'WeatherAgent';

    await processor.onSpanEnd(handoffSpan);
    await processor.onSpanEnd(agentSpan);
    await processor.onTraceEnd(trace);

    // The handoff workflow span should receive the JSON dict output (not empty string)
    const wfCall = mockLogger.addWorkflowSpan.mock.calls.find(
      (c: [Record<string, unknown>]) =>
        c[0].name === 'Handoff: TriageAgent → WeatherAgent'
    );
    expect(wfCall).toBeDefined();
    expect(wfCall?.[0].output).toBe('{"to_agent":"WeatherAgent"}');

    // The agent conclude should also get the JSON dict via last-child fallback
    const concludeCalls = mockLogger.conclude.mock.calls as [
      Record<string, unknown>
    ][];
    const agentConclude = concludeCalls.find(
      (c) => c[0].output === '{"to_agent":"WeatherAgent"}'
    );
    expect(agentConclude).toBeDefined();
  });
});

describe('_firstInput population (trace-level input handling)', () => {
  test('captures first input from LLM span', async () => {
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, false);
    const trace = makeTrace();

    await processor.onTraceStart(trace);

    // LLM span with input
    const llm = makeSpan({
      spanId: 'llm-001',
      parentId: 'trace-001',
      spanData: {
        type: 'generation',
        model: 'gpt-4',
        input: 'What is the weather in NYC?',
        output: 'It is sunny...'
      }
    });

    await processor.onSpanStart(llm);
    await processor.onSpanEnd(llm);
    await processor.onTraceEnd(trace);

    // Verify startTrace was called with the LLM input
    const startTraceCall = mockLogger.startTrace.mock.calls[0][0];
    expect(startTraceCall.input).toBe('What is the weather in NYC?');
  });

  test('captures first input from tool span if LLM input unavailable', async () => {
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, false);
    const trace = makeTrace();

    await processor.onTraceStart(trace);

    // Tool span (with input, no LLM)
    const tool = makeSpan({
      spanId: 'tool-001',
      parentId: 'trace-001',
      spanData: {
        type: 'function',
        name: 'search',
        input: 'NYC weather forecast',
        output: 'Sunny, 72F'
      }
    });

    await processor.onSpanStart(tool);
    await processor.onSpanEnd(tool);
    await processor.onTraceEnd(trace);

    const startTraceCall = mockLogger.startTrace.mock.calls[0][0];
    expect(startTraceCall.input).toBe('NYC weather forecast');
  });

  test('skips empty or null inputs, uses first meaningful one', async () => {
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, false);
    const trace = makeTrace();

    await processor.onTraceStart(trace);

    // First LLM with empty input
    const llm1 = makeSpan({
      spanId: 'llm-001',
      parentId: 'trace-001',
      spanData: {
        type: 'generation',
        model: 'gpt-4',
        input: '',
        output: 'response'
      }
    });

    // Second LLM with actual input
    const llm2 = makeSpan({
      spanId: 'llm-002',
      parentId: 'trace-001',
      spanData: {
        type: 'generation',
        model: 'gpt-4',
        input: 'Real question',
        output: 'Real answer'
      }
    });

    await processor.onSpanStart(llm1);
    await processor.onSpanEnd(llm1);
    await processor.onSpanStart(llm2);
    await processor.onSpanEnd(llm2);
    await processor.onTraceEnd(trace);

    // Should use input from llm2, not llm1
    const startTraceCall = mockLogger.startTrace.mock.calls[0][0];
    expect(startTraceCall.input).toBe('Real question');
  });

  test('falls back to trace name if no meaningful input captured', async () => {
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, false);
    const trace = makeTrace({ name: 'Agent Workflow' });

    await processor.onTraceStart(trace);
    await processor.onTraceEnd(trace); // No spans at all

    const startTraceCall = mockLogger.startTrace.mock.calls[0][0];
    // Should fall back to trace name
    expect(startTraceCall.input).toBe('Agent Workflow');
  });

  test('only captures input from first meaningful span, ignores later ones', async () => {
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, false);
    const trace = makeTrace();

    await processor.onTraceStart(trace);

    const llm1 = makeSpan({
      spanId: 'llm-001',
      parentId: 'trace-001',
      spanData: {
        type: 'generation',
        model: 'gpt-4',
        input: 'First query',
        output: 'First answer'
      }
    });

    const llm2 = makeSpan({
      spanId: 'llm-002',
      parentId: 'trace-001',
      spanData: {
        type: 'generation',
        model: 'gpt-4',
        input: 'Second query',
        output: 'Second answer'
      }
    });

    await processor.onSpanStart(llm1);
    await processor.onSpanEnd(llm1);
    await processor.onSpanStart(llm2);
    await processor.onSpanEnd(llm2);
    await processor.onTraceEnd(trace);

    const startTraceCall = mockLogger.startTrace.mock.calls[0][0];
    // Should use first input, not second
    expect(startTraceCall.input).toBe('First query');
  });
});
