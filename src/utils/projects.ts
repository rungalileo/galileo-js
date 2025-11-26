import {
  CollaboratorRole,
  CollaboratorUpdate,
  Project,
  ProjectTypes,
  ProjectCreateOptions,
  ProjectCreateResponse,
  ProjectDeleteResponse,
  UserCollaborator,
  UserCollaboratorCreate,
  GetProjectOptions
} from '../types/project.types';
import { GalileoApiClient } from '../api-client';

/**
 * Projects class for managing projects in the Galileo platform.
 * Delegates to the internal GalileoApiClient for API interactions.
 */
export class Projects {
  private shouldContinue(
    paginated: boolean = false,
    nextToken?: number | null
  ): nextToken is number {
    return paginated && typeof nextToken === 'number';
  }

  /**
   * Lists every user collaborator for a project, exhausting pagination tokens.
   * @param projectId - (Optional) The project ID to list collaborators for.
   * @returns A promise that resolves to all collaborators for the project.
   */
  public async getAllUserCollaborators(
    projectId?: string
  ): Promise<UserCollaborator[]> {
    const apiClient = new GalileoApiClient();
    await apiClient.init({ projectScoped: true, projectId });

    const collaborators: UserCollaborator[] = [];
    let startingToken: number | undefined = 0;

    while (startingToken !== undefined) {
      const response = await apiClient.listUserProjectCollaborators({
        projectId,
        startingToken
      });

      collaborators.push(...(response.collaborators ?? []));
      const nextToken = response.nextStartingToken;
      startingToken = this.shouldContinue(response.paginated, nextToken)
        ? nextToken
        : undefined;
    }

    return collaborators;
  }

  /**
   * Lists projects available to the authenticated user.
   * @param projectType - (Optional) Project type filter to apply.
   * @returns A promise that resolves to the matching projects.
   */
  public async list(projectType?: ProjectTypes): Promise<Project[]> {
    const apiClient = new GalileoApiClient();
    await apiClient.init({ projectScoped: true });
    return await apiClient.getProjects(projectType);
  }

  /**
   * Creates a new project.
   * @param name - Name of the project.
   * @param options - (Optional) Additional project creation settings.
   * @param options.type - (Optional) Project type to assign.
   * @param options.createdBy - (Optional) Identifier of the creator.
   * @param options.createExampleTemplates - (Optional) Whether example templates should be created.
   * @returns A promise that resolves to the created project.
   */
  public async create(
    name: string,
    options?: ProjectCreateOptions
  ): Promise<ProjectCreateResponse> {
    const apiClient = new GalileoApiClient();
    await apiClient.init({ projectScoped: true });
    return await apiClient.createProject(name, options);
  }

  /**
   * Gets a project by ID or name, falling back to environment configuration when omitted.
   * @param options - The lookup options.
   * @param options.projectId - (Optional) Explicit project ID override.
   * @param options.name - (Optional) Explicit project name override.
   * @param options.projectType - (Optional) Project type hint when resolving by name.
   * @returns A promise that resolves to the matching project.
   */
  public async getWithEnvFallbacks({
    projectId,
    name,
    projectType
  }: GetProjectOptions): Promise<Project> {
    projectId = projectId ?? process.env.GALILEO_PROJECT_ID;
    name = name ?? process.env.GALILEO_PROJECT;

    return this.get({ projectId, name, projectType });
  }

  /**
   * Gets a project by ID or name.
   * @param options - The lookup options.
   * @param options.projectId - (Optional) ID of the project to fetch.
   * @param options.name - (Optional) Name of the project to fetch.
   * @param options.projectType - (Optional) Project type hint when resolving by name.
   * @returns A promise that resolves to the matching project.
   */
  public async get({
    projectId,
    name,
    projectType
  }: GetProjectOptions): Promise<Project> {
    if (!projectId && !name) {
      throw new Error('Either projectId or name must be provided');
    }

    if (projectId && name) {
      throw new Error('Provide only one of projectId or name');
    }

    const apiClient = new GalileoApiClient();
    await apiClient.init({ projectScoped: true, projectId });

    if (projectId) {
      return await apiClient.getProject(projectId!);
    }

    return await apiClient.getProjectByName(name!, {
      projectType: projectType ?? undefined
    });
  }

