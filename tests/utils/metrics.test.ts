import { createCustomLlmMetric } from '../../src/utils/metrics';
import { createScorer, createLlmScorerVersion } from '../../src/utils/scorers';
import {
  OutputType,
  ScorerTypes,
  ScorerVersion,
  StepType
} from '../../src/types';

jest.mock('../../src/utils/scorers', () => ({
  createScorer: jest.fn(),
  createLlmScorerVersion: jest.fn()
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
