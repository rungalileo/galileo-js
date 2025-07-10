import { BaseClient, RequestMethod } from '../base-client';
import { Routes } from '../../types/routes.types';
import {
  PromptTemplate,
  PromptTemplateVersion,
  ListPromptTemplateResponse
} from '../../types/prompt-template.types';
import { Message } from '../../types/message.types';

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

  public getPromptTemplate = async (id: string): Promise<PromptTemplate> => {
    return await this.makeRequest<PromptTemplate>(
      RequestMethod.GET,
      Routes.promptTemplate,
      null,
      { project_id: this.projectId, template_id: id }
    );
  };

  public getPromptTemplateVersion = async (
    id: string,
    version: number
  ): Promise<PromptTemplateVersion> => {
    return await this.makeRequest<PromptTemplateVersion>(
      RequestMethod.GET,
      Routes.promptTemplateVersion,
      null,
      { project_id: this.projectId, template_id: id, version }
    );
  };

  public getPromptTemplateVersionByName = async (
    name: string,
    version?: number
  ): Promise<PromptTemplateVersion> => {
    return await this.makeRequest<PromptTemplateVersion>(
      RequestMethod.GET,
      Routes.promptTemplateVersions,
      null,
      {
        project_id: this.projectId,
        template_name: name,
        version: version ?? null
      }
    );
  };

  public createPromptTemplate = async ({
    template,
    name
  }: {
    template: Message[];
    name: string;
  }): Promise<PromptTemplate> => {
    return await this.makeRequest<PromptTemplate>(
      RequestMethod.POST,
      Routes.promptTemplates,
      { template, name },
      { project_id: this.projectId }
    );
  };
}

export class GlobalPromptTemplateService extends BaseClient {
  constructor(apiUrl: string, token: string) {
    super();
    this.apiUrl = apiUrl;
    this.token = token;
    this.initializeClient();
  }

  public createGlobalPromptTemplate = async ({
    template,
    name
  }: {
    template: Message[];
    name: string;
  }): Promise<PromptTemplate> => {
    return await this.makeRequest<PromptTemplate>(
      RequestMethod.POST,
      Routes.globalPromptTemplates,
      { name, template }
    );
  };

  public listGlobalPromptTemplates = async (
    name_filter?: string,
    limit?: number,
    starting_token?: number
  ): Promise<PromptTemplate[]> => {
    const response = await this.makeRequest<ListPromptTemplateResponse>(
      RequestMethod.POST,
      Routes.globalPromptTemplateQuery,
      {
        filters: [
          {
            name: 'name',
            value: name_filter,
            operator: 'contains'
          }
        ],
        sort: {
          name: 'created_at',
          ascending: false,
          sort_type: 'column'
        }
      },
      {
        limit,
        starting_token
      }
    );

    if (response.templates) {
      return response.templates;
    }
    return [];
  };

  public getGlobalPromptTemplate = async (
    template_id: string
  ): Promise<PromptTemplate> => {
    return await this.makeRequest<PromptTemplate>(
      RequestMethod.GET,
      Routes.globalPromptTemplate,
      null,
      { template_id }
    );
  };

  public getGlobalPromptTemplateVersion = async (
    template_id: string,
    version: number
  ): Promise<PromptTemplateVersion> => {
    return await this.makeRequest<PromptTemplateVersion>(
      RequestMethod.GET,
      Routes.globalPromptTemplateVersion,
      null,
      { template_id, version }
    );
  };

  public deleteGlobalPromptTemplate = async (
    template_id: string
  ): Promise<void> => {
    return await this.makeRequest<void>(
      RequestMethod.DELETE,
      Routes.globalPromptTemplate,
      null,
      { template_id }
    );
  };
}
