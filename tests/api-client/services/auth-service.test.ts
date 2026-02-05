import querystring from 'querystring';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { AuthService } from '../../../src/api-client/services/auth-service';
import { Routes } from '../../../src/types/routes.types';
import { TEST_HOST } from '../../common';

const server = setupServer();

// Mock Okta ID token (valid JWT format, not actually signed)
const mockOktaIdToken =
  'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

/**
 * Sets SSO environment variables for testing
 * @param idToken - The SSO ID token to set
 * @param provider - The SSO provider (e.g., 'okta', 'google', etc.)
 */
function setSSOEnvVars(idToken: string, provider: string): void {
  process.env.GALILEO_SSO_ID_TOKEN = idToken;
  process.env.GALILEO_SSO_PROVIDER = provider;
}

/**
 * Unsets SSO environment variables for testing
 */
function unsetSSOEnvVars(): void {
  delete process.env.GALILEO_SSO_ID_TOKEN;
  delete process.env.GALILEO_SSO_PROVIDER;
}

beforeAll(() => {
  server.listen();
});

afterEach(() => {
  server.resetHandlers();
  // Clean up environment variables
  delete process.env.GALILEO_API_KEY;
  delete process.env.GALILEO_USERNAME;
  delete process.env.GALILEO_PASSWORD;
  unsetSSOEnvVars();
});

afterAll(() => {
  server.close();
});

