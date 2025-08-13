import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { getJobProgress, getScorerJobsStatus } from '../../src/utils/jobs';
import { Job, JobStatus } from '../../src/types';
import { TEST_HOST } from '../common';

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

const getJobHandler = jest.fn();
const getJobsForProjectRunHandler = jest.fn();
const getProjectByNameHandler = jest.fn();

import { commonHandlers } from '../common';

export const handlers = [
  ...commonHandlers,
  http.get(`${TEST_HOST}/jobs/:jobId`, getJobHandler),
  http.get(
    `${TEST_HOST}/projects/${projectId}/runs/${runId}/jobs`,
    getJobsForProjectRunHandler
  ),
  http.get(`${TEST_HOST}/projects`, getProjectByNameHandler),
  http.get(`${TEST_HOST}/projects/${projectId}/log_streams`, () => {
    return HttpResponse.json([]);
  }),
  http.post(`${TEST_HOST}/projects/${projectId}/log_streams`, () => {
    return HttpResponse.json({ id: 'test-log-stream-id', name: 'default' });
  })
];

const server = setupServer(...handlers);

describe('Job Utils', () => {
  beforeAll(() => {
    process.env.GALILEO_CONSOLE_URL = TEST_HOST;
    server.listen();
    process.env.GALILEO_API_KEY = 'test-token';
  });

  beforeEach(() => {
    getProjectByNameHandler.mockImplementation(() => {
      return HttpResponse.json([
        {
          id: projectId,
          name: 'test-project'
        }
      ]);
    });
  });

  afterEach(() => {
    server.resetHandlers();
    getJobHandler.mockClear();
    getJobsForProjectRunHandler.mockClear();
    getProjectByNameHandler.mockClear();
  });

  afterAll(() => {
    server.close();
  });

  describe('getJobProgress', () => {
    beforeEach(() => {
      // This is called internally by getJobProgress after the primary job completes
      getJobsForProjectRunHandler.mockImplementation(() => {
        return HttpResponse.json([]);
      });
    });

    it('should return the job when it is completed on the first try', async () => {
      getJobHandler.mockImplementation(() => {
        return HttpResponse.json(mockJob);
      });

      const resultJobId = await getJobProgress(jobId, 'test-project', runId);

      expect(resultJobId).toEqual(jobId);
      expect(getJobHandler).toHaveBeenCalledTimes(1);
    });

    it('should throw an error if the job fails', async () => {
      const failedJob = {
        ...mockJob,
        status: JobStatus.failed,
        error_message: 'Test error'
      };
      getJobHandler.mockImplementation(() => {
        return HttpResponse.json(failedJob);
      });

      await expect(
        getJobProgress(jobId, 'test-project', runId)
      ).rejects.toThrow('Job failed with error message Test error.');

      expect(getJobHandler).toHaveBeenCalledTimes(1);
    });

    it('should poll until the job is completed', async () => {
      const pendingJob = { ...mockJob, status: JobStatus.pending };
      const processingJob = { ...mockJob, status: JobStatus.processing };

      getJobHandler
        .mockImplementationOnce(() => {
          return HttpResponse.json(pendingJob);
        })
        .mockImplementationOnce(() => {
          return HttpResponse.json(processingJob);
        })
        .mockImplementationOnce(() => {
          return HttpResponse.json(mockJob);
        });

      const resultJobId = await getJobProgress(jobId, 'test-project', runId);

      expect(resultJobId).toEqual(jobId);
      expect(getJobHandler).toHaveBeenCalledTimes(3);
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

      getJobsForProjectRunHandler.mockImplementation(() => {
        return HttpResponse.json(mockJobs);
      });

      await getScorerJobsStatus('test-project', runId);

      expect(getJobsForProjectRunHandler).toHaveBeenCalledTimes(1);

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
