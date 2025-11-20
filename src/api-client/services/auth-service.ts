import querystring from 'querystring';
import { AxiosResponse } from 'axios';
import { decode } from 'jsonwebtoken';
import { BaseClient, RequestMethod } from '../base-client';
import { Routes } from '../../types/routes.types';
import {
  SSOProvider,
  AccessTokenResponse,
  SSOProviders
} from '../../types/auth.types';

export class AuthService extends BaseClient {
  private refreshToken?: string;
  private originalCredentials?:
    | { type: 'api_key'; apiKey: string }
    | { type: 'username_password'; username: string; password: string }
    | { type: 'sso'; ssoIdToken: string; ssoProvider: SSOProvider };

  /**
   * Creates a new AuthService instance.
   *
   * @param apiUrl - The base URL for the Galileo API
   * @param token - (Optional) Initial access token. If not provided, will be fetched via getToken()
   */
  constructor(apiUrl: string, token: string = '') {
    super();
    this.apiUrl = apiUrl;
    this.token = token;
    this.initializeClient();
  }

  /**
   * Retrieves an access token using available credentials from environment variables.
   *
   * Credentials are checked in the following priority order:
   * 1. API Key (GALILEO_API_KEY)
   * 2. Username/Password (GALILEO_USERNAME and GALILEO_PASSWORD)
   * 3. SSO (GALILEO_SSO_ID_TOKEN and GALILEO_SSO_PROVIDER)
   *
   * The method automatically stores refresh tokens from Set-Cookie headers when available.
   *
   * @returns Promise resolving to an access token string
   * @throws {Error} If no valid credentials are found in environment variables
   * @throws {Error} If SSO provider is invalid (not in supported list)
   */
  public async getToken(): Promise<string> {
    const apiKey = process.env.GALILEO_API_KEY;
    const username = process.env.GALILEO_USERNAME;
    const password = process.env.GALILEO_PASSWORD;
    const ssoIdToken = process.env.GALILEO_SSO_ID_TOKEN;
    const ssoProvider = process.env.GALILEO_SSO_PROVIDER as SSOProvider;

    if (apiKey) {
      this.originalCredentials = { type: 'api_key', apiKey };
    } else if (username && password) {
      this.originalCredentials = {
        type: 'username_password',
        username,
        password
      };
    } else if (ssoIdToken?.trim() && ssoProvider) {
      if (!SSOProviders.includes(ssoProvider)) {
        throw new Error(
          `Invalid SSO provider. Currently supported providers: ${SSOProviders.join(', ')}`
        );
      }

      this.originalCredentials = {
        type: 'sso',
        ssoIdToken: ssoIdToken.trim(),
        ssoProvider
      };
    }

    if (this.originalCredentials) {
      await this.fetchNewToken();
      return this.token;
    }

    throw new Error(
      '❗ GALILEO_API_KEY, (GALILEO_USERNAME and GALILEO_PASSWORD), or (GALILEO_SSO_ID_TOKEN and GALILEO_SSO_PROVIDER) must be set'
    );
  }

  /**
   * Fetches a new access token using stored original credentials.
   *
   * Dispatches to the appropriate login method based on credential type.
   *
   * @throws {Error} If no credentials are found in environment variables
   */
  private async fetchNewToken() {
    if (this.originalCredentials?.type === 'api_key') {
      this.token = await this.apiKeyLogin(this.originalCredentials.apiKey);
      this.initializeClient();
    } else if (this.originalCredentials?.type === 'username_password') {
      this.token = await this.usernameLogin(
        this.originalCredentials.username,
        this.originalCredentials.password
      );
      this.initializeClient();
    } else if (this.originalCredentials?.type === 'sso') {
      this.token = await this.ssoLogin(
        this.originalCredentials.ssoIdToken,
        this.originalCredentials.ssoProvider
      );
      this.initializeClient();
    } else throw new Error('No credentials found in environment variables');
  }

  /**
   * Attempts to extract and store refresh token from Set-Cookie header in response.
   *
   * @param response - Axios response object containing headers
   */
  private attemptRefreshTokenUpdate(response: AxiosResponse): void {
    const setCookieHeader = response.headers['set-cookie'];
    if (setCookieHeader) {
      const refreshTokenMatch = setCookieHeader
        .join('; ')
        .match(/refresh_token=([^;]+)/);
      if (refreshTokenMatch) {
        this.refreshToken = refreshTokenMatch[1];
      }
    }
  }

