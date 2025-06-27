/* eslint-disable no-console */
import { GalileoApiClient } from '../api-client';
import { Message, MessageRole } from '../types/message.types';
import {
  PromptTemplate,
  PromptTemplateVersion
} from '../types/prompt-template.types';

export const getPrompts = async ({
  name,
  limit = 100
}: {
  name: string;
  limit?: number;
}): Promise<PromptTemplate[]> => {
  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectScoped: false });
  return await apiClient.listGlobalPromptTemplates(name, limit, 0);
};

export const getPrompt = async ({
  id,
  name,
  version
}: {
  id?: string;
  name?: string;
  version?: number;
}): Promise<PromptTemplateVersion> => {
  if (!id && !name) {
    throw new Error('Either id or name must be provided');
  }
  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectScoped: false });
  if (id) {
    if (version) {
      return await apiClient.getGlobalPromptTemplateVersion(id, version);
    } else {
      const template = await apiClient.getGlobalPromptTemplate(id);
      version = template.selected_version.version;
      return await apiClient.getGlobalPromptTemplateVersion(id, version);
    }
  } else {
    // lookup by name
    const templates = await getPrompts({
      name: name!
    });
    if (templates.length > 0) {
      const template = templates[0];
      version = template.selected_version.version;
      id = template.id;
      return await apiClient.getGlobalPromptTemplateVersion(id, version);
    }
    throw new Error(`Prompt template with name '${name}' not found`);
  }
};

export const createPrompt = async ({
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

export const deletePrompt = async ({
  id,
  name
}: {
  id?: string;
  name?: string;
}) => {
  if (!id && !name) {
    throw new Error('Either id or name must be provided');
  }

  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectScoped: false });

  let template_id = id;
  if (name) {
    // lookup by name
    const templates = await getPrompts({
      name: name!
    });
    if (templates.length > 0) {
      const template = templates[0];
      template_id = template.id;
    } else {
      throw new Error(`Prompt template with name '${name}' not found`);
    }
  }

  return await apiClient.deleteGlobalPromptTemplate(template_id!);
};

// DEPRECATED

export const getPromptTemplates = async (
  projectName: string
): Promise<PromptTemplate[]> => {
  console.warn('getPromptTemplates is deprecated, use getPrompts instead.');
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
  console.warn('getPromptTemplate is deprecated, use getPrompt instead.');
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
  console.warn('createPromptTemplate is deprecated, use createPrompt instead.');
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
