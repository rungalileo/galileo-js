/* eslint-disable no-console */
import { GalileoApiClient } from '../api-client';
import { Message, MessageRole } from '../types/message.types';
import {
  PromptTemplate,
  PromptTemplateVersion,
  RenderTemplateRequest,
  RenderTemplateResponse,
  DatasetData,
  StringData
} from '../types/prompt-template.types';

// Internal class - not exported
// Manages singleton API client for all global template operations
class GlobalPromptTemplatesClient {
  private static apiClient: GalileoApiClient | null = null;
  private static initPromise: Promise<GalileoApiClient> | null = null;

  public static async getClient(): Promise<GalileoApiClient> {
    // If initialization already started, wait for it and return the client
    if (GlobalPromptTemplatesClient.initPromise) {
      return await GlobalPromptTemplatesClient.initPromise;
    }

    // Create initialization promise (atomic operation)
    GlobalPromptTemplatesClient.initPromise = (async () => {
      try {
        // Create and initialize client
        const client = new GalileoApiClient();
        await client.init({ projectScoped: false });

        // Store the initialized client
        GlobalPromptTemplatesClient.apiClient = client;
        return client;
      } catch (error) {
        // On error, reset state to allow retry
        GlobalPromptTemplatesClient.apiClient = null;
        GlobalPromptTemplatesClient.initPromise = null;
        throw error;
      }
    })();

    // Return the promise (all concurrent calls get the same promise)
    return await GlobalPromptTemplatesClient.initPromise;
  }
}

/**
 * Retrieves a list of prompt templates by name.
 *
 * @param {Object} params - The parameters object
 * @param {string} params.name - The name of the prompt template to search for
 * @param {number} [params.limit=100] - Maximum number of templates to return (default: 100)
 * @returns {Promise<PromptTemplate[]>} A promise that resolves to an array of prompt templates
 * @throws {Error} When the API client fails to retrieve templates
 *
 */
export const getPrompts = async ({
  name,
  limit = 100
}: {
  name: string;
  limit?: number;
}): Promise<PromptTemplate[]> => {
  const apiClient = await GlobalPromptTemplatesClient.getClient();
  return await apiClient.listGlobalPromptTemplates(name, limit, 0);
};

/**
 * Retrieves a specific prompt template by ID or name.
 *
 * @param {Object} params - The parameters object
 * @param {string} [params.id] - The unique identifier of the prompt template
 * @param {string} [params.name] - The name of the prompt template (alternative to id)
 * @param {number} [params.version] - The specific version of the template to retrieve (optional)
 * @returns {Promise<PromptTemplateVersion>} A promise that resolves to the prompt template version
 * @throws {Error} When neither id nor name is provided
 * @throws {Error} When the template is not found
 *
 */
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
  const apiClient = await GlobalPromptTemplatesClient.getClient();

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
    const templates = await getPrompts({ name: name! });
    if (templates.length > 0) {
      const template = templates[0];
      version = template.selected_version.version;
      return await apiClient.getGlobalPromptTemplateVersion(
        template.id,
        version
      );
    }
    throw new Error(`Prompt template with name '${name}' not found`);
  }
};

/**
 * Creates a new prompt template.
 *
 * @param {Object} params - The parameters object
 * @param {Message[] | string} params.template - The template content as either an array of messages or a single string
 * @param {string} params.name - The name for the new prompt template
 * @returns {Promise<PromptTemplate>} A promise that resolves to the created prompt template
 * @throws {Error} When the API client fails to create the template
 *
 */
export const createPrompt = async ({
  template,
  name
}: {
  template: Message[] | string;
  name: string;
}): Promise<PromptTemplate> => {
  // Data conversion stays here
  let tmp: Message[];
  if (typeof template === 'string') {
    tmp = [{ content: template, role: MessageRole.user }];
  } else {
    tmp = template;
  }

  const apiClient = await GlobalPromptTemplatesClient.getClient();
  return await apiClient.createGlobalPromptTemplate(tmp, name);
};

/**
 * Deletes a prompt template by ID or name.
 *
 * @param {Object} params - The parameters object
 * @param {string} [params.id] - The unique identifier of the prompt template to delete
 * @param {string} [params.name] - The name of the prompt template to delete (alternative to id)
 * @returns {Promise<void>} A promise that resolves when the template is successfully deleted
 * @throws {Error} When neither id nor name is provided
 * @throws {Error} When the template is not found
 *
 */
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

  let template_id = id;
  if (name) {
    // lookup by name
    const templates = await getPrompts({ name: name! });
    if (templates.length > 0) {
      template_id = templates[0].id;
    } else {
      throw new Error(`Prompt template with name '${name}' not found`);
    }
  }

  const apiClient = await GlobalPromptTemplatesClient.getClient();
  return await apiClient.deleteGlobalPromptTemplate(template_id!);
};