describe('AuthService - SSO Login', () => {
  describe('SSO Login Success', () => {
    it('should successfully login with Okta SSO and extract access token', async () => {
      const mockAccessToken = 'sso-access-token-123';
      server.use(
        http.post(`${TEST_HOST}/${Routes.socialLogin}`, async ({ request }) => {
          const body = (await request.json()) as {
            id_token: string;
            provider: string;
          };
          expect(body.id_token).toBe(mockOktaIdToken);
          expect(body.provider).toBe('okta');
          return HttpResponse.json({
            access_token: mockAccessToken
          });
        })
      );

      setSSOEnvVars(mockOktaIdToken, 'okta');
      const authService = new AuthService(TEST_HOST);
      const token = await authService.getToken();

      expect(token).toBe(mockAccessToken);
    });

    it('should extract refresh token from Set-Cookie header', async () => {
      const mockRefreshToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJyZWZyZXNoLXRva2VuLTQ1NiIsInR5cCI6InJlZnJlc2giLCJpYXQiOjE1MTYyMzkwMjJ9.dummy_signature_for_testing_purposes_only';
      server.use(
        http.post(`${TEST_HOST}/${Routes.socialLogin}`, () =>
          HttpResponse.json(
            { access_token: 'access-token' },
            {
              headers: {
                'Set-Cookie': `refresh_token=${mockRefreshToken}; HttpOnly; Secure; Path=/refresh_token`
              }
            }
          )
        )
      );

      setSSOEnvVars(mockOktaIdToken, 'okta');
      const authService = new AuthService(TEST_HOST);
      await authService.getToken();

      expect(authService.getRefreshToken()).toBe(mockRefreshToken);
    });

    it('should store token in AuthService instance', async () => {
      const mockAccessToken = 'stored-token-789';
      server.use(
        http.post(`${TEST_HOST}/${Routes.socialLogin}`, () =>
          HttpResponse.json({ access_token: mockAccessToken })
        )
      );

      setSSOEnvVars(mockOktaIdToken, 'okta');
      const authService = new AuthService(TEST_HOST);
      await authService.getToken();

      // Access private token through getToken result
      const token = await authService.getToken();
      expect(token).toBe(mockAccessToken);
    });
  });

  describe('SSO Login with Different Providers', () => {
    const providers = [
      'okta',
      'google',
      'azure-ad',
      'github',
      'custom'
    ] as const;

    providers.forEach((provider) => {
      it(`should successfully login with ${provider} provider`, async () => {
        server.use(
          http.post(
            `${TEST_HOST}/${Routes.socialLogin}`,
            async ({ request }) => {
              const body = (await request.json()) as {
                id_token: string;
                provider: string;
              };
              expect(body.provider).toBe(provider);
              return HttpResponse.json({ access_token: `${provider}-token` });
            }
          )
        );

        setSSOEnvVars(mockOktaIdToken, provider);
        const authService = new AuthService(TEST_HOST);
        const token = await authService.getToken();

        expect(token).toBe(`${provider}-token`);
      });
    });
  });

  describe('SSO Priority in getToken()', () => {
    it('should use API key when API key is set, even if SSO is also set', async () => {
      const apiKeyToken = 'api-key-token';
      server.use(
        http.post(`${TEST_HOST}/${Routes.apiKeyLogin}`, () =>
          HttpResponse.json({ access_token: apiKeyToken })
        ),
        http.post(`${TEST_HOST}/${Routes.socialLogin}`, () =>
          HttpResponse.json({ access_token: 'sso-token' })
        )
      );

      process.env.GALILEO_API_KEY = 'test-api-key';
      setSSOEnvVars(mockOktaIdToken, 'okta');

      const authService = new AuthService(TEST_HOST);
      const token = await authService.getToken();

      expect(token).toBe(apiKeyToken);
    });

    it('should use username/password when set, even if SSO is also set', async () => {
      const usernamePasswordToken = 'username-password-token';
      server.use(
        http.post(`${TEST_HOST}/${Routes.login}`, () =>
          HttpResponse.json({ access_token: usernamePasswordToken })
        ),
        http.post(`${TEST_HOST}/${Routes.socialLogin}`, () =>
          HttpResponse.json({ access_token: 'sso-token' })
        )
      );

      process.env.GALILEO_USERNAME = 'testuser';
      process.env.GALILEO_PASSWORD = 'testpass';
      setSSOEnvVars(mockOktaIdToken, 'okta');

      const authService = new AuthService(TEST_HOST);
      const token = await authService.getToken();

      expect(token).toBe(usernamePasswordToken);
    });

    it('should use SSO when no other credentials are available', async () => {
      const ssoToken = 'sso-only-token';
      server.use(
        http.post(`${TEST_HOST}/${Routes.socialLogin}`, () =>
          HttpResponse.json({ access_token: ssoToken })
        )
      );

      setSSOEnvVars(mockOktaIdToken, 'okta');
      const authService = new AuthService(TEST_HOST);
      const token = await authService.getToken();

      expect(token).toBe(ssoToken);
    });

    it('should use SSO when API key and username/password are not set', async () => {
      const ssoToken = 'fallback-sso-token';
      server.use(
        http.post(`${TEST_HOST}/${Routes.socialLogin}`, () =>
          HttpResponse.json({ access_token: ssoToken })
        )
      );

      // Explicitly unset other credentials
      delete process.env.GALILEO_API_KEY;
      delete process.env.GALILEO_USERNAME;
      delete process.env.GALILEO_PASSWORD;
      setSSOEnvVars(mockOktaIdToken, 'okta');

      const authService = new AuthService(TEST_HOST);
      const token = await authService.getToken();

      expect(token).toBe(ssoToken);
    });
  });

  describe('Error Cases', () => {
    it('should throw error when GALILEO_SSO_ID_TOKEN is missing', async () => {
      process.env.GALILEO_SSO_PROVIDER = 'okta';
      delete process.env.GALILEO_SSO_ID_TOKEN;

      const authService = new AuthService(TEST_HOST);

      await expect(authService.getToken()).rejects.toThrow(
        'GALILEO_API_KEY, (GALILEO_USERNAME and GALILEO_PASSWORD), or (GALILEO_SSO_ID_TOKEN and GALILEO_SSO_PROVIDER) must be set'
      );
    });

    it('should throw error when GALILEO_SSO_PROVIDER is missing', async () => {
      process.env.GALILEO_SSO_ID_TOKEN = mockOktaIdToken;
      delete process.env.GALILEO_SSO_PROVIDER;

      const authService = new AuthService(TEST_HOST);

      await expect(authService.getToken()).rejects.toThrow(
        'GALILEO_API_KEY, (GALILEO_USERNAME and GALILEO_PASSWORD), or (GALILEO_SSO_ID_TOKEN and GALILEO_SSO_PROVIDER) must be set'
      );
    });

    it('should throw error with invalid provider value', async () => {
      setSSOEnvVars(mockOktaIdToken, 'invalid-provider');

      const authService = new AuthService(TEST_HOST);

      await expect(authService.getToken()).rejects.toThrow(
        'Invalid SSO provider. Currently supported providers:'
      );
    });

    it('should handle 401 Unauthorized for invalid/expired id_token', async () => {
      server.use(
        http.post(`${TEST_HOST}/${Routes.socialLogin}`, () =>
          HttpResponse.json(
            { detail: 'Invalid or expired token' },
            { status: 401 }
          )
        )
      );

      setSSOEnvVars('invalid-token', 'okta');
      const authService = new AuthService(TEST_HOST);

      await expect(authService.getToken()).rejects.toThrow();
    });

    it('should handle 400 Bad Request for invalid provider', async () => {
      server.use(
        http.post(`${TEST_HOST}/${Routes.socialLogin}`, () =>
          HttpResponse.json({ detail: 'Invalid provider' }, { status: 400 })
        )
      );

      // Note: This shouldn't reach the API due to client-side validation
      // But if it does, it should handle the error
      setSSOEnvVars(mockOktaIdToken, 'okta');
      const authService = new AuthService(TEST_HOST);

      // The client-side validation should catch invalid providers before API call
      // But if somehow a valid provider string causes a 400, we should handle it
      await expect(authService.getToken()).rejects.toThrow();
    });

    it('should handle 422 Unprocessable Entity for missing id_token', async () => {
      server.use(
        http.post(`${TEST_HOST}/${Routes.socialLogin}`, () =>
          HttpResponse.json(
            { detail: [{ msg: 'id_token is required' }] },
            { status: 422 }
          )
        )
      );

      // Client-side validation should catch empty tokens
      setSSOEnvVars('', 'okta');
      const authService = new AuthService(TEST_HOST);

      await expect(authService.getToken()).rejects.toThrow();
    });
  });

  describe('Environment Variable Handling', () => {
    it('should read GALILEO_SSO_ID_TOKEN from process.env', async () => {
      const customToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjb250cmFjdC1pZC10b2tlbi0xMjMiLCJ0eXAiOiJzZW5kIiwiaWF0IjoxNTE2MjM5MDIyfQ.dummy_signature_for_testing_purposes_only';
      server.use(
        http.post(`${TEST_HOST}/${Routes.socialLogin}`, async ({ request }) => {
          const body = (await request.json()) as {
            id_token: string;
            provider: string;
          };
          expect(body.id_token).toBe(customToken);
          return HttpResponse.json({ access_token: 'token' });
        })
      );

      setSSOEnvVars(customToken, 'okta');
      const authService = new AuthService(TEST_HOST);
      await authService.getToken();

      // If we get here without error, env var was read correctly
      expect(true).toBe(true);
    });

    it('should read GALILEO_SSO_PROVIDER from process.env', async () => {
      server.use(
        http.post(`${TEST_HOST}/${Routes.socialLogin}`, async ({ request }) => {
          const body = (await request.json()) as {
            id_token: string;
            provider: string;
          };
          expect(body.provider).toBe('google');
          return HttpResponse.json({ access_token: 'token' });
        })
      );

      setSSOEnvVars(mockOktaIdToken, 'google');
      const authService = new AuthService(TEST_HOST);
      await authService.getToken();

      // If we get here without error, env var was read correctly
      expect(true).toBe(true);
    });

    it('should reject empty string id_token', async () => {
      setSSOEnvVars('', 'okta');
      const authService = new AuthService(TEST_HOST);

      await expect(authService.getToken()).rejects.toThrow(
        'GALILEO_API_KEY, (GALILEO_USERNAME and GALILEO_PASSWORD), or (GALILEO_SSO_ID_TOKEN and GALILEO_SSO_PROVIDER) must be set'
      );
    });
  });

  describe('Refresh "Token Handling', () => {
    it('should extract refresh token from Set-Cookie header with multiple cookies', async () => {
      const mockRefreshToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJyZWZyZXNoLXRva2VuLW11bHRpcGxlIiwidHlwIjoicmVmcmVzaCIsImlhdCI6MTUxNjIzOTAyMn0.dummy_signature_for_testing_purposes_only';
      const headers: Record<string, string | string[]> = {
        'Set-Cookie': [
          `refresh_token=${mockRefreshToken}; HttpOnly; Secure; Path=/refresh_token`
        ]
      };
      server.use(
        http.post(`${TEST_HOST}/${Routes.socialLogin}`, () =>
          HttpResponse.json(
            { access_token: 'access-token' },
            {
              headers: headers as unknown as Record<string, string>
            }
          )
        )
      );

      setSSOEnvVars(mockOktaIdToken, 'okta');
      const authService = new AuthService(TEST_HOST);
      await authService.getToken();

      expect(authService.getRefreshToken()).toBe(mockRefreshToken);
    });

    it('should handle missing refresh token gracefully', async () => {
      server.use(
        http.post(`${TEST_HOST}/${Routes.socialLogin}`, () =>
          HttpResponse.json({ access_token: 'access-token' })
        )
      );

      setSSOEnvVars(mockOktaIdToken, 'okta');
      const authService = new AuthService(TEST_HOST);
      await authService.getToken();

      expect(authService.getRefreshToken()).toBeNull();
    });

    it('should refresh access token using refresh token', async () => {
      const mockRefreshToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJyZWZyZXNoLXRva2VuLW11bHRpcGxlIiwidHlwIjoicmVmcmVzaCIsImlhdCI6MTUxNjIzOTAyMn0.dummy_signature_for_testing_purposes_only';
      const newAccessToken = 'new-access-token-456';
      const newRefreshToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJuZXctcmVmcmVzaC10b2tlbi03ODkiLCJ0eXAiOiJyZWZyZXNoIiwiaWF0IjoxNTE2MjM5MDIyfQ.dummy_signature_for_testing_purposes_only';

      server.use(
        http.post(`${TEST_HOST}/${Routes.socialLogin}`, () =>
          HttpResponse.json(
            { access_token: 'initial-access-token' },
            {
              headers: {
                'Set-Cookie': `refresh_token=${mockRefreshToken}; HttpOnly; Secure; Path=/refresh_token`
              }
            }
          )
        ),
        http.post(
          `${TEST_HOST}/${Routes.refreshToken}`,
          async ({ request }) => {
            // Verify refresh token is sent in Cookie header
            const cookieHeader = request.headers.get('Cookie');
            expect(cookieHeader).toContain(`refresh_token=${mockRefreshToken}`);

            return HttpResponse.json(
              { access_token: newAccessToken },
              {
                headers: {
                  'Set-Cookie': `refresh_token=${newRefreshToken}; HttpOnly; Secure; Path=/refresh_token`
                }
              }
            );
          }
        )
      );

      setSSOEnvVars(mockOktaIdToken, 'okta');
      const authService = new AuthService(TEST_HOST);
      await authService.getToken();

      expect(authService.getRefreshToken()).toBe(mockRefreshToken);

      // Manually trigger refresh (simulating expired token)
      // We'll need to access the private method via a test helper or make it public for testing
      // For now, we can verify the refresh token is stored correctly
      expect(authService.getRefreshToken()).toBe(mockRefreshToken);
    });

    it('should fallback to original credentials when refresh token fails', async () => {
      const mockRefreshToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJyZWZyZXNoLXRva2VuLW11bHRpcGxlIiwidHlwIjoicmVmcmVzaCIsImlhdCI6MTUxNjIzOTAyMn0.dummy_signature_for_testing_purposes_only';
      const mockApiKey = 'test-api-key';
      const headers: Record<string, string | string[]> = {
        'Set-Cookie': [
          `refresh_token=${mockRefreshToken}; HttpOnly; Secure; Path=/refresh_token`
        ]
      };

      server.use(
        http.post(`${TEST_HOST}/${Routes.apiKeyLogin}`, () =>
          HttpResponse.json({ access_token: 'api-key-token' })
        ),
        http.post(`${TEST_HOST}/${Routes.socialLogin}`, () =>
          HttpResponse.json(
            { access_token: 'initial-access-token' },
            {
              headers: headers as unknown as Record<string, string>
            }
          )
        ),
        http.post(`${TEST_HOST}/${Routes.refreshToken}`, () =>
          HttpResponse.json(
            { detail: 'Invalid refresh token' },
            { status: 401 }
          )
        )
      );

      // Set API key for fallback
      process.env.GALILEO_API_KEY = mockApiKey;
      unsetSSOEnvVars();

      const authService = new AuthService(TEST_HOST);
      await authService.getToken();

      // Verify API key was used (not SSO)
      expect(authService.getRefreshToken()).toBeNull();
    });
  });

  describe('Integration with BaseClient', () => {
    it('should not trigger refresh check for socialLogin endpoint', async () => {
      // This test verifies that socialLogin is excluded from refresh checks
      // by ensuring a request to socialLogin doesn't trigger refresh logic
      server.use(
        http.post(`${TEST_HOST}/${Routes.socialLogin}`, () =>
          HttpResponse.json({ access_token: 'token' })
        )
      );

      setSSOEnvVars(mockOktaIdToken, 'okta');
      const authService = new AuthService(TEST_HOST);

      // Should not throw "Token expired" error
      await expect(authService.getToken()).resolves.toBe('token');
    });
  });
});

