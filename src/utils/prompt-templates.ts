/* eslint-disable no-console */
import { GalileoApiClient } from '../api-client';
import { Message, MessageRole } from '../types/message.types';
import {
  DatasetData,
  PromptTemplate as PromptTemplateType,
  PromptTemplateVersion,
  ListPromptTemplateResponse,
  RenderTemplateRequest,
  RenderTemplateResponse,
  StringData,
  ProjectScopeOptions,
  PromptListOptions,
  CreatePromptOptions,
  UpdatePromptOptions,
  DeletePromptOptions,
  GetPromptOptions,
  GetPromptsOptions,
  RenderPromptTemplateOptions
} from '../types/prompt-template.types';

const MAX_UNIQUE_NAME_ATTEMPTS = 1000;

/**
 * Utility helper for managing prompt templates through the Galileo API.
 */
class PromptTemplate {
  /**
   * Initializes an API client scoped to the provided project options.
   * @param options - (Optional) Project information used to scope the client.
   * @param options.projectName - (Optional) Project name used to resolve the project ID.
   * @param options.projectId - (Optional) Explicit project ID to scope the client.
   * @returns A promise that resolves to an initialized Galileo API client.
   */
  private async getClient(options?: {
    projectName?: string;
    projectId?: string;
  }): Promise<GalileoApiClient> {
    const client = new GalileoApiClient();
    await client.init({
      projectName: options?.projectName,
      projectId: options?.projectId,
      projectScoped:
        options?.projectName != undefined || options?.projectId != undefined
    });
    return client;
  }

  /**
   * Ensures only one of the provided identifiers is supplied.
   * @param first - (Optional) First identifier option to validate.
   * @param second - (Optional) Second identifier option to validate.
   * @param errorMessage - (Optional) Error message when both identifiers exist.
   */
  private ensureExclusiveField(
    first?: unknown,
    second?: unknown,
    errorMessage: string = 'Exactly one identifier must be provided'
  ): void {
    if (first && second) {
      throw new Error(errorMessage);
    }
  }

  /**
   * Normalizes template inputs into the message list expected by the API.
   * @param template - Either a raw string template or a list of messages.
   * @returns Template represented as an ordered set of role-based messages.
   */
  private normalizeTemplate(template: Message[] | string): Message[] {
    if (typeof template === 'string') {
      return [{ content: template, role: MessageRole.user }];
    }
    return template;
  }

  /**
   * Looks up a prompt template by name.
   * @param name - Template name to search for.
   * @param options - Project scoping information for the lookup.
   * @returns A promise that resolves to the matched prompt template.
   */
  private async findTemplateByName(
    name: string,
    options: ProjectScopeOptions
  ): Promise<PromptTemplateType> {
    const apiClient = await this.getClient(options);
    const response = await apiClient.listGlobalPromptTemplates({
      nameFilter: name,
      nameOperator: 'eq',
      projectId: options.projectId,
      projectName: options.projectName,
      limit: 100
    });
    const template = response.templates?.find((item) => item.name === name);
    if (!template) {
      throw new Error(`Prompt template with name '${name}' not found`);
    }
    return template;
  }

  /**
   * Determines whether a template name already exists.
   * @param name - Template name to check for uniqueness.
   * @returns A promise that resolves to true when the name exists.
   */
  private async nameExists(name: string): Promise<boolean> {
    const apiClient = await this.getClient();
    const response = await apiClient.listGlobalPromptTemplates({
      nameFilter: name,
      nameOperator: 'eq',
      limit: 1
    });

    return Boolean(
      response.templates?.some((template) => template.name === name)
    );
  }

  /**
   * Creates a uniquely suffixed template name when needed.
   * @param name - Desired template name.
   * @returns A promise that resolves to a name guaranteed to be unique.
   */
  private async generateUniqueName(name: string): Promise<string> {
    if (!(await this.nameExists(name))) {
      return name;
    }

    for (let attempt = 1; attempt <= MAX_UNIQUE_NAME_ATTEMPTS; attempt++) {
      const candidate = `${name} (${attempt})`;
      if (!(await this.nameExists(candidate))) {
        return candidate;
      }
    }

    throw new Error(
      `Unable to generate unique name for '${name}' after ${MAX_UNIQUE_NAME_ATTEMPTS} attempts`
    );
  }

