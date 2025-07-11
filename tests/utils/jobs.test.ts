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
  job_name: 'test-job',
  project_id: projectId,
  run_id: runId,
  request_data: {},
  progress_percent: 100,
  retries: 0,
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
  http.get(
    `${TEST_HOST}/projects/${projectId}/log_streams`,
    () => {
      return HttpResponse.json([]);
    }
  ),
  http.post(
    `${TEST_HOST}/projects/${projectId}/log_streams`,
    () => {
      return HttpResponse.json({ id: 'test-log-stream-id', name: 'default' });
    }
  ),
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
          name: 'test-project',
        },
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
      getJobsForProjectRunHandler.mockImplementation(() => {
        return HttpResponse.json([]);
      });
    });
    it('should return the job when it is completed', async () => {
      getJobHandler.mockImplementation(() => {
        return HttpResponse.json(mockJob);
      });

      const job = await getJobProgress(jobId, 'test-project', runId);

      expect(job).toEqual(mockJob);
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

      const job = await getJobProgress(jobId, 'test-project', runId);

      expect(job).toEqual(mockJob);
      expect(getJobHandler).toHaveBeenCalledTimes(3);
    });
  });

  describe('getScorerJobsStatus', () => {
    it('should return the jobs for a given run', async () => {
      const mockJobs = [mockJob];
      getJobsForProjectRunHandler.mockImplementation(() => {
        return HttpResponse.json(mockJobs);
      });

      const jobs = await getScorerJobsStatus('test-project', runId);

      expect(jobs).toEqual(mockJobs);
      expect(getJobsForProjectRunHandler).toHaveBeenCalledTimes(1);
    });
  });
});