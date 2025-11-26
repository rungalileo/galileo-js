import { BaseClient, RequestMethod } from '../base-client';
import { Routes } from '../../types/routes.types';
import {
  PromptTemplate,
  PromptTemplateVersion,
  ListPromptTemplateResponse,
  ListPromptTemplateParams,
  RenderTemplateRequest,
  RenderTemplateResponse,
  RenderTemplateRequestOpenAPI,
  RenderTemplateResponseOpenAPI,
  PromptTemplateVersionOpenAPI,
  PromptTemplateOpenAPI,
  ListPromptTemplateParamsOpenAPI,
  ListPromptTemplateResponseOpenAPI,
  CreatePromptTemplateWithVersionRequestBody,
  CreatePromptTemplateWithVersionRequestBodyOpenAPI
} from '../../types/prompt-template.types';
import { Message } from '../../types/message.types';

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
    const result = await this.makeRequest<PromptTemplateOpenAPI[]>(
      RequestMethod.GET,
      Routes.promptTemplates,
      null,
      { project_id: this.projectId }
    );

    return this.convertToCamelCase<PromptTemplateOpenAPI[], PromptTemplate[]>(
      result
    );
  };

  public getPromptTemplate = async (id: string): Promise<PromptTemplate> => {
    const result = await this.makeRequest<PromptTemplateOpenAPI>(
      RequestMethod.GET,
      Routes.promptTemplate,
      null,
      { project_id: this.projectId, template_id: id }
    );

    return this.convertToCamelCase<PromptTemplateOpenAPI, PromptTemplate>(
      result
    );
  };

  public getPromptTemplateVersion = async (
    id: string,
    version: number
  ): Promise<PromptTemplateVersion> => {
    const result = await this.makeRequest<PromptTemplateVersionOpenAPI>(
      RequestMethod.GET,
      Routes.promptTemplateVersion,
      null,
      { project_id: this.projectId, template_id: id, version }
    );

    return this.convertToCamelCase<
      PromptTemplateVersionOpenAPI,
      PromptTemplateVersion
    >(result);
  };

  public getPromptTemplateVersionByName = async (
    name: string,
    version?: number
  ): Promise<PromptTemplateVersion> => {
    const result = await this.makeRequest<PromptTemplateVersionOpenAPI>(
      RequestMethod.GET,
      Routes.promptTemplateVersions,
      null,
      {
        project_id: this.projectId,
        template_name: name,
        version: version ?? null
      }
    );

    return this.convertToCamelCase<
      PromptTemplateVersionOpenAPI,
      PromptTemplateVersion
    >(result);
  };

  public createPromptTemplate = async ({
    template,
    name
  }: {
    template: Message[];
    name: string;
  }): Promise<PromptTemplate> => {
    const result = await this.makeRequest<PromptTemplateOpenAPI>(
      RequestMethod.POST,
      Routes.promptTemplates,
      { template, name },
      { project_id: this.projectId }
    );

    return this.convertToCamelCase<PromptTemplateOpenAPI, PromptTemplate>(
      result
    );
  };
}

export class GlobalPromptTemplateService extends BaseClient {
  private projectId?: string;
  constructor(apiUrl: string, token: string, projectId?: string) {
    super();
    this.apiUrl = apiUrl;
    this.token = token;
    this.projectId = projectId;
    this.initializeClient();
  }

  public async createGlobalPromptTemplate(
    options: CreatePromptTemplateWithVersionRequestBody,
    projectId?: string
  ): Promise<PromptTemplate> {
    const finalProjectId =
      projectId ?? (this.projectId ? this.projectId : null);

    return await this.makeRequestWithConversion<
      CreatePromptTemplateWithVersionRequestBody,
      CreatePromptTemplateWithVersionRequestBodyOpenAPI,
      PromptTemplateOpenAPI,
      PromptTemplate
    >(
      RequestMethod.POST,
      Routes.globalPromptTemplates,
      options,
      finalProjectId ? { project_id: finalProjectId } : undefined
    );
  }

  public listGlobalPromptTemplates = async (
    options: ListPromptTemplateParams,
    limit: number = 100,
    startingToken: number = 0
  ): Promise<ListPromptTemplateResponse> => {
    return await this.makeRequestWithConversion<
      ListPromptTemplateParams,
      ListPromptTemplateParamsOpenAPI,
      ListPromptTemplateResponseOpenAPI,
      ListPromptTemplateResponse
    >(RequestMethod.POST, Routes.globalPromptTemplateQuery, options, {
      limit: limit,
      starting_token: startingToken
    });
  };

  public getGlobalPromptTemplate = async (
    templateId: string
  ): Promise<PromptTemplate> => {
    const result = await this.makeRequest<PromptTemplateOpenAPI>(
      RequestMethod.GET,
      Routes.globalPromptTemplate,
      null,
      { template_id: templateId }
    );

    return this.convertToCamelCase<PromptTemplateOpenAPI, PromptTemplate>(
      result
    );
  };

  public getGlobalPromptTemplateVersion = async (
    templateId: string,
    version: number
  ): Promise<PromptTemplateVersion> => {
    const result = await this.makeRequest<PromptTemplateVersionOpenAPI>(
      RequestMethod.GET,
      Routes.globalPromptTemplateVersion,
      null,
      { template_id: templateId, version }
    );

    return this.convertToCamelCase<
      PromptTemplateVersionOpenAPI,
      PromptTemplateVersion
    >(result);
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

  public updateGlobalPromptTemplate = async ({
    templateId,
    name
  }: {
    templateId: string;
    name: string;
  }): Promise<PromptTemplate> => {
    const result = await this.makeRequest<PromptTemplateOpenAPI>(
      RequestMethod.PATCH,
      Routes.globalPromptTemplate,
      { name },
      { template_id: templateId }
    );

    return this.convertToCamelCase<PromptTemplateOpenAPI, PromptTemplate>(
      result
    );
  };

  public renderTemplate = async (
    body: RenderTemplateRequest,
    startingToken: number = 0,
    limit: number = 100
  ): Promise<RenderTemplateResponse> => {
    return await this.makeRequestWithConversion<
      typeof body,
      RenderTemplateRequestOpenAPI,
      RenderTemplateResponseOpenAPI,
      RenderTemplateResponse
    >(RequestMethod.POST, Routes.renderTemplate, body, {
      starting_token: startingToken,
      limit
    });
  };
}