  /**
   * Deletes a project by ID or name without falling back to defaults.
   * @param options - The deletion options.
   * @param options.projectId - (Optional) ID of the project to delete.
   * @param options.name - (Optional) Name of the project to delete.
   * @param options.projectType - (Optional) Project type hint when resolving by name.
   * @returns A promise that resolves to the delete response payload.
   */
  public async delete({
    projectId,
    name,
    projectType
  }: GetProjectOptions): Promise<ProjectDeleteResponse> {
    if (!projectId && !name) {
      throw new Error(
        'To delete a project, either projectId or name must be provided.'
      );
    }

    if (projectId && name) {
      throw new Error(
        'To delete a project, provide only one of projectId or name to avoid ambiguity.'
      );
    }

    const apiClient = new GalileoApiClient();
    await apiClient.init({ projectScoped: true });

    const resolvedProjectId =
      projectId ?? (await apiClient.getProjectIdByName(name!, projectType));

    return await apiClient.deleteProject(resolvedProjectId);
  }

  /**
   * Adds user collaborators to a project.
   * @param collaborators - Collaborator payloads to create.
   * @param collaborators[].userId - ID of the user receiving access.
   * @param collaborators[].role - (Optional) Role assigned to the user.
   * @param projectId - (Optional) Project ID override when client is not project-scoped.
   * @returns A promise that resolves to the created collaborators.
   */
  public async addUserCollaborators(
    collaborators: UserCollaboratorCreate[],
    projectId?: string
  ): Promise<UserCollaborator[]> {
    if (!collaborators.length) {
      throw new Error('At least one user collaborator payload is required.');
    }

    const apiClient = new GalileoApiClient();
    await apiClient.init({ projectScoped: true });
    return await apiClient.createUserProjectCollaborators(
      collaborators,
      projectId
    );
  }

  /**
   * Updates a user collaborator assignment.
   * @param userId - ID of the collaborator to update.
   * @param update - Update payload describing the collaborator changes.
   * @param update.role - (Optional) Updated role for the collaborator.
   * @param projectId - (Optional) Project ID override when client is not project-scoped.
   * @returns A promise that resolves to the updated collaborator.
   */
  public async updateUserCollaborator(
    userId: string,
    update: CollaboratorUpdate,
    projectId?: string
  ): Promise<UserCollaborator> {
    if (!userId) {
      throw new Error('userId is required to update a collaborator.');
    }

    const apiClient = new GalileoApiClient();
    await apiClient.init({ projectScoped: true });
    return await apiClient.updateUserProjectCollaborator(
      userId,
      update,
      projectId
    );
  }

  /**
   * Removes a user collaborator from a project.
   * @param userId - ID of the collaborator to remove.
   * @param projectId - Project ID that the collaborator belongs to.
   * @returns A promise that resolves when removal succeeds.
   */
  public async removeUserCollaborator(
    userId: string,
    projectId: string
  ): Promise<void> {
    if (!userId) {
      throw new Error('userId is required to remove a collaborator.');
    }

    const apiClient = new GalileoApiClient();
    await apiClient.init({ projectScoped: true });
    await apiClient.deleteUserProjectCollaborator(userId, projectId);
  }

  /**
   * Shares a project with a single user.
   * @param projectId - ID of the project to share.
   * @param userId - ID of the user receiving access.
   * @param role - (Optional) Role to assign to the user (defaults to viewer).
   * @returns A promise that resolves to the created collaborator record.
   */
  public async shareWithUser(
    projectId: string,
    userId: string,
    role: CollaboratorRole = 'viewer'
  ): Promise<UserCollaborator> {
    const collaborators = await this.addUserCollaborators(
      [{ userId, role }],
      projectId
    );

    if (!collaborators || collaborators.length === 0) {
      throw new Error(
        `Failed to share project ${projectId} with user ${userId}`
      );
    }

    return collaborators[0];
  }

  /**
   * Removes a user's access to a project.
   * @param projectId - ID of the project to unshare.
   * @param userId - ID of the user losing access.
   * @returns A promise that resolves when the user is unshared.
   */
  public async unshareWithUser(
    projectId: string,
    userId: string
  ): Promise<void> {
    await this.removeUserCollaborator(userId, projectId);
  }
}

/**
 * Lists projects available to the authenticated user.
 * @returns A promise that resolves to the accessible projects.
 */
export const getProjects = async (): Promise<Project[]> => {
  const projects = new Projects();
  return await projects.list();
};

/**
 * Creates a new project.
 * @param name - Name of the project to create.
 * @param options - (Optional) Additional create options.
 * @param options.type - (Optional) Project type to assign.
 * @param options.createdBy - (Optional) Identifier of the creator.
 * @param options.createExampleTemplates - (Optional) Whether example templates should be created.
 * @returns A promise that resolves to the created project.
 */
export const createProject = async (
  name: string,
  options?: ProjectCreateOptions
): Promise<ProjectCreateResponse> => {
  const projects = new Projects();
  return await projects.create(name, options);
};

