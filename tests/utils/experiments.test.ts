import {
  createExperiment,
  getExperiment,
  getExperiments,
  runExperiment
} from '../../src';
import { Experiment } from '../../src/types/experiment.types';
import { Project, ProjectTypes } from '../../src/types/project.types';
import {
  PromptTemplate,
  PromptTemplateVersion
} from '../../src/types/prompt-template.types';
import { Scorer, ScorerTypes } from '../../src/types/scorer.types';
import { Dataset, DatasetRow } from '../../src/types/dataset.types';
import { GalileoScorers } from '../../src/types/metrics.types';

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

jest.mock('../../src/utils/galileo-logger', () => {
  return {
    GalileoLogger: jest.fn().mockImplementation(() => ({
      startTrace: jest.fn(),
      addLlmSpan: jest.fn(),
      addRetrieverSpan: jest.fn(),
      addToolSpan: jest.fn(),
      addWorkflowSpan: jest.fn(),
      conclude: jest.fn(),
      flush: jest.fn()
    }))
  };
});

const experimentId = 'exp-123';
const experimentName = 'My Test Experiment';
const projectId = 'proj-123';
const projectName = 'test-project';
const promptRunJobCreatedSuccessMessage = 'Prompt run job created';

const mockExperiment: Experiment = {
  id: experimentId,
  name: experimentName,
  created_at: new Date('2023-01-01T00:00:00Z'),
  updated_at: new Date('2023-01-01T00:00:00Z'),
  project_id: 'proj-123',
  created_by: 'user-123'
};

const mockExperiments: Experiment[] = [mockExperiment];

// Example data
const mockProject: Project = {
  id: projectId,
  name: projectName,
  type: ProjectTypes.genAI
};

const mockDataset: Dataset = {
  id: 'test-dataset-id',
  name: 'test-dataset',
  column_names: ['country'],
  project_count: 1,
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2023-01-01T00:00:00Z',
  num_rows: 1,
  created_by_user: null,
  current_version_index: 1,
  draft: false
};

const mockDatasetRow: DatasetRow = {
  index: 0,
  row_id: 'row-123',
  values: ['France'],
  values_dict: { country: 'France' },
  metadata: null
};

const mockPromptTemplateVersion: PromptTemplateVersion = {
  id: 'prompt-template-version-123',
  template: [
    { role: 'user', content: 'What is the capital of {{ country }}?' }
  ],
  version: 1,
  lines_added: 0,
  lines_removed: 0,
  lines_edited: 0,
  model_changed: false,
  settings_changed: false,
  settings: {}
};

const mockPromptTemplate: PromptTemplate = {
  id: 'prompt-template-123',
  name: 'Test Prompt Template',
  template: 'What is the capital of {{ country }}?',
  selected_version_id: 'prompt-template-version-123',
  selected_version: mockPromptTemplateVersion,
  all_versions: [mockPromptTemplateVersion],
  all_available_versions: [1],
  total_versions: 1,
  max_version: 1
};

const mockScorer: Scorer = {
  id: 'scorer-123',
  name: 'correctness',
  scorer_type: ScorerTypes.preset
};

