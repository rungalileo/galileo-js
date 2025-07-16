import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { updateScorerSettings } from '../../src/utils/runs';
import { ScorerConfig, ScorerTypes } from '../../src/types/scorer.types';
import { GalileoApiClient } from '../../src/api-client';
import { RunScorerSettingsResponse } from '../../src/types';

jest.mock('../../src/api-client');

const server = setupServer(
  http.patch(
    'https://api.dev.rungalileo.io/api/v2/projects/:projectId/runs/:runId/scorer-settings',
    () => {
      return HttpResponse.json({ result: 'success' });
    }
  )
);

const mockUpdateScorerSettings = jest.fn();

GalileoApiClient.prototype.updateRunScorerSettings = mockUpdateScorerSettings;

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  mockUpdateScorerSettings.mockClear();
});
afterAll(() => server.close());

describe('updateScorerSettings', () => {
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
    const response = await updateScorerSettings(
      'projectId',
      'runId',
      scorers
    );
    expect(response).toEqual(mockResponse);
    expect(mockUpdateScorerSettings).toHaveBeenCalledWith(
      'runId',
      scorers,
      undefined
    );
  });
});