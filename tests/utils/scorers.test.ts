import {
  createScorer,
  createLlmScorerVersion,
  createCodeScorerVersion,
  deleteScorer,
  getScorerVersion,
  getScorers,
  validateCodeScorer
} from '../../src/utils/scorers';
import {
  Scorer,
  ScorerVersion,
  ScorerTypes,
  OutputType,
  ValidateRegisteredScorerResult,
  ResultType
} from '../../src/types/scorer.types';
import { StepType } from '../../src/types';

// Create mock implementation functions
const mockInit = jest.fn().mockResolvedValue(undefined);
const mockCreateScorer = jest.fn();
const mockCreateLlmScorerVersion = jest.fn();
const mockCreateCodeScorerVersion = jest.fn();
const mockDeleteScorer = jest.fn();
const mockGetScorerVersion = jest.fn();
const mockGetScorers = jest.fn();
const mockValidateCodeScorerAndWait = jest.fn();

jest.mock('../../src/api-client', () => {
  return {
    GalileoApiClient: jest.fn().mockImplementation(() => {
      return {
        init: mockInit,
        createScorer: mockCreateScorer,
        createLlmScorerVersion: (...args: unknown[]) =>
          mockCreateLlmScorerVersion(...args),
        createCodeScorerVersion: (...args: unknown[]) =>
          mockCreateCodeScorerVersion(...args),
        deleteScorer: mockDeleteScorer,
        getScorerVersion: mockGetScorerVersion,
        getScorers: mockGetScorers,
        validateCodeScorerAndWait: (...args: unknown[]) =>
          mockValidateCodeScorerAndWait(...args)
      };
    })
  };
});

