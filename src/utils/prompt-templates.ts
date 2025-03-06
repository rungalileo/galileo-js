import { GalileoApiClient } from '../api-client';

// Template methods - delegate to PromptTemplateService
export const getPromptTemplates = async (projectName: string) => {
  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectName });

  const templates = await apiClient.getPromptTemplates();
  return templates;
};

export const createPromptTemplate = async ({
  template,
  version,
  name,
  projectName
}: {
  template: string;
  version: string;
  name: string;
  projectName: string;
}) => {
  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectName });

  const createdTemplate = await apiClient.createPromptTemplate(
    template,
    version,
    name
  );
  return createdTemplate;
};
