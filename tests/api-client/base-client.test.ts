import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { BaseClient, RequestMethod } from '../../src/api-client/base-client';
import { Routes } from '../../src/types/routes.types';
import { getSdkIdentifier } from '../../src/utils/version';

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

describe('BaseClient Headers', () => {
  let capturedHeaders: Record<string, string> = {};

  const server = setupServer(
    http.get('http://localhost:8088/healthcheck', ({ request }) => {
      // Capture headers from the request
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
    const server = setupServer(
      http.get('http://localhost:8088/healthcheck', ({ request }) => {
        capturedHeaders = {};
        request.headers.forEach((value, key) => {
          capturedHeaders[key] = value;
        });
        return HttpResponse.json({ status: 'ok' });
      })
    );

    server.listen();

    const client = new TestClient();

    // Test with extra headers
    await client.makeRequest(
      RequestMethod.GET,
      Routes.healthCheck,
      null,
      {},
      { 'Custom-Header': 'custom-value' }
    );

    expect(capturedHeaders['custom-header']).toBe('custom-value');
    expect(capturedHeaders['x-galileo-sdk']).toBe(getSdkIdentifier());

    server.close();
  });
});
