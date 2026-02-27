import { GalileoTracingProcessor } from '../../../src/handlers/openai-agents';
import type {
  AgentTrace,
  AgentSpan
} from '../../../src/handlers/openai-agents';

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

function makeTrace(overrides: Partial<AgentTrace> = {}): AgentTrace {
  return {
    traceId: 'trace-001',
    name: 'Multi-Agent Flow',
    metadata: {},
    startedAt: new Date('2024-01-01T00:00:00Z').toISOString(),
    endedAt: new Date('2024-01-01T00:00:05Z').toISOString(),
    ...overrides
  };
}

function makeSpan(
  overrides: Partial<AgentSpan> & { spanData: AgentSpan['spanData'] }
): AgentSpan {
  return {
    spanId: 'span-001',
    traceId: 'trace-001',
    parentId: 'trace-001',
    startedAt: new Date('2024-01-01T00:00:01Z').toISOString(),
    endedAt: new Date('2024-01-01T00:00:02Z').toISOString(),
    error: null,
    ...overrides
  };
}

describe('Multi-agent integration flows', () => {
  test('test multiple agents with handoff', async () => {
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, false);
    const trace = makeTrace();

    await processor.onTraceStart(trace);

    // PlannerAgent
    const planner = makeSpan({
      spanId: 'agent-planner',
      parentId: 'trace-001',
      spanData: { type: 'agent', name: 'PlannerAgent' }
    });

    // Handoff to ExecutorAgent
    const handoff = makeSpan({
      spanId: 'handoff-001',
      parentId: 'agent-planner',
      spanData: {
        type: 'handoff',
        from_agent: 'PlannerAgent',
        to_agent: 'ExecutorAgent'
      }
    });

    // ExecutorAgent
    const executor = makeSpan({
      spanId: 'agent-executor',
      parentId: 'handoff-001',
      spanData: { type: 'agent', name: 'ExecutorAgent' }
    });

    await processor.onSpanStart(planner);
    await processor.onSpanStart(handoff);
    await processor.onSpanStart(executor);
    await processor.onSpanEnd(executor);
    await processor.onSpanEnd(handoff);
    await processor.onSpanEnd(planner);
    await processor.onTraceEnd(trace);

    // Verify all spans logged
    expect(mockLogger.addWorkflowSpan).toHaveBeenCalledTimes(3); // 2 agents + 1 handoff
  });

  test('test agent->tool->llm->tool flow', async () => {
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, false);
    const trace = makeTrace();

    await processor.onTraceStart(trace);

    const agent = makeSpan({
      spanId: 'agent-001',
      parentId: 'trace-001',
      spanData: { type: 'agent' }
    });

    const tool1 = makeSpan({
      spanId: 'tool-001',
      parentId: 'agent-001',
      spanData: { type: 'function', name: 'search' }
    });

    const llm = makeSpan({
      spanId: 'llm-001',
      parentId: 'agent-001',
      spanData: { type: 'generation', model: 'gpt-4' }
    });

    const tool2 = makeSpan({
      spanId: 'tool-002',
      parentId: 'agent-001',
      spanData: { type: 'function', name: 'calculate' }
    });

    await processor.onSpanStart(agent);
    await processor.onSpanStart(tool1);
    await processor.onSpanEnd(tool1);
    await processor.onSpanStart(llm);
    await processor.onSpanEnd(llm);
    await processor.onSpanStart(tool2);
    await processor.onSpanEnd(tool2);
    await processor.onSpanEnd(agent);
    await processor.onTraceEnd(trace);

    expect(mockLogger.addWorkflowSpan).toHaveBeenCalledTimes(1); // agent
    expect(mockLogger.addToolSpan).toHaveBeenCalledTimes(2); // 2 tools
    expect(mockLogger.addLlmSpan).toHaveBeenCalledTimes(1); // 1 llm
  });

  test('test guardrail triggered in flow', async () => {
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, false);
    const trace = makeTrace();

    await processor.onTraceStart(trace);

    const agent = makeSpan({
      spanId: 'agent-001',
      parentId: 'trace-001',
      spanData: { type: 'agent' }
    });

    const guardrail = makeSpan({
      spanId: 'guardrail-001',
      parentId: 'agent-001',
      spanData: { type: 'guardrail', name: 'PII Filter', triggered: true }
    });

    await processor.onSpanStart(agent);
    await processor.onSpanStart(guardrail);
    await processor.onSpanEnd(guardrail);
    await processor.onSpanEnd(agent);
    await processor.onTraceEnd(trace);

    const toolCall = mockLogger.addToolSpan.mock.calls[0][0];
    expect(toolCall.output).toBe('Guardrail triggered');
  });

  test('test embedded tool calls from OpenAI response', async () => {
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, false);
    const trace = makeTrace();

    await processor.onTraceStart(trace);

    const response = makeSpan({
      spanId: 'response-001',
      parentId: 'trace-001',
      spanData: {
        type: 'response',
        model: 'gpt-4o',
        _input: [{ role: 'user', content: 'search for python' }],
        _response: {
          model: 'gpt-4o',
          output: [
            {
              type: 'web_search_call',
              action: { query: 'python programming' },
              id: 'search-1'
            },
            {
              type: 'code_interpreter_call',
              code: 'print("result")',
              outputs: [{ logs: 'result' }],
              id: 'code-1'
            }
          ]
        }
      }
    });

    await processor.onSpanStart(response);
    await processor.onSpanEnd(response);
    await processor.onTraceEnd(trace);

    expect(mockLogger.addLlmSpan).toHaveBeenCalledTimes(1);
    const llmCall = mockLogger.addLlmSpan.mock.calls[0][0];
    // Verify that either embeddedToolCalls exists or metadata includes them
    if (llmCall.embeddedToolCalls) {
      expect(llmCall.embeddedToolCalls.length).toBe(2);
      expect(llmCall.embeddedToolCalls[0].type).toBe('web_search_call');
      expect(llmCall.embeddedToolCalls[1].type).toBe('code_interpreter_call');
    } else {
      // May be in metadata as embedded_tool_calls
      const meta = llmCall.metadata as Record<string, string>;
      expect(meta.embedded_tool_calls).toBeDefined();
    }
  });

  test('test custom spans mixed with regular spans', async () => {
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, false);
    const trace = makeTrace();

    await processor.onTraceStart(trace);

    const agent = makeSpan({
      spanId: 'agent-001',
      parentId: 'trace-001',
      spanData: { type: 'agent' }
    });

    const customSpan = makeSpan({
      spanId: 'custom-001',
      parentId: 'agent-001',
      spanData: {
        type: 'custom',
        __galileoCustom: true,
        data: { input: 'test', output: 'result' }
      }
    });

    const llm = makeSpan({
      spanId: 'llm-001',
      parentId: 'agent-001',
      spanData: { type: 'generation', model: 'gpt-4' }
    });

    await processor.onSpanStart(agent);
    await processor.onSpanStart(customSpan);
    await processor.onSpanEnd(customSpan);
    await processor.onSpanStart(llm);
    await processor.onSpanEnd(llm);
    await processor.onSpanEnd(agent);
    await processor.onTraceEnd(trace);

    expect(mockLogger.addWorkflowSpan).toHaveBeenCalledTimes(2); // agent + custom
    expect(mockLogger.addLlmSpan).toHaveBeenCalledTimes(1);
    // conclude is called for all non-root workflow/agent spans
    expect(mockLogger.conclude).toHaveBeenCalled();
  });

  test('test error in middle of flow handled', async () => {
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, false);
    const trace = makeTrace();

    await processor.onTraceStart(trace);

    const agent = makeSpan({
      spanId: 'agent-001',
      parentId: 'trace-001',
      spanData: { type: 'agent' }
    });

    const tool1 = makeSpan({
      spanId: 'tool-001',
      parentId: 'agent-001',
      spanData: { type: 'function', name: 'search' }
    });

    const errorTool = makeSpan({
      spanId: 'tool-002',
      parentId: 'agent-001',
      error: { message: 'Connection timeout' },
      spanData: { type: 'function', name: 'fetch' }
    });

    const tool3 = makeSpan({
      spanId: 'tool-003',
      parentId: 'agent-001',
      spanData: { type: 'function', name: 'parse' }
    });

    await processor.onSpanStart(agent);
    await processor.onSpanStart(tool1);
    await processor.onSpanEnd(tool1);
    await processor.onSpanStart(errorTool);
    await processor.onSpanEnd(errorTool); // Ends with error
    await processor.onSpanStart(tool3);
    await processor.onSpanEnd(tool3);
    await processor.onSpanEnd(agent);
    await processor.onTraceEnd(trace);

    // Verify error tool has error status
    const errorToolCall = mockLogger.addToolSpan.mock.calls[1][0];
    expect(errorToolCall.statusCode).toBe(500);
    const errorMeta = errorToolCall.metadata as Record<string, string>;
    expect(errorMeta.error_message).toBe('Connection timeout');

    // Verify all tools logged
    expect(mockLogger.addToolSpan).toHaveBeenCalledTimes(3);
  });

  test('test complex nested structure with multiple agents', async () => {
    const mockLogger = createMockLogger();
    const processor = new GalileoTracingProcessor(mockLogger as never, false);
    const trace = makeTrace();

    await processor.onTraceStart(trace);

    // Root agent
    const rootAgent = makeSpan({
      spanId: 'root-agent',
      parentId: 'trace-001',
      spanData: { type: 'agent', name: 'RootAgent' }
    });

    // First branch: planning
    const planningAgent = makeSpan({
      spanId: 'planning-agent',
      parentId: 'root-agent',
      spanData: { type: 'agent', name: 'PlanningAgent' }
    });

    const planLLM = makeSpan({
      spanId: 'plan-llm',
      parentId: 'planning-agent',
      spanData: { type: 'generation', model: 'gpt-4' }
    });

    // Second branch: execution
    const executionAgent = makeSpan({
      spanId: 'execution-agent',
      parentId: 'root-agent',
      spanData: { type: 'agent', name: 'ExecutionAgent' }
    });

    const executionTool = makeSpan({
      spanId: 'exec-tool',
      parentId: 'execution-agent',
      spanData: { type: 'function', name: 'execute' }
    });

    await processor.onSpanStart(rootAgent);
    await processor.onSpanStart(planningAgent);
    await processor.onSpanStart(planLLM);
    await processor.onSpanEnd(planLLM);
    await processor.onSpanEnd(planningAgent);
    await processor.onSpanStart(executionAgent);
    await processor.onSpanStart(executionTool);
    await processor.onSpanEnd(executionTool);
    await processor.onSpanEnd(executionAgent);
    await processor.onSpanEnd(rootAgent);
    await processor.onTraceEnd(trace);

    // Verify all spans logged
    expect(mockLogger.addWorkflowSpan).toHaveBeenCalledTimes(3); // 3 agents
    expect(mockLogger.addLlmSpan).toHaveBeenCalledTimes(1);
    expect(mockLogger.addToolSpan).toHaveBeenCalledTimes(1);
    // conclude is called for all non-root workflow/agent spans
    expect(mockLogger.conclude).toHaveBeenCalled();
  });
});

describe('Output tracking integration', () => {
  test('test last output preserved across multiple spans', async () => {
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
        input: [],
        output: 'First output'
      }
    });

    const llm2 = makeSpan({
      spanId: 'llm-002',
      parentId: 'trace-001',
      spanData: {
        type: 'generation',
        model: 'gpt-4',
        input: [],
        output: 'Final output'
      }
    });

    await processor.onSpanStart(llm1);
    await processor.onSpanEnd(llm1);
    await processor.onSpanStart(llm2);
    await processor.onSpanEnd(llm2);
    await processor.onTraceEnd(trace);

    const startTraceCall = mockLogger.startTrace.mock.calls[0][0];
    // Output is stringified, so check for either the string or JSON-stringified version
    expect(
      startTraceCall.output === 'Final output' ||
        startTraceCall.output === '"Final output"'
    ).toBe(true);
  });
});