/*
 * Gets a project by Id or name.
 * If neither Id nor name are provided, it will use the environment variables GALILEO_PROJECT_ID or GALILEO_PROJECT.
 * @param options - The lookup options.
 * @param options.projectId - (Optional) Project ID to fetch.
 * @param options.name - (Optional) Project name to fetch.
 * @param options.projectType - (Optional) Project type hint when resolving by name.
 * @returns A promise that resolves to the matching project.
 */
export const getProjectWithEnvFallbacks = async ({
  projectId,
  name,
  projectType
}: GetProjectOptions): Promise<Project> => {
  const projects = new Projects();
  return await projects.getWithEnvFallbacks({ projectId, name, projectType });
};

/**
 * Gets a project by ID or name.
 * @param options - The lookup options.
 * @param options.projectId - (Optional) ID of the project to fetch.
 * @param options.name - (Optional) Name of the project to fetch.
 * @param options.projectType - (Optional) Project type hint when resolving by name.
 * @returns A promise that resolves to the matching project.
 */
export const getProject = async ({
  projectId,
  name,
  projectType
}: GetProjectOptions): Promise<Project> => {
  const projects = new Projects();
  return await projects.get({ projectId, name, projectType });
};

/**
 * Deletes a project by ID or name without falling back to defaults.
 * @param options - The deletion options.
 * @param options.projectId - (Optional) ID of the project to delete.
 * @param options.name - (Optional) Name of the project to delete.
 * @param options.projectType - (Optional) Project type hint when resolving by name.
 * @returns A promise that resolves to the delete response payload.
 */
export const deleteProject = async ({
  projectId,
  name,
  projectType
}: GetProjectOptions): Promise<ProjectDeleteResponse> => {
  const projects = new Projects();
  return await projects.delete({ projectId, name, projectType });
};

/**
 * Lists every user collaborator for a project, handling pagination automatically.
 * @param projectId - (Optional) Project ID to list collaborators for.
 * @returns A promise that resolves to every user collaborator.
 */
export const listProjectUserCollaborators = async (
  projectId?: string
): Promise<UserCollaborator[]> => {
  const projects = new Projects();
  return await projects.getAllUserCollaborators(projectId);
};

/**
 * Adds multiple user collaborators to a project.
 * @param collaborators - Collaborator payloads to create.
 * @param collaborators[].userId - ID of the user receiving access.
 * @param collaborators[].role - (Optional) Role assigned to the user.
 * @param projectId - (Optional) Project ID override when client is not project-scoped.
 * @returns A promise that resolves to the created collaborators.
 */
export const addProjectUserCollaborators = async (
  collaborators: UserCollaboratorCreate[],
  projectId?: string
): Promise<UserCollaborator[]> => {
  const projects = new Projects();
  return await projects.addUserCollaborators(collaborators, projectId);
};

/**
 * Updates a user collaborator assignment.
 * @param userId - ID of the collaborator to update.
 * @param update - Update payload describing the collaborator changes.
 * @param update.role - (Optional) Updated role for the collaborator.
 * @param projectId - (Optional) Project ID override when client is not project-scoped.
 * @returns A promise that resolves to the updated collaborator.
 */
export const updateProjectUserCollaborator = async (
  userId: string,
  update: CollaboratorUpdate,
  projectId?: string
): Promise<UserCollaborator> => {
  const projects = new Projects();
  return await projects.updateUserCollaborator(userId, update, projectId);
};

/**
 * Removes a user collaborator from a project.
 * @param userId - ID of the collaborator to remove.
 * @param projectId - ID of the project the collaborator belongs to.
 * @returns A promise that resolves when removal succeeds.
 */
export const removeProjectUserCollaborator = async (
  userId: string,
  projectId: string
): Promise<void> => {
  const projects = new Projects();
  return await projects.removeUserCollaborator(userId, projectId);
};

/**
 * Shares a project with a single user.
 * @param projectId - ID of the project to share.
 * @param userId - ID of the user receiving access.
 * @param role - (Optional) Role to assign to the user (defaults to viewer).
 * @returns A promise that resolves to the created collaborator record.
 */
export const shareProjectWithUser = async (
  projectId: string,
  userId: string,
  role: CollaboratorRole = 'viewer'
): Promise<UserCollaborator> => {
  const projects = new Projects();
  return await projects.shareWithUser(projectId, userId, role);
};

/**
 * Removes a user's access to a project.
 * @param projectId - ID of the project to unshare.
 * @param userId - ID of the user losing access.
 * @returns A promise that resolves when the user is unshared.
 */
export const unshareProjectWithUser = async (
  projectId: string,
  userId: string
): Promise<void> => {
  const projects = new Projects();
  return await projects.unshareWithUser(projectId, userId);
};
