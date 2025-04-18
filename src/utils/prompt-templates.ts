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
