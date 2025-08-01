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
import { Trace } from '../../src/types';

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

const experimentId = 'exp-123';
const experimentName = 'My Test Experiment';
const projectId = 'proj-123';
const projectName = 'test-project';
const promptRunJobCreatedSuccessMessage = 'Prompt run job created';
const experimentCompletedMessage = 'Experiment completed.';

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
  column_names: ['input'],
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
  values: [
    '{"country":"France"}',
    '{"value":"Paris"}',
    '{"iteration":"alpha"}'
  ],
  values_dict: {
    input: '{"country":"France"}',
    output: '{"value":"Paris"}',
    metadata: '{"iteration":"alpha"}'
  },
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
  content_changed: false,
  model_changed: false,
  settings_changed: false,
  settings: {},
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2023-01-01T00:00:00Z',
  created_by_user: {
    id: '8b198c08-ea7f-42d2-9e8d-d2b8bcb008b0',
    email: 'b@b.com'
  }
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
  max_version: 1,
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2023-01-01T00:00:00Z',
  created_by_user: {
    id: '8b198c08-ea7f-42d2-9e8d-d2b8bcb008b0',
    email: 'b@b.com'
  }
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
    mockGetScorerVersion.mockResolvedValue({
      // Add this implementation
      id: 'scorer-version-123',
      version: 1,
      scorer_id: 'scorer-123'
    });
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

  describe('runExperiment - prompt', () => {
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
        metrics: [GalileoScorers.Correctness],
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

  describe('runExperiment - local', () => {
    const mockDate = new Date('2024-01-01T00:00:00.000Z');

    beforeEach(() => {
      jest.clearAllMocks();
      jest.useFakeTimers();
      jest.setSystemTime(mockDate);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    const identityFunction = async (input: Record<string, unknown>) => {
      jest.advanceTimersByTime(1);
      return input;
    };

    const verifyLocalExperimentTraces = (traces: Trace[]) => {
      expect(traces.length).toBe(1);
      expect(traces[0].input).toBe('{"country":"France"}');
      expect(traces[0].output).toEqual('{"country":"France"}');
      expect(traces[0].name).toBe('My Test Experiment');
      expect(traces[0].metrics).toEqual({
        durationNs: 1_000_000
      });
      expect(traces[0].datasetInput).toBe('{"country":"France"}');
      expect(traces[0].datasetOutput).toBe('{"value":"Paris"}');
      expect(traces[0].datasetMetadata).toEqual({ iteration: 'alpha' });

      const spans = traces[0].spans;
      expect(spans.length).toBe(1);
      expect(spans[0].type).toBe('workflow');
      expect(spans[0].input).toBe('{"country":"France"}');
      expect(spans[0].output).toEqual('{"country":"France"}');
      expect(spans[0].name).toBe('My Test Experiment');
      expect(spans[0].metrics).toEqual({
        durationNs: 1_000_000
      });
      expect(spans[0].datasetInput).toBe('{"country":"France"}');
      expect(spans[0].datasetOutput).toBe('{"value":"Paris"}');
      expect(spans[0].datasetMetadata).toEqual({ iteration: 'alpha' });
    };

    it('should run an experiment with a dataset ID and a function', async () => {
      const result = await runExperiment({
        name: 'Test Experiment',
        datasetId: 'test-dataset-id',
        function: identityFunction,
        projectName
      });
      expect(result).toHaveProperty('message', experimentCompletedMessage);
      expect(mockCreateExperiment).toHaveBeenCalled();
      expect(mockIngestTraces).toHaveBeenCalled();
      verifyLocalExperimentTraces(mockIngestTraces.mock.calls[0][0]);
    });

    it('should run an experiment with a dataset name and a function', async () => {
      const result = await runExperiment({
        name: 'Test Experiment',
        datasetName: 'test-dataset',
        function: identityFunction,
        projectName
      });
      expect(result).toHaveProperty('message', experimentCompletedMessage);
      expect(mockCreateExperiment).toHaveBeenCalled();
      expect(mockGetDatasetByName).toHaveBeenCalled();
      expect(mockIngestTraces).toHaveBeenCalled();
      verifyLocalExperimentTraces(mockIngestTraces.mock.calls[0][0]);
    });

    it('should run an experiment with a dataset object and a function', async () => {
      const result = await runExperiment({
        name: 'Test Experiment',
        dataset: mockDataset,
        function: identityFunction,
        projectName
      });
      expect(result).toHaveProperty('message', experimentCompletedMessage);
      expect(mockCreateExperiment).toHaveBeenCalled();
      expect(mockIngestTraces).toHaveBeenCalled();
      verifyLocalExperimentTraces(mockIngestTraces.mock.calls[0][0]);
    });

    it('should handle string metric names', async () => {
      const result = await runExperiment({
        name: 'Test Experiment',
        datasetId: 'test-dataset-id',
        promptTemplate: mockPromptTemplate,
        metrics: ['correctness'], // String metric name
        projectName
      });

      expect(result).toHaveProperty(
        'message',
        promptRunJobCreatedSuccessMessage
      );
      expect(mockCreateExperiment).toHaveBeenCalled();
      expect(mockGetScorers).toHaveBeenCalled();

      // Verify the correct scorer was found by name
      expect(mockCreateRunScorerSettings).toHaveBeenCalled();
      expect(mockCreatePromptRunJob).toHaveBeenCalled();
    });

    it('should handle object metrics without version', async () => {
      const result = await runExperiment({
        name: 'Test Experiment',
        datasetId: 'test-dataset-id',
        promptTemplate: mockPromptTemplate,
        metrics: [{ name: 'correctness', version: 1 }], // Object metric with version
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

    it('should handle object metrics with version', async () => {
      // Setup specific mock for this test only
      mockGetScorerVersion.mockResolvedValueOnce({
        id: 'scorer-version-123',
        version: 3,
        scorer_id: 'scorer-123'
      });

      const result = await runExperiment({
        name: 'Test Experiment',
        datasetId: 'test-dataset-id',
        promptTemplate: mockPromptTemplate,
        metrics: [{ name: 'correctness', version: 3 }], // Object metric with version
        projectName
      });

      expect(result).toHaveProperty(
        'message',
        promptRunJobCreatedSuccessMessage
      );
      expect(mockCreateExperiment).toHaveBeenCalled();
      expect(mockGetScorers).toHaveBeenCalled();
      expect(mockGetScorerVersion).toHaveBeenCalledWith('scorer-123', 3);
      expect(mockCreateRunScorerSettings).toHaveBeenCalled();
      expect(mockCreatePromptRunJob).toHaveBeenCalled();
    });

    it('should handle multiple metrics with mixed formats', async () => {
      mockGetScorers.mockImplementation(({ names }) => {
        return (names || []).map((name: string) => ({
          id: `scorer-${name}`,
          name,
          scorer_type: ScorerTypes.preset
        }));
      });

      const result = await runExperiment({
        name: 'Test Experiment',
        datasetId: 'test-dataset-id',
        promptTemplate: mockPromptTemplate,
        metrics: [
          'correctness',
          { name: 'toxicity' },
          { name: 'correctness', version: 3 }
        ],
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
  });
});
