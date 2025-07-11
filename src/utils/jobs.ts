import { GalileoApiClient } from '../api-client';
import {
  Job,
  JobStatus,
  isJobIncomplete,
  isJobFailed,
  RequestData
} from '../types/job.types';

const apiClient = new GalileoApiClient();

export const getJobProgress = async (
  jobId: string,
  projectName: string,
  runId: string
): Promise<Job> => {
  await apiClient.init({ projectName, runId });
  let job = await apiClient.getJob(jobId);
  if (isJobIncomplete(job.status as JobStatus)) {
    // This is where the progress bar logic would go.
    // Since we don't have a progress bar library, we'll just poll.
    while (isJobIncomplete(job.status as JobStatus)) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * Math.random()));
      job = await apiClient.getJob(jobId);
    }
  }

  if (isJobFailed(job.status as JobStatus)) {
    throw new Error(`Job failed with error message ${job.error_message}.`);
  }

  console.log(
    'Initial job complete, executing scorers asynchronously. Current status:'
  );
  await getScorerJobsStatus(projectName, runId);
  return job;
};

export const getScorerJobsStatus = async (
  projectName: string,
  runId: string,
  status?: string
): Promise<Job[]> => {
  await apiClient.init({ projectName, runId });
  const scorerJobs = await apiClient.getJobsForProjectRun(runId, status);
  for (const job of scorerJobs) {
    const scorerName =
      (job.request_data as RequestData)?.prompt_scorer_settings?.scorer_name ||
      'Unknown Scorer';
    if (isJobIncomplete(job.status as JobStatus)) {
      console.log(`${scorerName.replace(/^_+/, '')}: Computing 🚧`);
    } else if (isJobFailed(job.status as JobStatus)) {
      console.log(
        `${scorerName.replace(/^_+/, '')}: Failed ❌, error was: ${
          job.error_message
        }`
      );
    } else {
      console.log(`${scorerName.replace(/^_+/, '')}: Done ✅`);
    }
  }
  return scorerJobs;
};