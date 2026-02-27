import { ScorerService } from '../../../src/api-client/services/scorer-service';
import { BaseClient } from '../../../src/api-client/base-client';
import {
  ScorerTypes,
  TaskStatus,
  ResultType,
  ValidateRegisteredScorerResult
} from '../../../src/types/scorer.types';
import { StepType } from '../../../src/types/logging/step.types';

jest.mock('galileo-generated', () => ({
  getSdkLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }))
}));

const mockMakeRequest = jest
  .spyOn(BaseClient.prototype, 'makeRequest')
  .mockImplementation();

describe('ScorerService', () => {
  let scorerService: ScorerService;
  const mockApiUrl = 'http://fake.api/v2';
  const mockToken = 'fake-api-token';
  const scorerId = 'test-scorer-id';
  const version = 1;
  const taskId = 'test-task-id';

  beforeEach(() => {
    jest.clearAllMocks();
    scorerService = new ScorerService(mockApiUrl, mockToken);
  });

  describe('validateCodeScorer()', () => {
    const codeContent = 'def score(input, output): return 0.5';
    const scoreableNodeTypes: StepType[] = ['llm'];

    it('should validate code scorer and return task ID', async () => {
      const mockResponse = {
        task_id: taskId,
        status: TaskStatus.PENDING
      };

      mockMakeRequest.mockResolvedValue(mockResponse);

      const result = await scorerService.validateCodeScorer(
        codeContent,
        scoreableNodeTypes
      );

      expect(mockMakeRequest).toHaveBeenCalled();
      expect(result.task_id).toBe(taskId);
    });

    it('should include validation result when provided', async () => {
      const mockResponse = {
        task_id: taskId,
        status: TaskStatus.PENDING
      };

      mockMakeRequest.mockResolvedValue(mockResponse);

      await scorerService.validateCodeScorer(codeContent, scoreableNodeTypes, [
        'scorer-1',
        'scorer-2'
      ]);

      expect(mockMakeRequest).toHaveBeenCalled();
    });

    it('should handle multiple scoreable node types', async () => {
      const multipleNodeTypes: StepType[] = ['llm', 'retriever', 'tool'];
      const mockResponse = {
        task_id: taskId,
        status: TaskStatus.PENDING
      };

      mockMakeRequest.mockResolvedValue(mockResponse);

      await scorerService.validateCodeScorer(codeContent, multipleNodeTypes);

      expect(mockMakeRequest).toHaveBeenCalled();
    });
  });

  describe('getCodeScorerValidationResult()', () => {
    it('should fetch validation result by task ID', async () => {
      const mockResponse = {
        status: TaskStatus.COMPLETE,
        result: JSON.stringify({
          result: {
            result_type: ResultType.VALID,
            score_type: 'float',
            scoreable_node_types: ['llm']
          }
        })
      };

      mockMakeRequest.mockResolvedValue(mockResponse);

      const result = await scorerService.getCodeScorerValidationResult(taskId);

      expect(mockMakeRequest).toHaveBeenCalled();
      expect(result.status).toBe(TaskStatus.COMPLETE);
    });

    it('should handle pending validation status', async () => {
      const mockResponse = {
        status: TaskStatus.PENDING,
        result: null
      };

      mockMakeRequest.mockResolvedValue(mockResponse);

      const result = await scorerService.getCodeScorerValidationResult(taskId);

      expect(result.status).toBe(TaskStatus.PENDING);
    });

    it('should handle failed validation status', async () => {
      const mockResponse = {
        status: TaskStatus.FAILED,
        result: 'Validation failed: syntax error'
      };

      mockMakeRequest.mockResolvedValue(mockResponse);

      const result = await scorerService.getCodeScorerValidationResult(taskId);

      expect(result.status).toBe(TaskStatus.FAILED);
    });
  });

  describe('validateCodeScorerAndWait()', () => {
    const codeContent = 'def score(input, output): return 0.5';
    const scoreableNodeTypes: StepType[] = ['llm'];
    const defaultTimeoutMs = 60000;
    const defaultPollIntervalMs = 1;

    it('should successfully validate and return result when complete', async () => {
      const mockValidationResult: ValidateRegisteredScorerResult = {
        result: {
          result_type: ResultType.VALID,
          score_type: 'float',
          scoreable_node_types: ['llm'],
          include_llm_credentials: false,
          test_scores: []
        }
      };

      const mockInitResponse = {
        task_id: taskId,
        status: TaskStatus.PENDING
      };

      const mockCompleteResponse = {
        status: TaskStatus.COMPLETE,
        result: JSON.stringify(mockValidationResult)
      };

      mockMakeRequest
        .mockResolvedValueOnce(mockInitResponse)
        .mockResolvedValueOnce(mockCompleteResponse);

      const result = await scorerService.validateCodeScorerAndWait(
        codeContent,
        scoreableNodeTypes,
        defaultTimeoutMs,
        defaultPollIntervalMs
      );

      expect(result).toEqual(mockValidationResult);
    });

    it('should retry polling until completion', async () => {
      const mockValidationResult: ValidateRegisteredScorerResult = {
        result: {
          result_type: ResultType.VALID,
          score_type: 'float',
          scoreable_node_types: ['llm'],
          include_llm_credentials: false,
          test_scores: []
        }
      };

      const mockInitResponse = {
        task_id: taskId,
        status: TaskStatus.PENDING
      };

      const mockPendingResponse = {
        status: TaskStatus.PENDING,
        result: null
      };

      const mockCompleteResponse = {
        status: TaskStatus.COMPLETE,
        result: JSON.stringify(mockValidationResult)
      };

      mockMakeRequest
        .mockResolvedValueOnce(mockInitResponse)
        .mockResolvedValueOnce(mockPendingResponse)
        .mockResolvedValueOnce(mockPendingResponse)
        .mockResolvedValueOnce(mockCompleteResponse);

      const result = await scorerService.validateCodeScorerAndWait(
        codeContent,
        scoreableNodeTypes,
        defaultTimeoutMs,
        defaultPollIntervalMs
      );

      expect(result).toEqual(mockValidationResult);
      expect(mockMakeRequest).toHaveBeenCalledTimes(4);
    }, 15000);

    it('should throw error when validation fails', async () => {
      const mockInitResponse = {
        task_id: taskId,
        status: TaskStatus.PENDING
      };

      const mockFailedResponse = {
        status: TaskStatus.FAILED,
        result: 'Validation failed: syntax error'
      };

      mockMakeRequest
        .mockResolvedValueOnce(mockInitResponse)
        .mockResolvedValueOnce(mockFailedResponse);

      await expect(
        scorerService.validateCodeScorerAndWait(
          codeContent,
          scoreableNodeTypes,
          defaultTimeoutMs,
          defaultPollIntervalMs
        )
      ).rejects.toThrow(
        'Code metric validation failed: Validation failed: syntax error'
      );
    });

    it('should throw error when validation times out', async () => {
      const mockInitResponse = {
        task_id: taskId,
        status: TaskStatus.PENDING
      };

      const mockPendingResponse = {
        status: TaskStatus.PENDING,
        result: null
      };

      mockMakeRequest
        .mockResolvedValueOnce(mockInitResponse)
        .mockResolvedValue(mockPendingResponse);

      await expect(
        scorerService.validateCodeScorerAndWait(
          codeContent,
          scoreableNodeTypes,
          50,
          1
        )
      ).rejects.toThrow('Code scorer validation timed out after');
    }, 15000);

    it('should handle invalid result type response', async () => {
      const mockInitResponse = {
        task_id: taskId,
        status: TaskStatus.PENDING
      };

      const mockInvalidResultResponse = {
        status: TaskStatus.COMPLETE,
        result: JSON.stringify({
          result: {
            result_type: ResultType.INVALID,
            error_message: 'Code contains invalid syntax'
          }
        })
      };

      mockMakeRequest
        .mockResolvedValueOnce(mockInitResponse)
        .mockResolvedValueOnce(mockInvalidResultResponse);

      const resultPromise = scorerService.validateCodeScorerAndWait(
        codeContent,
        scoreableNodeTypes
      );

      jest.advanceTimersByTime(1000);

      await expect(resultPromise).rejects.toThrow(
        'Code metric validation failed: Code contains invalid syntax'
      );
    });

    it('should handle null result after completion', async () => {
      const mockInitResponse = {
        task_id: taskId,
        status: TaskStatus.PENDING
      };

      const mockCompleteResponse = {
        status: TaskStatus.COMPLETE,
        result: null
      };

      mockMakeRequest
        .mockResolvedValueOnce(mockInitResponse)
        .mockResolvedValueOnce(mockCompleteResponse);

      const resultPromise = scorerService.validateCodeScorerAndWait(
        codeContent,
        scoreableNodeTypes
      );

      jest.advanceTimersByTime(1000);

      await expect(resultPromise).rejects.toThrow(
        'Validation completed but result is empty'
      );
    });

    it('should handle JSON parse error in result', async () => {
      const mockInitResponse = {
        task_id: taskId,
        status: TaskStatus.PENDING
      };

      const mockCompleteResponse = {
        status: TaskStatus.COMPLETE,
        result: 'invalid json'
      };

      mockMakeRequest
        .mockResolvedValueOnce(mockInitResponse)
        .mockResolvedValueOnce(mockCompleteResponse);

      const resultPromise = scorerService.validateCodeScorerAndWait(
        codeContent,
        scoreableNodeTypes
      );

      jest.advanceTimersByTime(1000);

      await expect(resultPromise).rejects.toThrow(
        'Failed to parse validation result as JSON'
      );
    });

    it('should use custom timeout and poll interval', async () => {
      const customTimeoutMs = 10000;
      const customPollIntervalMs = 2000;

      const mockValidationResult: ValidateRegisteredScorerResult = {
        result: {
          result_type: ResultType.VALID,
          score_type: 'float',
          scoreable_node_types: ['llm'],
          include_llm_credentials: false,
          test_scores: []
        }
      };

      const mockInitResponse = {
        task_id: taskId,
        status: TaskStatus.PENDING
      };

      const mockCompleteResponse = {
        status: TaskStatus.COMPLETE,
        result: JSON.stringify(mockValidationResult)
      };

      mockMakeRequest
        .mockResolvedValueOnce(mockInitResponse)
        .mockResolvedValueOnce(mockCompleteResponse);

      const resultPromise = scorerService.validateCodeScorerAndWait(
        codeContent,
        scoreableNodeTypes,
        customTimeoutMs,
        customPollIntervalMs
      );

      jest.advanceTimersByTime(2000);
      const result = await resultPromise;

      expect(result).toEqual(mockValidationResult);
    });

    it('should include required scorers when provided', async () => {
      const mockValidationResult: ValidateRegisteredScorerResult = {
        result: {
          result_type: ResultType.VALID,
          score_type: 'float',
          scoreable_node_types: ['llm'],
          include_llm_credentials: false,
          test_scores: []
        }
      };

      const mockInitResponse = {
        task_id: taskId,
        status: TaskStatus.PENDING
      };

      const mockCompleteResponse = {
        status: TaskStatus.COMPLETE,
        result: JSON.stringify(mockValidationResult)
      };

      mockMakeRequest
        .mockResolvedValueOnce(mockInitResponse)
        .mockResolvedValueOnce(mockCompleteResponse);

      const requiredScorers = ['scorer-1', 'scorer-2'];

      const resultPromise = scorerService.validateCodeScorerAndWait(
        codeContent,
        scoreableNodeTypes,
        defaultTimeoutMs,
        defaultPollIntervalMs,
        requiredScorers
      );

      jest.advanceTimersByTime(1000);
      const result = await resultPromise;

      expect(result).toEqual(mockValidationResult);
    });

    it('should handle result as object (not string)', async () => {
      const mockValidationResult: ValidateRegisteredScorerResult = {
        result: {
          result_type: ResultType.VALID,
          score_type: 'float',
          scoreable_node_types: ['llm'],
          include_llm_credentials: false,
          test_scores: []
        }
      };

      const mockInitResponse = {
        task_id: taskId,
        status: TaskStatus.PENDING
      };

      const mockCompleteResponse = {
        status: TaskStatus.COMPLETE,
        result: mockValidationResult
      };

      mockMakeRequest
        .mockResolvedValueOnce(mockInitResponse)
        .mockResolvedValueOnce(mockCompleteResponse);

      const resultPromise = scorerService.validateCodeScorerAndWait(
        codeContent,
        scoreableNodeTypes
      );

      jest.advanceTimersByTime(1000);
      const result = await resultPromise;

      expect(result).toEqual(mockValidationResult);
    });

    it('should return validated result', async () => {
      const mockValidationResult: ValidateRegisteredScorerResult = {
        result: {
          result_type: ResultType.VALID,
          score_type: 'float',
          scoreable_node_types: ['llm', 'retriever'],
          include_llm_credentials: false,
          test_scores: []
        }
      };

      const mockInitResponse = {
        task_id: taskId,
        status: TaskStatus.PENDING
      };

      const mockCompleteResponse = {
        status: TaskStatus.COMPLETE,
        result: JSON.stringify(mockValidationResult)
      };

      mockMakeRequest
        .mockResolvedValueOnce(mockInitResponse)
        .mockResolvedValueOnce(mockCompleteResponse);

      const result = await scorerService.validateCodeScorerAndWait(
        codeContent,
        scoreableNodeTypes,
        defaultTimeoutMs,
        defaultPollIntervalMs
      );

      expect(result).toEqual(mockValidationResult);
    });
  });

  describe('createCodeScorerVersion()', () => {
    const codeContent = 'def score(input, output): return 0.5';

    it('should create code scorer version without validation result', async () => {
      const mockResponse = {
        id: 'version-id',
        version: 1,
        scorer_id: scorerId
      };

      mockMakeRequest.mockResolvedValue(mockResponse);

      const result = await scorerService.createCodeScorerVersion(
        scorerId,
        codeContent
      );

      expect(mockMakeRequest).toHaveBeenCalled();
      expect(result.id).toBe('version-id');
    });

    it('should create code scorer version with validation result', async () => {
      const validationResult = 'validation-data';
      const mockResponse = {
        id: 'version-id',
        version: 1,
        scorer_id: scorerId
      };

      mockMakeRequest.mockResolvedValue(mockResponse);

      const result = await scorerService.createCodeScorerVersion(
        scorerId,
        codeContent,
        validationResult
      );

      expect(mockMakeRequest).toHaveBeenCalled();
      expect(result.id).toBe('version-id');
    });
  });

  describe('getScorers()', () => {
    it('should get all scorers without filters', async () => {
      const mockResponse = {
        scorers: [
          {
            id: 'scorer-1',
            name: 'Completeness',
            scorer_type: ScorerTypes.preset
          },
          {
            id: 'scorer-2',
            name: 'Relevance',
            scorer_type: ScorerTypes.preset
          }
        ]
      };

      mockMakeRequest.mockResolvedValue(mockResponse);

      const result = await scorerService.getScorers();

      expect(mockMakeRequest).toHaveBeenCalled();
      expect(result.scorers).toHaveLength(2);
    });

    it('should get scorers filtered by type', async () => {
      const mockResponse = {
        scorers: [
          {
            id: 'scorer-1',
            name: 'Completeness',
            scorer_type: ScorerTypes.preset
          }
        ]
      };

      mockMakeRequest.mockResolvedValue(mockResponse);

      const result = await scorerService.getScorers({
        type: ScorerTypes.preset
      });

      expect(mockMakeRequest).toHaveBeenCalled();
      expect(result.scorers).toHaveLength(1);
    });

    it('should get scorers filtered by single name', async () => {
      const mockResponse = {
        scorers: [
          {
            id: 'scorer-1',
            name: 'Completeness',
            scorer_type: ScorerTypes.preset
          }
        ]
      };

      mockMakeRequest.mockResolvedValue(mockResponse);

      const result = await scorerService.getScorers({
        names: ['Completeness']
      });

      expect(mockMakeRequest).toHaveBeenCalled();
      expect(result.scorers).toHaveLength(1);
    });

    it('should get scorers filtered by multiple names', async () => {
      const mockResponse = {
        scorers: [
          {
            id: 'scorer-1',
            name: 'Completeness',
            scorer_type: ScorerTypes.preset
          },
          {
            id: 'scorer-2',
            name: 'Relevance',
            scorer_type: ScorerTypes.preset
          }
        ]
      };

      mockMakeRequest.mockResolvedValue(mockResponse);

      const result = await scorerService.getScorers({
        names: ['Completeness', 'Relevance']
      });

      expect(mockMakeRequest).toHaveBeenCalled();
      expect(result.scorers).toHaveLength(2);
    });
  });

  describe('getScorerVersion()', () => {
    it('should get scorer version by ID and version number', async () => {
      const mockResponse = {
        id: 'version-id',
        version: 1,
        scorer_id: scorerId
      };

      mockMakeRequest.mockResolvedValue(mockResponse);

      const result = await scorerService.getScorerVersion(scorerId, version);

      expect(mockMakeRequest).toHaveBeenCalled();
      expect(result.id).toBe('version-id');
    });

    it('should handle different version numbers', async () => {
      const mockResponse = {
        id: 'version-id-2',
        version: 2,
        scorer_id: scorerId
      };

      mockMakeRequest.mockResolvedValue(mockResponse);

      const result = await scorerService.getScorerVersion(scorerId, 2);

      expect(mockMakeRequest).toHaveBeenCalled();
      expect(result.version).toBe(2);
    });
  });
});
