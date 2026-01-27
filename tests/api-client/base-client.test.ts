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
}

let capturedHeaders: Record<string, string> = {};

const server = setupServer(
  http.get('http://localhost:8088/healthcheck', ({ request }) => {
    capturedHeaders = {};
    request.headers.forEach((value, key) => {
      capturedHeaders[key] = value;
    });
    return HttpResponse.json({ status: 'ok' });
  })
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
});
