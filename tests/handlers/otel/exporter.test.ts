/* eslint-disable @typescript-eslint/no-explicit-any */
import { GalileoOTLPExporter } from '../../../src/handlers/otel/exporter';
import { GALILEO_ATTRIBUTES } from '../../../src/handlers/otel/types';
import { GalileoConfig } from 'galileo-generated';

const mockExport = jest.fn();
const mockExporterShutdown = jest.fn().mockResolvedValue(undefined);
const mockExporterForceFlush = jest.fn().mockResolvedValue(undefined);

interface MockInnerExporter {
  export: jest.Mock;
  shutdown: jest.Mock;
  forceFlush: jest.Mock;
  headers?: Record<string, string>;
  _delegate?: {
    _transport: {
      _transport: {
        _parameters: {
          headers: (() => Record<string, string>) | Record<string, string>;
        };
      };
    };
  };
}

let lastCreatedInner: MockInnerExporter;

function createModernTransportStructure(
  initialHeaders: Record<string, string>
): MockInnerExporter['_delegate'] {
  let headersFn = () => ({ ...initialHeaders });
  return {
    _transport: {
      _transport: {
        _parameters: {
          get headers() {
            return headersFn;
          },
          set headers(fn: () => Record<string, string>) {
            headersFn = fn;
          }
        }
      }
    }
  };
}