  /**
   * Lists prompt templates with optional filters.
   * @param options - (Optional) Options for the list operation.
   * @param options.nameFilter - (Optional) Name filter applied to results.
   * @param options.name - (Optional) Legacy alias for `nameFilter`.
   * @param options.matchExact - (Optional) Whether to use an equality match on names.
   * @param options.projectId - (Optional) Project ID to scope the query.
   * @param options.projectName - (Optional) Project name to scope the query.
   * @param options.limit - (Optional) Maximum number of templates to fetch.
   * @param options.startingToken - (Optional) Pagination starting token.
   * @returns A promise that resolves to the list response payload.
   */
  async list(
    options: PromptListOptions = {}
  ): Promise<ListPromptTemplateResponse> {
    const apiClient = await this.getClient(options);
    const nameFilter = options.nameFilter;
    return await apiClient.listGlobalPromptTemplates({
      nameFilter,
      nameOperator: options.matchExact ? 'eq' : undefined,
      projectId: options.projectId,
      projectName: options.projectName,
      limit: options.limit ?? 100,
      startingToken: options.startingToken
    });
  }

  /**
   * Retrieves a specific template version by ID or name.
   * @param options - Options describing the template lookup.
   * @param options.id - (Optional) Template identifier to load.
   * @param options.name - (Optional) Template name to resolve before loading.
   * @param options.version - (Optional) Template version to fetch, defaults to selected version.
   * @param options.projectId - (Optional) Project ID for name lookups.
   * @param options.projectName - (Optional) Project name for name lookups.
   * @returns A promise that resolves to the resolved template version.
   */
  async get(options: GetPromptOptions): Promise<PromptTemplateVersion> {
    if (!options.id && !options.name) {
      throw new Error('Either id or name must be provided');
    }
    this.ensureExclusiveField(options.id, options.name);

    const apiClient = await this.getClient(options);

    if (options.id) {
      if (options.version !== undefined) {
        return await apiClient.getGlobalPromptTemplateVersion(
          options.id,
          options.version
        );
      }
      const template = await apiClient.getGlobalPromptTemplate(options.id);
      const resolvedVersion = template.selectedVersion.version;
      return await apiClient.getGlobalPromptTemplateVersion(
        options.id,
        resolvedVersion
      );
    }

    const template = await this.findTemplateByName(options.name!, {
      projectId: options.projectId,
      projectName: options.projectName
    });
    const resolvedVersion = options.version ?? template.selectedVersion.version;
    return await apiClient.getGlobalPromptTemplateVersion(
      template.id,
      resolvedVersion
    );
  }

  /**
   * Creates a global prompt template within an optional project scope.
   * @param options - Creation options.
   * @param options.template - Template content as messages or string.
   * @param options.name - Desired template name.
   * @param options.ensureUniqueName - (Optional) Whether to generate a unique name automatically.
   * @param options.projectId - (Optional) Project ID associated with the template.
   * @param options.projectName - (Optional) Project name associated with the template.
   * @param options.ensureUniqueName - (Optional) Whether to generate a unique name automatically.
   * @returns A promise that resolves to the created template summary.
   */
  async create(options: CreatePromptOptions): Promise<PromptTemplateType> {
    const apiClient = await this.getClient(options);
    const normalizedTemplate = this.normalizeTemplate(options.template);
    const shouldEnsureUnique = options.ensureUniqueName ?? true;
    const finalName = shouldEnsureUnique
      ? await this.generateUniqueName(options.name)
      : options.name;

    return await apiClient.createGlobalPromptTemplate(
      normalizedTemplate,
      finalName,
      { projectId: options.projectId, projectName: options.projectName }
    );
  }

  /**
   * Renames a prompt template by ID or name.
   * @param options - Update options.
   * @param options.id - (Optional) Template ID to rename.
   * @param options.name - (Optional) Template name to resolve before renaming.
   * @param options.newName - New template name to apply.
   * @param options.projectId - (Optional) Project ID used for name resolution.
   * @param options.projectName - (Optional) Project name used for name resolution.
   * @returns A promise that resolves to the updated prompt template.
   */
  async update(options: UpdatePromptOptions): Promise<PromptTemplateType> {
    if (!options.id && !options.name) {
      throw new Error('Either id or name must be provided');
    }
    this.ensureExclusiveField(options.id, options.name);

    const apiClient = await this.getClient(options);
    const templateId =
      options.id ??
      (
        await this.findTemplateByName(options.name!, {
          projectId: options.projectId,
          projectName: options.projectName
        })
      ).id;
    return await apiClient.updateGlobalPromptTemplate(
      templateId,
      options.newName
    );
  }

