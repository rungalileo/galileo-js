import { GalileoOTLPExporter } from '../../../src/handlers/otel/exporter';
import { GALILEO_ATTRIBUTES } from '../../../src/handlers/otel/types';
import { GalileoConfig } from 'galileo-generated';

// Mock OTel dependencies — source tries proto first, falls back to http
const mockExport = jest.fn();
const mockExporterShutdown = jest.fn().mockResolvedValue(undefined);
const mockExporterForceFlush = jest.fn().mockResolvedValue(undefined);
let mockInnerHeaders: Record<string, string> = {};

const mockExporterFactory = jest
  .fn()
  .mockImplementation((config: { headers: Record<string, string> }) => {
    mockInnerHeaders = { ...config.headers };
    return {
      export: mockExport,
      shutdown: mockExporterShutdown,
      forceFlush: mockExporterForceFlush,
      headers: mockInnerHeaders
    };
  });

jest.mock(
  '@opentelemetry/exporter-trace-otlp-proto',
  () => ({
    OTLPTraceExporter: mockExporterFactory
  }),
  { virtual: true }
);

jest.mock('@opentelemetry/exporter-trace-otlp-http', () => ({
  OTLPTraceExporter: mockExporterFactory
}));

const MockResource = jest
  .fn()
  .mockImplementation((attrs: Record<string, unknown>) => ({
    attributes: attrs,
    merge: jest.fn().mockReturnThis()
  }));

jest.mock('@opentelemetry/resources', () => ({
  Resource: MockResource
}));

function createMockSpan(
  attributes: Record<string, unknown> = {},
  resourceAttrs: Record<string, unknown> = {}
) {
  const resource = {
    attributes: resourceAttrs,
    merge: jest
      .fn()
      .mockImplementation((other: { attributes: Record<string, unknown> }) => ({
        ...resource,
        attributes: { ...resourceAttrs, ...other.attributes }
      }))
  };

  return {
    name: 'test-span',
    attributes,
    resource
  };
}

