import { Jobs } from '../../src/utils/jobs';
import { TaskType, JobName } from '../../src/types/job.types';
import {
  CreateJobResponse,
  PromptRunSettings
} from '../../src/types/experiment.types';
import { ScorerConfig, ScorerTypes } from '../../src/types/scorer.types';

// Create mock functions that will be accessible
const mockInit = jest.fn<
  Promise<void>,
  [{ projectId: string; projectScoped: boolean }]
>();
const mockCreateJob = jest.fn<
  Promise<CreateJobResponse>,
  [
    string,
    string,
    string,
    string,
    string,
    TaskType,
    PromptRunSettings,
    ScorerConfig[] | undefined
  ]
>();

// Mock GalileoApiClient
jest.mock('../../src/api-client', () => {
  return {
    GalileoApiClient: jest.fn().mockImplementation(() => {
      return {
        init: mockInit,
        createJob: mockCreateJob
      };
    })
  };
});

describe('Jobs', () => {
  const projectId = 'test-project-id';
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
      scorerType: ScorerTypes.preset,
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
    mockInit.mockResolvedValue(undefined);
    mockCreateJob.mockResolvedValue(mockCreateJobResponse);
  });

  describe('create', () => {
    it('should create a job successfully with all required parameters', async () => {
      const jobs = new Jobs();
      const result = await jobs.create(
        projectId,
        name,
        runId,
        datasetId,
        promptTemplateId,
        taskType,
        mockPromptSettings
      );

      expect(result).toEqual(mockCreateJobResponse);
      expect(mockInit).toHaveBeenCalledWith({ projectId, projectScoped: true });
      expect(mockCreateJob).toHaveBeenCalledWith(
        projectId,
        name,
        runId,
        datasetId,
        promptTemplateId,
        taskType,
        mockPromptSettings,
        undefined
      );
    });

    it('should create a job with optional scorers', async () => {
      const jobs = new Jobs();
      const result = await jobs.create(
        projectId,
        name,
        runId,
        datasetId,
        promptTemplateId,
        taskType,
        mockPromptSettings,
        mockScorers
      );

      expect(result).toEqual(mockCreateJobResponse);
      expect(mockCreateJob).toHaveBeenCalledWith(
        projectId,
        name,
        runId,
        datasetId,
        promptTemplateId,
        taskType,
        mockPromptSettings,
        mockScorers
      );
    });

    it('should initialize GalileoApiClient with correct parameters', async () => {
      const jobs = new Jobs();
      await jobs.create(
        projectId,
        name,
        runId,
        datasetId,
        promptTemplateId,
        taskType,
        mockPromptSettings
      );

      expect(mockInit).toHaveBeenCalledWith({ projectId, projectScoped: true });
      expect(mockCreateJob).toHaveBeenCalledTimes(1);
    });

    it('should pass all parameters to createJob in correct order', async () => {
      const jobs = new Jobs();
      await jobs.create(
        projectId,
        name,
        runId,
        datasetId,
        promptTemplateId,
        taskType,
        mockPromptSettings,
        mockScorers
      );

      expect(mockCreateJob).toHaveBeenCalledWith(
        projectId,
        name,
        runId,
        datasetId,
        promptTemplateId,
        taskType,
        mockPromptSettings,
        mockScorers
      );
    });

    it('should throw error if createJob fails', async () => {
      const errorMessage = 'API error occurred';
      mockCreateJob.mockRejectedValue(new Error(errorMessage));

      const jobs = new Jobs();
      await expect(
        jobs.create(
          projectId,
          name,
          runId,
          datasetId,
          promptTemplateId,
          taskType,
          mockPromptSettings
        )
      ).rejects.toThrow(errorMessage);
    });

    it('should handle empty prompt settings', async () => {
      const emptyPromptSettings: PromptRunSettings = {};
      const jobs = new Jobs();
      await jobs.create(
        projectId,
        name,
        runId,
        datasetId,
        promptTemplateId,
        taskType,
        emptyPromptSettings
      );

      expect(mockCreateJob).toHaveBeenCalledWith(
        projectId,
        name,
        runId,
        datasetId,
        promptTemplateId,
        taskType,
        emptyPromptSettings,
        undefined
      );
    });

    it('should handle undefined scorers', async () => {
      const jobs = new Jobs();
      await jobs.create(
        projectId,
        name,
        runId,
        datasetId,
        promptTemplateId,
        taskType,
        mockPromptSettings,
        undefined
      );

      expect(mockCreateJob).toHaveBeenCalledWith(
        projectId,
        name,
        runId,
        datasetId,
        promptTemplateId,
        taskType,
        mockPromptSettings,
        undefined
      );
    });

    it('should create a new GalileoApiClient instance for each call', async () => {
      const jobs = new Jobs();

      await jobs.create(
        projectId,
        name,
        runId,
        datasetId,
        promptTemplateId,
        taskType,
        mockPromptSettings
      );

      await jobs.create(
        projectId,
        name,
        runId,
        datasetId,
        promptTemplateId,
        taskType,
        mockPromptSettings
      );

      // Verify init was called twice (once per create call)
      expect(mockInit).toHaveBeenCalledTimes(2);
    });
  });
});
