import { GalileoSpanProcessor } from '../../../src/handlers/otel/processor';
import { experimentContext } from '../../../src/singleton';
import { GALILEO_ATTRIBUTES } from '../../../src/handlers/otel/types';
import { GalileoConfig } from 'galileo-generated';

// Mock the OTel dependencies
const mockOnStart = jest.fn();
const mockOnEnd = jest.fn();
const mockShutdown = jest.fn().mockResolvedValue(undefined);
const mockForceFlush = jest.fn().mockResolvedValue(undefined);

jest.mock('@opentelemetry/sdk-trace-base', () => ({
  BatchSpanProcessor: jest.fn().mockImplementation(() => ({
    onStart: mockOnStart,
    onEnd: mockOnEnd,
    shutdown: mockShutdown,
    forceFlush: mockForceFlush
  }))
}));

jest.mock('@opentelemetry/exporter-trace-otlp-http', () => ({
  OTLPTraceExporter: jest.fn().mockImplementation(() => ({
    export: jest.fn(),
    shutdown: jest.fn().mockResolvedValue(undefined),
    forceFlush: jest.fn().mockResolvedValue(undefined)
  }))
}));

jest.mock('@opentelemetry/resources', () => ({
  Resource: jest.fn().mockImplementation((attrs: Record<string, unknown>) => ({
    attributes: attrs,
    merge: jest.fn().mockReturnThis()
  }))
}));

// Mock span that records setAttribute calls
function createMockSpan(): {
  setAttribute: jest.Mock;
  attributes: Record<string, string>;
} {
  const attributes: Record<string, string> = {};
  return {
    attributes,
    setAttribute: jest.fn((key: string, value: string) => {
      attributes[key] = value;
    })
  };
}

const mockParentContext = { getValue: jest.fn() };