describe('GalileoOTLPExporter', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    mockInnerHeaders = {};
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

  test('test constructor builds correct endpoint and headers', () => {
    // Given: explicit config overriding all values
    // When: creating an exporter
    const exporter = new GalileoOTLPExporter({
      project: 'my-project',
      logstream: 'my-logstream',
      apiKey: 'my-key',
      apiUrl: 'https://custom.galileo.ai'
    });

    // Then: project and logstream are set correctly
    expect(exporter.project).toBe('my-project');
    expect(exporter.logstream).toBe('my-logstream');

    // Then: OTLPTraceExporter was created with correct endpoint and headers
    expect(mockExporterFactory).toHaveBeenCalledWith({
      url: 'https://custom.galileo.ai/otel/traces',
      headers: {
        'Galileo-API-Key': 'my-key',
        project: 'my-project',
        logstream: 'my-logstream'
      }
    });
  });

  test('test constructor strips trailing slash from apiUrl', () => {
    // Given: apiUrl with trailing slash
    // When: creating an exporter
    new GalileoOTLPExporter({
      apiKey: 'my-key',
      apiUrl: 'https://custom.galileo.ai/'
    });

    // Then: endpoint has no double slash
    expect(mockExporterFactory).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://custom.galileo.ai/otel/traces'
      })
    );
  });

  test('test constructor throws without API key', () => {
    // Given: no API key in environment
    delete process.env.GALILEO_API_KEY;
    GalileoConfig.reset();

    // When/Then: creating an exporter throws
    expect(() => new GalileoOTLPExporter()).toThrow(
      'Galileo API key is required'
    );
  });

  test('test constructor resolves project and logstream from GalileoConfig', () => {
    // Given: project and logstream set via env vars (resolved by GalileoConfig)
    process.env.GALILEO_PROJECT = 'env-project';
    process.env.GALILEO_LOG_STREAM = 'env-logstream';
    GalileoConfig.reset();

    // When: creating an exporter without explicit config
    const exporter = new GalileoOTLPExporter();

    // Then: values come from GalileoConfig (which reads env vars)
    expect(exporter.project).toBe('env-project');
    expect(exporter.logstream).toBe('env-logstream');
  });

  test('test export delegates to inner exporter', () => {
    // Given: an exporter and a span with no galileo attributes
    const exporter = new GalileoOTLPExporter();
    const span = createMockSpan();
    const callback = jest.fn();

    // When: exporting spans
    exporter.export([span], callback);

    // Then: inner exporter's export is called
    expect(mockExport).toHaveBeenCalledWith([span], callback);
  });

  test('test export merges resource attributes from span attributes', () => {
    // Given: an exporter and a span with galileo attributes
    const exporter = new GalileoOTLPExporter();
    const span = createMockSpan({
      [GALILEO_ATTRIBUTES.PROJECT_NAME]: 'span-project',
      [GALILEO_ATTRIBUTES.LOGSTREAM_NAME]: 'span-logstream',
      [GALILEO_ATTRIBUTES.SESSION_ID]: 'session-123'
    });
    const callback = jest.fn();

    // When: exporting spans
    exporter.export([span], callback);

    // Then: resource.merge is called with galileo attributes
    expect(span.resource.merge).toHaveBeenCalled();
    // Then: inner exporter receives the spans
    expect(mockExport).toHaveBeenCalledWith([span], callback);
  });

  test('test export handles experiment mode by removing logstream', () => {
    // Given: an exporter
    const exporter = new GalileoOTLPExporter();
    const span = createMockSpan({
      [GALILEO_ATTRIBUTES.PROJECT_NAME]: 'span-project',
      [GALILEO_ATTRIBUTES.LOGSTREAM_NAME]: 'span-logstream',
      [GALILEO_ATTRIBUTES.EXPERIMENT_ID]: 'exp-456'
    });
    const callback = jest.fn();

    // When: exporting spans with experiment ID
    exporter.export([span], callback);

    // Then: Resource was created without logstream (experiment takes priority)
    const resourceCallArgs = MockResource.mock.calls[0][0];
    expect(resourceCallArgs[GALILEO_ATTRIBUTES.EXPERIMENT_ID]).toBe('exp-456');
    expect(resourceCallArgs[GALILEO_ATTRIBUTES.LOGSTREAM_NAME]).toBeUndefined();
  });

  test('test export includes dataset attributes in resource', () => {
    // Given: a span with dataset attributes
    const exporter = new GalileoOTLPExporter();
    const span = createMockSpan({
      [GALILEO_ATTRIBUTES.PROJECT_NAME]: 'my-project',
      [GALILEO_ATTRIBUTES.DATASET_INPUT]: 'test input',
      [GALILEO_ATTRIBUTES.DATASET_OUTPUT]: 'test output',
      [GALILEO_ATTRIBUTES.DATASET_METADATA]: '{"key": "value"}'
    });
    const callback = jest.fn();

    // When: exporting spans
    exporter.export([span], callback);

    // Then: dataset attributes are included in the resource
    const resourceCallArgs = MockResource.mock.calls[0][0];
    expect(resourceCallArgs[GALILEO_ATTRIBUTES.DATASET_INPUT]).toBe(
      'test input'
    );
    expect(resourceCallArgs[GALILEO_ATTRIBUTES.DATASET_OUTPUT]).toBe(
      'test output'
    );
    expect(resourceCallArgs[GALILEO_ATTRIBUTES.DATASET_METADATA]).toBe(
      '{"key": "value"}'
    );
  });

  test('test shutdown delegates to inner exporter', async () => {
    // Given: an exporter
    const exporter = new GalileoOTLPExporter();

    // When: shutdown is called
    await exporter.shutdown();

    // Then: inner exporter's shutdown is called
    expect(mockExporterShutdown).toHaveBeenCalled();
  });

  test('test forceFlush delegates to inner exporter', async () => {
    // Given: an exporter
    const exporter = new GalileoOTLPExporter();

    // When: forceFlush is called
    await exporter.forceFlush();

    // Then: inner exporter's forceFlush is called
    expect(mockExporterForceFlush).toHaveBeenCalled();
  });

  test('test export with empty spans array does not update headers', () => {
    // Given: an exporter
    const exporter = new GalileoOTLPExporter();
    const callback = jest.fn();

    // When: exporting empty array
    exporter.export([], callback);

    // Then: inner exporter is still called
    expect(mockExport).toHaveBeenCalledWith([], callback);
  });

  test('test export updates inner exporter headers for experiment mode', () => {
    // Given: an exporter
    const exporter = new GalileoOTLPExporter({
      project: 'my-project',
      logstream: 'my-logstream'
    });
    const span = createMockSpan({
      [GALILEO_ATTRIBUTES.PROJECT_NAME]: 'exp-project',
      [GALILEO_ATTRIBUTES.EXPERIMENT_ID]: 'exp-789'
    });
    const callback = jest.fn();

    // When: exporting spans with experiment ID
    exporter.export([span], callback);

    // Then: inner exporter headers are updated with experiment ID and logstream is removed
    expect(mockInnerHeaders['experimentid']).toBe('exp-789');
    expect(mockInnerHeaders['project']).toBe('exp-project');
    expect(mockInnerHeaders['logstream']).toBeUndefined();
  });

  test('test export cleans up experiment headers for non-experiment batch', () => {
    // Given: an exporter that previously exported an experiment batch
    const exporter = new GalileoOTLPExporter({
      project: 'my-project',
      logstream: 'my-logstream'
    });
    const experimentSpan = createMockSpan({
      [GALILEO_ATTRIBUTES.PROJECT_NAME]: 'exp-project',
      [GALILEO_ATTRIBUTES.EXPERIMENT_ID]: 'exp-789'
    });
    exporter.export([experimentSpan], jest.fn());

    // When: exporting a non-experiment batch
    const normalSpan = createMockSpan({
      [GALILEO_ATTRIBUTES.PROJECT_NAME]: 'normal-project',
      [GALILEO_ATTRIBUTES.LOGSTREAM_NAME]: 'normal-logstream'
    });
    exporter.export([normalSpan], jest.fn());

    // Then: experiment ID is cleaned up and logstream is restored
    expect(mockInnerHeaders['experimentid']).toBeUndefined();
    expect(mockInnerHeaders['logstream']).toBe('normal-logstream');
    expect(mockInnerHeaders['project']).toBe('normal-project');
  });
});
