import { ExperimentService } from '../../../src/api-client/services/experiment-service';
import { BaseClient, RequestMethod } from '../../../src/api-client/base-client';
import { Routes } from '../../../src/types/routes.types';
import { ScorerConfig, ScorerTypes } from '../../../src/types/scorer.types';

const mockMakeRequest = jest
  .spyOn(BaseClient.prototype, 'makeRequest')
  .mockImplementation();

describe('ExperimentService', () => {
  let experimentService: ExperimentService;
  const mockApiUrl = 'http://fake.api/v2';
  const mockToken = 'fake-api-token';
  const projectId = 'project-uuid-for-experiment';
  const experimentId = 'experiment-123';

  beforeEach(() => {
    jest.clearAllMocks();
    experimentService = new ExperimentService(mockApiUrl, mockToken, projectId);
  });

  describe('createRunScorerSettings', () => {
    const mockScorers: ScorerConfig[] = [
      {
        id: 'scorer-1',
        scorerType: ScorerTypes.preset,
        name: 'completeness'
      }
    ];

    it('should call makeRequest with correct parameters when projectId is provided', async () => {
      mockMakeRequest.mockResolvedValue(undefined);

      await experimentService.createRunScorerSettings(
        experimentId,
        projectId,
        mockScorers
      );

      expect(mockMakeRequest).toHaveBeenCalledTimes(1);
      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.POST,
        Routes.runScorerSettings,
        {
          run_id: experimentId,
          scorers: [
            {
              id: 'scorer-1',
              scorer_type: 'preset',
              name: 'completeness'
            }
          ]
        },
        {
          project_id: projectId,
          run_id: experimentId
        }
      );
    });

    it('should use instance projectId when projectId parameter is not provided', async () => {
      mockMakeRequest.mockResolvedValue(undefined);

      await experimentService.createRunScorerSettings(
        experimentId,
        '',
        mockScorers
      );

      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.POST,
        Routes.runScorerSettings,
        {
          run_id: experimentId,
          scorers: [
            {
              id: 'scorer-1',
              scorer_type: 'preset',
              name: 'completeness'
            }
          ]
        },
        {
          project_id: projectId, // Should use instance projectId
          run_id: experimentId
        }
      );
    });

    it('should handle multiple scorers with different types', async () => {
      const multipleScorers: ScorerConfig[] = [
        {
          id: 'scorer-1',
          scorerType: ScorerTypes.preset,
          name: 'completeness'
        },
        {
          id: 'scorer-2',
          scorerType: ScorerTypes.llm,
          name: 'custom-llm-scorer'
        },
        {
          id: 'scorer-3',
          scorerType: ScorerTypes.code,
          name: 'custom-code-scorer'
        }
      ];

      mockMakeRequest.mockResolvedValue(undefined);

      await experimentService.createRunScorerSettings(
        experimentId,
        projectId,
        multipleScorers
      );

      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.POST,
        Routes.runScorerSettings,
        {
          run_id: experimentId,
          scorers: [
            {
              id: 'scorer-1',
              scorer_type: 'preset',
              name: 'completeness'
            },
            {
              id: 'scorer-2',
              scorer_type: 'llm',
              name: 'custom-llm-scorer'
            },
            {
              id: 'scorer-3',
              scorer_type: 'code',
              name: 'custom-code-scorer'
            }
          ]
        },
        {
          project_id: projectId,
          run_id: experimentId
        }
      );
    });

    it('should handle empty scorers array', async () => {
      mockMakeRequest.mockResolvedValue(undefined);

      await experimentService.createRunScorerSettings(
        experimentId,
        projectId,
        []
      );

      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.POST,
        Routes.runScorerSettings,
        {
          run_id: experimentId,
          scorers: []
        },
        {
          project_id: projectId,
          run_id: experimentId
        }
      );
    });

    it('should convert camelCase scorer properties to snake_case', async () => {
      const scorersWithAdditionalProps: ScorerConfig[] = [
        {
          id: 'scorer-1',
          scorerType: ScorerTypes.llm,
          name: 'test-scorer',
          modelName: 'gpt-4',
          numJudges: 3
        }
      ];

      mockMakeRequest.mockResolvedValue(undefined);

      await experimentService.createRunScorerSettings(
        experimentId,
        projectId,
        scorersWithAdditionalProps
      );

      // Verify that convertToSnakeCase was applied to the scorers
      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.POST,
        Routes.runScorerSettings,
        expect.objectContaining({
          run_id: experimentId,
          scorers: expect.arrayContaining([
            expect.objectContaining({
              id: 'scorer-1',
              scorer_type: 'llm',
              name: 'test-scorer',
              model_name: 'gpt-4',
              num_judges: 3
            })
          ])
        }),
        {
          project_id: projectId,
          run_id: experimentId
        }
      );
    });

    it('should return void when successful', async () => {
      mockMakeRequest.mockResolvedValue(undefined);

      const result = await experimentService.createRunScorerSettings(
        experimentId,
        projectId,
        mockScorers
      );

      expect(result).toBeUndefined();
    });

    it('should propagate errors from makeRequest', async () => {
      const apiError = new Error('API request failed');
      mockMakeRequest.mockRejectedValue(apiError);

      await expect(
        experimentService.createRunScorerSettings(
          experimentId,
          projectId,
          mockScorers
        )
      ).rejects.toThrow('API request failed');
    });

    it('should handle API errors with detail message', async () => {
      const apiError = {
        response: {
          data: {
            detail: 'Invalid experiment ID'
          }
        },
        message: 'Request failed'
      };
      mockMakeRequest.mockRejectedValue(apiError);

      await expect(
        experimentService.createRunScorerSettings(
          experimentId,
          projectId,
          mockScorers
        )
      ).rejects.toEqual(apiError);
    });
  });
});