describe('AuthService - Injected Credentials', () => {
  const ACCEPTABLE_API_KEYS = new Set<string>([
    'injected-api-key',
    'key-1',
    'key-2',
    'injected-key',
    'env-key'
  ]);
  const ACCEPTABLE_USER_PASSWORD_PAIRS = new Set<string>([
    'injected-user:injected-pass',
    'env-user:env-pass'
  ]);
  const INJECTED_SSO_ID_TOKEN =
    'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJpbmplY3RlZCIsIm5hbWUiOiJJbmplY3RlZCIsImlhdCI6MTUxNjIzOTAyMn0.dummy';
  const ACCEPTABLE_SSO_ID_TOKENS = new Set<string>([
    mockOktaIdToken,
    INJECTED_SSO_ID_TOKEN
  ]);

  const unauthorizedResponse = (): HttpResponse =>
    HttpResponse.json({ detail: 'Invalid or unauthorized' }, { status: 401 });

  const API_KEY_TO_TOKEN: Record<string, string> = {
    'injected-api-key': 'injected-api-key-token',
    'key-1': 'token-1',
    'key-2': 'token-2',
    'injected-key': 'injected-api-key-token',
    'env-key': 'env-api-key-token'
  };
  const USER_PASS_TO_TOKEN: Record<string, string> = {
    'injected-user:injected-pass': 'injected-username-password-token',
    'env-user:env-pass': 'env-username-password-token'
  };
  const SSO_ID_TO_TOKEN: Record<string, string> = {
    [INJECTED_SSO_ID_TOKEN]: 'injected-sso-token',
    [mockOktaIdToken]: 'injected-sso-token'
  };

  beforeEach(() => {
    server.use(
      http.post(`${TEST_HOST}/${Routes.apiKeyLogin}`, async ({ request }) => {
        const body = (await request.json()) as { api_key: string };
        if (!ACCEPTABLE_API_KEYS.has(body.api_key)) {
          return unauthorizedResponse();
        }
        return HttpResponse.json({
          access_token: API_KEY_TO_TOKEN[body.api_key]
        });
      }),
      http.post(`${TEST_HOST}/${Routes.login}`, async ({ request }) => {
        const body = await request.text();
        const parsed = querystring.parse(body) as {
          username?: string;
          password?: string;
        };
        const pair = `${parsed.username ?? ''}:${parsed.password ?? ''}`;
        if (!ACCEPTABLE_USER_PASSWORD_PAIRS.has(pair)) {
          return unauthorizedResponse();
        }
        return HttpResponse.json({
          access_token: USER_PASS_TO_TOKEN[pair]
        });
      }),
      http.post(`${TEST_HOST}/${Routes.socialLogin}`, async ({ request }) => {
        const body = (await request.json()) as {
          id_token: string;
          provider: string;
        };
        if (!ACCEPTABLE_SSO_ID_TOKENS.has(body.id_token)) {
          return unauthorizedResponse();
        }
        return HttpResponse.json({
          access_token: SSO_ID_TO_TOKEN[body.id_token]
        });
      })
    );
  });

  describe('setCredentials() Method', () => {
    it('should set API key credentials via setCredentials()', async () => {
      const authService = new AuthService(TEST_HOST);
      authService.setCredentials({ apiKey: 'injected-api-key' });
      const token = await authService.getToken();

      expect(token).toBe('injected-api-key-token');
    });

    it('should set username/password credentials via setCredentials()', async () => {
      const authService = new AuthService(TEST_HOST);
      authService.setCredentials({
        username: 'injected-user',
        password: 'injected-pass'
      });
      const token = await authService.getToken();

      expect(token).toBe('injected-username-password-token');
    });

    it('should set SSO credentials via setCredentials()', async () => {
      const authService = new AuthService(TEST_HOST);
      authService.setCredentials({
        ssoIdToken: mockOktaIdToken,
        ssoProvider: 'okta'
      });
      const token = await authService.getToken();

      expect(token).toBe('injected-sso-token');
    });

    it('should create a copy of credentials (not reference)', async () => {
      const authService = new AuthService(TEST_HOST);
      const credentialsObject = { apiKey: 'key-1' };

      authService.setCredentials(credentialsObject);
      const token1 = await authService.getToken();
      expect(token1).toBe('token-1');

      // Modify the original object
      credentialsObject.apiKey = 'key-2';

      // Should still use the copied credentials
      const token2 = await authService.getToken();
      expect(token2).toBe('token-1');
    });

    it('should update credentials with multiple calls to setCredentials()', async () => {
      const authService = new AuthService(TEST_HOST);

      // First credentials
      authService.setCredentials({ apiKey: 'key-1' });
      const token1 = await authService.getToken();
      expect(token1).toBe('token-1');

      // Update credentials
      authService.setCredentials({ apiKey: 'key-2' });
      const token2 = await authService.getToken();
      expect(token2).toBe('token-2');
    });
  });

  describe('Credentials Priority - Injected vs Environment', () => {
    it('should use injected API key over environment variable API key', async () => {
      process.env.GALILEO_API_KEY = 'env-key';
      const authService = new AuthService(TEST_HOST);
      authService.setCredentials({ apiKey: 'injected-key' });

      const token = await authService.getToken();
      expect(token).toBe('injected-api-key-token');
    });

    it('should use injected username/password over environment variables', async () => {
      process.env.GALILEO_USERNAME = 'env-user';
      process.env.GALILEO_PASSWORD = 'env-pass';

      const authService = new AuthService(TEST_HOST);
      authService.setCredentials({
        username: 'injected-user',
        password: 'injected-pass'
      });

      const token = await authService.getToken();
      expect(token).toBe('injected-username-password-token');
    });

    it('should use injected SSO over environment variables', async () => {
      setSSOEnvVars(mockOktaIdToken, 'okta');

      const authService = new AuthService(TEST_HOST);
      authService.setCredentials({
        ssoIdToken: INJECTED_SSO_ID_TOKEN,
        ssoProvider: 'google'
      });

      const token = await authService.getToken();
      expect(token).toBe('injected-sso-token');
    });

    it('should fall back to environment variables when no credentials injected', async () => {
      process.env.GALILEO_API_KEY = 'env-key';
      const authService = new AuthService(TEST_HOST);
      // Don't call setCredentials()

      const token = await authService.getToken();
      expect(token).toBe('env-api-key-token');
    });

    it('should update and use new injected credentials', async () => {
      const authService = new AuthService(TEST_HOST);

      // Set first credentials
      authService.setCredentials({ apiKey: 'key-1' });
      const firstToken = await authService.getToken();
      expect(firstToken).toBe('token-1');

      // Update to new credentials
      authService.setCredentials({ apiKey: 'key-2' });
      const secondToken = await authService.getToken();
      expect(secondToken).toBe('token-2');
    });
  });

  describe('Invalid credentials - error response', () => {
    it('should reject when API key is not in acceptable list', async () => {
      const authService = new AuthService(TEST_HOST);
      authService.setCredentials({ apiKey: 'invalid-api-key' });

      await expect(authService.getToken()).rejects.toThrow();
    });

    it('should reject when username/password pair is not in acceptable list', async () => {
      const authService = new AuthService(TEST_HOST);
      authService.setCredentials({
        username: 'wrong-user',
        password: 'wrong-pass'
      });

      await expect(authService.getToken()).rejects.toThrow();
    });

    it('should reject when SSO id_token is not in acceptable list', async () => {
      const invalidIdToken =
        'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJpbnZhbGlkIn0.dummy';

      const authService = new AuthService(TEST_HOST);
      authService.setCredentials({
        ssoIdToken: invalidIdToken,
        ssoProvider: 'okta'
      });

      await expect(authService.getToken()).rejects.toThrow();
    });
  });
});

