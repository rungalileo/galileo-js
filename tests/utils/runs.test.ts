import { updateScorerSettings } from '../../src/utils/runs';
import { ScorerConfig, ScorerTypes } from '../../src/types/scorer.types';
import { RunScorerSettingsResponse } from '../../src/types';

// Create mock implementation functions
const mockInit = jest.fn().mockResolvedValue(undefined);
const mockUpdateScorerSettings = jest.fn();

jest.mock('../../src/api-client', () => {
  return {
    GalileoApiClient: jest.fn().mockImplementation(() => {
      return {
        init: mockInit,
        updateRunScorerSettings: mockUpdateScorerSettings
      };
    })
  };
});

describe('updateScorerSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return null when the api call fails', async () => {
    mockUpdateScorerSettings.mockRejectedValue(new Error('API Error'));
    const response = await updateScorerSettings('projectId', 'runId', []);
    expect(response).toBeNull();
  });

  it('should return the response from the api client', async () => {
    const mockResponse: RunScorerSettingsResponse = {
      run_id: 'runId',
      scorers: [],
      segment_filters: []
    };
    mockUpdateScorerSettings.mockResolvedValue(mockResponse);

    const scorers: ScorerConfig[] = [
      {
        id: 'test-scorer',
        name: 'completeness_gpt',
        scorer_type: ScorerTypes.llm,
        model_name: 'gpt-4'
      }
    ];
    const response = await updateScorerSettings('projectId', 'runId', scorers);
    expect(response).toEqual(mockResponse);
    expect(mockUpdateScorerSettings).toHaveBeenCalledWith(
      'runId',
      scorers,
      undefined
    );
  });
});
