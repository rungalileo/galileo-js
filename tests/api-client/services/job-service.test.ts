import { JobService } from '../../../src/api-client/services/job-service';
import { BaseClient, RequestMethod } from '../../../src/api-client/base-client';
import { Routes } from '../../../src/types/routes.types';
import { Job, JobStatus } from '../../../src/types';

const mockMakeRequest = jest
  .spyOn(BaseClient.prototype, 'makeRequest')
  .mockImplementation();

describe('JobService', () => {
  let jobService: JobService;
  const mockApiUrl = 'http://fake.api/v2';
  const mockToken = 'fake-api-token';
  const mockProjectId = 'project-uuid-for-job';

  beforeEach(() => {
    jest.clearAllMocks();
    jobService = new JobService(mockApiUrl, mockToken, mockProjectId);
  });

  describe('getJob', () => {
    const jobId = 'test-job-id';
    const mockJob: Job = {
      id: jobId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: JobStatus.completed,
      job_name: 'test-job',
      project_id: mockProjectId,
      run_id: 'test-run-id',
      request_data: {},
      progress_percent: 100,
      retries: 0,
    };

    it('should call makeRequest with correct parameters and return its result', async () => {
      mockMakeRequest.mockResolvedValue(mockJob);

      const result = await jobService.getJob(jobId);

      expect(mockMakeRequest).toHaveBeenCalledTimes(1);
      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.GET,
        Routes.job,
        undefined,
        { job_id: jobId }
      );
      expect(result).toEqual(mockJob);
    });

    it('should propagate errors from makeRequest', async () => {
      const apiError = new Error('Network Error');
      mockMakeRequest.mockRejectedValue(apiError);

      await expect(jobService.getJob(jobId)).rejects.toThrow(apiError);
      expect(mockMakeRequest).toHaveBeenCalledTimes(1);
    });
  });

  describe('getJobsForProjectRun', () => {
    const runId = 'test-run-id';
    const mockJobs: Job[] = [
      {
        id: 'test-job-id-1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: JobStatus.completed,
        job_name: 'test-job-1',
        project_id: mockProjectId,
        run_id: runId,
        request_data: {},
        progress_percent: 100,
        retries: 0,
      },
    ];

    it('should call makeRequest with correct parameters and return its result', async () => {
      mockMakeRequest.mockResolvedValue(mockJobs);

      const result = await jobService.getJobsForProjectRun(runId);

      expect(mockMakeRequest).toHaveBeenCalledTimes(1);
      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.GET,
        Routes.jobsForProjectRun,
        undefined,
        { project_id: mockProjectId, run_id: runId },
        undefined
      );
      expect(result).toEqual(mockJobs);
    });

    it('should throw an error if project is not initialized', async () => {
      jobService = new JobService(mockApiUrl, mockToken, '');
      await expect(jobService.getJobsForProjectRun(runId)).rejects.toThrow(
        'Project not initialized'
      );
    });
  });
});