import { Project, ProjectTypes } from '../../src/types';
import {
  addProjectUserCollaborators,
  deleteProject,
  getProject,
  getProjectWithEnvFallbacks,
  listProjectUserCollaborators
} from '../../src/utils/projects';

// Create mock implementation functions
const mockInit = jest.fn().mockResolvedValue(undefined);
const mockGetExperiment = jest.fn();
const mockGetExperiments = jest.fn();
const mockCreateExperiment = jest.fn();
const mockGetProject = jest.fn();
const mockGetProjects = jest.fn();
const mockGetProjectByName = jest.fn();
const mockDeleteProject = jest.fn();
const mockGetProjectIdByName = jest.fn();
const mockCreateRunScorerSettings = jest.fn();
const mockGetScorers = jest.fn();
const mockCreatePromptRunJob = jest.fn();
const mockGetDataset = jest.fn();
const mockGetDatasets = jest.fn();
const mockGetDatasetByName = jest.fn();
const mockGetDatasetContent = jest.fn();
const mockIngestTraces = jest.fn();
const mockGetScorerVersion = jest.fn();
const mockListUserProjectCollaborators = jest.fn();
const mockCreateUserProjectCollaborators = jest.fn();
const mockUpdateUserProjectCollaborator = jest.fn();
const mockDeleteUserProjectCollaborator = jest.fn();

jest.mock('../../src/api-client', () => {
  return {
    GalileoApiClient: jest.fn().mockImplementation(() => {
      return {
        init: mockInit,
        getExperiment: mockGetExperiment,
        getExperiments: mockGetExperiments,
        createExperiment: mockCreateExperiment,
        getProject: mockGetProject,
        getProjects: mockGetProjects,
        getProjectByName: mockGetProjectByName,
        getProjectIdByName: mockGetProjectIdByName,
        deleteProject: mockDeleteProject,
        listUserProjectCollaborators: mockListUserProjectCollaborators,
        createUserProjectCollaborators: mockCreateUserProjectCollaborators,
        updateUserProjectCollaborator: mockUpdateUserProjectCollaborator,
        deleteUserProjectCollaborator: mockDeleteUserProjectCollaborator,
        createRunScorerSettings: mockCreateRunScorerSettings,
        getScorers: mockGetScorers,
        getScorerVersion: mockGetScorerVersion,
        createPromptRunJob: mockCreatePromptRunJob,
        getDataset: mockGetDataset,
        getDatasets: mockGetDatasets,
        getDatasetByName: mockGetDatasetByName,
        getDatasetContent: mockGetDatasetContent,
        ingestTraces: mockIngestTraces
      };
    })
  };
});

const projectId = 'proj-123';
const projectName = 'test-project';

// Example data
const mockProject: Project = {
  id: projectId,
  name: projectName,
  type: ProjectTypes.genAI,
  createdBy: 'user-123',
  createdByUser: {
    id: 'user-123',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User'
  },
  runs: [],
  createdAt: '2021-09-10T00:00:00Z',
  updatedAt: '2021-09-10T00:00:00Z'
};

const sampleUserCollaborator = {
  id: 'col-1',
  role: 'viewer',
  createdAt: '2023-01-01T00:00:00Z',
  userId: 'user-1',
  firstName: 'User',
  lastName: 'One',
  email: 'user1@example.com',
  permissions: []
};

