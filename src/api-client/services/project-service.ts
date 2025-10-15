import { BaseClient, RequestMethod } from '../base-client';
import {
  Project,
  ProjectCreateResponse,
  ProjectTypes
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

  public async getProjects(): Promise<Project[]> {
    return await this.makeRequest<Project[]>(
      RequestMethod.GET,
      Routes.projects_all,
      null,
      this.projectType ? { project_type: this.projectType } : {}
    );
  }

  public async getProject(id: string): Promise<Project> {
    return await this.makeRequest<Project>(
      RequestMethod.GET,
      Routes.project,
      null,
      {
        project_id: id
      }
    );
  }

  public async getProjectByName(name: string): Promise<Project> {
    const projects = await this.makeRequest<Project[]>(
      RequestMethod.GET,
      Routes.projects,
      null,
      {
        project_name: name,
        type: this.projectType
      }
    );

    if (projects.length < 1) {
      throw new Error(`Galileo project ${name} not found`);
    }

    return projects[0];
  }

  public async getProjectIdByName(name: string): Promise<string> {
    return (await this.getProjectByName(name)).id;
  }

  public async createProject(
    project_name: string
  ): Promise<ProjectCreateResponse> {
    return await this.makeRequest<ProjectCreateResponse>(
      RequestMethod.POST,
      Routes.projects,
      {
        name: project_name,
        type: this.projectType
      }
    );
  }
}