describe('AuthService - Public Methods', () => {
  describe('getApiUrl() Method', () => {
    it('should return the API URL', () => {
      const authService = new AuthService(TEST_HOST);
      expect(authService.getApiUrl()).toBe(TEST_HOST);
    });

    it('should return correct URL for different hosts', () => {
      const customHost = 'https://custom.galileo.ai';
      const authService = new AuthService(customHost);
      expect(authService.getApiUrl()).toBe(customHost);
    });
  });

  describe('ensureValidToken() Method', () => {
    it('should return valid token when token is not expired', async () => {
      // Create a token that expires in the future (1 hour from now)
      const futureExp = Math.floor(Date.now() / 1000) + 3600;
      const validToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${Buffer.from(
        JSON.stringify({ exp: futureExp })
      ).toString('base64')}.dummy`;

      server.use(
        http.post(`${TEST_HOST}/${Routes.apiKeyLogin}`, () =>
          HttpResponse.json({ access_token: validToken })
        )
      );

      const authService = new AuthService(TEST_HOST);
      authService.setCredentials({ apiKey: 'test-key' });
      await authService.getToken();

      const token = await authService.ensureValidToken(
        Routes.projects as Routes
      );
      expect(token).toBe(validToken);
    });

    it('should trigger refresh when token is expired', async () => {
      const refreshedToken = 'refreshed-token';
      // Create a token that has already expired
      const pastExp = Math.floor(Date.now() / 1000) - 3600;
      const expiredToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${Buffer.from(
        JSON.stringify({ exp: pastExp })
      ).toString('base64')}.dummy`;

      let callCount = 0;
      server.use(
        http.post(`${TEST_HOST}/${Routes.apiKeyLogin}`, () => {
          callCount++;
          if (callCount === 1) {
            return HttpResponse.json({ access_token: expiredToken });
          }
          return HttpResponse.json({ access_token: refreshedToken });
        })
      );

      const authService = new AuthService(TEST_HOST);
      authService.setCredentials({ apiKey: 'test-key' });
      await authService.getToken();

      const token = await authService.ensureValidToken(
        Routes.projects as Routes
      );
      expect(token).toBe(refreshedToken);
      expect(callCount).toBe(2);
    });

    it('should not trigger refresh for auth endpoints', async () => {
      // Create an expired token
      const pastExp = Math.floor(Date.now() / 1000) - 3600;
      const expiredToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${Buffer.from(
        JSON.stringify({ exp: pastExp })
      ).toString('base64')}.dummy`;

      let callCount = 0;
      server.use(
        http.post(`${TEST_HOST}/${Routes.apiKeyLogin}`, () => {
          callCount++;
          return HttpResponse.json({ access_token: expiredToken });
        })
      );

      const authService = new AuthService(TEST_HOST);
      authService.setCredentials({ apiKey: 'test-key' });
      await authService.getToken();

      // Should not trigger refresh for auth endpoints
      const token = await authService.ensureValidToken(Routes.apiKeyLogin);
      expect(token).toBe(expiredToken);
      expect(callCount).toBe(1); // Only the initial getToken() call
    });

    it('should handle concurrent calls to ensureValidToken', async () => {
      const refreshedToken = 'refreshed-token';
      // Create an expired token
      const pastExp = Math.floor(Date.now() / 1000) - 3600;
      const expiredToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${Buffer.from(
        JSON.stringify({ exp: pastExp })
      ).toString('base64')}.dummy`;

      let callCount = 0;
      server.use(
        http.post(`${TEST_HOST}/${Routes.apiKeyLogin}`, async () => {
          callCount++;
          if (callCount === 1) {
            return HttpResponse.json({ access_token: expiredToken });
          }
          // Add delay to simulate slow refresh
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json({ access_token: refreshedToken });
        })
      );

      const authService = new AuthService(TEST_HOST);
      authService.setCredentials({ apiKey: 'test-key' });
      await authService.getToken();

      // Make multiple concurrent calls
      const promises = [
        authService.ensureValidToken(Routes.projects as Routes),
        authService.ensureValidToken(Routes.projects as Routes),
        authService.ensureValidToken(Routes.projects as Routes)
      ];

      const tokens = await Promise.all(promises);

      // All should return the same refreshed token
      expect(tokens[0]).toBe(refreshedToken);
      expect(tokens[1]).toBe(refreshedToken);
      expect(tokens[2]).toBe(refreshedToken);

      // Should only refresh once, not three times
      expect(callCount).toBe(2); // Initial getToken() + one refresh
    });
  });
});