describe('projects utils', () => {
  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    originalEnv = { ...process.env };
    jest.clearAllMocks();
    // default mocks
    mockInit.mockResolvedValue(undefined);
    mockGetProject.mockResolvedValue(mockProject);
    mockGetProjectByName.mockResolvedValue(mockProject);
    mockGetProjectIdByName.mockResolvedValue(projectId);
    // clear project-related envs by default
    delete process.env.GALILEO_PROJECT_ID;
    delete process.env.GALILEO_PROJECT;
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('getProject', () => {
    it('throws when neither id nor name provided', async () => {
      await expect(getProject({})).rejects.toThrow(
        'Either projectId or name must be provided'
      );
    });

    it('throws when both id and name provided', async () => {
      await expect(
        getProject({ projectId, name: projectName })
      ).rejects.toThrow('Provide only one of projectId or name');
    });

    it('fetches by id when id is provided', async () => {
      const result = await getProject({ projectId });
      expect(mockInit).toHaveBeenCalled();
      expect(mockGetProject).toHaveBeenCalledWith(projectId);
      expect(result).toEqual(mockProject);
    });

    it('fetches by name when name is provided', async () => {
      const result = await getProject({ name: projectName });
      expect(mockInit).toHaveBeenCalled();
      expect(mockGetProjectByName).toHaveBeenCalledWith(projectName, {
        projectType: undefined
      });
      expect(result).toEqual(mockProject);
    });
  });

  describe('getProjectWithEnvFallbacks', () => {
    it('throws when neither id nor name provided and no env set', async () => {
      await expect(getProjectWithEnvFallbacks({})).rejects.toThrow(
        'Either projectId or name must be provided'
      );
    });

    it('fetches by env id when only GALILEO_PROJECT_ID is set', async () => {
      process.env.GALILEO_PROJECT_ID = projectId;
      const result = await getProjectWithEnvFallbacks({});
      expect(mockGetProject).toHaveBeenCalledWith(projectId);
      expect(result).toEqual(mockProject);
    });

    it('fetches by env name when only GALILEO_PROJECT is set', async () => {
      process.env.GALILEO_PROJECT = projectName;
      const result = await getProjectWithEnvFallbacks({});
      expect(mockGetProjectByName).toHaveBeenCalledWith(projectName, {
        projectType: undefined
      });
      expect(result).toEqual(mockProject);
    });

    it('throws when both GALILEO_PROJECT_ID and GALILEO_PROJECT are set', async () => {
      process.env.GALILEO_PROJECT_ID = projectId;
      process.env.GALILEO_PROJECT = projectName;
      await expect(getProjectWithEnvFallbacks({})).rejects.toThrow(
        'Provide only one of projectId or name'
      );
    });

    it('fetches by explicit id even if GALILEO_PROJECT_ID is also set', async () => {
      process.env.GALILEO_PROJECT_ID = 'different-id';
      const result = await getProjectWithEnvFallbacks({ projectId });
      expect(mockGetProject).toHaveBeenCalledWith(projectId);
      expect(result).toEqual(mockProject);
    });

    it('fetches by explicit name even if GALILEO_PROJECT is also set', async () => {
      process.env.GALILEO_PROJECT = 'different-name';
      const result = await getProjectWithEnvFallbacks({ name: projectName });
      expect(mockGetProjectByName).toHaveBeenCalledWith(projectName, {
        projectType: undefined
      });
      expect(result).toEqual(mockProject);
    });

    it('throws when explicit id is provided and GALILEO_PROJECT (name) is set', async () => {
      process.env.GALILEO_PROJECT = projectName;
      await expect(getProjectWithEnvFallbacks({ projectId })).rejects.toThrow(
        'Provide only one of projectId or name'
      );
    });

    it('throws when explicit name is provided and GALILEO_PROJECT_ID is set', async () => {
      process.env.GALILEO_PROJECT_ID = projectId;
      await expect(
        getProjectWithEnvFallbacks({ name: projectName })
      ).rejects.toThrow('Provide only one of projectId or name');
    });

    it('throws when both explicit id and name are provided (regardless of env)', async () => {
      await expect(
        getProjectWithEnvFallbacks({ projectId, name: projectName })
      ).rejects.toThrow('Provide only one of projectId or name');
    });
  });

  describe('deleteProject', () => {
    it('throws when neither id nor name provided', async () => {
      await expect(deleteProject({})).rejects.toThrow(
        'To delete a project, either projectId or name must be provided.'
      );
    });

    it('throws when both id and name provided', async () => {
      await expect(
        deleteProject({ projectId, name: projectName })
      ).rejects.toThrow(
        'To delete a project, provide only one of projectId or name to avoid ambiguity.'
      );
    });

    it('deletes when id provided', async () => {
      mockDeleteProject.mockResolvedValue({ id: projectId });
      await deleteProject({ projectId });
      expect(mockDeleteProject).toHaveBeenCalledWith(projectId);
    });

    it('looks up project by name when id absent', async () => {
      mockDeleteProject.mockResolvedValue({ id: projectId });
      await deleteProject({ name: projectName });
      expect(mockGetProjectIdByName).toHaveBeenCalledWith(projectName, {
        projectType: undefined
      });
      expect(mockDeleteProject).toHaveBeenCalledWith(projectId);
    });
  });

  describe('collaborator helpers', () => {
    it('aggregates paginated user collaborators', async () => {
      mockListUserProjectCollaborators
        .mockResolvedValueOnce({
          collaborators: [sampleUserCollaborator],
          paginated: true,
          nextStartingToken: 1
        })
        .mockResolvedValueOnce({
          collaborators: [
            {
              ...sampleUserCollaborator,
              id: 'col-2',
              userId: 'user-2',
              email: 'user2@example.com'
            }
          ],
          paginated: false
        });

      const collaborators = await listProjectUserCollaborators();
      expect(collaborators).toHaveLength(2);
      expect(mockListUserProjectCollaborators).toHaveBeenCalledTimes(2);
    });

    it('throws when adding user collaborators without payload', async () => {
      await expect(addProjectUserCollaborators([])).rejects.toThrow(
        'At least one user collaborator payload is required.'
      );
    });
  });
});
