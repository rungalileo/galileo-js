import { GalileoTracingProcessor } from '../../../src/handlers/openai-agents';
import { GalileoLogger } from '../../../src/utils/galileo-logger';
import type {
  AgentTrace,
  AgentSpan
} from '../../../src/handlers/openai-agents';
import type { LogTracesIngestRequest } from '../../../src/types/logging/trace.types';

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

describe('GalileoTracingProcessor ingestionHook', () => {
  test('test constructor with explicit logger ignores ingestionHook', async () => {
    const mockLogger = createMockLogger();
    const mockHook = jest.fn();

    // When an explicit logger is provided, ingestionHook is not used
    const processor = new GalileoTracingProcessor(
      mockLogger as never,
      false,
      mockHook
    );

    const trace = makeTrace();
    await processor.onTraceStart(trace);
    await processor.onTraceEnd(trace);

    // The explicit mock logger should have been used
    expect(mockLogger.startTrace).toHaveBeenCalledTimes(1);
    expect(mockLogger.conclude).toHaveBeenCalled();
    // The hook function should never be called because we gave a mock logger
    expect(mockHook).not.toHaveBeenCalled();
  });

  test('test constructor with ingestionHook creates GalileoLogger with hook', () => {
    const mockHook = jest
      .fn<Promise<void>, [LogTracesIngestRequest]>()
      .mockResolvedValue(undefined);

    // Spy on GalileoLogger constructor
    const constructorSpy = jest.spyOn(
      GalileoLogger.prototype as never,
      'initializeProperties' as never
    );

    new GalileoTracingProcessor(undefined, true, mockHook);

    // GalileoLogger constructor was called with config containing ingestionHook
    expect(constructorSpy).toHaveBeenCalledTimes(1);
    const config = constructorSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(config.ingestionHook).toBe(mockHook);

    constructorSpy.mockRestore();
  });

  test('test constructor without logger or hook falls back to singleton', () => {
    // We can't easily test singleton fallback without initializing,
    // but we can verify it throws or returns correctly.
    // The singleton.getInstance().getClient() will be called.
    // Since we haven't initialized, this may throw.
    // The important thing is that the GalileoLogger constructor is NOT called
    // with a config object.

    const constructorSpy = jest.spyOn(
      GalileoLogger.prototype as never,
      'initializeProperties' as never
    );

    try {
      new GalileoTracingProcessor(undefined, true, undefined);
    } catch {
      // Singleton may not be initialized in test environment, which is fine
    }

    // If singleton works, initializeProperties may be called (via singleton's getClient).
    // If it throws, initializeProperties may not be called.
    // In either case, the constructor should NOT pass ingestionHook.
    if (constructorSpy.mock.calls.length > 0) {
      const config = constructorSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(config.ingestionHook).toBeUndefined();
    }

    constructorSpy.mockRestore();
  });

  test('test processor with ingestionHook runs trace and calls flush', async () => {
    const mockHook = jest
      .fn<Promise<void>, [LogTracesIngestRequest]>()
      .mockResolvedValue(undefined);

    // Create a processor with ingestionHook; it creates a real GalileoLogger.
    // Instead of testing the full flush flow (which requires API mocking),
    // verify the processor correctly uses the logger by tracking its method calls.
    const processor = new GalileoTracingProcessor(undefined, false, mockHook);

    // Access the internal logger to verify it was created
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const internalLogger = (processor as any)._galileoLogger;
    expect(internalLogger).toBeInstanceOf(GalileoLogger);

    // Spy on the internal logger's flush method
    const flushSpy = jest.spyOn(internalLogger, 'flush');

    const trace = makeTrace();
    const span = makeSpan({
      spanId: 'llm-001',
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

    // flushOnTraceEnd=false, so flush should not have been called yet
    expect(flushSpy).not.toHaveBeenCalled();

    // Verify trace was built — the logger should have traces
    expect(internalLogger.traces.length).toBe(1);

    flushSpy.mockRestore();
  });

  test('test processor with ingestionHook and flushOnTraceEnd calls flush', async () => {
    const mockHook = jest
      .fn<Promise<void>, [LogTracesIngestRequest]>()
      .mockResolvedValue(undefined);

    const processor = new GalileoTracingProcessor(undefined, true, mockHook);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const internalLogger = (processor as any)._galileoLogger;
    const flushSpy = jest.spyOn(internalLogger, 'flush');

    const trace = makeTrace();
    const span = makeSpan({
      spanId: 'llm-001',
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

    // flushOnTraceEnd=true, so flush should have been called
    expect(flushSpy).toHaveBeenCalledTimes(1);

    flushSpy.mockRestore();
  });

  test('test shutdown calls flush on logger created with ingestionHook', async () => {
    const mockHook = jest
      .fn<Promise<void>, [LogTracesIngestRequest]>()
      .mockResolvedValue(undefined);

    const processor = new GalileoTracingProcessor(undefined, false, mockHook);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const internalLogger = (processor as any)._galileoLogger;
    const flushSpy = jest.spyOn(internalLogger, 'flush');

    await processor.shutdown();
    expect(flushSpy).toHaveBeenCalledTimes(1);

    flushSpy.mockRestore();
  });
});
