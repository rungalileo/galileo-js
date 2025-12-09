import {
  createCustomLlmMetric,
  createCustomCodeMetric,
  deleteMetric,
  getMetrics
} from '../../src/utils/metrics';
import { enableMetrics } from '../../src/utils/log-streams';
import {
  GalileoScorers,
  LocalMetricConfig,
  Metric,
  LogRecordsMetricsQueryRequest,
  LogRecordsMetricsResponse
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
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Create mock implementation functions
const mockInit = jest.fn().mockResolvedValue(undefined);
const mockCreateScorer = jest.fn();
const mockCreateLlmScorerVersion = jest.fn();
const mockCreateCodeScorerVersion = jest.fn();
const mockDeleteScorer = jest.fn();
const mockGetScorerVersion = jest.fn();
const mockGetScorers = jest.fn();
const mockGetScorersPage = jest.fn();
const mockCreateRunScorerSettings = jest.fn();
const mockGetProject = jest.fn();
const mockGetProjectByName = jest.fn();
const mockGetLogStream = jest.fn();
const mockGetLogStreamByName = jest.fn();
const mockSearchMetrics = jest.fn();
const mockValidateCodeScorerAndWait = jest.fn();

jest.mock('../../src/api-client', () => {
  return {
    GalileoApiClient: jest.fn().mockImplementation(() => {
      return {
        init: mockInit,
        createScorer: mockCreateScorer,
        createLlmScorerVersion: mockCreateLlmScorerVersion,
        createCodeScorerVersion: mockCreateCodeScorerVersion,
        deleteScorer: mockDeleteScorer,
        getScorerVersion: mockGetScorerVersion,
        getScorers: mockGetScorers,
        getScorersPage: mockGetScorersPage,
        createRunScorerSettings: mockCreateRunScorerSettings,
        getProject: mockGetProject,
        getProjectByName: mockGetProjectByName,
        getLogStream: mockGetLogStream,
        getLogStreamByName: mockGetLogStreamByName,
        searchMetrics: mockSearchMetrics,
        validateCodeScorerAndWait: mockValidateCodeScorerAndWait
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

  const EXAMPLE_LOG_STREAM: LogStream = {
    id: 'log-stream-123',
    name: 'test-log-stream',
    project_id: 'project-123',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    created_by: null
  };

  const MOCK_METRICS_RESPONSE: LogRecordsMetricsResponse = {
    groupByColumns: [],
    aggregateMetrics: {},
    bucketedMetrics: {}
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
    mockGetScorersPage.mockResolvedValue({
      scorers: [
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
      ],
      nextStartingToken: null
    });
    mockDeleteScorer.mockResolvedValue(undefined);
    mockCreateRunScorerSettings.mockResolvedValue(undefined);
    mockGetProject.mockResolvedValue(EXAMPLE_PROJECT);
    mockGetProjectByName.mockResolvedValue(EXAMPLE_PROJECT);
    mockGetLogStream.mockResolvedValue(EXAMPLE_LOG_STREAM);
    mockGetLogStreamByName.mockResolvedValue(EXAMPLE_LOG_STREAM);
    mockSearchMetrics.mockResolvedValue(MOCK_METRICS_RESPONSE);
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
      expect(mockCreateScorer).toHaveBeenCalledWith({
        name: 'custom_metric',
        scorerType: ScorerTypes.llm,
        description: 'Custom description',
        tags: ['tag1', 'tag2'],
        defaults: { model_name: 'gpt-4', num_judges: 5 },
        modelType: undefined,
        defaultVersionId: undefined,
        scoreableNodeTypes: ['trace'],
        outputType: 'categorical',
        inputType: undefined
      });
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

      expect(mockCreateScorer).toHaveBeenCalledWith({
        name: 'Test Metric',
        scorerType: ScorerTypes.llm,
        description: '',
        tags: [],
        defaults: { model_name: 'gpt-4.1-mini', num_judges: 3 },
        modelType: undefined,
        defaultVersionId: undefined,
        scoreableNodeTypes: ['llm'],
        outputType: 'boolean',
        inputType: undefined
      });
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
      mockGetScorersPage.mockResolvedValueOnce({
        scorers: [EXAMPLE_CUSTOM_SCORER],
        nextStartingToken: null
      });

      await deleteMetric({
        scorerName: 'custom_metric',
        scorerType: ScorerTypes.llm
      });

      expect(mockGetScorersPage).toHaveBeenCalledWith(
        expect.objectContaining({
          types: [ScorerTypes.llm],
          name: 'custom_metric'
        })
      );
      expect(mockDeleteScorer).toHaveBeenCalledWith(EXAMPLE_CUSTOM_SCORER.id);
    });

    it('should call deleteScorer with the correct scorer ID for object-based API', async () => {
      const mockScorer: Scorer = {
        id: 'scorer-123',
        name: 'Test Scorer',
        scorer_type: ScorerTypes.llm,
        tags: []
      };
      mockGetScorersPage.mockResolvedValueOnce({
        scorers: [mockScorer],
        nextStartingToken: null
      });

      await deleteMetric({
        scorerName: 'Test Scorer',
        scorerType: ScorerTypes.llm
      });

      expect(mockDeleteScorer).toHaveBeenCalledWith(mockScorer.id);
    });

    it('should throw error when metric is not found', async () => {
      mockGetScorersPage.mockResolvedValueOnce({
        scorers: [],
        nextStartingToken: null
      });

      await expect(
        deleteMetric({
          scorerName: 'nonexistent_metric',
          scorerType: ScorerTypes.llm
        })
      ).rejects.toThrow('Scorer with name nonexistent_metric not found.');
    });

    it('should throw an error if the scorer is not found for object-based API', async () => {
      mockGetScorersPage.mockResolvedValueOnce({
        scorers: [],
        nextStartingToken: null
      });

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
        scorerFn: (traceOrSpan) => {
          const { output } = traceOrSpan;
          if (typeof output === 'string' || Array.isArray(output)) {
            return output.length;
          }
          return 0;
        },
        scorableTypes: ['llm'],
        aggregatableTypes: ['trace']
      };

      const localMetrics = await enableMetrics({
        projectName: 'test-project',
        logStreamName: 'test-log-stream',
        metrics: [GalileoScorers.correctness, localMetric]
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
          metrics: [GalileoScorers.correctness]
        })
      ).rejects.toThrow("Project 'nonexistent-project' not found");
    });

    it('should throw error when log stream is not found', async () => {
      mockGetLogStreamByName.mockResolvedValueOnce(null);

      await expect(
        enableMetrics({
          projectName: 'test-project',
          logStreamName: 'nonexistent-log-stream',
          metrics: [GalileoScorers.correctness]
        })
      ).rejects.toThrow(
        "Log stream 'nonexistent-log-stream' not found in project 'test-project'"
      );
    });

    it('should handle multiple metrics types', async () => {
      const metric: Metric = { name: 'custom_metric', version: 2 };
      const localMetric: LocalMetricConfig = {
        name: 'response_length',
        scorerFn: (traceOrSpan) => {
          const { output } = traceOrSpan;
          if (typeof output === 'string' || Array.isArray(output)) {
            return output.length;
          }
          return 0;
        }
      };

      const localMetrics = await enableMetrics({
        projectName: 'test-project',
        logStreamName: 'test-log-stream',
        metrics: [
          GalileoScorers.correctness,
          GalileoScorers.completeness,
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

  describe('createCustomCodeMetric', () => {
    const CODE_SCORER: Scorer = {
      id: 'code-scorer-789',
      name: 'my_code_metric',
      scorer_type: ScorerTypes.code,
      tags: ['custom']
    };

    const CODE_SCORER_VERSION: ScorerVersion = {
      id: 'code-scorer-version-789',
      version: 1,
      scorer_id: 'code-scorer-789'
    };

    let tempDir: string;
    let validCodeFile: string;
    let emptyFile: string;
    let whitespaceFile: string;

    beforeAll(() => {
      // Create temporary directory for test files
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'galileo-test-'));

      // Create test files
      validCodeFile = path.join(tempDir, 'scorer.py');
      fs.writeFileSync(
        validCodeFile,
        'def score(input, output):\n    return 1.0\n'
      );

      emptyFile = path.join(tempDir, 'empty.py');
      fs.writeFileSync(emptyFile, '');

      whitespaceFile = path.join(tempDir, 'whitespace.py');
      fs.writeFileSync(whitespaceFile, '   \n\n  \t  ');
    });

    afterAll(() => {
      // Clean up test files
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    beforeEach(() => {
      mockCreateScorer.mockResolvedValue(CODE_SCORER);
      mockCreateCodeScorerVersion.mockResolvedValue(CODE_SCORER_VERSION);
      mockValidateCodeScorerAndWait.mockResolvedValue({
        result: {
          result_type: 'valid',
          score_type: 'float',
          scoreable_node_types: ['llm'],
          include_llm_credentials: false,
          chain_aggregation: null,
          test_scores: []
        }
      });
    });

    it('should create a custom code metric successfully', async () => {
      const result = await createCustomCodeMetric({
        name: 'my_code_metric',
        codePath: validCodeFile,
        nodeLevel: StepType.llm,
        description: 'My custom code scorer',
        tags: ['custom']
      });

      expect(result).toEqual(CODE_SCORER_VERSION);
      expect(mockCreateScorer).toHaveBeenCalledWith({
        name: 'my_code_metric',
        scorerType: ScorerTypes.code,
        description: 'My custom code scorer',
        tags: ['custom'],
        defaults: undefined,
        modelType: undefined,
        defaultVersionId: undefined,
        scoreableNodeTypes: ['llm'],
        outputType: undefined,
        inputType: undefined
      });
      expect(mockCreateCodeScorerVersion).toHaveBeenCalledWith(
        'code-scorer-789',
        'def score(input, output):\n    return 1.0\n',
        expect.any(String) // validation result JSON
      );
    });

    it('should throw error when file does not exist', async () => {
      await expect(
        createCustomCodeMetric({
          name: 'my_code_metric',
          codePath: path.join(tempDir, 'nonexistent.py'),
          nodeLevel: StepType.llm
        })
      ).rejects.toThrow('Code file not found at path');
    });

    it('should throw error when path is a directory', async () => {
      await expect(
        createCustomCodeMetric({
          name: 'my_code_metric',
          codePath: tempDir,
          nodeLevel: StepType.llm
        })
      ).rejects.toThrow('Path is not a file');
    });

    it('should throw error when file is empty', async () => {
      await expect(
        createCustomCodeMetric({
          name: 'my_code_metric',
          codePath: emptyFile,
          nodeLevel: StepType.llm
        })
      ).rejects.toThrow('Code file is empty');
    });

    it('should throw error when file contains only whitespace', async () => {
      await expect(
        createCustomCodeMetric({
          name: 'my_code_metric',
          codePath: whitespaceFile,
          nodeLevel: StepType.llm
        })
      ).rejects.toThrow('Code file is empty');
    });

    it('should pass required_metrics as string array to validation', async () => {
      await createCustomCodeMetric({
        name: 'my_code_metric',
        codePath: validCodeFile,
        nodeLevel: StepType.llm,
        required_metrics: ['correctness', 'context_adherence']
      });

      expect(mockValidateCodeScorerAndWait).toHaveBeenCalledWith(
        'def score(input, output):\n    return 1.0\n',
        [StepType.llm],
        undefined, // uses default timeout
        undefined, // uses default poll interval
        ['correctness', 'context_adherence']
      );
    });

    it('should pass required_metrics as GalileoScorers enum values to validation', async () => {
      await createCustomCodeMetric({
        name: 'my_code_metric',
        codePath: validCodeFile,
        nodeLevel: StepType.llm,
        required_metrics: [
          GalileoScorers.correctness,
          GalileoScorers.contextAdherence
        ]
      });

      expect(mockValidateCodeScorerAndWait).toHaveBeenCalledWith(
        'def score(input, output):\n    return 1.0\n',
        [StepType.llm],
        undefined,
        undefined,
        [GalileoScorers.correctness, GalileoScorers.contextAdherence]
      );
    });

    it('should pass mixed required_metrics (enum and string) to validation', async () => {
      await createCustomCodeMetric({
        name: 'my_code_metric',
        codePath: validCodeFile,
        nodeLevel: StepType.llm,
        required_metrics: [GalileoScorers.correctness, 'custom_metric']
      });

      expect(mockValidateCodeScorerAndWait).toHaveBeenCalledWith(
        'def score(input, output):\n    return 1.0\n',
        [StepType.llm],
        undefined,
        undefined,
        [GalileoScorers.correctness, 'custom_metric']
      );
    });

    it('should pass custom timeout and poll interval with required_metrics', async () => {
      await createCustomCodeMetric({
        name: 'my_code_metric',
        codePath: validCodeFile,
        nodeLevel: StepType.llm,
        timeoutMs: 60000,
        pollIntervalMs: 2000,
        required_metrics: [GalileoScorers.correctness]
      });

      expect(mockValidateCodeScorerAndWait).toHaveBeenCalledWith(
        'def score(input, output):\n    return 1.0\n',
        [StepType.llm],
        60000,
        2000,
        [GalileoScorers.correctness]
      );
    });
  });

  describe('getMetrics', () => {
    const projectId = EXAMPLE_PROJECT.id;

    it('should query metrics with minimal options', async () => {
      const request = {
        projectId,
        startTime: '2024-01-01T00:00:00Z',
        endTime: '2024-01-02T00:00:00Z'
      } as LogRecordsMetricsQueryRequest & { projectId: string };

      const result = await getMetrics(request);

      expect(mockInit).toHaveBeenCalledWith({
        projectId,
        projectScoped: true
      });
      expect(mockSearchMetrics).toHaveBeenCalledWith(request);
      expect(result).toEqual(MOCK_METRICS_RESPONSE);
    });

    it('should forward all options and propagate errors', async () => {
      const error = new Error('metrics failure');
      mockSearchMetrics.mockRejectedValueOnce(error);

      const request = {
        projectId,
        startTime: '2024-01-01T00:00:00Z',
        endTime: '2024-01-02T00:00:00Z',
        logStreamId: EXAMPLE_LOG_STREAM.id,
        experimentId: 'exp-123',
        metricsTestingId: 'test-123',
        interval: 10,
        groupBy: 'status'
      } as LogRecordsMetricsQueryRequest & { projectId: string };

      await expect(getMetrics(request)).rejects.toThrow('metrics failure');
      expect(mockSearchMetrics).toHaveBeenCalledWith(request);
    });
  });
});
