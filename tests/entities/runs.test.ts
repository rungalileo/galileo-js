import { Runs } from '../../src/entities/runs';
import { ScorerConfig, ScorerTypes } from '../../src/types/scorer.types';
import {
  SegmentFilter,
  RunScorerSettingsResponse
} from '../../src/types/runs.types';

// Create mock implementation functions
const mockInit = jest.fn().mockResolvedValue(undefined);
const mockUpdateRunScorerSettings = jest.fn();

jest.mock('../../src/api-client', () => {
  return {
    GalileoApiClient: jest.fn().mockImplementation(() => {
      return {
        init: mockInit,
        updateRunScorerSettings: mockUpdateRunScorerSettings
      };
    })
  };
});

describe('Runs', () => {
  const FIXED_PROJECT_ID = 'project-123';
  const FIXED_RUN_ID = 'run-456';

  const mockScorers: ScorerConfig[] = [
    {
      id: 'scorer-1',
      name: 'completeness',
      scorerType: ScorerTypes.preset
    }
  ];

  const mockSegmentFilters: SegmentFilter[] = [
    {
      sampleRate: 0.5,
      filter: null,
      llmScorers: false
    }
  ];

  const mockResponse: RunScorerSettingsResponse = {
    runId: FIXED_RUN_ID,
    scorers: mockScorers
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockInit.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('updateScorerSettings', () => {
    it('should call updateRunScorerSettings with correct parameters', async () => {
      const runs = new Runs();
      mockUpdateRunScorerSettings.mockResolvedValue(mockResponse);

      await runs.updateScorerSettings({
        projectId: FIXED_PROJECT_ID,
        runId: FIXED_RUN_ID,
        scorers: mockScorers
      });

      expect(mockUpdateRunScorerSettings).toHaveBeenCalledTimes(1);
      expect(mockUpdateRunScorerSettings).toHaveBeenCalledWith({
        projectId: FIXED_PROJECT_ID,
        runId: FIXED_RUN_ID,
        scorers: mockScorers
      });
    });

    it('should return the response from updateRunScorerSettings', async () => {
      const runs = new Runs();
      mockUpdateRunScorerSettings.mockResolvedValue(mockResponse);

      const response = await runs.updateScorerSettings({
        projectId: FIXED_PROJECT_ID,
        runId: FIXED_RUN_ID,
        scorers: mockScorers
      });

      expect(response).toEqual(mockResponse);
      expect(response.runId).toBe(FIXED_RUN_ID);
      expect(response.scorers).toEqual(mockScorers);
    });

    it('should pass segmentFilters when provided', async () => {
      const runs = new Runs();
      mockUpdateRunScorerSettings.mockResolvedValue(mockResponse);

      await runs.updateScorerSettings({
        projectId: FIXED_PROJECT_ID,
        runId: FIXED_RUN_ID,
        scorers: mockScorers,
        segmentFilters: mockSegmentFilters
      });

      expect(mockUpdateRunScorerSettings).toHaveBeenCalledWith({
        projectId: FIXED_PROJECT_ID,
        runId: FIXED_RUN_ID,
        scorers: mockScorers,
        segmentFilters: mockSegmentFilters
      });
    });

    it('should handle null segmentFilters', async () => {
      const runs = new Runs();
      mockUpdateRunScorerSettings.mockResolvedValue(mockResponse);

      await runs.updateScorerSettings({
        projectId: FIXED_PROJECT_ID,
        runId: FIXED_RUN_ID,
        scorers: mockScorers,
        segmentFilters: null
      });

      expect(mockUpdateRunScorerSettings).toHaveBeenCalledWith({
        projectId: FIXED_PROJECT_ID,
        runId: FIXED_RUN_ID,
        scorers: mockScorers,
        segmentFilters: null
      });
    });

    it('should propagate errors from updateRunScorerSettings', async () => {
      const runs = new Runs();
      const apiError = new Error('Failed to update scorer settings');
      mockUpdateRunScorerSettings.mockRejectedValue(apiError);

      await expect(
        runs.updateScorerSettings({
          projectId: FIXED_PROJECT_ID,
          runId: FIXED_RUN_ID,
          scorers: mockScorers
        })
      ).rejects.toThrow('Failed to update scorer settings');

      expect(mockUpdateRunScorerSettings).toHaveBeenCalledTimes(1);
    });

    it('should handle validation errors', async () => {
      const runs = new Runs();
      const validationError = new Error(
        'Validation error: project_id is not a valid uuid'
      );
      mockUpdateRunScorerSettings.mockRejectedValue(validationError);

      await expect(
        runs.updateScorerSettings({
          projectId: 'invalid-project-id',
          runId: FIXED_RUN_ID,
          scorers: mockScorers
        })
      ).rejects.toThrow('Validation error: project_id is not a valid uuid');
    });
  });
});
