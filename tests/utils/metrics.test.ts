import { createCustomLlmMetric, deleteMetric } from '../../src/utils/metrics';
import { enableMetrics } from '../../src/utils/log-streams';
import {
  GalileoScorers,
  LocalMetricConfig,
  Metric
} from '../../src/types/metrics.types';
import {
  Scorer,
  ScorerVersion,
  ScorerTypes,
  OutputType
} from '../../src/types/scorer.types';
import { StepType } from '../../src/types';
import { LogStream } from '../../src/types/log-stream.types';
import { Project, ProjectTypes } from '../../src/types/project.types';

// Create mock implementation functions
const mockInit = jest.fn().mockResolvedValue(undefined);
const mockCreateScorer = jest.fn();
const mockCreateLlmScorerVersion = jest.fn();
const mockDeleteScorer = jest.fn();
const mockGetScorerVersion = jest.fn();
const mockGetScorers = jest.fn();
const mockCreateRunScorerSettings = jest.fn();
const mockGetProject = jest.fn();
const mockGetProjectByName = jest.fn();
const mockGetLogStream = jest.fn();
const mockGetLogStreamByName = jest.fn();

jest.mock('../../src/api-client', () => {
  return {
    GalileoApiClient: jest.fn().mockImplementation(() => {
      return {
        init: mockInit,
        createScorer: mockCreateScorer,
        createLlmScorerVersion: mockCreateLlmScorerVersion,
        deleteScorer: mockDeleteScorer,
        getScorerVersion: mockGetScorerVersion,
        getScorers: mockGetScorers,
        createRunScorerSettings: mockCreateRunScorerSettings,
        getProject: mockGetProject,
        getProjectByName: mockGetProjectByName,
        getLogStream: mockGetLogStream,
        getLogStreamByName: mockGetLogStreamByName
      };
    })
  };
});

