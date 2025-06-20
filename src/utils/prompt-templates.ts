import { GalileoApiClient } from '../api-client';
import { Message, MessageRole } from '../types/message.types';
import {
  PromptTemplate,
  PromptTemplateVersion
} from '../types/prompt-template.types';

export const getPromptTemplates = async (
  projectName: string
): Promise<PromptTemplate[]> => {
  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectName });

  const templates = await apiClient.getPromptTemplates();
  return templates;
};

export const getPromptTemplate = async ({
  id,
  name,
  projectName,
  version
}: {
  id?: string;
  name?: string;
  projectName: string;
  version?: number;
}): Promise<PromptTemplateVersion> => {
  if (!id && !name) {
    throw new Error('Either id or name must be provided');
  }

  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectName });

  if (id) {
    if (version) {
      const template = await apiClient.getPromptTemplateVersion(id, version);
      return template;
    } else {
      const template = await apiClient.getPromptTemplate(id);
      version = template.selected_version.version;
      return await apiClient.getPromptTemplateVersion(id, version);
    }
  } else {
    return await apiClient.getPromptTemplateVersionByName(name!, version);
  }
};

export const createPromptTemplate = async ({
  template,
  name,
  projectName
}: {
  template: Message[] | string;
  name: string;
  projectName: string;
}): Promise<PromptTemplate> => {
  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectName });
  let tmp: Message[];

  if (typeof template === 'string') {
    tmp = [{ content: template, role: MessageRole.user }];
  } else {
    tmp = template;
  }
  const createdTemplate = await apiClient.createPromptTemplate(tmp, name);
  return createdTemplate;
};

export const createGlobalPromptTemplate = async ({
  template,
  name
}: {
  template: Message[] | string;
  name: string;
}): Promise<PromptTemplate> => {
  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectScoped: false });
  let tmp: Message[];

  if (typeof template === 'string') {
    tmp = [{ content: template, role: MessageRole.user }];
  } else {
    tmp = template;
  }
  return await apiClient.createGlobalPromptTemplate(tmp, name);
};

export const getGlobalPromptTemplate = async ({
  id,
  name
}: {
  id?: string;
  name?: string;
}): Promise<PromptTemplate> => {
  if ((!id && !name) || (id && name)) {
    throw new Error('Either id or name must be provided, but not both.');
  }

  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectScoped: false });

  if (id) {
    return await apiClient.getGlobalPromptTemplate(id);
  } else {
    const templates = await listGlobalPromptTemplates({
      name_filter: name!,
      limit: 1
    });
    if (templates.length > 0) {
      return templates[0];
    }
    throw new Error(`Global prompt template with name '${name}' not found`);
  }
};

export const getGlobalPromptTemplateVersion = async ({
  template_id,
  version
}: {
  template_id: string;
  version: number;
}): Promise<PromptTemplateVersion> => {
  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectScoped: false });

  return await apiClient.getGlobalPromptTemplateVersion(template_id, version);
};

export const deleteGlobalPromptTemplate = async ({
  id,
  name
}: {
  id?: string;
  name?: string;
}) => {
  if ((!id && !name) || (id && name)) {
    throw new Error('Either id or name must be provided, but not both.');
  }

  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectScoped: false });

  let template_id = id;
  if (name) {
    const template = await getGlobalPromptTemplate({ name });
    template_id = template.id;
  }

  return await apiClient.deleteGlobalPromptTemplate(template_id!);
};

export const listGlobalPromptTemplates = async ({
  name_filter,
  limit = 100,
  starting_token = 0
}: {
  name_filter: string;
  limit?: number;
  starting_token?: number;
}): Promise<PromptTemplate[]> => {
  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectScoped: false });

  const templates = await apiClient.listGlobalPromptTemplates(
    name_filter,
    limit,
    starting_token
  );
  return templates;
};