  /**
   * Deletes a prompt template by ID or name.
   * @param options - Deletion options.
   * @param options.id - (Optional) Template ID to delete.
   * @param options.name - (Optional) Template name to resolve before deletion.
   * @param options.projectId - (Optional) Project ID used for name resolution.
   * @param options.projectName - (Optional) Project name used for name resolution.
   * @returns A promise that resolves when the template is deleted.
   */
  async delete(options: DeletePromptOptions): Promise<void> {
    if (!options.id && !options.name) {
      throw new Error('Either id or name must be provided');
    }
    this.ensureExclusiveField(options.id, options.name);

    const apiClient = await this.getClient();

    const templateId =
      options.id ??
      (
        await this.findTemplateByName(options.name!, {
          projectId: options.projectId,
          projectName: options.projectName
        })
      ).id;

    return await apiClient.deleteGlobalPromptTemplate(templateId);
  }

  /**
   * Renders a prompt template with the provided data.
   * @param options - Render options.
   * @param options.template - Template content to render.
   * @param options.data - Dataset identifier, raw strings, or structured data.
   * @param options.startingToken - (Optional) Pagination starting token.
   * @param options.limit - (Optional) Maximum number of rendered messages per page.
   * @returns A promise that resolves to the rendered template response.
   */
  async render(
    options: RenderPromptTemplateOptions
  ): Promise<RenderTemplateResponse> {
    const apiClient = await this.getClient();
    let processedData: DatasetData | StringData;

    if (Array.isArray(options.data)) {
      processedData = { inputStrings: options.data };
    } else if (typeof options.data === 'string') {
      processedData = { datasetId: options.data };
    } else {
      processedData = options.data;
    }

    const request: RenderTemplateRequest = {
      template: options.template,
      data: processedData
    };

    return await apiClient.renderPromptTemplate(
      request,
      options.startingToken ?? 0,
      options.limit ?? 100
    );
  }
}

/**
 * Updates an existing prompt template name.
 * @param options - Update options containing the template identifier.
 * @param options.id - (Optional) Template ID to rename.
 * @param options.name - (Optional) Template name to resolve before renaming.
 * @param options.newName - New template name to apply.
 * @param options.projectId - (Optional) Project ID associated with template.
 * @param options.projectName - (Optional) Project name associated with template.
 * @returns A promise that resolves to the updated template metadata.
 */
export const updatePrompt = async ({
  id,
  name,
  newName,
  projectId,
  projectName
}: UpdatePromptOptions): Promise<PromptTemplateType> => {
  const promptTemplate = new PromptTemplate();
  return await promptTemplate.update({
    id,
    name,
    newName,
    projectId,
    projectName
  });
};

/**
 * Deletes a prompt template.
 * @param options - Delete options containing the template identifier.
 * @param options.id - (Optional) Template ID to delete.
 * @param options.name - (Optional) Template name to resolve before deletion.
 * @param options.projectId - (Optional) Project ID associated with template.
 * @param options.projectName - (Optional) Project name associated with template.
 * @returns A promise that resolves when the template is removed.
 */
export const deletePrompt = async ({
  id,
  name,
  projectId,
  projectName
}: DeletePromptOptions) => {
  const promptTemplate = new PromptTemplate();
  return await promptTemplate.delete({ id, name, projectId, projectName });
};

/**
 * Renders a prompt template with flexible data inputs.
 * @param options - Render options.
 * @param options.template - Template to render.
 * @param options.data - Dataset identifier, array of input strings, or request payload.
 * @param options.startingToken - (Optional) Pagination starting token (default: 0).
 * @param options.limit - (Optional) Maximum records per page (default: 100).
 * @returns A promise that resolves to the render response payload.
 */
export const renderPrompt = async ({
  template,
  data,
  startingToken = 0,
  limit = 100
}: RenderPromptTemplateOptions): Promise<RenderTemplateResponse> => {
  const promptTemplate = new PromptTemplate();
  return await promptTemplate.render({ template, data, startingToken, limit });
};