describe('scorers utility', () => {
  const scorerId = 'scorer-123';
  const version = 2;

  const mockScorerVersion: ScorerVersion = {
    id: 'scorer-version-123',
    version: 2,
    scorer_id: 'scorer-123'
  };

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Reset mock implementation to default
    mockInit.mockResolvedValue(undefined);
    mockGetScorerVersion.mockResolvedValue(mockScorerVersion);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getScorerVersion', () => {
    it('should initialize the API client', async () => {
      await getScorerVersion(scorerId, version);
      expect(mockInit).toHaveBeenCalled();
    });
    it('should call getScorerVersion with the correct parameters', async () => {
      await getScorerVersion(scorerId, version);
      expect(mockGetScorerVersion).toHaveBeenCalledWith(scorerId, version);
    });
    it('should return the scorer version data', async () => {
      const result = await getScorerVersion(scorerId, version);
      expect(result).toEqual(mockScorerVersion);
    });
    it('should handle API errors gracefully', async () => {
      // Setup mock to throw an error
      const apiError = new Error('API connection failed');
      mockGetScorerVersion.mockRejectedValueOnce(apiError);

      // Call the function and expect it to reject with the same error
      await expect(getScorerVersion(scorerId, version)).rejects.toThrow(
        apiError
      );
    });
  });

  describe('createScorer', () => {
    const mockScorer: Scorer = {
      id: 'scorer-uuid',
      name: 'test',
      scorer_type: ScorerTypes.llm,
      tags: []
    };

    beforeEach(() => {
      jest.clearAllMocks();
      mockInit.mockResolvedValue(undefined);
      mockCreateScorer.mockResolvedValue(mockScorer);
    });

    it('should initialize the API client', async () => {
      await createScorer('test', ScorerTypes.llm);
      expect(mockInit).toHaveBeenCalled();
    });

    it('should call createScorer with correct parameters', async () => {
      await createScorer(
        'test',
        ScorerTypes.llm,
        'desc',
        ['tag1'],
        { model_name: 'gpt-4' },
        'llm',
        'ver-uuid'
      );
      expect(mockCreateScorer).toHaveBeenCalledWith(
        'test',
        ScorerTypes.llm,
        'desc',
        ['tag1'],
        { model_name: 'gpt-4' },
        'llm',
        'ver-uuid',
        undefined, // scoreableNodeTypes
        undefined, // outputType
        undefined // inputType
      );
    });

    it('should return the created scorer', async () => {
      const result = await createScorer('test', ScorerTypes.llm);
      expect(result).toEqual(mockScorer);
    });

    it('should handle API errors gracefully', async () => {
      const apiError = new Error('API error');
      mockCreateScorer.mockRejectedValueOnce(apiError);
      await expect(createScorer('test', ScorerTypes.llm)).rejects.toThrow(
        apiError
      );
    });
  });

  describe('createLlmScorerVersion', () => {
    const mockVersion: ScorerVersion = {
      id: 'ver-uuid',
      version: 1,
      scorer_id: 'scorer-uuid'
    };

    beforeEach(() => {
      jest.clearAllMocks();
      mockInit.mockResolvedValue(undefined);
      mockCreateLlmScorerVersion.mockResolvedValue(mockVersion);
    });

    it('should initialize the API client', async () => {
      await createLlmScorerVersion({
        scorerId: 'scorer-uuid',
        instructions: 'instructions',
        chainPollTemplate: { template: 'foo' }
      });
      expect(mockInit).toHaveBeenCalled();
    });

    it('should call createLlmScorerVersion with correct parameters', async () => {
      await createLlmScorerVersion({
        scorerId: 'scorer-uuid',
        instructions: 'instructions',
        chainPollTemplate: { template: 'foo' },
        scoreableNodeTypes: [StepType.trace],
        cotEnabled: true,
        modelName: 'gpt-4',
        numJudges: 3,
        outputType: OutputType.CATEGORICAL
      });
      expect(mockCreateLlmScorerVersion).toHaveBeenCalledWith(
        'scorer-uuid',
        'instructions',
        { template: 'foo' },
        undefined, // userPrompt
        true, // cotEnabled
        'gpt-4',
        3
      );
    });

    it('should return the created scorer version', async () => {
      const result = await createLlmScorerVersion({
        scorerId: 'scorer-uuid',
        instructions: 'instructions',
        chainPollTemplate: { template: 'foo' }
      });
      expect(result).toEqual(mockVersion);
    });

    it('should handle API errors gracefully', async () => {
      const apiError = new Error('API error');
      mockCreateLlmScorerVersion.mockRejectedValueOnce(apiError);
      await expect(
        createLlmScorerVersion({
          scorerId: 'scorer-uuid',
          instructions: 'instructions',
          chainPollTemplate: { template: 'foo' }
        })
      ).rejects.toThrow(apiError);
    });

    it('should call createLlmScorerVersion with userPrompt instead of instructions/chainPollTemplate', async () => {
      await createLlmScorerVersion({
        scorerId: 'scorer-uuid',
        userPrompt: 'custom user prompt',
        scoreableNodeTypes: [StepType.session],
        cotEnabled: false,
        modelName: 'gpt-4',
        numJudges: 3,
        outputType: OutputType.CATEGORICAL
      });
      expect(mockCreateLlmScorerVersion).toHaveBeenCalledWith(
        'scorer-uuid',
        undefined, // instructions
        undefined, // chainPollTemplate
        'custom user prompt', // userPrompt
        false,
        'gpt-4',
        3
      );
    });

    it('should return the created scorer version when using userPrompt', async () => {
      const result = await createLlmScorerVersion({
        scorerId: 'scorer-uuid',
        userPrompt: 'custom user prompt'
      });
      expect(result).toEqual(mockVersion);
    });
  });

  describe('createCodeScorerVersion', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockInit.mockResolvedValue(undefined);
      mockCreateCodeScorerVersion.mockResolvedValue(mockScorerVersion);
    });

    it('should initialize the API client', async () => {
      await createCodeScorerVersion('scorer-uuid', 'def score(): return 1.0');
      expect(mockInit).toHaveBeenCalled();
    });

    it('should call createCodeScorerVersion with correct parameters', async () => {
      const codeContent = 'def score(input, output):\n    return 1.0';
      await createCodeScorerVersion('scorer-uuid', codeContent);
      expect(mockCreateCodeScorerVersion).toHaveBeenCalledWith(
        'scorer-uuid',
        codeContent,
        undefined
      );
    });

    it('should return the created scorer version', async () => {
      const result = await createCodeScorerVersion(
        'scorer-uuid',
        'def score(): return 1.0'
      );
      expect(result).toEqual(mockScorerVersion);
    });

    it('should handle API errors gracefully', async () => {
      const apiError = new Error('Code upload failed');
      mockCreateCodeScorerVersion.mockRejectedValueOnce(apiError);
      await expect(
        createCodeScorerVersion('scorer-uuid', 'def score(): return 1.0')
      ).rejects.toThrow(apiError);
    });

    it('should handle multiline code content', async () => {
      const multilineCode = `def score(input, output):
    # Calculate score based on input and output
    if 'error' in output.lower():
        return 0.0
    return 1.0`;

      await createCodeScorerVersion('scorer-uuid', multilineCode);
      expect(mockCreateCodeScorerVersion).toHaveBeenCalledWith(
        'scorer-uuid',
        multilineCode,
        undefined
      );
    });
  });

  describe('deleteScorer', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockInit.mockResolvedValue(undefined);
      mockDeleteScorer.mockResolvedValue(undefined);
    });

    it('should initialize the API client', async () => {
      await deleteScorer('scorer-uuid');
      expect(mockInit).toHaveBeenCalled();
    });

    it('should call deleteScorer with correct parameters', async () => {
      await deleteScorer('scorer-uuid');
      expect(mockDeleteScorer).toHaveBeenCalledWith('scorer-uuid');
    });

    it('should resolve when deletion is successful', async () => {
      await expect(deleteScorer('scorer-uuid')).resolves.toBeUndefined();
    });

    it('should handle API errors gracefully', async () => {
      const apiError = new Error('API error');
      mockDeleteScorer.mockRejectedValueOnce(apiError);
      await expect(deleteScorer('scorer-uuid')).rejects.toThrow(apiError);
    });
  });

  describe('getScorers', () => {
    const mockScorers: Scorer[] = [
      { id: '1', name: 'foo', scorer_type: ScorerTypes.llm, tags: [] },
      { id: '2', name: 'bar', scorer_type: ScorerTypes.llm, tags: [] }
    ];

    beforeEach(() => {
      jest.clearAllMocks();
      mockInit.mockResolvedValue(undefined);
      mockGetScorers.mockResolvedValue(mockScorers);
    });

    it('should initialize the API client', async () => {
      await getScorers();
      expect(mockInit).toHaveBeenCalled();
    });

    it('should call getScorers with no filters', async () => {
      await getScorers();
      expect(mockGetScorers).toHaveBeenCalled();
    });

    it('should call getScorers with type filter', async () => {
      await getScorers({ type: ScorerTypes.llm });
      expect(mockGetScorers).toHaveBeenCalledWith({ type: ScorerTypes.llm });
    });

    it('should call getScorers with names filter', async () => {
      await getScorers({ names: ['foo', 'bar'] });
      expect(mockGetScorers).toHaveBeenCalledWith({ names: ['foo', 'bar'] });
    });

    it('should return the scorers from the API', async () => {
      const result = await getScorers();
      expect(result).toEqual(mockScorers);
    });

    it('should handle API errors gracefully', async () => {
      const apiError = new Error('API error');
      mockGetScorers.mockRejectedValueOnce(apiError);
      await expect(getScorers()).rejects.toThrow(apiError);
    });
  });

  describe('validateCodeScorer', () => {
    const mockValidResult: ValidateRegisteredScorerResult = {
      result: {
        result_type: ResultType.VALID,
        score_type: 'float',
        scoreable_node_types: ['llm'],
        include_llm_credentials: false,
        chain_aggregation: null,
        test_scores: [
          { node_type: 'llm', score: 0.95 },
          { node_type: 'llm', score: 1.0 }
        ]
      }
    };

    const mockInvalidResult: ValidateRegisteredScorerResult = {
      result: {
        result_type: ResultType.INVALID,
        error_message: 'Invalid Python syntax on line 5'
      }
    };

    const validCode = 'def score(input, output):\n    return 1.0';
    const invalidCode = 'def score(input output):\n    return 1.0'; // Missing comma

    beforeEach(() => {
      jest.clearAllMocks();
      mockInit.mockResolvedValue(undefined);
      mockValidateCodeScorerAndWait.mockResolvedValue(mockValidResult);
    });

    it('should initialize the API client', async () => {
      await validateCodeScorer(validCode, [StepType.llm]);
      expect(mockInit).toHaveBeenCalled();
    });

    it('should call validateCodeScorerAndWait with correct parameters', async () => {
      await validateCodeScorer(validCode, [StepType.llm]);
      expect(mockValidateCodeScorerAndWait).toHaveBeenCalledWith(
        validCode,
        [StepType.llm],
        undefined,
        undefined,
        undefined
      );
    });

    it('should pass custom timeout and poll interval', async () => {
      const customTimeout = 30000;
      const customPollInterval = 500;
      await validateCodeScorer(
        validCode,
        [StepType.llm],
        customTimeout,
        customPollInterval
      );
      expect(mockValidateCodeScorerAndWait).toHaveBeenCalledWith(
        validCode,
        [StepType.llm],
        customTimeout,
        customPollInterval,
        undefined
      );
    });

    it('should return valid result for valid code', async () => {
      const result = await validateCodeScorer(validCode, [StepType.llm]);
      expect(result).toEqual(mockValidResult);
      expect(result.result.result_type).toBe(ResultType.VALID);
    });

    it('should return invalid result for invalid code', async () => {
      mockValidateCodeScorerAndWait.mockResolvedValueOnce(mockInvalidResult);
      const result = await validateCodeScorer(invalidCode, [StepType.llm]);
      expect(result).toEqual(mockInvalidResult);
      expect(result.result.result_type).toBe(ResultType.INVALID);
      if (result.result.result_type === ResultType.INVALID) {
        expect(result.result.error_message).toBe(
          'Invalid Python syntax on line 5'
        );
      }
    });

    it('should handle multiple scoreable node types', async () => {
      const multiNodeResult: ValidateRegisteredScorerResult = {
        result: {
          result_type: ResultType.VALID,
          score_type: 'float',
          scoreable_node_types: ['llm', 'tool', 'retriever'],
          include_llm_credentials: false,
          chain_aggregation: null,
          test_scores: []
        }
      };
      mockValidateCodeScorerAndWait.mockResolvedValueOnce(multiNodeResult);

      await validateCodeScorer(validCode, [
        StepType.llm,
        StepType.tool,
        StepType.retriever
      ]);
      expect(mockValidateCodeScorerAndWait).toHaveBeenCalledWith(
        validCode,
        [StepType.llm, StepType.tool, StepType.retriever],
        undefined,
        undefined,
        undefined
      );
    });

    it('should handle validation with test scores of different types', async () => {
      const mixedScoreResult: ValidateRegisteredScorerResult = {
        result: {
          result_type: ResultType.VALID,
          score_type: 'mixed',
          scoreable_node_types: ['llm'],
          include_llm_credentials: true,
          chain_aggregation: 'mean',
          test_scores: [
            { node_type: 'llm', score: 0.5 },
            { node_type: 'llm', score: 'pass' },
            { node_type: 'llm', score: true },
            { node_type: 'llm', score: null }
          ]
        }
      };
      mockValidateCodeScorerAndWait.mockResolvedValueOnce(mixedScoreResult);

      const result = await validateCodeScorer(validCode, [StepType.llm]);
      expect(result).toEqual(mixedScoreResult);
      if (result.result.result_type === ResultType.VALID) {
        expect(result.result.test_scores).toHaveLength(4);
        expect(result.result.include_llm_credentials).toBe(true);
        expect(result.result.chain_aggregation).toBe('mean');
      }
    });

    it('should handle API errors gracefully', async () => {
      const apiError = new Error('Validation service unavailable');
      mockValidateCodeScorerAndWait.mockRejectedValueOnce(apiError);
      await expect(
        validateCodeScorer(validCode, [StepType.llm])
      ).rejects.toThrow('Validation service unavailable');
    });

    it('should handle timeout errors', async () => {
      const timeoutError = new Error(
        'Code scorer validation timed out after 60 seconds'
      );
      mockValidateCodeScorerAndWait.mockRejectedValueOnce(timeoutError);
      await expect(
        validateCodeScorer(validCode, [StepType.llm])
      ).rejects.toThrow('Code scorer validation timed out after 60 seconds');
    });

    it('should handle validation failure errors', async () => {
      const validationError = new Error(
        'Code scorer validation failed: Function "score" not found'
      );
      mockValidateCodeScorerAndWait.mockRejectedValueOnce(validationError);
      await expect(
        validateCodeScorer(validCode, [StepType.llm])
      ).rejects.toThrow(
        'Code scorer validation failed: Function "score" not found'
      );
    });

    it('should handle multiline code content', async () => {
      const multilineCode = `def score(input, output):
    # Calculate score based on output quality
    if not output:
        return 0.0
    if 'error' in output.lower():
        return 0.0
    return 1.0`;

      await validateCodeScorer(multilineCode, [StepType.llm]);
      expect(mockValidateCodeScorerAndWait).toHaveBeenCalledWith(
        multilineCode,
        [StepType.llm],
        undefined,
        undefined,
        undefined
      );
    });

    it('should handle code with special characters', async () => {
      const codeWithSpecialChars = `def score(input, output):
    """Score function with special chars: @#$%^&*"""
    return len(output) / 100.0 if output else 0.0`;

      await validateCodeScorer(codeWithSpecialChars, [StepType.tool]);
      expect(mockValidateCodeScorerAndWait).toHaveBeenCalledWith(
        codeWithSpecialChars,
        [StepType.tool],
        undefined,
        undefined,
        undefined
      );
    });
  });
});
