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
 * Gets a project by Id or name.
 * If neither Id nor name are provided, it will use the environment variables GALILEO_PROJECT_ID or GALILEO_PROJECT.
 */
export const getProjectWithEnvFallbacks = async ({
  id,
  name
}: {
  id?: string;
  name?: string;
}): Promise<Project> => {
  id = id ?? process.env.GALILEO_PROJECT_ID;
  name = name ?? process.env.GALILEO_PROJECT;

  return getProject({ id, name });
};

/*
 * Gets a project by Id or name.
 */
export const getProject = async ({
  id,
  name
}: {
  id?: string;
  name?: string;
}): Promise<Project> => {
  if (!id && !name) {
    throw new Error(
      'To fetch a project with `getProject`, either id or name must be provided'
    );
  }

  if (id && name) {
    throw new Error(
      'To fetch a project with `getProject`, provide only one of id or name'
    );
  }

  const apiClient = new GalileoApiClient();
  await apiClient.init();
  if (id) {
    return await apiClient.getProject(id!);
  }

  return await apiClient.getProjectByName(name!);
};
