import { createCustomLlmMetric, deleteMetric } from '../../src/utils/metrics';
import {
  deleteScorer,
  createScorer,
  createLlmScorerVersion,
  getScorers
} from '../../src/utils/scorers';
import {
  OutputType,
  Scorer,
  ScorerTypes,
  ScorerVersion,
  StepType
} from '../../src/types';

jest.mock('../../src/utils/scorers', () => ({
  createScorer: jest.fn(),
  createLlmScorerVersion: jest.fn(),
  deleteScorer: jest.fn(),
  getScorers: jest.fn()
}));

describe('createCustomLlmMetric', () => {
  const mockScorer = { id: 'scorer-123' };
  const mockScorerVersion: ScorerVersion = {
    id: 'version-456',
    version: 1
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createScorer as jest.Mock).mockResolvedValue(mockScorer);
    (createLlmScorerVersion as jest.Mock).mockResolvedValue(mockScorerVersion);
  });

  it('should call createScorer with the correct parameters', async () => {
    await createCustomLlmMetric({
      name: 'Test Metric',
      userPrompt: 'Test prompt'
    });

    expect(createScorer).toHaveBeenCalledWith(
      'Test Metric',
      ScorerTypes.llm,
      '',
      [],
      {
        model_name: 'gpt-4.1-mini',
        num_judges: 3
      },
      undefined,
      undefined
    );
  });

  it('should call createLlmScorerVersion with the correct parameters', async () => {
    await createCustomLlmMetric({
      name: 'Test Metric',
      userPrompt: 'Test prompt',
      nodeLevel: StepType.trace,
      cotEnabled: false,
      modelName: 'gpt-4',
      numJudges: 5,
      outputType: OutputType.CATEGORICAL
    });

    expect(createLlmScorerVersion).toHaveBeenCalledWith({
      scorerId: mockScorer.id,
      userPrompt: 'Test prompt',
      scoreableNodeTypes: [StepType.trace],
      cotEnabled: false,
      modelName: 'gpt-4',
      numJudges: 5,
      outputType: OutputType.CATEGORICAL
    });
  });

  it('should return the created scorer version', async () => {
    const result = await createCustomLlmMetric({
      name: 'Test Metric',
      userPrompt: 'Test prompt'
    });

    expect(result).toEqual(mockScorerVersion);
  });

  it('should handle API errors gracefully', async () => {
    const apiError = new Error('API error');
    (createScorer as jest.Mock).mockRejectedValue(apiError);

    await expect(
      createCustomLlmMetric({
        name: 'Test Metric',
        userPrompt: 'Test prompt'
      })
    ).rejects.toThrow(apiError);
  });
});

describe('deleteMetric', () => {
  const mockScorer: Scorer = {
    id: 'scorer-123',
    name: 'Test Scorer',
    scorer_type: ScorerTypes.llm
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getScorers as jest.Mock).mockResolvedValue([mockScorer]);
  });

  it('should call deleteScorer with the correct scorer ID', async () => {
    await deleteMetric({
      scorerName: 'Test Scorer',
      scorerType: ScorerTypes.llm
    });

    expect(deleteScorer).toHaveBeenCalledWith(mockScorer.id);
  });

  it('should throw an error if the scorer is not found', async () => {
    (getScorers as jest.Mock).mockResolvedValue([]);

    await expect(
      deleteMetric({
        scorerName: 'Test Scorer',
        scorerType: ScorerTypes.llm
      })
    ).rejects.toThrow('Scorer with name Test Scorer not found.');
  });
});