const mockExporterFactory = jest
  .fn()
  .mockImplementation((config: { headers: Record<string, string> }) => {
    const inner: MockInnerExporter = {
      export: mockExport,
      shutdown: mockExporterShutdown,
      forceFlush: mockExporterForceFlush,
      _delegate: createModernTransportStructure(config.headers)
    };
    lastCreatedInner = inner;
    return inner;
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

jest.mock('galileo-generated', () => {
  const actual = jest.requireActual('galileo-generated');
  return {
    ...actual,
    getSdkLogger: () => ({
      debug: jest.fn(),
      info: jest.fn(),
      warn: (...args: unknown[]) => sdkWarnCalls.push(args),
      error: jest.fn()
    })
  };
});

const sdkWarnCalls: unknown[][] = [];

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
    sdkWarnCalls.length = 0;
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

  describe('constructor', () => {
    test('test constructor builds correct endpoint and headers', () => {
      const exporter = new GalileoOTLPExporter({
        project: 'my-project',
        logstream: 'my-logstream',
        apiKey: 'my-key',
        apiUrl: 'https://custom.galileo.ai'
      });

      expect(exporter.project).toBe('my-project');
      expect(exporter.logstream).toBe('my-logstream');
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
      new GalileoOTLPExporter({
        apiKey: 'my-key',
        apiUrl: 'https://custom.galileo.ai/'
      });

      expect(mockExporterFactory).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://custom.galileo.ai/otel/traces'
        })
      );
    });

    test('test constructor throws without API key', () => {
      delete process.env.GALILEO_API_KEY;
      GalileoConfig.reset();

      expect(() => new GalileoOTLPExporter()).toThrow(
        'Galileo API key is required'
      );
    });

    test('test constructor resolves project and logstream from GalileoConfig', () => {
      process.env.GALILEO_PROJECT = 'env-project';
      process.env.GALILEO_LOG_STREAM = 'env-logstream';
      GalileoConfig.reset();

      const exporter = new GalileoOTLPExporter();

      expect(exporter.project).toBe('env-project');
      expect(exporter.logstream).toBe('env-logstream');
    });
  });

  describe('_installHeadersHook — modern OTEL SDK path', () => {
    test('test export installs dynamic headers hook on first call', () => {
      const exporter = new GalileoOTLPExporter({
        project: 'my-project',
        logstream: 'my-logstream'
      });
      const span = createMockSpan({
        [GALILEO_ATTRIBUTES.PROJECT_NAME]: 'batch-project',
        [GALILEO_ATTRIBUTES.LOGSTREAM_NAME]: 'batch-logstream'
      });

      exporter.export([span], jest.fn());

      const params =
        lastCreatedInner._delegate!._transport._transport._parameters;
      const headers = (params.headers as () => Record<string, string>)();
      expect(headers['project']).toBe('batch-project');
      expect(headers['logstream']).toBe('batch-logstream');
      expect(headers['Galileo-API-Key']).toBe('test-api-key');
    });

    test('test hook merges overrides with base headers at call time', () => {
      const exporter = new GalileoOTLPExporter({
        project: 'my-project',
        logstream: 'my-logstream',
        apiKey: 'my-key'
      });

      const span1 = createMockSpan({
        [GALILEO_ATTRIBUTES.PROJECT_NAME]: 'project-a',
        [GALILEO_ATTRIBUTES.LOGSTREAM_NAME]: 'logstream-a'
      });
      exporter.export([span1], jest.fn());

      const params =
        lastCreatedInner._delegate!._transport._transport._parameters;
      const headersFn = params.headers as () => Record<string, string>;

      let headers = headersFn();
      expect(headers['project']).toBe('project-a');
      expect(headers['logstream']).toBe('logstream-a');

      const span2 = createMockSpan({
        [GALILEO_ATTRIBUTES.PROJECT_NAME]: 'project-b',
        [GALILEO_ATTRIBUTES.LOGSTREAM_NAME]: 'logstream-b'
      });
      exporter.export([span2], jest.fn());

      headers = headersFn();
      expect(headers['project']).toBe('project-b');
      expect(headers['logstream']).toBe('logstream-b');
      expect(headers['Galileo-API-Key']).toBe('my-key');
    });

    test('test hook only installed once across multiple exports', () => {
      const exporter = new GalileoOTLPExporter();
      const params =
        lastCreatedInner._delegate!._transport._transport._parameters;
      const originalHeadersFn = params.headers;

      exporter.export([createMockSpan()], jest.fn());
      const hookedHeadersFn = params.headers;
      expect(hookedHeadersFn).not.toBe(originalHeadersFn);

      exporter.export([createMockSpan()], jest.fn());
      expect(params.headers).toBe(hookedHeadersFn);
    });
  });

  describe('_installHeadersHook — legacy OTEL SDK path', () => {
    test('test hook falls back to Object.defineProperty for legacy headers', () => {
      const exporter = new GalileoOTLPExporter({
        project: 'my-project',
        logstream: 'my-logstream'
      });

      delete lastCreatedInner._delegate;
      (lastCreatedInner as any).headers = {
        'Galileo-API-Key': 'test-api-key',
        project: 'my-project',
        logstream: 'my-logstream'
      };

      const span = createMockSpan({
        [GALILEO_ATTRIBUTES.PROJECT_NAME]: 'legacy-project',
        [GALILEO_ATTRIBUTES.LOGSTREAM_NAME]: 'legacy-logstream'
      });
      exporter.export([span], jest.fn());

      const headers = (lastCreatedInner as any).headers;
      expect(headers['project']).toBe('legacy-project');
      expect(headers['logstream']).toBe('legacy-logstream');
      expect(headers['Galileo-API-Key']).toBe('test-api-key');
    });
  });

  describe('_installHeadersHook — no recognized transport', () => {
    test('test hook warns when transport structure not recognized', () => {
      const exporter = new GalileoOTLPExporter();

      delete lastCreatedInner._delegate;
      delete (lastCreatedInner as any).headers;

      exporter.export([createMockSpan()], jest.fn());

      expect(sdkWarnCalls.length).toBeGreaterThan(0);
      expect(sdkWarnCalls[0][0]).toContain(
        'Could not install dynamic headers hook on the inner exporter'
      );
    });

    test('test hook does not retry after failed installation', () => {
      const exporter = new GalileoOTLPExporter();

      delete lastCreatedInner._delegate;
      delete (lastCreatedInner as any).headers;

      exporter.export([createMockSpan()], jest.fn());
      expect(sdkWarnCalls.length).toBe(1);

      sdkWarnCalls.length = 0;
      exporter.export([createMockSpan()], jest.fn());
      expect(sdkWarnCalls.length).toBe(0);
    });

    test('test hook warns when headers are frozen', () => {
      const exporter = new GalileoOTLPExporter();

      delete lastCreatedInner._delegate;
      (lastCreatedInner as any).headers = Object.freeze({
        'Galileo-API-Key': 'test-api-key'
      });

      exporter.export([createMockSpan()], jest.fn());

      expect(sdkWarnCalls.length).toBeGreaterThan(0);
      expect(sdkWarnCalls[0][0]).toContain(
        'Could not install dynamic headers hook on the inner exporter'
      );
    });
  });

  describe('export — resource attribute merging', () => {
    test('test export merges galileo attributes into span resource', () => {
      const exporter = new GalileoOTLPExporter();
      const span = createMockSpan({
        [GALILEO_ATTRIBUTES.PROJECT_NAME]: 'span-project',
        [GALILEO_ATTRIBUTES.LOGSTREAM_NAME]: 'span-logstream',
        [GALILEO_ATTRIBUTES.SESSION_ID]: 'session-123'
      });

      exporter.export([span], jest.fn());

      expect(span.resource.merge).toHaveBeenCalled();
      const resourceCallArgs = MockResource.mock.calls[0][0];
      expect(resourceCallArgs[GALILEO_ATTRIBUTES.PROJECT_NAME]).toBe(
        'span-project'
      );
      expect(resourceCallArgs[GALILEO_ATTRIBUTES.LOGSTREAM_NAME]).toBe(
        'span-logstream'
      );
      expect(resourceCallArgs[GALILEO_ATTRIBUTES.SESSION_ID]).toBe(
        'session-123'
      );
    });

    test('test export excludes logstream from resource when experiment ID present', () => {
      const exporter = new GalileoOTLPExporter();
      const span = createMockSpan({
        [GALILEO_ATTRIBUTES.PROJECT_NAME]: 'span-project',
        [GALILEO_ATTRIBUTES.LOGSTREAM_NAME]: 'span-logstream',
        [GALILEO_ATTRIBUTES.EXPERIMENT_ID]: 'exp-456'
      });

      exporter.export([span], jest.fn());

      const resourceCallArgs = MockResource.mock.calls[0][0];
      expect(resourceCallArgs[GALILEO_ATTRIBUTES.EXPERIMENT_ID]).toBe(
        'exp-456'
      );
      expect(
        resourceCallArgs[GALILEO_ATTRIBUTES.LOGSTREAM_NAME]
      ).toBeUndefined();
    });

    test('test export includes dataset attributes in resource', () => {
      const exporter = new GalileoOTLPExporter();
      const span = createMockSpan({
        [GALILEO_ATTRIBUTES.PROJECT_NAME]: 'my-project',
        [GALILEO_ATTRIBUTES.DATASET_INPUT]: 'test input',
        [GALILEO_ATTRIBUTES.DATASET_OUTPUT]: 'test output',
        [GALILEO_ATTRIBUTES.DATASET_METADATA]: '{"key": "value"}'
      });

      exporter.export([span], jest.fn());

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

    test('test export skips resource merge for spans without galileo attributes', () => {
      const exporter = new GalileoOTLPExporter();
      const span = createMockSpan({});

      exporter.export([span], jest.fn());

      expect(span.resource.merge).not.toHaveBeenCalled();
    });
  });

  describe('export — per-batch header overrides', () => {
    test('test export sets experiment header and clears logstream in experiment mode', () => {
      const exporter = new GalileoOTLPExporter({
        project: 'my-project',
        logstream: 'my-logstream'
      });
      const span = createMockSpan({
        [GALILEO_ATTRIBUTES.PROJECT_NAME]: 'exp-project',
        [GALILEO_ATTRIBUTES.EXPERIMENT_ID]: 'exp-789'
      });

      exporter.export([span], jest.fn());

      const params =
        lastCreatedInner._delegate!._transport._transport._parameters;
      const headers = (params.headers as () => Record<string, string>)();
      expect(headers['experimentid']).toBe('exp-789');
      expect(headers['project']).toBe('exp-project');
      expect(headers['logstream']).toBeUndefined();
    });

    test('test export cleans up experiment headers for non-experiment batch', () => {
      const exporter = new GalileoOTLPExporter({
        project: 'my-project',
        logstream: 'my-logstream'
      });

      const experimentSpan = createMockSpan({
        [GALILEO_ATTRIBUTES.PROJECT_NAME]: 'exp-project',
        [GALILEO_ATTRIBUTES.EXPERIMENT_ID]: 'exp-789'
      });
      exporter.export([experimentSpan], jest.fn());

      const normalSpan = createMockSpan({
        [GALILEO_ATTRIBUTES.PROJECT_NAME]: 'normal-project',
        [GALILEO_ATTRIBUTES.LOGSTREAM_NAME]: 'normal-logstream'
      });
      exporter.export([normalSpan], jest.fn());

      const params =
        lastCreatedInner._delegate!._transport._transport._parameters;
      const headers = (params.headers as () => Record<string, string>)();
      expect(headers['experimentid']).toBeUndefined();
      expect(headers['logstream']).toBe('normal-logstream');
      expect(headers['project']).toBe('normal-project');
    });

    test('test export falls back to constructor project/logstream when spans lack attributes', () => {
      const exporter = new GalileoOTLPExporter({
        project: 'default-project',
        logstream: 'default-logstream'
      });
      const span = createMockSpan({});

      exporter.export([span], jest.fn());

      const params =
        lastCreatedInner._delegate!._transport._transport._parameters;
      const headers = (params.headers as () => Record<string, string>)();
      expect(headers['project']).toBe('default-project');
      expect(headers['logstream']).toBe('default-logstream');
    });

    test('test export with empty spans does not update header overrides', () => {
      const exporter = new GalileoOTLPExporter({
        project: 'my-project',
        logstream: 'my-logstream'
      });

      const span = createMockSpan({
        [GALILEO_ATTRIBUTES.PROJECT_NAME]: 'first-project'
      });
      exporter.export([span], jest.fn());

      exporter.export([], jest.fn());

      const params =
        lastCreatedInner._delegate!._transport._transport._parameters;
      const headers = (params.headers as () => Record<string, string>)();
      expect(headers['project']).toBe('first-project');
    });

    test('test last span in batch wins for header values', () => {
      const exporter = new GalileoOTLPExporter();
      const span1 = createMockSpan({
        [GALILEO_ATTRIBUTES.PROJECT_NAME]: 'project-first',
        [GALILEO_ATTRIBUTES.LOGSTREAM_NAME]: 'logstream-first'
      });
      const span2 = createMockSpan({
        [GALILEO_ATTRIBUTES.PROJECT_NAME]: 'project-last',
        [GALILEO_ATTRIBUTES.LOGSTREAM_NAME]: 'logstream-last'
      });

      exporter.export([span1, span2], jest.fn());

      const params =
        lastCreatedInner._delegate!._transport._transport._parameters;
      const headers = (params.headers as () => Record<string, string>)();
      expect(headers['project']).toBe('project-last');
      expect(headers['logstream']).toBe('logstream-last');
    });
  });

  describe('export — delegation', () => {
    test('test export delegates to inner exporter', () => {
      const exporter = new GalileoOTLPExporter();
      const span = createMockSpan();
      const callback = jest.fn();

      exporter.export([span], callback);

      expect(mockExport).toHaveBeenCalledWith([span], callback);
    });
  });

  describe('shutdown and forceFlush', () => {
    test('test shutdown delegates to inner exporter', async () => {
      const exporter = new GalileoOTLPExporter();

      await exporter.shutdown();

      expect(mockExporterShutdown).toHaveBeenCalled();
    });

    test('test forceFlush delegates to inner exporter', async () => {
      const exporter = new GalileoOTLPExporter();

      await exporter.forceFlush();

      expect(mockExporterForceFlush).toHaveBeenCalled();
    });
  });
});
