//import type { components } from './api.types';

import type {
  BasePromptTemplateResponse as PromptTemplateOpenAPI,
  BasePromptTemplateVersionResponse as PromptTemplateVersionOpenAPI,
  ListPromptTemplateResponse as ListPromptTemplateResponseOpenAPI,
  ListPromptTemplateParams as ListPromptTemplateParamsOpenAPI,
  RenderTemplateRequest as RenderTemplateRequestOpenAPI,
  RenderTemplateResponse as RenderTemplateResponseOpenAPI,
  DatasetData as DatasetDataOpenAPI,
  StringData as StringDataOpenAPI,
  CreatePromptTemplateWithVersionRequestBody as CreatePromptTemplateWithVersionRequestBodyOpenAPI
} from './openapi.types';

import type {
  BasePromptTemplateResponse as PromptTemplate,
  BasePromptTemplateVersionResponse as PromptTemplateVersion,
  ListPromptTemplateResponse,
  ListPromptTemplateParams,
  RenderTemplateRequest,
  RenderTemplateResponse,
  DatasetData as DatasetData,
  StringData as StringData,
  CreatePromptTemplateWithVersionRequestBody
} from './new-api.types';
import { Message } from './message.types';

export type {
  PromptTemplate,
  PromptTemplateVersion,
  ListPromptTemplateResponse,
  ListPromptTemplateParams,
  RenderTemplateRequest,
  RenderTemplateResponse,
  DatasetData,
  StringData,
  CreatePromptTemplateWithVersionRequestBody,
  PromptTemplateOpenAPI,
  PromptTemplateVersionOpenAPI,
  ListPromptTemplateResponseOpenAPI,
  ListPromptTemplateParamsOpenAPI,
  RenderTemplateRequestOpenAPI,
  RenderTemplateResponseOpenAPI,
  DatasetDataOpenAPI,
  StringDataOpenAPI,
  CreatePromptTemplateWithVersionRequestBodyOpenAPI
};

export type GlobalPromptTemplateListOptions = {
  nameFilter?: string;
  nameOperator?: 'eq' | 'ne' | 'contains' | 'one_of' | 'not_in';
  projectId?: string;
  projectName?: string;
  excludeProjectId?: string;
  limit?: number;
  startingToken?: number;
  sortField?: 'name' | 'created_at' | 'updated_at';
  ascending?: boolean;
};

export type ProjectScopeOptions = {
  projectId?: string;
  projectName?: string;
};

export type PromptListOptions = ProjectScopeOptions & {
  nameFilter?: string;
  limit?: number;
  startingToken?: number;
  matchExact?: boolean;
};

export type CreatePromptOptions = ProjectScopeOptions & {
  template: Message[] | string;
  name: string;
  ensureUniqueName?: boolean;
};

export type UpdatePromptOptions = ProjectScopeOptions & {
  id?: string;
  name?: string;
  newName: string;
};

export type DeletePromptOptions = ProjectScopeOptions & {
  id?: string;
  name?: string;
};

export type GetPromptOptions = ProjectScopeOptions & {
  id?: string;
  name?: string;
  version?: number;
};

export type GetPromptsOptions = ProjectScopeOptions & {
  name?: string;
  limit?: number;
};

export type RenderPromptTemplateOptions = {
  template: string;
  data: DatasetData | StringData | string[] | string;
  startingToken?: number;
  limit?: number;
};