describe('experiments utility', () => {
  let originalEnv: Record<string, string | undefined>;
  beforeEach(() => {
    // Store original env variables
    originalEnv = { ...process.env };

    // Set required env variables
    process.env.GALILEO_PROJECT = 'test-project';
    process.env.GALILEO_LOG_STREAM = 'test-log-stream';

    // Clear all mocks before each test
    jest.clearAllMocks();

    // Reset mock implementations to default
    mockInit.mockResolvedValue(undefined);
    mockGetExperiment.mockResolvedValue(mockExperiment);
    mockGetExperiments.mockResolvedValue(mockExperiments);
    mockCreateExperiment.mockResolvedValue(mockExperiment);
    mockGetProject.mockResolvedValue(mockProject);
    mockGetProjects.mockResolvedValue([mockProject]);
    mockGetProjectByName.mockResolvedValue(mockProject);
    mockCreateRunScorerSettings.mockResolvedValue(undefined);
    mockGetScorers.mockResolvedValue([mockScorer]);
    mockCreatePromptRunJob.mockResolvedValue({
      run_id: experimentId,
      project_id: mockProject.id,
      message: promptRunJobCreatedSuccessMessage
    });
    mockGetDataset.mockResolvedValue(mockDataset);
    mockGetDatasets.mockResolvedValue([mockDataset]);
    mockGetDatasetByName.mockResolvedValue(mockDataset);
    mockGetDatasetContent.mockResolvedValue([mockDatasetRow]);
    mockIngestTraces.mockResolvedValue(undefined);
  });

  afterEach(() => {
    // Restore original env variables
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('getExperiment', () => {
    const projectName = 'test-project';
    const experimentId = 'exp-123';
    const experimentName = 'My Test Experiment';

    it('should throw an error if neither id nor name is provided', async () => {
      await expect(getExperiment({ projectName })).rejects.toThrow(
        'To fetch an experiment with `getExperiment`, either id or name must be provided'
      );
    });

    it('should initialize the API client with the provided project name', async () => {
      // Call the function
      await getExperiment({ id: experimentId, projectName });

      // Verify init was called with the correct project name
      expect(mockInit).toHaveBeenCalledWith({ projectName });
    });

    it('should fetch experiment by ID when ID is provided', async () => {
      // Call the function
      const result = await getExperiment({ id: experimentId, projectName });

      // Verify the correct method was called with the right ID
      expect(mockGetExperiment).toHaveBeenCalledWith(experimentId);
      expect(result).toEqual(mockExperiment);
    });

    it('should fetch experiments and find by name when name is provided', async () => {
      // Call the function
      const result = await getExperiment({ name: experimentName, projectName });

      // Verify getExperiments was called and the result is correct
      expect(mockGetExperiments).toHaveBeenCalled();
      expect(mockGetExperiment).not.toHaveBeenCalled(); // Should not call getExperiment
      expect(result).toEqual(mockExperiment);
    });

    it('should return undefined when searching by name and no matching experiment is found', async () => {
      // Return experiments without the one we're looking for
      mockGetExperiments.mockResolvedValueOnce([]);

      // Call the function with a non-existent name
      const result = await getExperiment({
        name: 'Non-existent Experiment',
        projectName
      });

      // Verify getExperiments was called and the result is undefined
      expect(mockGetExperiments).toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it('should prioritize ID over name when both are provided', async () => {
      // Call the function with both ID and name
      const result = await getExperiment({
        id: experimentId,
        name: 'Different Name',
        projectName
      });

      // Verify only getExperiment was called with the ID
      expect(mockGetExperiment).toHaveBeenCalledWith(experimentId);
      expect(mockGetExperiments).not.toHaveBeenCalled();
      expect(result).toEqual(mockExperiment);
    });

    it('should handle API errors gracefully', async () => {
      // Setup mock to throw an error
      const apiError = new Error('API connection failed');
      mockGetExperiment.mockRejectedValueOnce(apiError);

      // Call the function and expect it to reject with the same error
      await expect(
        getExperiment({ id: experimentId, projectName })
      ).rejects.toThrow(apiError);
    });
  });

  describe('getExperiments', () => {
    it('should return experiments', async () => {
      // Call the function
      const result = await getExperiments(projectName);

      // Verify the correct method was called
      expect(mockGetExperiments).toHaveBeenCalled();
      expect(result).toEqual([mockExperiment]);
    });
  });

  describe('createExperiment', () => {
    it('should create an experiment if a valid name and projectName are provided', async () => {
      // Call the function
      const result = await createExperiment('Test Experiment', projectName);

      // Verify the correct method was called with the right name
      expect(mockCreateExperiment).toHaveBeenCalledWith('Test Experiment');
      expect(result).toEqual(mockExperiment);
    });
    it('should throw an error if name is empty', async () => {
      await expect(createExperiment('', projectName)).rejects.toThrow(
        'A valid `name` must be provided to create an experiment'
      );
    });
  });

  describe('runExperiment', () => {
    it('should run an experiment with a dataset ID and promptTemplate', async () => {
      const result = await runExperiment({
        name: 'Test Experiment',
        datasetId: 'test-dataset-id',
        promptTemplate: mockPromptTemplate,
        projectName
      });
      expect(result).toHaveProperty(
        'message',
        promptRunJobCreatedSuccessMessage
      );
      expect(mockCreateExperiment).toHaveBeenCalled();
      expect(mockCreatePromptRunJob).toHaveBeenCalled();
    });

    it('should run an experiment with a dataset ID, promptTemplate, and a metric', async () => {
      const result = await runExperiment({
        name: 'Test Experiment',
        datasetId: 'test-dataset-id',
        promptTemplate: mockPromptTemplate,
        metrics: [GalileoScorers.CORRECTNESS],
        projectName
      });
      expect(result).toHaveProperty(
        'message',
        promptRunJobCreatedSuccessMessage
      );
      expect(mockCreateExperiment).toHaveBeenCalled();
      expect(mockGetScorers).toHaveBeenCalled();
      expect(mockCreateRunScorerSettings).toHaveBeenCalled();
      expect(mockCreatePromptRunJob).toHaveBeenCalled();
    });

    it('should run an experiment with a dataset name and promptTemplate', async () => {
      const result = await runExperiment({
        name: 'Test Experiment',
        datasetName: 'test-dataset',
        promptTemplate: mockPromptTemplate,
        projectName
      });
      expect(result).toHaveProperty(
        'message',
        promptRunJobCreatedSuccessMessage
      );
      expect(mockCreateExperiment).toHaveBeenCalled();
      expect(mockGetDatasetByName).toHaveBeenCalled();
      expect(mockCreatePromptRunJob).toHaveBeenCalled();
    });

    it('should run an experiment with a dataset object and promptTemplate', async () => {
      const result = await runExperiment({
        name: 'Test Experiment',
        dataset: mockDataset,
        promptTemplate: mockPromptTemplate,
        projectName
      });
      expect(result).toHaveProperty(
        'message',
        promptRunJobCreatedSuccessMessage
      );
      expect(mockCreateExperiment).toHaveBeenCalled();
      expect(mockCreatePromptRunJob).toHaveBeenCalled();
    });
  });
});
