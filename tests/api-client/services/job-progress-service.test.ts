import { JobProgressService } from '../../../src/api-client/services/job-progress-service';
import { BaseClient, RequestMethod } from '../../../src/api-client/base-client';
import { Routes } from '../../../src/types/routes.types';
import { Job, JobStatus, JobName } from '../../../src/types';

const mockMakeRequest = jest
  .spyOn(BaseClient.prototype, 'makeRequest')
  .mockImplementation();

describe('JobProgressService', () => {
  let jobProgressService: JobProgressService;
  const mockApiUrl = 'http://fake.api/v2';
  const mockToken = 'fake-api-token';
  const mockProjectId = 'project-uuid-for-job';

  beforeEach(() => {
    jest.clearAllMocks();
    jobProgressService = new JobProgressService(mockApiUrl, mockToken);
  });

  describe('getJob', () => {
    const jobId = 'test-job-id';
    const mockJob: Job = {
      id: jobId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: JobStatus.completed,
      job_name: JobName.log_stream_scorer,
      project_id: mockProjectId,
      run_id: 'test-run-id',
      request_data: {},
      progress_percent: 100,
      retries: 0
    };

    it('should call makeRequest with correct parameters and return its result', async () => {
      mockMakeRequest.mockResolvedValue(mockJob);

      const result = await jobProgressService.getJob(jobId);

      expect(mockMakeRequest).toHaveBeenCalledTimes(1);
      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.GET,
        Routes.job,
        undefined,
        { job_id: jobId }
      );
      expect(result).toEqual(mockJob);
    });

    it('should throw an error if job cannot be retrieved', async () => {
      mockMakeRequest.mockResolvedValue(null);

      await expect(jobProgressService.getJob(jobId)).rejects.toThrow(
        `Failed to get job status for job ${jobId}`
      );
    });

    it('should throw an error if job response is missing id', async () => {
      mockMakeRequest.mockResolvedValue({} as Job);

      await expect(jobProgressService.getJob(jobId)).rejects.toThrow(
        `Failed to get job status for job ${jobId}`
      );
    });

    it('should propagate errors from makeRequest', async () => {
      const apiError = new Error('Network Error');
      mockMakeRequest.mockRejectedValue(apiError);

      await expect(jobProgressService.getJob(jobId)).rejects.toThrow(apiError);
      expect(mockMakeRequest).toHaveBeenCalledTimes(1);
    });
  });

  describe('getRunScorerJobs', () => {
    const runId = 'test-run-id';
    const mockJobs: Job[] = [
      {
        id: 'test-job-id-1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: JobStatus.completed,
        job_name: JobName.log_stream_scorer,
        project_id: mockProjectId,
        run_id: runId,
        request_data: {},
        progress_percent: 100,
        retries: 0
      },
      {
        id: 'test-job-id-2',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: JobStatus.processing,
        job_name: JobName.log_stream_scorer,
        project_id: mockProjectId,
        run_id: runId,
        request_data: {},
        progress_percent: 50,
        retries: 0
      },
      {
        id: 'test-job-id-3',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: JobStatus.completed,
        job_name: JobName.playground_run,
        project_id: mockProjectId,
        run_id: runId,
        request_data: {},
        progress_percent: 100,
        retries: 0
      }
    ];

    it('should call makeRequest with correct parameters and filter to scorer jobs', async () => {
      mockMakeRequest.mockResolvedValue(mockJobs);

      const result = await jobProgressService.getRunScorerJobs(
        mockProjectId,
        runId
      );

      expect(mockMakeRequest).toHaveBeenCalledTimes(1);
      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.GET,
        Routes.jobsForProjectRun,
        undefined,
        { project_id: mockProjectId, run_id: runId }
      );
      // Should only return log_stream_scorer jobs
      expect(result).toHaveLength(2);
      expect(
        result.every((job) => job.job_name === JobName.log_stream_scorer)
      ).toBe(true);
    });

    it('should throw an error if jobs cannot be retrieved', async () => {
      mockMakeRequest.mockResolvedValue(null);

      await expect(
        jobProgressService.getRunScorerJobs(mockProjectId, runId)
      ).rejects.toThrow(
        `Failed to get scorer jobs for project ${mockProjectId}, run ${runId}`
      );
    });

    it('should return empty array if no scorer jobs exist', async () => {
      const nonScorerJobs: Job[] = [
        {
          id: 'test-job-id-1',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          status: JobStatus.completed,
          job_name: JobName.playground_run,
          project_id: mockProjectId,
          run_id: runId,
          request_data: {},
          progress_percent: 100,
          retries: 0
        }
      ];
      mockMakeRequest.mockResolvedValue(nonScorerJobs);

      const result = await jobProgressService.getRunScorerJobs(
        mockProjectId,
        runId
      );

      expect(result).toEqual([]);
    });
  });

  describe('getLatestJobForProjectRun', () => {
    const runId = 'test-run-id';
    const mockJob: Job = {
      id: 'latest-job-id',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: JobStatus.completed,
      job_name: JobName.playground_run,
      project_id: mockProjectId,
      run_id: runId,
      request_data: {},
      progress_percent: 100,
      retries: 0
    };

    it('should call makeRequest with correct parameters and return latest job', async () => {
      mockMakeRequest.mockResolvedValue(mockJob);

      const result = await jobProgressService.getLatestJobForProjectRun(
        mockProjectId,
        runId
      );

      expect(mockMakeRequest).toHaveBeenCalledTimes(1);
      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.GET,
        Routes.jobsLatestForProjectRun,
        undefined,
        { project_id: mockProjectId, run_id: runId }
      );
      expect(result).toEqual(mockJob);
    });

    it('should return null if no latest job found', async () => {
      mockMakeRequest.mockResolvedValue(null);

      const result = await jobProgressService.getLatestJobForProjectRun(
        mockProjectId,
        runId
      );

      expect(result).toBeNull();
    });

    it('should propagate errors from makeRequest', async () => {
      const apiError = new Error('Network Error');
      mockMakeRequest.mockRejectedValue(apiError);

      await expect(
        jobProgressService.getLatestJobForProjectRun(mockProjectId, runId)
      ).rejects.toThrow(apiError);
      expect(mockMakeRequest).toHaveBeenCalledTimes(1);
    });
  });
});
