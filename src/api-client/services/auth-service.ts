import querystring from 'querystring';
import { BaseClient, RequestMethod } from '../base-client';
import { Routes } from '../../types/routes.types';

export class AuthService extends BaseClient {
  constructor(apiUrl: string, token: string = '') {
    super();
    this.apiUrl = apiUrl;
    this.token = token;
    this.initializeClient();
  }

  public async getToken(): Promise<string> {
    const apiKey = process.env.GALILEO_API_KEY;

    if (apiKey) {
      const loginResponse = await this.apiKeyLogin(apiKey);
      this.token = loginResponse.access_token || '';
      this.initializeClient(); // Reinitialize with new token
      return this.token;
    }

    const username = process.env.GALILEO_USERNAME;
    const password = process.env.GALILEO_PASSWORD;

    if (username && password) {
      const loginResponse = await this.usernameLogin(username, password);
      this.token = loginResponse.access_token || '';
      this.initializeClient(); // Reinitialize with new token
      return this.token;
    }

    throw new Error(
      '❗ GALILEO_API_KEY or GALILEO_USERNAME and GALILEO_PASSWORD must be set'
    );
  }

  private async apiKeyLogin(
    api_key: string
  ): Promise<{ access_token: string }> {
    return await this.makeRequest<{ access_token: string }>(
      RequestMethod.POST,
      Routes.apiKeyLogin,
      {
        api_key
      }
    );
  }

  private async usernameLogin(username: string, password: string) {
    return await this.makeRequest<{ access_token: string }>(
      RequestMethod.POST,
      Routes.login,
      querystring.stringify({
        username,
        password
      })
    );
  }
}