describe('GalileoSpanProcessor', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    GalileoConfig.reset();
    process.env = {
      ...originalEnv,
      GALILEO_API_KEY: 'test-api-key',
      GALILEO_CONSOLE_URL: 'https://test.galileo.ai'
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    GalileoConfig.reset();
  });

  test('test constructor creates processor with default config', () => {
    // Given: default environment with API key set
    // When: creating a processor without explicit config
    const processor = new GalileoSpanProcessor();

    // Then: processor is created successfully
    expect(processor).toBeDefined();
    expect(processor.exporter).toBeDefined();
    expect(processor.processor).toBeDefined();
  });

  test('test onStart sets galileo attributes from config', () => {
    // Given: a processor configured with explicit project and logstream
    const processor = new GalileoSpanProcessor({
      project: 'my-project',
      logstream: 'my-logstream'
    });
    const span = createMockSpan();

    // When: a span starts
    processor.onStart(span, mockParentContext);

    // Then: galileo attributes are set on the span
    expect(span.setAttribute).toHaveBeenCalledWith(
      GALILEO_ATTRIBUTES.PROJECT_NAME,
      'my-project'
    );
    expect(span.setAttribute).toHaveBeenCalledWith(
      GALILEO_ATTRIBUTES.LOGSTREAM_NAME,
      'my-logstream'
    );
    // Then: the inner processor's onStart is called
    expect(mockOnStart).toHaveBeenCalledWith(span, mockParentContext);
  });

  test('test onStart sets experiment id and omits logstream', () => {
    // Given: a processor configured with an experiment ID
    const processor = new GalileoSpanProcessor({
      project: 'my-project',
      logstream: 'my-logstream',
      experimentId: 'exp-123'
    });
    const span = createMockSpan();

    // When: a span starts
    processor.onStart(span, mockParentContext);

    // Then: experiment ID is set
    expect(span.setAttribute).toHaveBeenCalledWith(
      GALILEO_ATTRIBUTES.EXPERIMENT_ID,
      'exp-123'
    );
    // Then: logstream is NOT set (experiment takes priority)
    expect(span.setAttribute).not.toHaveBeenCalledWith(
      GALILEO_ATTRIBUTES.LOGSTREAM_NAME,
      expect.anything()
    );
  });

  test('test onStart sets session id', () => {
    // Given: a processor configured with a session ID
    const processor = new GalileoSpanProcessor({
      project: 'my-project',
      sessionId: 'session-456'
    });
    const span = createMockSpan();

    // When: a span starts
    processor.onStart(span, mockParentContext);

    // Then: session ID is set on the span
    expect(span.setAttribute).toHaveBeenCalledWith(
      GALILEO_ATTRIBUTES.SESSION_ID,
      'session-456'
    );
  });

  test('test onStart reads from experimentContext AsyncLocalStorage', (done) => {
    // Given: a processor with default config
    const processor = new GalileoSpanProcessor();
    const span = createMockSpan();

    // When: running inside an experimentContext with project and logstream set
    experimentContext.run(
      {
        projectName: 'ctx-project',
        logStreamName: 'ctx-logstream',
        sessionId: 'ctx-session'
      },
      () => {
        processor.onStart(span, mockParentContext);

        // Then: attributes come from the AsyncLocalStorage context
        expect(span.setAttribute).toHaveBeenCalledWith(
          GALILEO_ATTRIBUTES.PROJECT_NAME,
          'ctx-project'
        );
        expect(span.setAttribute).toHaveBeenCalledWith(
          GALILEO_ATTRIBUTES.LOGSTREAM_NAME,
          'ctx-logstream'
        );
        expect(span.setAttribute).toHaveBeenCalledWith(
          GALILEO_ATTRIBUTES.SESSION_ID,
          'ctx-session'
        );
        done();
      }
    );
  });

  test('test onStart context overrides config defaults', (done) => {
    // Given: a processor with explicit config
    const processor = new GalileoSpanProcessor({
      project: 'config-project',
      logstream: 'config-logstream'
    });
    const span = createMockSpan();

    // When: running inside an experimentContext that overrides the config values
    experimentContext.run(
      {
        projectName: 'ctx-project',
        logStreamName: 'ctx-logstream'
      },
      () => {
        processor.onStart(span, mockParentContext);

        // Then: AsyncLocalStorage context takes priority over constructor config
        expect(span.setAttribute).toHaveBeenCalledWith(
          GALILEO_ATTRIBUTES.PROJECT_NAME,
          'ctx-project'
        );
        expect(span.setAttribute).toHaveBeenCalledWith(
          GALILEO_ATTRIBUTES.LOGSTREAM_NAME,
          'ctx-logstream'
        );
        done();
      }
    );
  });

  test('test onStart experiment from context overrides logstream', (done) => {
    // Given: a processor with logstream config
    const processor = new GalileoSpanProcessor({
      project: 'my-project',
      logstream: 'my-logstream'
    });
    const span = createMockSpan();

    // When: running inside a context with an experiment ID
    experimentContext.run(
      {
        projectName: 'my-project',
        experimentId: 'ctx-exp-789'
      },
      () => {
        processor.onStart(span, mockParentContext);

        // Then: experiment ID is set and logstream is omitted
        expect(span.setAttribute).toHaveBeenCalledWith(
          GALILEO_ATTRIBUTES.EXPERIMENT_ID,
          'ctx-exp-789'
        );
        expect(span.setAttribute).not.toHaveBeenCalledWith(
          GALILEO_ATTRIBUTES.LOGSTREAM_NAME,
          expect.anything()
        );
        done();
      }
    );
  });

  test('test onEnd delegates to inner processor', () => {
    // Given: a processor
    const processor = new GalileoSpanProcessor();
    const readableSpan = {
      name: 'test-span',
      attributes: {},
      resource: { merge: jest.fn() }
    };

    // When: a span ends
    processor.onEnd(readableSpan);

    // Then: the inner processor's onEnd is called
    expect(mockOnEnd).toHaveBeenCalledWith(readableSpan);
  });

  test('test shutdown delegates to inner processor', async () => {
    // Given: a processor
    const processor = new GalileoSpanProcessor();

    // When: shutdown is called
    await processor.shutdown();

    // Then: the inner processor's shutdown is called
    expect(mockShutdown).toHaveBeenCalled();
  });

  test('test forceFlush delegates to inner processor', async () => {
    // Given: a processor
    const processor = new GalileoSpanProcessor();

    // When: forceFlush is called
    await processor.forceFlush();

    // Then: the inner processor's forceFlush is called
    expect(mockForceFlush).toHaveBeenCalled();
  });

  test('test constructor throws without API key', () => {
    // Given: no API key in environment
    delete process.env.GALILEO_API_KEY;
    GalileoConfig.reset();

    // When/Then: creating a processor throws
    expect(() => new GalileoSpanProcessor()).toThrow(
      'Galileo API key is required'
    );
  });

  test('test constructor uses env vars for project and logstream', () => {
    // Given: project and logstream set via env vars
    process.env.GALILEO_PROJECT = 'env-project';
    process.env.GALILEO_LOG_STREAM = 'env-logstream';
    GalileoConfig.reset();

    // When: creating a processor without explicit config
    const processor = new GalileoSpanProcessor();
    const span = createMockSpan();
    processor.onStart(span, mockParentContext);

    // Then: attributes come from env vars
    expect(span.setAttribute).toHaveBeenCalledWith(
      GALILEO_ATTRIBUTES.PROJECT_NAME,
      'env-project'
    );
    expect(span.setAttribute).toHaveBeenCalledWith(
      GALILEO_ATTRIBUTES.LOGSTREAM_NAME,
      'env-logstream'
    );
  });
});
