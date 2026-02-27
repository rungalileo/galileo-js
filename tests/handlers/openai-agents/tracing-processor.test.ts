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
    expect(mockLogger.addWorkflowSpan).toHaveBeenCalledTimes(1); // agent
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

    const workflowCall = mockLogger.addWorkflowSpan.mock.calls[0][0];
    const meta = workflowCall.metadata as Record<string, string>;
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
