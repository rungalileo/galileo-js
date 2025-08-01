import {
  createScorer,
  createLlmScorerVersion,
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
    version: 2
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
      scorer_type: ScorerTypes.llm
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
        'ver-uuid'
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
    const mockVersion: ScorerVersion = { id: 'ver-uuid', version: 1 };

    beforeEach(() => {
      jest.clearAllMocks();
      mockInit.mockResolvedValue(undefined);
      mockCreateLlmScorerVersion.mockResolvedValue(mockVersion);
    });

    it('should initialize the API client', async () => {
      await createLlmScorerVersion('scorer-uuid', 'instructions', {
        template: 'foo'
      });
      expect(mockInit).toHaveBeenCalled();
    });

    it('should call createLlmScorerVersion with correct parameters', async () => {
      await createLlmScorerVersion(
        'scorer-uuid',
        'instructions',
        { template: 'foo' },
        undefined, // userPrompt
        [StepType.trace], // scoreableNodeTypes
        true, // cotEnabled
        'gpt-4',
        3,
        OutputType.CATEGORICAL
      );
      expect(mockCreateLlmScorerVersion).toHaveBeenCalledWith(
        'scorer-uuid',
        'instructions',
        { template: 'foo' },
        undefined, // userPrompt
        [StepType.trace], // scoreableNodeTypes
        true, // cotEnabled
        'gpt-4',
        3,
        OutputType.CATEGORICAL
      );
    });

    it('should return the created scorer version', async () => {
      const result = await createLlmScorerVersion(
        'scorer-uuid',
        'instructions',
        { template: 'foo' }
      );
      expect(result).toEqual(mockVersion);
    });

    it('should handle API errors gracefully', async () => {
      const apiError = new Error('API error');
      mockCreateLlmScorerVersion.mockRejectedValueOnce(apiError);
      await expect(
        createLlmScorerVersion('scorer-uuid', 'instructions', {
          template: 'foo'
        })
      ).rejects.toThrow(apiError);
    });

    it('should call createLlmScorerVersion with userPrompt instead of instructions/chainPollTemplate', async () => {
      await createLlmScorerVersion(
        'scorer-uuid',
        undefined, // instructions
        undefined, // chainPollTemplate
        'custom user prompt', // userPrompt
        [StepType.session],
        false,
        'gpt-4',
        3,
        OutputType.CATEGORICAL
      );
      expect(mockCreateLlmScorerVersion).toHaveBeenCalledWith(
        'scorer-uuid',
        undefined, // instructions
        undefined, // chainPollTemplate
        'custom user prompt', // userPrompt
        [StepType.session],
        false,
        'gpt-4',
        3,
        OutputType.CATEGORICAL
      );
    });

    it('should return the created scorer version when using userPrompt', async () => {
      const result = await createLlmScorerVersion(
        'scorer-uuid',
        undefined, // instructions
        undefined, // chainPollTemplate
        'custom user prompt' // userPrompt
      );
      expect(result).toEqual(mockVersion);
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
      { id: '1', name: 'foo', scorer_type: ScorerTypes.llm },
      { id: '2', name: 'bar', scorer_type: ScorerTypes.llm }
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