describe('metrics utils', () => {
  const EXAMPLE_SCORER: Scorer = {
    id: 'scorer-123',
    name: 'correctness',
    scorer_type: ScorerTypes.preset,
    tags: []
  };

  const EXAMPLE_CUSTOM_SCORER: Scorer = {
    id: 'custom-scorer-456',
    name: 'custom_metric',
    scorer_type: ScorerTypes.llm,
    tags: []
  };

  const EXAMPLE_CUSTOM_SCORER_VERSION: ScorerVersion = {
    id: 'custom-scorer-version-456',
    version: 2,
    scorer_id: 'custom-scorer-456'
  };

  const EXAMPLE_PROJECT: Project = {
    id: 'project-123',
    name: 'test-project',
    type: ProjectTypes.genAI,
    created_by: 'user-123',
    created_by_user: {
      id: 'user-123',
      email: 'test@example.com',
      first_name: 'Test',
      last_name: 'User'
    },
    runs: [],
    created_at: '2021-09-10T00:00:00Z',
    updated_at: '2021-09-10T00:00:00Z'
  };

  const EXAMPLE_LOG_STREAM: LogStream = {
    id: 'log-stream-123',
    name: 'test-log-stream',
    project_id: 'project-123',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    created_by: null
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockInit.mockResolvedValue(undefined);
    mockCreateScorer.mockResolvedValue(EXAMPLE_CUSTOM_SCORER);
    mockCreateLlmScorerVersion.mockResolvedValue(EXAMPLE_CUSTOM_SCORER_VERSION);
    mockGetScorerVersion.mockResolvedValue(EXAMPLE_CUSTOM_SCORER_VERSION);
    mockGetScorers.mockResolvedValue([
      EXAMPLE_SCORER,
      EXAMPLE_CUSTOM_SCORER,
      {
        id: 'completeness-scorer',
        name: 'completeness',
        scorer_type: ScorerTypes.preset
      },
      {
        id: 'toxicity-scorer',
        name: 'toxicity',
        scorer_type: ScorerTypes.preset
      }
    ]);
    mockDeleteScorer.mockResolvedValue(undefined);
    mockCreateRunScorerSettings.mockResolvedValue(undefined);
    mockGetProject.mockResolvedValue(EXAMPLE_PROJECT);
    mockGetProjectByName.mockResolvedValue(EXAMPLE_PROJECT);
    mockGetLogStream.mockResolvedValue(EXAMPLE_LOG_STREAM);
    mockGetLogStreamByName.mockResolvedValue(EXAMPLE_LOG_STREAM);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createCustomLlmMetric', () => {
    it('should create a custom LLM metric with default parameters', async () => {
      const result = await createCustomLlmMetric({
        name: 'custom_metric',
        userPrompt: 'Is this response good?'
      });

      expect(result).toEqual(EXAMPLE_CUSTOM_SCORER_VERSION);
      expect(mockCreateScorer).toHaveBeenCalled();
      expect(mockCreateLlmScorerVersion).toHaveBeenCalled();
    });

    it('should create a custom LLM metric with custom parameters', async () => {
      const result = await createCustomLlmMetric({
        name: 'custom_metric',
        userPrompt: 'Is this response good?',
        nodeLevel: StepType.trace,
        cotEnabled: false,
        modelName: 'gpt-4',
        numJudges: 5,
        description: 'Custom description',
        tags: ['tag1', 'tag2'],
        outputType: OutputType.CATEGORICAL
      });

      expect(result).toEqual(EXAMPLE_CUSTOM_SCORER_VERSION);
      expect(mockCreateScorer).toHaveBeenCalledWith(
        'custom_metric',
        ScorerTypes.llm,
        'Custom description',
        ['tag1', 'tag2'],
        { model_name: 'gpt-4', num_judges: 5 },
        undefined,
        undefined,
        ['trace'],
        'categorical',
        undefined
      );
      expect(mockCreateLlmScorerVersion).toHaveBeenCalledWith(
        EXAMPLE_CUSTOM_SCORER.id,
        undefined,
        undefined,
        'Is this response good?',
        false,
        'gpt-4',
        5
      );
    });

    it('should call createScorer with the correct parameters for object-based API', async () => {
      await createCustomLlmMetric({
        name: 'Test Metric',
        userPrompt: 'Test prompt'
      });

      expect(mockCreateScorer).toHaveBeenCalledWith(
        'Test Metric',
        ScorerTypes.llm,
        '',
        [],
        {
          model_name: 'gpt-4.1-mini',
          num_judges: 3
        },
        undefined,
        undefined,
        ['llm'],
        OutputType.BOOLEAN,
        undefined
      );
    });

    it('should call createLlmScorerVersion with the correct parameters for object-based API', async () => {
      await createCustomLlmMetric({
        name: 'Test Metric',
        userPrompt: 'Test prompt',
        nodeLevel: StepType.trace,
        cotEnabled: false,
        modelName: 'gpt-4',
        numJudges: 5,
        outputType: OutputType.CATEGORICAL
      });

      expect(mockCreateLlmScorerVersion).toHaveBeenCalledWith(
        EXAMPLE_CUSTOM_SCORER.id,
        undefined,
        undefined,
        'Test prompt',
        false,
        'gpt-4',
        5
      );
    });

    it('should return the created scorer version', async () => {
      const result = await createCustomLlmMetric({
        name: 'Test Metric',
        userPrompt: 'Test prompt'
      });

      expect(result).toEqual(EXAMPLE_CUSTOM_SCORER_VERSION);
    });

    it('should handle API errors gracefully', async () => {
      const apiError = new Error('API error');
      mockCreateScorer.mockRejectedValueOnce(apiError);

      await expect(
        createCustomLlmMetric({
          name: 'Test Metric',
          userPrompt: 'Test prompt'
        })
      ).rejects.toThrow(apiError);
    });
  });

  describe('deleteMetric', () => {
    it('should delete a metric by name and type', async () => {
      // Mock getScorers to return only the matching scorer
      mockGetScorers.mockResolvedValueOnce([EXAMPLE_CUSTOM_SCORER]);

      await deleteMetric({
        scorerName: 'custom_metric',
        scorerType: ScorerTypes.llm
      });

      expect(mockGetScorers).toHaveBeenCalledWith({
        type: ScorerTypes.llm,
        names: ['custom_metric']
      });
      expect(mockDeleteScorer).toHaveBeenCalledWith(EXAMPLE_CUSTOM_SCORER.id);
    });

    it('should call deleteScorer with the correct scorer ID for object-based API', async () => {
      const mockScorer: Scorer = {
        id: 'scorer-123',
        name: 'Test Scorer',
        scorer_type: ScorerTypes.llm,
        tags: []
      };
      mockGetScorers.mockResolvedValueOnce([mockScorer]);

      await deleteMetric({
        scorerName: 'Test Scorer',
        scorerType: ScorerTypes.llm
      });

      expect(mockDeleteScorer).toHaveBeenCalledWith(mockScorer.id);
    });

    it('should throw error when metric is not found', async () => {
      mockGetScorers.mockResolvedValueOnce([]);

      await expect(
        deleteMetric({
          scorerName: 'nonexistent_metric',
          scorerType: ScorerTypes.llm
        })
      ).rejects.toThrow('Scorer with name nonexistent_metric not found.');
    });

    it('should throw an error if the scorer is not found for object-based API', async () => {
      mockGetScorers.mockResolvedValueOnce([]);

      await expect(
        deleteMetric({
          scorerName: 'Test Scorer',
          scorerType: ScorerTypes.llm
        })
      ).rejects.toThrow('Scorer with name Test Scorer not found.');
    });
  });

  describe('enableMetrics', () => {
    let originalEnv: Record<string, string | undefined>;

    beforeEach(() => {
      originalEnv = { ...process.env };
      delete process.env.GALILEO_PROJECT;
      delete process.env.GALILEO_PROJECT_NAME;
      delete process.env.GALILEO_LOG_STREAM;
      delete process.env.GALILEO_LOG_STREAM_NAME;
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should return local metrics when configured', async () => {
      const localMetric: LocalMetricConfig = {
        name: 'response_length',
        scorerFn: (traceOrSpan) => traceOrSpan.output?.length || 0,
        scorableTypes: ['llm'],
        aggregatableTypes: ['trace']
      };

      const localMetrics = await enableMetrics({
        projectName: 'test-project',
        logStreamName: 'test-log-stream',
        metrics: [GalileoScorers.Correctness, localMetric]
      });

      expect(localMetrics).toHaveLength(1);
      expect(localMetrics[0].name).toBe('response_length');
    });

    it('should throw error when no metrics provided', async () => {
      await expect(
        enableMetrics({
          projectName: 'test-project',
          logStreamName: 'test-log-stream',
          metrics: []
        })
      ).rejects.toThrow('At least one metric must be provided');
    });

    it('should throw error when project is not found', async () => {
      mockGetProjectByName.mockResolvedValueOnce(null);

      await expect(
        enableMetrics({
          projectName: 'nonexistent-project',
          logStreamName: 'test-log-stream',
          metrics: [GalileoScorers.Correctness]
        })
      ).rejects.toThrow("Project 'nonexistent-project' not found");
    });

    it('should throw error when log stream is not found', async () => {
      mockGetLogStreamByName.mockResolvedValueOnce(null);

      await expect(
        enableMetrics({
          projectName: 'test-project',
          logStreamName: 'nonexistent-log-stream',
          metrics: [GalileoScorers.Correctness]
        })
      ).rejects.toThrow(
        "Log stream 'nonexistent-log-stream' not found in project 'test-project'"
      );
    });

    it('should handle multiple metrics types', async () => {
      const metric: Metric = { name: 'custom_metric', version: 2 };
      const localMetric: LocalMetricConfig = {
        name: 'response_length',
        scorerFn: (traceOrSpan) => traceOrSpan.output?.length || 0
      };

      const localMetrics = await enableMetrics({
        projectName: 'test-project',
        logStreamName: 'test-log-stream',
        metrics: [
          GalileoScorers.Correctness,
          GalileoScorers.Completeness,
          'toxicity',
          metric,
          localMetric
        ]
      });

      expect(localMetrics).toHaveLength(1);
      expect(localMetrics[0].name).toBe('response_length');
      expect(mockCreateRunScorerSettings).toHaveBeenCalled();
    });
  });
});
