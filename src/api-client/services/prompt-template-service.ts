import { BaseClient, RequestMethod } from '../base-client';
import { Routes } from '../../types/routes.types';
import { components } from '../../types/api.types';

export type PromptTemplate =
  components['schemas']['BasePromptTemplateResponse'];
export type PromptTemplateVersion =
  components['schemas']['BasePromptTemplateVersionResponse'];
type ListTemplatesResponse = PromptTemplate[];

export class PromptTemplateService extends BaseClient {
  private projectId: string;
  constructor(apiUrl: string, token: string, projectId: string) {
    super();
    this.apiUrl = apiUrl;
    this.token = token;
    this.projectId = projectId;
    this.initializeClient();
  }

  public getPromptTemplates = async (): Promise<PromptTemplate[]> => {
    return await this.makeRequest<ListTemplatesResponse>(
      RequestMethod.GET,
      Routes.promptTemplates,
      null,
      { project_id: this.projectId }
    );
  };

  public createPromptTemplate = async ({
    template,
    version,
    name
  }: {
    template: string;
    version: string;
    name: string;
  }): Promise<PromptTemplate> => {
    return await this.makeRequest<PromptTemplate>(
      RequestMethod.POST,
      Routes.promptTemplates,
      { template, version, name },
      { project_id: this.projectId }
    );
  };
}
