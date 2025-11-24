import { BaseClient, RequestMethod } from '../base-client';
import {
  CollaboratorUpdate,
  CollaboratorUpdateOpenAPI,
  ListUserCollaboratorsResponse,
  ListUserCollaboratorsResponseOpenAPI,
  Project,
  ProjectCreateResponse,
  ProjectCreateResponseOpenAPI,
  ProjectDeleteResponse,
  ProjectDeleteResponseOpenAPI,
  ProjectTypes,
  ProjectOpenAPI,
  UserCollaborator,
  UserCollaboratorCreate,
  UserCollaboratorCreateOpenAPI,
  UserCollaboratorOpenAPI,
  ProjectCreateOpenAPI,
  ProjectCreate,
  CollaboratorListOptions
} from '../../types/project.types';
import { Routes } from '../../types/routes.types';

export class ProjectService extends BaseClient {
  private projectType: ProjectTypes;

  constructor(apiUrl: string, token: string, projectType: ProjectTypes) {
    super();
    this.apiUrl = apiUrl;
    this.token = token;
    this.projectType = projectType;
    this.initializeClient();
  }

  public async getProjects(projectType?: ProjectTypes): Promise<Project[]> {
    const response = await this.makeRequest<ProjectOpenAPI[]>(
      RequestMethod.GET,
      Routes.projects_all,
      null,
      projectType ? { project_type: projectType } : {}
    );
    return response.map((item) =>
      this.convertToCamelCase<ProjectOpenAPI, Project>(item)
    );
  }

  public async getProject(id: string): Promise<Project> {
    const response = await this.makeRequest<ProjectOpenAPI>(
      RequestMethod.GET,
      Routes.project,
      null,
      {
        project_id: id
      }
    );
    return this.convertToCamelCase<ProjectOpenAPI, Project>(response);
  }

  public async getProjectByName(
    name: string,
    options: { projectType?: ProjectTypes | null } = {}
  ): Promise<Project> {
    const projectType = options.projectType ?? this.projectType;
    const response = await this.makeRequest<ProjectOpenAPI[]>(
      RequestMethod.GET,
      Routes.projects,
      null,
      {
        project_name: name,
        type: projectType
      }
    );

    if (response.length < 1) {
      throw new Error(`Galileo project ${name} not found`);
    }

    return this.convertToCamelCase<ProjectOpenAPI, Project>(response[0]);
  }

  public async getProjectIdByName(
    name: string,
    options?: { projectType?: ProjectTypes | null }
  ): Promise<string> {
    return (await this.getProjectByName(name, options)).id;
  }

  public async createProject(
    options: ProjectCreate
  ): Promise<ProjectCreateResponse> {
    if (!options.createExampleTemplates) options.createExampleTemplates = false;

    const requestBody: ProjectCreateOpenAPI = this.convertToSnakeCase<
      ProjectCreate,
      ProjectCreateOpenAPI
    >(options);

    const response = await this.makeRequest<ProjectCreateResponseOpenAPI>(
      RequestMethod.POST,
      Routes.projects,
      requestBody
    );

    return this.convertToCamelCase<
      ProjectCreateResponseOpenAPI,
      ProjectCreateResponse
    >(response);
  }

  public async deleteProject(
    projectId: string
  ): Promise<ProjectDeleteResponse> {
    const response = await this.makeRequest<ProjectDeleteResponseOpenAPI>(
      RequestMethod.DELETE,
      Routes.project,
      null,
      { project_id: projectId }
    );

    return this.convertToCamelCase<
      ProjectDeleteResponseOpenAPI,
      ProjectDeleteResponse
    >(response);
  }

  public async listUserProjectCollaborators(
    projectId: string,
    options?: CollaboratorListOptions
  ): Promise<ListUserCollaboratorsResponse> {
    const response =
      await this.makeRequest<ListUserCollaboratorsResponseOpenAPI>(
        RequestMethod.GET,
        Routes.projectUserCollaborators,
        null,
        {
          project_id: projectId,
          starting_token: options?.startingToken,
          limit: options?.limit
        }
      );

    return this.convertToCamelCase<
      ListUserCollaboratorsResponseOpenAPI,
      ListUserCollaboratorsResponse
    >(response);
  }

  public async createUserProjectCollaborators(
    projectId: string,
    collaborators: UserCollaboratorCreate[]
  ): Promise<UserCollaborator[]> {
    const request = collaborators.map((c) =>
      this.convertToSnakeCase<
        UserCollaboratorCreate,
        UserCollaboratorCreateOpenAPI
      >(c)
    );

    const response = await this.makeRequest<UserCollaboratorOpenAPI[]>(
      RequestMethod.POST,
      Routes.projectUserCollaborators,
      request,
      { project_id: projectId }
    );

    return response.map((item) =>
      this.convertToCamelCase<UserCollaboratorOpenAPI, UserCollaborator>(item)
    );
  }

  public async updateUserProjectCollaborator(
    projectId: string,
    userId: string,
    options: CollaboratorUpdate
  ): Promise<UserCollaborator> {
    const request = this.convertToSnakeCase<
      CollaboratorUpdate,
      CollaboratorUpdateOpenAPI
    >(options);

    const response = await this.makeRequest<UserCollaboratorOpenAPI>(
      RequestMethod.PATCH,
      Routes.projectUserCollaborator,
      request,
      { project_id: projectId, user_id: userId }
    );

    return this.convertToCamelCase<UserCollaboratorOpenAPI, UserCollaborator>(
      response
    );
  }

  public async deleteUserProjectCollaborator(
    projectId: string,
    userId: string
  ): Promise<void> {
    await this.makeRequest<void>(
      RequestMethod.DELETE,
      Routes.projectUserCollaborator,
      null,
      { project_id: projectId, user_id: userId }
    );
  }
}