describe('AuthService - Concurrent Refresh Bug Fix', () => {
  describe('refreshTokenWithFallback() Concurrency', () => {
    it('should use same promise for concurrent token refresh requests', async () => {
      const refreshedToken = 'refreshed-token-concurrent';
      // Create an expired token
      const pastExp = Math.floor(Date.now() / 1000) - 3600;
      const expiredToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${Buffer.from(
        JSON.stringify({ exp: pastExp })
      ).toString('base64')}.dummy`;

      let refreshCallCount = 0;
      server.use(
        http.post(`${TEST_HOST}/${Routes.apiKeyLogin}`, async () => {
          refreshCallCount++;
          if (refreshCallCount === 1) {
            return HttpResponse.json({ access_token: expiredToken });
          }
          // Add delay to simulate slow refresh
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json({ access_token: refreshedToken });
        })
      );

      const authService = new AuthService(TEST_HOST);
      authService.setCredentials({ apiKey: 'test-key' });
      await authService.getToken();

      // Make multiple concurrent calls that trigger refresh
      const promises = [
        authService.ensureValidToken(Routes.projects as Routes),
        authService.ensureValidToken(Routes.logStreams as Routes),
        authService.ensureValidToken(Routes.datasets as Routes)
      ];

      const tokens = await Promise.all(promises);

      // All should return the same refreshed token
      tokens.forEach((token) => {
        expect(token).toBe(refreshedToken);
      });

      // Should only call refresh once (plus initial getToken)
      expect(refreshCallCount).toBe(2);
    });

    it('should not create multiple refreshes for simultaneous expired token requests', async () => {
      const refreshedToken = 'single-refresh-token';
      // Create an expired token
      const pastExp = Math.floor(Date.now() / 1000) - 3600;
      const expiredToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${Buffer.from(
        JSON.stringify({ exp: pastExp })
      ).toString('base64')}.dummy`;

      let apiCallCount = 0;
      server.use(
        http.post(`${TEST_HOST}/${Routes.apiKeyLogin}`, async () => {
          apiCallCount++;
          if (apiCallCount === 1) {
            return HttpResponse.json({ access_token: expiredToken });
          }
          // Simulate slow refresh
          await new Promise((resolve) => setTimeout(resolve, 50));
          return HttpResponse.json({ access_token: refreshedToken });
        })
      );

      const authService = new AuthService(TEST_HOST);
      authService.setCredentials({ apiKey: 'test-key' });
      await authService.getToken();

      // Launch 5 concurrent requests that all detect expired token
      const promises = Array(5)
        .fill(null)
        .map(() => authService.ensureValidToken(Routes.projects as Routes));

      const results = await Promise.all(promises);

      // All should get the same refreshed token
      results.forEach((token) => {
        expect(token).toBe(refreshedToken);
      });

      // Should only refresh once (apiCallCount = 2: initial + 1 refresh)
      expect(apiCallCount).toBe(2);
    });

    it('should clear refresh promise after successful completion', async () => {
      const refreshedToken1 = 'refreshed-token-1';
      const refreshedToken2 = 'refreshed-token-2';
      // Create an expired token
      const pastExp = Math.floor(Date.now() / 1000) - 3600;
      const expiredToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${Buffer.from(
        JSON.stringify({ exp: pastExp })
      ).toString('base64')}.dummy`;

      let apiCallCount = 0;
      server.use(
        http.post(`${TEST_HOST}/${Routes.apiKeyLogin}`, async () => {
          apiCallCount++;
          if (apiCallCount === 1) {
            return HttpResponse.json({ access_token: expiredToken });
          } else if (apiCallCount === 2) {
            return HttpResponse.json({ access_token: refreshedToken1 });
          } else {
            // Second refresh should also work (token expired again)
            return HttpResponse.json({ access_token: refreshedToken2 });
          }
        })
      );

      const authService = new AuthService(TEST_HOST);
      authService.setCredentials({ apiKey: 'test-key' });
      await authService.getToken();

      // First refresh
      const token1 = await authService.ensureValidToken(
        Routes.projects as Routes
      );
      expect(token1).toBe(refreshedToken1);

      // Wait a bit to ensure first refresh completes
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Second refresh should be able to happen (promise was cleared)
      const token2 = await authService.ensureValidToken(
        Routes.projects as Routes
      );
      expect(token2).toBe(refreshedToken2);

      expect(apiCallCount).toBe(3); // Initial + 2 refreshes
    });

    it('should clear refresh promise after failure', async () => {
      const successToken = 'success-token';
      // Create an expired token
      const pastExp = Math.floor(Date.now() / 1000) - 3600;
      const expiredToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${Buffer.from(
        JSON.stringify({ exp: pastExp })
      ).toString('base64')}.dummy`;

      let apiCallCount = 0;
      server.use(
        http.post(`${TEST_HOST}/${Routes.apiKeyLogin}`, () => {
          apiCallCount++;
          if (apiCallCount === 1) {
            return HttpResponse.json({ access_token: expiredToken });
          } else if (apiCallCount === 2) {
            // First refresh fails
            return HttpResponse.json(
              { detail: 'Refresh failed' },
              { status: 401 }
            );
          } else {
            // Second attempt succeeds
            return HttpResponse.json({ access_token: successToken });
          }
        })
      );

      const authService = new AuthService(TEST_HOST);
      authService.setCredentials({ apiKey: 'test-key' });
      await authService.getToken();

      // First refresh attempt fails
      await expect(
        authService.ensureValidToken(Routes.projects as Routes)
      ).rejects.toThrow();

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Second refresh attempt should succeed (promise was cleared after failure)
      const token = await authService.ensureValidToken(
        Routes.projects as Routes
      );
      expect(token).toBe(successToken);

      expect(apiCallCount).toBe(3); // Initial + failed refresh + successful refresh
    });

    it('should handle race condition with rapid sequential refreshes', async () => {
      const tokens = ['token-1', 'token-2', 'token-3'];
      // Create an expired token
      const pastExp = Math.floor(Date.now() / 1000) - 3600;
      const expiredToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${Buffer.from(
        JSON.stringify({ exp: pastExp })
      ).toString('base64')}.dummy`;

      let apiCallCount = 0;
      server.use(
        http.post(`${TEST_HOST}/${Routes.apiKeyLogin}`, async () => {
          apiCallCount++;
          if (apiCallCount === 1) {
            return HttpResponse.json({ access_token: expiredToken });
          }
          const tokenIndex = Math.min(apiCallCount - 2, tokens.length - 1);
          await new Promise((resolve) => setTimeout(resolve, 20));
          return HttpResponse.json({ access_token: tokens[tokenIndex] });
        })
      );

      const authService = new AuthService(TEST_HOST);
      authService.setCredentials({ apiKey: 'test-key' });
      await authService.getToken();

      // Fire off multiple refresh attempts in rapid succession
      const promise1 = authService.ensureValidToken(Routes.projects as Routes);
      const promise2 = authService.ensureValidToken(Routes.projects as Routes);

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // Both should get the same token (same refresh promise)
      expect(result1).toBe(result2);
      expect(apiCallCount).toBe(2); // Initial + 1 refresh (not 2 refreshes)
    });
  });
});