/**
 * Lists prompt templates with optional filtering.
 * @param options - Options for the list operation.
 * @param options.name - Name filter applied to results.
 * @param options.limit - (Optional) Maximum number of templates to return.
 * @returns A promise that resolves to the available prompt templates.
 */
export const getPrompts = async ({
  name,
  limit,
  projectId,
  projectName
}: GetPromptsOptions): Promise<PromptTemplateType[]> => {
  const promptTemplate = new PromptTemplate();
  const response = await promptTemplate.list({
    nameFilter: name,
    limit,
    projectId,
    projectName
  });
  return response.templates ?? [];
};

/**
 * Retrieves a prompt template version using either an ID or name.
 * @param options - Lookup options.
 * @param options.id - (Optional) Template ID to fetch.
 * @param options.name - (Optional) Template name to resolve.
 * @param options.projectId - (Optional) Project ID associated with template.
 * @param options.projectName - (Optional) Project name associated with template.
 * @param options.version - (Optional) Version number to fetch.
 * @returns A promise that resolves to the requested template version.
 */
export const getPrompt = async ({
  id,
  name,
  version,
  projectId,
  projectName
}: GetPromptOptions): Promise<PromptTemplateVersion> => {
  const promptTemplate = new PromptTemplate();
  return await promptTemplate.get({
    id,
    name,
    version,
    projectId,
    projectName
  });
};

/**
 * Creates a prompt template while guaranteeing a unique name.
 * @param options - Creation request.
 * @param options.template - Template content as messages or plain text.
 * @param options.name - Preferred template name.
 * @param options.projectId - (Optional) Project ID associated with template.
 * @param options.projectName - (Optional) Project name associated with template.
 * @returns A promise that resolves to the created template summary.
 */
export const createPrompt = async ({
  template,
  name,
  projectId,
  projectName,
  ensureUniqueName
}: CreatePromptOptions): Promise<PromptTemplateType> => {
  const promptTemplate = new PromptTemplate();
  return await promptTemplate.create({
    template,
    name,
    projectId,
    projectName,
    ensureUniqueName
  });
};

// DEPRECATED HELPERS
/**
 * @deprecated Prefer `getPrompts`.
 *
 * Lists prompt templates scoped to the provided project name.
 * @param projectName - Project name whose templates should be fetched.
 * @returns A promise that resolves to the available prompt templates.
 */
export const getPromptTemplates = async (
  projectName: string
): Promise<PromptTemplateType[]> => {
  const promptTemplate = new PromptTemplate();
  const response = await promptTemplate.list({ projectName });
  return response.templates ?? [];
};

/**
 * @deprecated Prefer `getPrompt`.
 *
 * Retrieves a prompt template version using either an ID or name.
 * @param options - Lookup options.
 * @param options.id - (Optional) Template ID to fetch.
 * @param options.name - (Optional) Template name to resolve.
 * @param options.projectId - (Optional) Project ID associated with template.
 * @param options.projectName - (Optional) Project name associated with template.
 * @param options.version - (Optional) Version number to fetch.
 * @returns A promise that resolves to the requested template version.
 */
export const getPromptTemplate = async ({
  id,
  name,
  projectId,
  projectName,
  version
}: {
  id?: string;
  name?: string;
  projectId?: string;
  projectName?: string;
  version?: number;
}): Promise<PromptTemplateVersion> => {
  const promptTemplate = new PromptTemplate();
  return await promptTemplate.get({
    id,
    name,
    version,
    projectId,
    projectName
  });
};

/**
 * @deprecated Prefer `createPrompt`.
 *
 * Creates a prompt template without enforcing unique names.
 * @param options - Creation request.
 * @param options.template - Template content as messages or plain text.
 * @param options.name - Preferred template name.
 * @param options.projectId - (Optional) Project ID associated with template.
 * @param options.projectName - (Optional) Project name associated with template.
 * @returns A promise that resolves to the created template summary.
 */
export const createPromptTemplate = async ({
  template,
  name,
  projectId,
  projectName
}: {
  template: Message[] | string;
  name: string;
  projectId?: string;
  projectName?: string;
}): Promise<PromptTemplateType> => {
  const promptTemplate = new PromptTemplate();
  return await promptTemplate.create({
    template,
    name,
    projectId,
    projectName,
    ensureUniqueName: false
  });
};