// DEPRECATED

/**
 * @deprecated This function is deprecated. Use {@link getPrompts} instead.
 *
 * Retrieves a list of all prompt templates.
 *
 * @param {string} projectName - The project name (kept for backwards compatibility, but ignored)
 * @returns {Promise<PromptTemplate[]>} A promise that resolves to an array of prompt templates
 * @throws {Error} When the API client fails to retrieve templates
 *
 */
export const getPromptTemplates = async (
  projectName: string // Keep parameter for backwards compatibility, but ignored
): Promise<PromptTemplate[]> => {
  console.warn('getPromptTemplates is deprecated, use getPrompts instead.');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  void projectName; // Parameter kept for backwards compatibility

  // Simplified: use singleton instead of new instance with projectName
  const apiClient = await GlobalPromptTemplatesClient.getClient();
  const templates = await apiClient.getPromptTemplates();
  return templates;
};

/**
 * @deprecated This function is deprecated. Use {@link getPrompt} instead.
 *
 * Retrieves a specific prompt template by ID or name.
 *
 * @param {Object} params - The parameters object
 * @param {string} [params.id] - The unique identifier of the prompt template
 * @param {string} [params.name] - The name of the prompt template (alternative to id)
 * @param {string} params.projectName - The project name (kept for backwards compatibility, but ignored)
 * @param {number} [params.version] - The specific version of the template to retrieve (optional)
 * @returns {Promise<PromptTemplateVersion>} A promise that resolves to the prompt template version
 * @throws {Error} When neither id nor name is provided
 * @throws {Error} When the template is not found
 *
 */
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  void projectName; // Parameter kept for backwards compatibility
  if (!id && !name) {
    throw new Error('Either id or name must be provided');
  }

  // Simplified: use singleton instead of new instance with projectName
  const apiClient = await GlobalPromptTemplatesClient.getClient();

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

/**
 * @deprecated This function is deprecated. Use {@link createPrompt} instead.
 *
 * Creates a new prompt template.
 *
 * @param {Object} params - The parameters object
 * @param {Message[] | string} params.template - The template content as either an array of messages or a single string
 * @param {string} params.name - The name for the new prompt template
 * @param {string} params.projectName - The project name (kept for backwards compatibility, but ignored)
 * @returns {Promise<PromptTemplate>} A promise that resolves to the created prompt template
 * @throws {Error} When the API client fails to create the template
 *
 */
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  void projectName; // Parameter kept for backwards compatibility

  // Data conversion
  let tmp: Message[];
  if (typeof template === 'string') {
    tmp = [{ content: template, role: MessageRole.user }];
  } else {
    tmp = template;
  }

  // Simplified: use singleton instead of new instance with projectName
  const apiClient = await GlobalPromptTemplatesClient.getClient();
  const createdTemplate = await apiClient.createPromptTemplate(tmp, name);
  return createdTemplate;
};

/**
 * Renders a prompt template with the provided data.
 *
 * @param {Object} params - The parameters object
 * @param {string} params.template - The template string to render
 * @param {DatasetData | StringData | string[] | string} params.data - The data to use for rendering the template
 * @param {number} [params.starting_token=0] - The starting token index for pagination (default: 0)
 * @param {number} [params.limit=100] - Maximum number of results to return (default: 100)
 * @returns {Promise<RenderTemplateResponse>} A promise that resolves to the rendered template response
 * @throws {Error} When the API client fails to render the template
 *
 */
export const renderPromptTemplate = async ({
  template,
  data,
  starting_token = 0,
  limit = 100
}: {
  template: string;
  data: DatasetData | StringData | string[] | string;
  starting_token?: number;
  limit?: number;
}): Promise<RenderTemplateResponse> => {
  // Data conversion stays in public function
  let processedData: DatasetData | StringData;
  if (Array.isArray(data)) {
    processedData = { input_strings: data };
  } else if (typeof data === 'string') {
    processedData = { dataset_id: data };
  } else {
    processedData = data;
  }

  const body: RenderTemplateRequest = {
    template,
    data: processedData
  };

  const apiClient = await GlobalPromptTemplatesClient.getClient();
  return await apiClient.renderPromptTemplate(body, starting_token, limit);
};
