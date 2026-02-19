import {
  getJobProgress,
  logScorerJobsStatus,
  getJob,
  getRunScorerJobs,
  getScorerJobsStatus,
  JobProgressLogger
} from '../../src/utils/job-progress';
import {
  JobDbType,
  JobStatus,
  JobName,
  RequestData
} from '../../src/types/job.types';
import { enableLogging, disableLogging } from 'galileo-generated';

// Create mock functions that will be accessible
const mockInit = jest.fn<
  Promise<void>,
  [{ projectId?: string; runId?: string; projectScoped?: boolean }]
>();
const mockGetJob = jest.fn<Promise<JobDbType>, [string]>();
const mockGetRunScorerJobs = jest.fn<Promise<JobDbType[]>, [string, string]>();
const mockGetJobsForProjectRun = jest.fn<
  Promise<JobDbType[]>,
  [string, string]
>();

// Mock GalileoApiClient
jest.mock('../../src/api-client', () => {
  return {
    GalileoApiClient: jest.fn().mockImplementation(() => {
      return {
        init: mockInit,
        getJob: mockGetJob,
        getRunScorerJobs: mockGetRunScorerJobs,
        getJobsForProjectRun: mockGetJobsForProjectRun
      };
    })
  };
});

// Mock cli-progress
jest.mock('cli-progress', () => {
  return {
    SingleBar: jest.fn().mockImplementation(() => {
      return {
        start: jest.fn(),
        update: jest.fn(),
        stop: jest.fn()
      };
    }),
    Presets: {
      shades_classic: {}
    }
  };
});

