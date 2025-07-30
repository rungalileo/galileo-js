import { BaseClient, RequestMethod } from '../base-client';
import { Routes } from '../../types/routes.types';
import { Job } from '../../types/job.types';

export class JobService extends BaseClient {
  private projectId?: string;

  constructor(apiUrl: string, token: string, projectId?: string) {
    super();
    this.apiUrl = apiUrl;
    this.token = token;
    this.projectId = projectId;
    this.initializeClient();
  }

  public async getJob(jobId: string): Promise<Job> {
    return await this.makeRequest<Job>(
      RequestMethod.GET,
      Routes.job,
      undefined,
      {
        job_id: jobId
      }
    );
  }

  public async getJobsForProjectRun(
    runId: string,
    status?: string
  ): Promise<Job[]> {
    if (!this.projectId) {
      throw new Error('Project not initialized');
    }
    return await this.makeRequest<Job[]>(
      RequestMethod.GET,
      Routes.jobsForProjectRun,
      undefined,
      {
        project_id: this.projectId,
        run_id: runId
      },
      status ? { status } : undefined
    );
  }
}
