import { Project, ProjectTypes } from '../../src/types';
import {
  getProject,
  getProjectWithEnvFallbacks
} from '../../src/utils/projects';

// Create mock implementation functions
const mockInit = jest.fn().mockResolvedValue(undefined);
const mockGetExperiment = jest.fn();
const mockGetExperiments = jest.fn();
const mockCreateExperiment = jest.fn();
const mockGetProject = jest.fn();
const mockGetProjects = jest.fn();
const mockGetProjectByName = jest.fn();
const mockCreateRunScorerSettings = jest.fn();
const mockGetScorers = jest.fn();
const mockCreatePromptRunJob = jest.fn();
const mockGetDataset = jest.fn();
const mockGetDatasets = jest.fn();
const mockGetDatasetByName = jest.fn();
const mockGetDatasetContent = jest.fn();
const mockIngestTraces = jest.fn();
const mockGetScorerVersion = jest.fn();

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
  type: ProjectTypes.genAI
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
        'To fetch a project with `getProject`, either id or name must be provided'
      );
    });

    it('throws when both id and name provided', async () => {
      await expect(
        getProject({ id: projectId, name: projectName })
      ).rejects.toThrow(
        'To fetch a project with `getProject`, provide only one of id or name'
      );
    });

    it('fetches by id when id is provided', async () => {
      const result = await getProject({ id: projectId });
      expect(mockInit).toHaveBeenCalled();
      expect(mockGetProject).toHaveBeenCalledWith(projectId);
      expect(result).toEqual(mockProject);
    });

    it('fetches by name when name is provided', async () => {
      const result = await getProject({ name: projectName });
      expect(mockInit).toHaveBeenCalled();
      expect(mockGetProjectByName).toHaveBeenCalledWith(projectName);
      expect(result).toEqual(mockProject);
    });
  });

  describe('getProjectWithEnvFallbacks', () => {
    it('throws when neither id nor name provided and no env set', async () => {
      await expect(getProjectWithEnvFallbacks({})).rejects.toThrow(
        'To fetch a project with `getProject`, either id or name must be provided'
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
      expect(mockGetProjectByName).toHaveBeenCalledWith(projectName);
      expect(result).toEqual(mockProject);
    });

    it('throws when both GALILEO_PROJECT_ID and GALILEO_PROJECT are set', async () => {
      process.env.GALILEO_PROJECT_ID = projectId;
      process.env.GALILEO_PROJECT = projectName;
      await expect(getProjectWithEnvFallbacks({})).rejects.toThrow(
        'To fetch a project with `getProject`, provide only one of id or name'
      );
    });

    it('fetches by explicit id even if GALILEO_PROJECT_ID is also set', async () => {
      process.env.GALILEO_PROJECT_ID = 'different-id';
      const result = await getProjectWithEnvFallbacks({ id: projectId });
      expect(mockGetProject).toHaveBeenCalledWith(projectId);
      expect(result).toEqual(mockProject);
    });

    it('fetches by explicit name even if GALILEO_PROJECT is also set', async () => {
      process.env.GALILEO_PROJECT = 'different-name';
      const result = await getProjectWithEnvFallbacks({ name: projectName });
      expect(mockGetProjectByName).toHaveBeenCalledWith(projectName);
      expect(result).toEqual(mockProject);
    });

    it('throws when explicit id is provided and GALILEO_PROJECT (name) is set', async () => {
      process.env.GALILEO_PROJECT = projectName;
      await expect(
        getProjectWithEnvFallbacks({ id: projectId })
      ).rejects.toThrow(
        'To fetch a project with `getProject`, provide only one of id or name'
      );
    });

    it('throws when explicit name is provided and GALILEO_PROJECT_ID is set', async () => {
      process.env.GALILEO_PROJECT_ID = projectId;
      await expect(
        getProjectWithEnvFallbacks({ name: projectName })
      ).rejects.toThrow(
        'To fetch a project with `getProject`, provide only one of id or name'
      );
    });

    it('throws when both explicit id and name are provided (regardless of env)', async () => {
      await expect(
        getProjectWithEnvFallbacks({ id: projectId, name: projectName })
      ).rejects.toThrow(
        'To fetch a project with `getProject`, provide only one of id or name'
      );
    });
  });
});
