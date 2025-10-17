import { Job, JobStatus } from '../../src/types';

const projectId = 'test-project-id';
const runId = 'test-run-id';
const jobId = 'test-job-id';

const mockJob: Job = {
  id: jobId,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  status: JobStatus.completed,
  job_name: 'log_stream_scorer',
  project_id: projectId,
  run_id: runId,
  request_data: {},
  progress_percent: 100,
  retries: 0
};

// Create mock implementation functions
const mockInit = jest.fn().mockResolvedValue(undefined);
const mockGetJob = jest.fn();
const mockGetJobsForProjectRun = jest.fn();

jest.mock('../../src/api-client', () => {
  return {
    GalileoApiClient: jest.fn().mockImplementation(() => {
      return {
        init: mockInit,
        getJob: mockGetJob,
        getJobsForProjectRun: mockGetJobsForProjectRun
      };
    })
  };
});

// Import the functions after mocking
import { getJobProgress, getScorerJobsStatus } from '../../src/utils/jobs';

describe('Job Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set up default mock implementations
    mockGetJob.mockResolvedValue(mockJob);
    mockGetJobsForProjectRun.mockResolvedValue([]);
  });

  describe('getJobProgress', () => {
    it('should return the job when it is completed on the first try', async () => {
      const resultJobId = await getJobProgress(jobId, 'test-project', runId);

      expect(resultJobId).toEqual(jobId);
      expect(mockGetJob).toHaveBeenCalledTimes(1);
    });

    it('should throw an error if the job fails', async () => {
      const failedJob = {
        ...mockJob,
        status: JobStatus.failed,
        error_message: 'Test error'
      };
      mockGetJob.mockResolvedValue(failedJob);

      await expect(
        getJobProgress(jobId, 'test-project', runId)
      ).rejects.toThrow('Job failed with error message Test error.');

      expect(mockGetJob).toHaveBeenCalledTimes(1);
    });

    it('should poll until the job is completed', async () => {
      const pendingJob = { ...mockJob, status: JobStatus.pending };
      const processingJob = { ...mockJob, status: JobStatus.processing };

      mockGetJob
        .mockResolvedValueOnce(pendingJob)
        .mockResolvedValueOnce(processingJob)
        .mockResolvedValueOnce(mockJob);

      const resultJobId = await getJobProgress(jobId, 'test-project', runId);

      expect(resultJobId).toEqual(jobId);
      expect(mockGetJob).toHaveBeenCalledTimes(3);
    });
  });

  describe('getScorerJobsStatus', () => {
    it('should log the correct status and handle aliased and unknown scorers', async () => {
      const consoleSpy = jest
        .spyOn(console, 'log')
        .mockImplementation(() => {});
      const consoleDebugSpy = jest
        .spyOn(console, 'debug')
        .mockImplementation(() => {});

      const mockJobs: Job[] = [
        // Test case 1: A completed job with an aliased scorer name
        {
          ...mockJob,
          id: 'job-1',
          status: JobStatus.completed,
          request_data: {
            prompt_scorer_settings: { scorer_name: 'completeness_gpt' }
          }
        },
        // Test case 2: A pending job with a non-aliased scorer name
        {
          ...mockJob,
          id: 'job-2',
          status: JobStatus.pending,
          request_data: {
            prompt_scorer_settings: { scorer_name: 'a_new_scorer' }
          }
        },
        // Test case 3: A failed job
        {
          ...mockJob,
          id: 'job-3',
          status: JobStatus.failed,
          error_message: 'Something went wrong.',
          request_data: {
            prompt_scorer_settings: { scorer_name: 'factuality' }
          }
        },
        // Test case 4: A job with no scorer settings, which should be skipped
        {
          ...mockJob,
          id: 'job-4',
          status: JobStatus.completed,
          request_data: {}
        },
        // Test case 5: A job with scorer_config
        {
          ...mockJob,
          id: 'job-5',
          status: JobStatus.completed,
          request_data: {
            scorer_config: { name: 'my_custom_scorer' }
          }
        }
      ];

      mockGetJobsForProjectRun.mockResolvedValue(mockJobs);

      await getScorerJobsStatus('test-project', runId);

      expect(mockGetJobsForProjectRun).toHaveBeenCalledTimes(1);

      // Verify the console output
      expect(consoleSpy).toHaveBeenCalledWith('completeness_plus: Done ✅');
      expect(consoleSpy).toHaveBeenCalledWith('a_new_scorer: Computing 🚧');
      expect(consoleSpy).toHaveBeenCalledWith(
        'correctness: Failed ❌, error was: Something went wrong.'
      );
      expect(consoleSpy).toHaveBeenCalledWith('my_custom_scorer: Done ✅');

      // Verify that the job with no scorer settings was skipped
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('job-4')
      );
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        'Scorer job job-4 has no scorer name.'
      );

      consoleSpy.mockRestore();
      consoleDebugSpy.mockRestore();
    });
  });
});
