import { BaseClient, RequestMethod } from '../base-client';
import { Routes } from '../../types/routes.types';
import { Job, JobName } from '../../types/job.types';

/**
 * Service for job progress tracking and monitoring.
 * Provides standardized interfaces for job status queries and progress events.
 */
export class JobProgressService extends BaseClient {
  constructor(apiUrl: string, token: string) {
    super();
    this.apiUrl = apiUrl;
    this.token = token;
    this.initializeClient();
  }

  /**
   * Retrieves a job by its ID.
   * @param jobId The unique identifier of the job.
   * @returns The job object with current status and progress information.
   * @throws Error if the job cannot be retrieved.
   */
  public async getJob(jobId: string): Promise<Job> {
    const response = await this.makeRequest<Job>(
      RequestMethod.GET,
      Routes.job,
      undefined,
      {
        job_id: jobId
      }
    );

    if (!response || !response.id) {
      throw new Error(`Failed to get job status for job ${jobId}`);
    }

    return response;
  }

  /**
   * Retrieves all scorer jobs for a specific project run.
   * Filters to only return jobs with job_name === 'log_stream_scorer'.
   * @param projectId The unique identifier of the project.
   * @param runId The unique identifier of the run.
   * @returns Array of scorer jobs for the run.
   * @throws Error if the jobs cannot be retrieved.
   */
  public async getRunScorerJobs(
    projectId: string,
    runId: string
  ): Promise<Job[]> {
    const response = await this.makeRequest<Job[]>(
      RequestMethod.GET,
      Routes.jobsForProjectRun,
      undefined,
      {
        project_id: projectId,
        run_id: runId
      }
    );

    if (!response) {
      throw new Error(
        `Failed to get scorer jobs for project ${projectId}, run ${runId}`
      );
    }

    // Filter to only return log_stream_scorer jobs
    return response.filter((job) => job.job_name === JobName.log_stream_scorer);
  }

  /**
   * Retrieves the latest job for a specific project and run.
   * @param projectId The unique identifier of the project.
   * @param runId The unique identifier of the run.
   * @returns The latest job for the project and run, or null if not found.
   * @throws Error if the job cannot be retrieved.
   */
  public async getLatestJobForProjectRun(
    projectId: string,
    runId: string
  ): Promise<Job | null> {
    const response = await this.makeRequest<Job | null>(
      RequestMethod.GET,
      Routes.jobsLatestForProjectRun,
      undefined,
      {
        project_id: projectId,
        run_id: runId
      }
    );

    return response;
  }
}
