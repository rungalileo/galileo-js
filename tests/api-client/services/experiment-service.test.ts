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

  describe('createExperiment', () => {
    const dataset = { datasetId: 'dataset-1', versionIndex: 1 };

    it('sends only name/task_type/dataset for the legacy two-arg call', async () => {
      mockMakeRequest.mockResolvedValue({ id: 'exp-1', name: 'Exp' });

      await experimentService.createExperiment('Exp', dataset);

      const body = mockMakeRequest.mock.calls[0][2] as Record<string, unknown>;
      expect(body.name).toBe('Exp');
      expect(body.task_type).toBe(16);
      expect(body.dataset).toEqual({
        dataset_id: 'dataset-1',
        version_index: 1
      });
      // Prompt-run fields are omitted when not provided (backward-compatible wire shape).
      expect(body).not.toHaveProperty('trigger');
      expect(body).not.toHaveProperty('scorers');
      expect(body).not.toHaveProperty('prompt_template_version_id');
      expect(body).not.toHaveProperty('prompt_settings');
    });

    it('sends trigger/scorers/prompt fields snake-cased when provided', async () => {
      mockMakeRequest.mockResolvedValue({ id: 'exp-1', name: 'Exp' });

      const scorers: ScorerConfig[] = [
        { id: 'scorer-1', scorerType: ScorerTypes.preset, name: 'correctness' }
      ];

      await experimentService.createExperiment(
        'Exp',
        dataset,
        true,
        scorers,
        'ptv-123',
        { temperature: 0.5 } as never
      );

      const body = mockMakeRequest.mock.calls[0][2] as Record<string, unknown>;
      expect(body.trigger).toBe(true);
      expect(body.prompt_template_version_id).toBe('ptv-123');
      expect(body.scorers).toEqual([
        { id: 'scorer-1', scorer_type: 'preset', name: 'correctness' }
      ]);
      expect(body.prompt_settings).toEqual({ temperature: 0.5 });
    });
  });
});
