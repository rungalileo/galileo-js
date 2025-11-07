import { JobsService } from '../../../src/api-client/services/job-service';
import { BaseClient, RequestMethod } from '../../../src/api-client/base-client';
import { Routes } from '../../../src/types/routes.types';
import { TaskType, JobName } from '../../../src/types/job.types';
import {
  CreateJobResponse,
  PromptRunSettings
} from '../../../src/types/experiment.types';
import { ScorerConfig, ScorerTypes } from '../../../src/types/scorer.types';

const mockMakeRequest = jest
  .spyOn(BaseClient.prototype, 'makeRequest')
  .mockImplementation();

describe('JobsService', () => {
  let jobsService: JobsService;
  const mockApiUrl = 'http://fake.api/v2';
  const mockToken = 'fake-api-token';
  const projectId = 'project-uuid-for-job';
  const runId = 'test-run-id';
  const datasetId = 'test-dataset-id';
  const promptTemplateId = 'test-prompt-template-id';
  const taskType = TaskType.VALUE_16;
  const name = JobName.playground_run;

  const mockPromptSettings: PromptRunSettings = {
    model_alias: 'GPT-4o',
    temperature: 0.7,
    max_tokens: 1000
  };

  const mockScorers: ScorerConfig[] = [
    {
      id: 'scorer-1',
      scorer_type: ScorerTypes.preset,
      name: 'completeness'
    }
  ];

  const mockCreateJobResponse: CreateJobResponse = {
    project_id: projectId,
    run_id: runId,
    job_id: 'test-job-id',
    link: 'https://app.galileo.ai/project/test-project-id/experiments/test-run-id',
    message: 'Job created successfully'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jobsService = new JobsService(mockApiUrl, mockToken);
  });

  describe('create', () => {
    it('should call makeRequest with correct parameters and return job response', async () => {
      mockMakeRequest.mockResolvedValue(mockCreateJobResponse);

      const result = await jobsService.create(
        projectId,
        name,
        runId,
        datasetId,
        promptTemplateId,
        taskType,
        mockPromptSettings
      );

      expect(mockMakeRequest).toHaveBeenCalledTimes(1);
      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.POST,
        Routes.jobs,
        {
          project_id: projectId,
          dataset_id: datasetId,
          job_name: name,
          run_id: runId,
          prompt_settings: mockPromptSettings,
          prompt_template_version_id: promptTemplateId,
          task_type: taskType,
          scorers: undefined
        }
      );
      expect(result).toEqual(mockCreateJobResponse);
    });

    it('should create job with optional scorers', async () => {
      mockMakeRequest.mockResolvedValue(mockCreateJobResponse);

      const result = await jobsService.create(
        projectId,
        name,
        runId,
        datasetId,
        promptTemplateId,
        taskType,
        mockPromptSettings,
        mockScorers
      );

      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.POST,
        Routes.jobs,
        {
          project_id: projectId,
          dataset_id: datasetId,
          job_name: name,
          run_id: runId,
          prompt_settings: mockPromptSettings,
          prompt_template_version_id: promptTemplateId,
          task_type: taskType,
          scorers: mockScorers
        }
      );
      expect(result).toEqual(mockCreateJobResponse);
    });

    it('should handle empty prompt settings', async () => {
      const emptyPromptSettings: PromptRunSettings = {};
      mockMakeRequest.mockResolvedValue(mockCreateJobResponse);

      await jobsService.create(
        projectId,
        name,
        runId,
        datasetId,
        promptTemplateId,
        taskType,
        emptyPromptSettings
      );

      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.POST,
        Routes.jobs,
        expect.objectContaining({
          prompt_settings: {}
        })
      );
    });

    it('should throw error if response is missing job_id', async () => {
      const invalidResponse = {
        project_id: projectId,
        run_id: runId,
        link: 'https://example.com',
        message: 'Job created'
      } as CreateJobResponse;
      mockMakeRequest.mockResolvedValue(invalidResponse);

      await expect(
        jobsService.create(
          projectId,
          name,
          runId,
          datasetId,
          promptTemplateId,
          taskType,
          mockPromptSettings
        )
      ).rejects.toThrow('Create job failed');
    });

    it('should throw error if response is null', async () => {
      mockMakeRequest.mockResolvedValue(null as unknown as CreateJobResponse);

      await expect(
        jobsService.create(
          projectId,
          name,
          runId,
          datasetId,
          promptTemplateId,
          taskType,
          mockPromptSettings
        )
      ).rejects.toThrow('Create job failed');
    });

    it('should handle API errors with detail message', async () => {
      const apiError = {
        response: {
          data: {
            detail: 'Invalid project ID'
          }
        },
        message: 'Request failed'
      };
      mockMakeRequest.mockRejectedValue(apiError);

      await expect(
        jobsService.create(
          projectId,
          name,
          runId,
          datasetId,
          promptTemplateId,
          taskType,
          mockPromptSettings
        )
      ).rejects.toThrow('Create job failed: Invalid project ID');
    });

    it('should handle API errors with message only', async () => {
      const apiError = {
        message: 'Network error'
      };
      mockMakeRequest.mockRejectedValue(apiError);

      await expect(
        jobsService.create(
          projectId,
          name,
          runId,
          datasetId,
          promptTemplateId,
          taskType,
          mockPromptSettings
        )
      ).rejects.toThrow('Create job failed: Network error');
    });

    it('should handle Error instances', async () => {
      const error = new Error('Connection timeout');
      mockMakeRequest.mockRejectedValue(error);

      await expect(
        jobsService.create(
          projectId,
          name,
          runId,
          datasetId,
          promptTemplateId,
          taskType,
          mockPromptSettings
        )
      ).rejects.toThrow('Create job failed: Connection timeout');
    });

    it('should handle unknown error types', async () => {
      mockMakeRequest.mockRejectedValue('String error');

      await expect(
        jobsService.create(
          projectId,
          name,
          runId,
          datasetId,
          promptTemplateId,
          taskType,
          mockPromptSettings
        )
      ).rejects.toThrow('Create job failed');
    });
  });
});
