import { Readable } from 'stream';
import axios from 'axios';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import {
  BaseClient,
  GENERIC_ERROR_MESSAGE,
  RequestMethod
} from '../../src/api-client/base-client';
import { Routes } from '../../src/types/routes.types';
import { getSdkIdentifier } from '../../src/utils/version';
import { GalileoAPIError } from '../../src/types/errors.types';
import type { GalileoAPIStandardErrorData } from '../../src/types/errors.types';

// Test implementation of BaseClient
class TestClient extends BaseClient {
  constructor() {
    super();
    this.apiUrl = 'http://localhost:8088';
    this.token = 'test-token';
    this.initializeClient();
  }

  public async testRequest() {
    return this.makeRequest(RequestMethod.GET, Routes.healthCheck);
  }

  public setTokenForTest(t: string): void {
    this.token = t;
  }
}

let capturedHeaders: Record<string, string> = {};

const getProjectHandler = jest
  .fn()
  .mockImplementation(() => HttpResponse.json({ id: 'p-1' }));

const server = setupServer(
  http.get('http://localhost:8088/healthcheck', ({ request }) => {
    capturedHeaders = {};
    request.headers.forEach((value, key) => {
      capturedHeaders[key] = value;
    });
    return HttpResponse.json({ status: 'ok' });
  }),
  http.get('http://localhost:8088/projects/p-1', () => getProjectHandler())
);

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  capturedHeaders = {};
});
afterAll(() => server.close());

describe('BaseClient Headers', () => {
  it('should include X-Galileo-SDK header with correct value', async () => {
    const client = new TestClient();

    await client.testRequest();

    // Verify the X-Galileo-SDK header is present and has correct format
    expect(capturedHeaders['x-galileo-sdk']).toBeDefined();
    expect(capturedHeaders['x-galileo-sdk']).toBe(getSdkIdentifier());
    expect(capturedHeaders['x-galileo-sdk']).toMatch(
      /^galileo-js\/\d+\.\d+\.\d+$/
    );
  });

  it('should include Authorization header', async () => {
    const client = new TestClient();

    await client.testRequest();

    expect(capturedHeaders['authorization']).toBe('Bearer test-token');
  });

  it('should include custom headers when provided', async () => {
    const client = new TestClient();

    await client.makeRequest(
      RequestMethod.GET,
      Routes.healthCheck,
      null,
      {},
      { 'Custom-Header': 'custom-value' }
    );

    expect(capturedHeaders['custom-header']).toBe('custom-value');
    expect(capturedHeaders['x-galileo-sdk']).toBe(getSdkIdentifier());
  });
});

/**
 * Catalog-aligned minimal: Orbit 1006 "Resource not found" required fields only.
 */
const VALID_STANDARD_ERROR: GalileoAPIStandardErrorData = {
  error_code: 1006,
  error_type: 'not_found_error',
  error_group: 'shared',
  severity: 'medium',
  message: 'The requested resource could not be found.',
  retriable: false,
  blocking: false
};

/**
 * Catalog-aligned full: Orbit 1006 with optional fields (dataset not found variant).
 */
const FULL_STANDARD_ERROR: GalileoAPIStandardErrorData = {
  error_code: 1006,
  error_type: 'not_found_error',
  error_group: 'shared',
  severity: 'medium',
  message: 'Dataset with the given id was not found.',
  user_action: 'Verify the identifier and try again.',
  documentation_link: null,
  retriable: false,
  blocking: true,
  http_status_code: 404,
  source_service: 'api',
  context: { dataset_id: 'ds-123' }
};

