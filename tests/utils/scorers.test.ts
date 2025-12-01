import {
  createScorer,
  createLlmScorerVersion,
  createCodeScorerVersion,
  deleteScorer,
  getScorerVersion,
  getScorers
} from '../../src/utils/scorers';
import {
  Scorer,
  ScorerVersion,
  ScorerTypes,
  OutputType
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
        getScorers: mockGetScorers
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
});