  /**
   * Authenticates using API key and retrieves access token.
   *
   * @param api_key - The API key for authentication
   * @returns Promise resolving to an access token string
   */
  private async apiKeyLogin(apiKey: string): Promise<string> {
    const response = await this.makeRequestRaw<AccessTokenResponse>(
      RequestMethod.POST,
      Routes.apiKeyLogin,
      {
        api_key: apiKey
      }
    );

    this.attemptRefreshTokenUpdate(response);
    return response.data.access_token || '';
  }

  /**
   * Authenticates using username and password and retrieves access token.
   *
   * @param username - The username for authentication
   * @param password - The password for authentication
   * @returns Promise resolving to an access token string
   */
  private async usernameLogin(
    username: string,
    password: string
  ): Promise<string> {
    const response = await this.makeRequestRaw<AccessTokenResponse>(
      RequestMethod.POST,
      Routes.login,
      querystring.stringify({
        username,
        password
      })
    );
    this.attemptRefreshTokenUpdate(response);
    return response.data.access_token || '';
  }

  /**
   * Authenticates using SSO ID token and retrieves access token.
   *
   * @param idToken - The SSO ID token for authentication
   * @param provider - The SSO provider (okta, google, github, azure-ad, or custom)
   * @returns Promise resolving to an access token string
   */
  private async ssoLogin(
    idToken: string,
    provider: SSOProvider
  ): Promise<string> {
    const response = await this.makeRequestRaw<AccessTokenResponse>(
      RequestMethod.POST,
      Routes.socialLogin,
      {
        id_token: idToken,
        provider
      },
      undefined,
      { 'Content-Type': 'application/json' }
    );

    this.attemptRefreshTokenUpdate(response);
    return response.data.access_token || '';
  }

  /**
   * Get the stored refresh token.
   *
   * @returns The stored refresh token, or undefined if no refresh token is available
   */
  public getRefreshToken(): string | undefined {
    return this.refreshToken;
  }

  /**
   * Refresh the access token using the stored refresh token.
   *
   * @returns Promise resolving to a new access token string
   * @throws {Error} If refresh token is not available or refresh fails
   */
  private async refreshAccessToken(): Promise<string> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await this.makeRequestRaw<AccessTokenResponse>(
        RequestMethod.POST,
        Routes.refreshToken,
        undefined,
        undefined,
        {
          'Content-Type': 'application/json',
          Cookie: `refresh_token=${this.refreshToken}`
        }
      );

      this.attemptRefreshTokenUpdate(response);
      this.token = response.data.access_token || '';
      this.initializeClient();
      return this.token;
    } catch (error) {
      this.refreshToken = undefined;
      throw error;
    }
  }

  /**
   * Refresh token with fallback to original credentials.
   *
   * Attempts to refresh using stored refresh token. If refresh fails or no refresh token
   * is available, falls back to fetching a new token using original credentials.
   *
   * @returns Promise resolving to a new access token string
   * @throws {Error} If both refresh and credential-based token fetch fail
   */
  private async refreshTokenWithFallback() {
    if (this.refreshToken) {
      try {
        await this.refreshAccessToken();
      } catch (error) {
        await this.fetchNewToken();
      }
    } else {
      await this.fetchNewToken();
    }
  }

  /**
   * Override base class method to implement refresh token logic.
   *
   * Automatically refreshes the access token if it's expired or will expire within 5 minutes.
   * Falls back to original credentials if refresh token is unavailable or refresh fails.
   * Auth endpoints (login, apiKeyLogin, socialLogin, refreshToken) are excluded from refresh checks.
   *
   * @param endpoint - The API endpoint being called
   * @throws {Error} If token validation fails and refresh also fails
   */
  protected async refreshTokenIfNeeded(endpoint: Routes): Promise<void> {
    if (
      [
        Routes.login,
        Routes.apiKeyLogin,
        Routes.socialLogin,
        Routes.refreshToken
      ].includes(endpoint)
    ) {
      return;
    }

    if (this.token) {
      try {
        const payload = decode(this.token, { json: true }) as {
          exp?: number;
        } | null;

        if (payload?.exp) {
          const expirationTime = payload.exp;
          const currentTime = Math.floor(Date.now() / 1000);
          const fiveMinutes = 300;

          if (expirationTime <= currentTime + fiveMinutes) {
            await this.refreshTokenWithFallback();
          }
        }
      } catch (error) {
        try {
          // Attempt refresh anyways if expiration time is not available
          await this.refreshTokenWithFallback();
        } catch (refreshError) {
          throw new Error(
            `Token validation failed: ${error}. Refresh attempt failed: ${refreshError}`
          );
        }
      }
    }
  }
}