describe('BaseClient API error handling', () => {
  test('test makeRequest throws GalileoAPIError when response has valid standard_error', async () => {
    server.use(
      http.get('http://localhost:8088/healthcheck', () =>
        HttpResponse.json(
          { standard_error: VALID_STANDARD_ERROR },
          { status: 400 }
        )
      )
    );
    const client = new TestClient();

    let err: unknown;
    try {
      await client.testRequest();
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(GalileoAPIError);
    const apiErr = err as GalileoAPIError;
    expect(apiErr.message).toBe(VALID_STANDARD_ERROR.message);
    expect(apiErr.errorCode).toBe(VALID_STANDARD_ERROR.error_code);
    expect(apiErr.retriable).toBe(VALID_STANDARD_ERROR.retriable);
  });

  test('test makeRequest throws generic parse error when standard_error is present but invalid', async () => {
    server.use(
      http.get('http://localhost:8088/healthcheck', () =>
        HttpResponse.json({ standard_error: { message: 'x' } }, { status: 400 })
      )
    );
    const client = new TestClient();

    await expect(client.testRequest()).rejects.toThrow(
      'The API returned an error, but the details could not be parsed.'
    );
  });

  test('test makeRequest throws generic parse error when standard_error is null', async () => {
    server.use(
      http.get('http://localhost:8088/healthcheck', () =>
        HttpResponse.json({ standard_error: null }, { status: 400 })
      )
    );
    const client = new TestClient();

    await expect(client.testRequest()).rejects.toThrow(
      'The API returned an error, but the details could not be parsed.'
    );
  });

  test('test makeRequest throws generic parse error when standard_error is non-object', async () => {
    server.use(
      http.get('http://localhost:8088/healthcheck', () =>
        HttpResponse.json({ standard_error: 'invalid' }, { status: 400 })
      )
    );
    const client = new TestClient();

    await expect(client.testRequest()).rejects.toThrow(
      'The API returned an error, but the details could not be parsed.'
    );
  });

  test('test makeRequest throws generic parse error when standard_error is empty object', async () => {
    server.use(
      http.get('http://localhost:8088/healthcheck', () =>
        HttpResponse.json({ standard_error: {} }, { status: 400 })
      )
    );
    const client = new TestClient();

    await expect(client.testRequest()).rejects.toThrow(
      /The API returned an error, but the details could not be parsed\./
    );
  });

  test('test makeRequest throws generic parse error when standard_error is array', async () => {
    server.use(
      http.get('http://localhost:8088/healthcheck', () =>
        HttpResponse.json({ standard_error: [] }, { status: 400 })
      )
    );
    const client = new TestClient();

    await expect(client.testRequest()).rejects.toThrow(
      /The API returned an error, but the details could not be parsed\./
    );
  });

  test('test makeRequest throws generic parse error when standard_error has invalid optional type', async () => {
    server.use(
      http.get('http://localhost:8088/healthcheck', () =>
        HttpResponse.json(
          {
            standard_error: {
              ...VALID_STANDARD_ERROR,
              documentation_link: 1
            }
          },
          { status: 400 }
        )
      )
    );
    const client = new TestClient();

    await expect(client.testRequest()).rejects.toThrow(
      /The API returned an error, but the details could not be parsed\./
    );
  });

  test('test makeRequest throws GENERIC_ERROR_MESSAGE when error body is null', async () => {
    server.use(
      http.get('http://localhost:8088/healthcheck', () =>
        HttpResponse.json(null, { status: 500 })
      )
    );
    const client = new TestClient();

    await expect(client.testRequest()).rejects.toThrow(GENERIC_ERROR_MESSAGE);
  });

  test('test makeRequest throws GENERIC_ERROR_MESSAGE when error body is string', async () => {
    server.use(
      http.get('http://localhost:8088/healthcheck', () =>
        HttpResponse.json('error', { status: 500 })
      )
    );
    const client = new TestClient();

    await expect(client.testRequest()).rejects.toThrow(GENERIC_ERROR_MESSAGE);
  });

  test('test makeRequest throws GalileoAPIError with all mapped properties when response has valid standard_error', async () => {
    server.use(
      http.get('http://localhost:8088/healthcheck', () =>
        HttpResponse.json(
          { standard_error: FULL_STANDARD_ERROR },
          { status: 400 }
        )
      )
    );
    const client = new TestClient();

    let err: unknown;
    try {
      await client.testRequest();
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(GalileoAPIError);
    const apiErr = err as GalileoAPIError;
    expect(apiErr.message).toBe(FULL_STANDARD_ERROR.message);
    expect(apiErr.errorCode).toBe(FULL_STANDARD_ERROR.error_code);
    expect(apiErr.errorType).toBe(FULL_STANDARD_ERROR.error_type);
    expect(apiErr.errorGroup).toBe(FULL_STANDARD_ERROR.error_group);
    expect(apiErr.severity).toBe(FULL_STANDARD_ERROR.severity);
    expect(apiErr.userAction).toBe(FULL_STANDARD_ERROR.user_action);
    expect(apiErr.documentationLink).toBe(
      FULL_STANDARD_ERROR.documentation_link
    );
    expect(apiErr.retriable).toBe(FULL_STANDARD_ERROR.retriable);
    expect(apiErr.blocking).toBe(FULL_STANDARD_ERROR.blocking);
    expect(apiErr.httpStatusCode).toBe(FULL_STANDARD_ERROR.http_status_code);
    expect(apiErr.sourceService).toBe(FULL_STANDARD_ERROR.source_service);
    expect(apiErr.context).toEqual(FULL_STANDARD_ERROR.context);
  });

  test('test makeRequest throws with detail message when detail is string and statusCode present', async () => {
    server.use(
      http.get('http://localhost:8088/healthcheck', () =>
        HttpResponse.json({ detail: 'Validation failed' }, { status: 422 })
      )
    );
    const client = new TestClient();

    await expect(client.testRequest()).rejects.toThrow(
      /non-ok status code 422 with output: Validation failed/
    );
  });

  test('test makeRequest throws with detail message when detail is validation array', async () => {
    server.use(
      http.get('http://localhost:8088/healthcheck', () =>
        HttpResponse.json(
          {
            detail: [
              {
                loc: ['body', 'x'],
                msg: 'field required',
                type: 'value_error'
              }
            ]
          },
          { status: 422 }
        )
      )
    );
    const client = new TestClient();

    await expect(client.testRequest()).rejects.toThrow(
      /non-ok status code 422 with output: field required/
    );
  });

  test('test makeRequest throws GENERIC_ERROR_MESSAGE when error body has neither standard_error nor detail', async () => {
    server.use(
      http.get('http://localhost:8088/healthcheck', () =>
        HttpResponse.json({}, { status: 500 })
      )
    );
    const client = new TestClient();

    await expect(client.testRequest()).rejects.toThrow(GENERIC_ERROR_MESSAGE);
  });

  test('test makeRequest throws with GENERIC_ERROR_MESSAGE when detail is array but first element has no msg', async () => {
    server.use(
      http.get('http://localhost:8088/healthcheck', () =>
        HttpResponse.json(
          {
            detail: [{ loc: ['body', 'x'], type: 'value_error' }]
          },
          { status: 422 }
        )
      )
    );
    const client = new TestClient();

    await expect(client.testRequest()).rejects.toThrow(
      /non-ok status code 422 with output: This error has been automatically tracked/
    );
  });
});

describe('BaseClient path parameter substitution', () => {
  test('test makeRequest substitutes project_id in route and hits correct URL', async () => {
    const client = new TestClient();
    getProjectHandler.mockClear();

    const result = await client.makeRequest<{ id: string }>(
      RequestMethod.GET,
      Routes.project,
      null,
      { project_id: 'p-1' }
    );

    expect(getProjectHandler).toHaveBeenCalled();
    expect(result).toEqual({ id: 'p-1' });
  });
});

describe('BaseClient makeStreamingRequest', () => {
  test('test makeStreamingRequest returns Readable and can be consumed', async () => {
    const client = new TestClient();

    const stream = await client.makeStreamingRequest(
      RequestMethod.GET,
      Routes.healthCheck
    );

    expect(stream).toBeDefined();
    expect(stream instanceof Readable).toBe(true);
    const data = await new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) =>
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      );
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      stream.on('error', reject);
    });
    expect(data.length).toBeGreaterThan(0);
    expect(JSON.parse(data)).toEqual({ status: 'ok' });
  });

  test('test makeStreamingRequest on 4xx with JSON stream body throws GalileoAPIError', async () => {
    const body = JSON.stringify({
      standard_error: VALID_STANDARD_ERROR
    });
    const streamBody = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(body));
        controller.close();
      }
    });
    server.use(
      http.get(
        'http://localhost:8088/healthcheck',
        () =>
          new HttpResponse(streamBody, {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          })
      )
    );
    const client = new TestClient();

    let err: unknown;
    try {
      await client.makeStreamingRequest(RequestMethod.GET, Routes.healthCheck);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(GalileoAPIError);
    expect((err as GalileoAPIError).message).toBe(VALID_STANDARD_ERROR.message);
  });

  test('test makeStreamingRequest on 4xx with non-JSON stream body throws with detail', async () => {
    const streamBody = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('not valid json'));
        controller.close();
      }
    });
    server.use(
      http.get(
        'http://localhost:8088/healthcheck',
        () => new HttpResponse(streamBody, { status: 400 })
      )
    );
    const client = new TestClient();

    await expect(
      client.makeStreamingRequest(RequestMethod.GET, Routes.healthCheck)
    ).rejects.toThrow(/non-ok status code 400 with output: not valid json/);
  });
});

describe('BaseClient validateError', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('test validateError throws Request failed when Axios error has no response', async () => {
    const networkError = Object.assign(new Error('Network Error'), {
      isAxiosError: true
    });
    jest.spyOn(axios, 'request').mockRejectedValue(networkError);
    const client = new TestClient();

    await expect(client.testRequest()).rejects.toThrow(
      'Request failed: Network Error'
    );
  });

  test('test validateError rethrows non-Axios error', async () => {
    jest.spyOn(axios, 'request').mockRejectedValue(new Error('custom'));
    const client = new TestClient();

    await expect(client.testRequest()).rejects.toThrow('custom');
  });
});
