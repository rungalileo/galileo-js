import cliProgress from 'cli-progress';
import { GalileoApiClient } from '../api-client';
import {
  JobStatus,
  isJobIncomplete,
  isJobFailed,
  RequestData
} from '../types/job.types';

const apiClient = new GalileoApiClient();

/** Promise-based sleep (ms). */
export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Create a CLI progress bar (tqdm-style). */
export const createProgressBar = (
  total: number,
  startValue: number,
  message: string
) => {
  const bar = new cliProgress.SingleBar(
    {
      format: '{message} {bar} {percentage}% | {value}/{total}',
      hideCursor: true
    },
    cliProgress.Presets.shades_classic
  );
  bar.start(total, startValue, { message });
  return bar;
};

/**
 * Monitors the progress of a job and displays a progress bar.
 * @param jobId The ID of the job to monitor.
 * @param projectName The name of the project.
 * @param runId The ID of the run.
 * @returns A promise that resolves to the job ID when the job is complete.
 */
export const getJobProgress = async (
  jobId: string,
  projectName: string,
  runId: string
): Promise<string> => {
  await apiClient.init({ projectName, runId });

  let job = await apiClient.getJob(jobId);
  let backoff = Math.random(); // random 0-1 s

  const totalSteps = job.steps_total ?? 0;
  const bar =
    totalSteps > 0 && isJobIncomplete(job.status as JobStatus)
      ? createProgressBar(totalSteps, job.steps_completed, job.progress_message)
      : null;

  while (isJobIncomplete(job.status as JobStatus)) {
    await sleep(backoff * 1000);
    job = await apiClient.getJob(jobId);

    if (bar) {
      bar.update(job.steps_completed, { message: job.progress_message });
    }

    backoff = Math.random(); // new random back-off
  }

  bar?.stop();

  if (isJobFailed(job.status as JobStatus)) {
    throw new Error(`Job failed with error message ${job.error_message}.`);
  }

  console.log(
    'Initial job complete, executing scorers asynchronously. Current status:'
  );
  console.debug(`Job ${jobId} status: ${job.status}.`);

  await getScorerJobsStatus(projectName, runId);
  return job.id;
};

const SCORER_ALIASES: Record<string, string> = {
  completeness_nli: 'completeness_luna',
  completeness_gpt: 'completeness_plus',
  adherence_nli: 'context_adherence_luna',
  groundedness: 'context_adherence_plus',
  context_relevance: 'context_relevance',
  factuality: 'correctness',
  chunk_attribution_utilization_nli: 'chunk_attribution_utilization_luna',
  chunk_attribution_utilization_gpt: 'chunk_attribution_utilization_plus',
  pii: 'pii',
  prompt_injection: 'prompt_injection',
  prompt_injection_gpt: 'prompt_injection_plus',
  prompt_perplexity: 'prompt_perplexity',
  input_sexist: 'input_sexist',
  input_sexist_gpt: 'input_sexist_plus',
  sexist: 'sexist',
  sexist_gpt: 'sexist_plus',
  tone: 'tone',
  input_toxicity: 'input_toxicity',
  input_toxicity_gpt: 'input_toxicity_plus',
  toxicity: 'toxicity',
  toxicity_gpt: 'toxicity_plus',
  instruction_adherence: 'instruction_adherence_plus',
  ground_truth_adherence: 'ground_truth_adherence_plus',
  tool_error_rate: 'tool_errors_plus',
  tool_selection_quality: 'tool_selection_quality',
  agentic_workflow_success: 'action_advancement_plus',
  agentic_session_success: 'action_completion_plus'
};

const getCanonicalScorerName = (name: string) => SCORER_ALIASES[name] ?? name;

/**
 * Gets the status of all scorer jobs for a given project and run.
 * @param projectName The name of the project.
 * @param runId The ID of the run.
 * @param status Optional status to filter jobs by.
 */
export const getScorerJobsStatus = async (
  projectName: string,
  runId: string,
  status?: string
): Promise<void> => {
  await apiClient.init({ projectName, runId });

  const jobs = await apiClient.getJobsForProjectRun(runId, status);
  const scorerJobs = jobs.filter((job) => job.job_name === 'log_stream_scorer');

  for (const job of scorerJobs) {
    const scorerSettings = (job.request_data as RequestData)
      ?.prompt_scorer_settings;

    let scorerName = 'scorer';

    if (scorerSettings) {
      scorerName = getCanonicalScorerName(scorerSettings.scorer_name);
    }

    const cleanName = scorerName.replace(/^_+/, '');
    if (isJobIncomplete(job.status as JobStatus)) {
      console.log(`${cleanName}: Computing 🚧`);
    } else if (isJobFailed(job.status as JobStatus)) {
      console.log(`${cleanName}: Failed ❌, error was: ${job.error_message}`);
    } else {
      console.log(`${cleanName}: Done ✅`);
    }
  }
};

export const getScorerJobs = async (
  projectName: string,
  runId: string,
  status?: string
) => {
  await apiClient.init({ projectName, runId });
  return apiClient.getJobsForProjectRun(runId, status);
};