describe('Job Progress Utilities', () => {
  const projectId = 'test-project-id';
  const runId = 'test-run-id';
  const jobId = 'test-job-id';

  beforeEach(() => {
    jest.clearAllMocks();
    mockInit.mockResolvedValue(undefined);
  });

  const createMockJob = (
    status: JobStatus,
    stepsCompleted = 0,
    stepsTotal = 100,
    progressMessage = 'Processing...',
    errorMessage?: string
  ): JobDbType => ({
    id: jobId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status,
    jobName: JobName.log_stream_scorer,
    projectId: projectId,
    runId: runId,
    requestData: {},
    progressPercent: (stepsCompleted / stepsTotal) * 100,
    stepsCompleted: stepsCompleted,
    stepsTotal: stepsTotal,
    progressMessage: progressMessage,
    errorMessage: errorMessage,
    retries: 0
  });

  describe('getJob', () => {
    it('should get a job by ID', async () => {
      const mockJob = createMockJob(JobStatus.completed);
      mockGetJob.mockResolvedValue(mockJob);

      const result = await getJob(jobId);

      expect(result).toEqual(mockJob);
      expect(mockInit).toHaveBeenCalledWith({ projectScoped: false });
      expect(mockGetJob).toHaveBeenCalledWith(jobId);
    });

    it('should handle errors when getting job', async () => {
      const error = new Error('Job not found');
      mockGetJob.mockRejectedValue(error);

      await expect(getJob(jobId)).rejects.toThrow('Job not found');
    });
  });

  describe('getRunScorerJobs', () => {
    it('should get all scorer jobs for a project run', async () => {
      const mockJobs = [
        createMockJob(JobStatus.completed),
        createMockJob(JobStatus.pending)
      ];
      mockGetRunScorerJobs.mockResolvedValue(mockJobs);

      const result = await getRunScorerJobs(projectId, runId);

      expect(result).toEqual(mockJobs);
      expect(mockInit).toHaveBeenCalledWith({ projectId, runId });
      expect(mockGetRunScorerJobs).toHaveBeenCalledWith(projectId, runId);
    });
  });

  describe('logScorerJobsStatus', () => {
    const createScorerJob = (
      scorerName: string,
      status: JobStatus,
      source:
        | 'prompt_scorer_settings'
        | 'scorer_config' = 'prompt_scorer_settings',
      errorMessage?: string
    ): JobDbType => {
      const requestData: RequestData =
        source === 'prompt_scorer_settings'
          ? { prompt_scorer_settings: { scorer_name: scorerName } }
          : { scorer_config: { name: scorerName } };

      return {
        id: `job-${scorerName}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status,
        jobName: JobName.log_stream_scorer,
        projectId: projectId,
        runId: runId,
        requestData: requestData as Record<string, unknown>,
        progressPercent: status === JobStatus.completed ? 100 : 50,
        errorMessage: errorMessage,
        retries: 0
      };
    };

    it('should log status for all scorer jobs', async () => {
      const jobs = [
        createScorerJob('completeness_nli', JobStatus.completed),
        createScorerJob('correctness', JobStatus.pending),
        createScorerJob(
          'toxicity',
          JobStatus.failed,
          'scorer_config',
          'Test error'
        )
      ];
      mockGetRunScorerJobs.mockResolvedValue(jobs);

      const logger: JobProgressLogger = {
        info: jest.fn(),
        debug: jest.fn()
      };

      await logScorerJobsStatus(projectId, runId, logger);

      expect(logger.info).toHaveBeenCalledWith('completeness_luna: Done ✅');
      expect(logger.info).toHaveBeenCalledWith('correctness: Computing 🚧');
      expect(logger.info).toHaveBeenCalledWith(
        'toxicity: Failed ❌, error was: Test error'
      );
    });

    it('should skip jobs without scorer name', async () => {
      const jobs = [
        createScorerJob('completeness_nli', JobStatus.completed),
        {
          ...createScorerJob('correctness', JobStatus.completed),
          requestData: {}
        }
      ];
      mockGetRunScorerJobs.mockResolvedValue(jobs);

      const logger: JobProgressLogger = {
        info: jest.fn(),
        debug: jest.fn()
      };

      await logScorerJobsStatus(projectId, runId, logger);

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('has no scorer name')
      );
      expect(logger.info).toHaveBeenCalledTimes(1);
    });

    it('should use console by default if no logger provided', async () => {
      const jobs = [createScorerJob('completeness_nli', JobStatus.completed)];
      mockGetRunScorerJobs.mockResolvedValue(jobs);

      enableLogging('info');
      const consoleSpy = {
        info: jest.spyOn(console, 'info').mockImplementation(() => {
          // Mock implementation
        }),
        debug: jest.spyOn(console, 'debug').mockImplementation(() => {
          // Mock implementation
        })
      };

      await logScorerJobsStatus(projectId, runId);

      expect(consoleSpy.info).toHaveBeenCalled();
      consoleSpy.info.mockRestore();
      consoleSpy.debug.mockRestore();
      disableLogging();
    });

    it('should normalize scorer names correctly', async () => {
      const jobs = [createScorerJob('completeness_nli', JobStatus.completed)];
      mockGetRunScorerJobs.mockResolvedValue(jobs);

      const logger: JobProgressLogger = {
        info: jest.fn(),
        debug: jest.fn()
      };

      await logScorerJobsStatus(projectId, runId, logger);

      expect(logger.info).toHaveBeenCalledWith('completeness_luna: Done ✅');
    });
  });

  describe('jobProgress', () => {
    it('should return job ID immediately if job is already completed', async () => {
      const completedJob = createMockJob(JobStatus.completed, 100, 100);
      mockGetJob.mockResolvedValue(completedJob);
      mockGetRunScorerJobs.mockResolvedValue([]);

      const result = await getJobProgress(jobId, projectId, runId, {
        showProgressBar: false
      });

      expect(result).toBe(jobId);
      expect(mockGetJob).toHaveBeenCalledTimes(1);
    });

    it('should poll until job is completed', async () => {
      const pendingJob = createMockJob(JobStatus.pending, 0, 100);
      const processingJob = createMockJob(JobStatus.processing, 50, 100);
      const completedJob = createMockJob(JobStatus.completed, 100, 100);

      mockGetJob
        .mockResolvedValueOnce(pendingJob)
        .mockResolvedValueOnce(processingJob)
        .mockResolvedValueOnce(completedJob);
      mockGetRunScorerJobs.mockResolvedValue([]);

      const result = await getJobProgress(jobId, projectId, runId, {
        showProgressBar: false,
        initialBackoff: 1,
        maxBackoff: 1
      });

      expect(result).toBe(jobId);
      expect(mockGetJob).toHaveBeenCalledTimes(3);
    }, 10000);

    it('should throw error if job fails', async () => {
      const failedJob = createMockJob(
        JobStatus.failed,
        50,
        100,
        'Processing...',
        'Job failed with error'
      );
      mockGetJob.mockResolvedValueOnce(failedJob);
      mockGetRunScorerJobs.mockResolvedValue([]);

      await expect(
        getJobProgress(jobId, projectId, runId, { showProgressBar: false })
      ).rejects.toThrow('Job failed with error message: Job failed with error');
    });

    it('should call onProgress callback during polling', async () => {
      const pendingJob = createMockJob(JobStatus.pending, 0, 100);
      const processingJob = createMockJob(JobStatus.processing, 50, 100);
      const completedJob = createMockJob(JobStatus.completed, 100, 100);
      const onProgress = jest.fn<void, [JobDbType]>();

      mockGetJob
        .mockResolvedValueOnce(pendingJob)
        .mockResolvedValueOnce(processingJob)
        .mockResolvedValueOnce(completedJob);
      mockGetRunScorerJobs.mockResolvedValue([]);

      await getJobProgress(jobId, projectId, runId, {
        onProgress,
        showProgressBar: false,
        initialBackoff: 1,
        maxBackoff: 1
      });

      expect(onProgress).toHaveBeenCalledWith(processingJob);
    }, 10000);

    it('should respect timeout option', async () => {
      const pendingJob = createMockJob(JobStatus.pending, 0, 100);
      mockGetJob.mockResolvedValue(pendingJob);

      const startTime = Date.now();
      let callCount = 0;
      jest.spyOn(Date, 'now').mockImplementation(() => {
        callCount++;
        return startTime + (callCount > 1 ? 2000 : 0);
      });

      const promise = getJobProgress(jobId, projectId, runId, {
        timeout: 1000,
        showProgressBar: false,
        initialBackoff: 1,
        maxBackoff: 1
      });

      await expect(promise).rejects.toThrow(
        'Job polling timed out after 1000ms'
      );

      jest.restoreAllMocks();
    });

    it('should respect AbortSignal cancellation', async () => {
      const pendingJob = createMockJob(JobStatus.pending, 0, 100);
      mockGetJob.mockResolvedValue(pendingJob);

      const abortController = new AbortController();
      abortController.abort();

      await expect(
        getJobProgress(jobId, projectId, runId, {
          signal: abortController.signal,
          showProgressBar: false
        })
      ).rejects.toThrow('Job polling was cancelled');
    });

    it('should use custom logger if provided', async () => {
      const completedJob = createMockJob(JobStatus.completed, 100, 100);
      mockGetJob.mockResolvedValue(completedJob);
      mockGetRunScorerJobs.mockResolvedValue([]);

      const logger: JobProgressLogger = {
        info: jest.fn(),
        debug: jest.fn()
      };

      await getJobProgress(jobId, projectId, runId, {
        logger,
        showProgressBar: false
      });

      expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Job'));
      expect(logger.info).toHaveBeenCalledWith(
        'Initial job complete, executing scorers asynchronously. Current status as follows:'
      );
    });

    it('should not show progress bar when showProgressBar is false', async () => {
      const completedJob = createMockJob(JobStatus.completed, 100, 100);
      mockGetJob.mockResolvedValue(completedJob);
      mockGetRunScorerJobs.mockResolvedValue([]);

      await getJobProgress(jobId, projectId, runId, {
        showProgressBar: false
      });

      expect(mockGetJob).toHaveBeenCalled();
    });

    it('should call logScorerJobsStatus after job completes', async () => {
      const completedJob = createMockJob(JobStatus.completed, 100, 100);
      mockGetJob.mockResolvedValue(completedJob);
      mockGetRunScorerJobs.mockResolvedValue([]);

      const logger: JobProgressLogger = {
        info: jest.fn(),
        debug: jest.fn()
      };

      await getJobProgress(jobId, projectId, runId, {
        logger,
        showProgressBar: false
      });

      expect(mockGetRunScorerJobs).toHaveBeenCalledWith(projectId, runId);
      expect(logger.info).toHaveBeenCalledWith(
        'Initial job complete, executing scorers asynchronously. Current status as follows:'
      );
    });
  });

  describe('getScorerJobsStatus (legacy)', () => {
    it('should log scorer jobs status', async () => {
      const jobs: JobDbType[] = [
        {
          ...createMockJob(JobStatus.completed),
          requestData: {
            prompt_scorer_settings: { scorer_name: 'completeness_nli' }
          } as Record<string, unknown>
        }
      ];
      mockGetJobsForProjectRun.mockResolvedValue(jobs);

      enableLogging('info');
      const consoleSpy = {
        info: jest.spyOn(console, 'info').mockImplementation(() => {
          // Mock implementation
        }),
        debug: jest.spyOn(console, 'debug').mockImplementation(() => {
          // Mock implementation
        })
      };

      await getScorerJobsStatus(projectId, runId);

      expect(consoleSpy.info).toHaveBeenCalled();
      consoleSpy.info.mockRestore();
      consoleSpy.debug.mockRestore();
      disableLogging();
    });
  });
});
