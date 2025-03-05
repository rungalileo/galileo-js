import { Project } from '../types/project.types';
import { GalileoApiClient } from '../api-client';

/*
 * Gets all projects.
 */
export const getProjects = async (): Promise<Project[]> => {
  const apiClient = new GalileoApiClient();
  await apiClient.init();
  return await apiClient.getProjects();
};

/*
 * Creates a new project.
 */
export const createProject = async (name: string): Promise<Project> => {
  const apiClient = new GalileoApiClient();
  await apiClient.init();
  return await apiClient.createProject(name);
};

/*
 * Gets a project by id or name.
 */
export const getProject = async (
  id?: string,
  name?: string
): Promise<Project> => {
  if (!id && !name) {
    throw new Error(
      'To fetch a project with `getProject`, either id or name must be provided'
    );
  }

  const apiClient = new GalileoApiClient();
  await apiClient.init();
  if (id) {
    return await apiClient.getProject(id!);
  }

  return await apiClient.getProjectByName(name!);
};
