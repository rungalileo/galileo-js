import { BaseClient, RequestMethod } from '../base-client';
import { Routes } from '../../types/routes.types';
import { Request, Response } from '../../types/protect.types';

export class ProtectService extends BaseClient {
  private projectId: string;
  constructor(apiUrl: string, token: string, projectId: string) {
    super();
    this.apiUrl = apiUrl;
    this.token = token;
    this.projectId = projectId;
    this.initializeClient();
  }

  public invoke = async (request: Request): Promise<Response> => {
    return await this.makeRequest<Response>(
      RequestMethod.POST,
      Routes.protectInvoke,
      request
    );
  };
}
