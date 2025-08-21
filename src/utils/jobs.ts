import cliProgress from 'cli-progress';
import { GalileoApiClient } from '../api-client';
import {
  JobStatus,
  isJobIncomplete,
  isJobFailed,
  RequestData
} from '../types/job.types';

const apiClient = new GalileoApiClient();

export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

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
  let backoff = Math.random();

  if (isJobIncomplete(job.status as JobStatus)) {
    const bar = createProgressBar(
      job.steps_total,
      job.steps_completed,
      job.progress_message
    );

    while (isJobIncomplete(job.status as JobStatus)) {
      await sleep(backoff * 1000);
      job = await apiClient.getJob(jobId);
      bar.update(job.steps_completed, { message: job.progress_message });
      backoff = Math.random();
    }
    bar.stop();
  }

  console.debug(`Job ${jobId} status: ${job.status}.`);

  if (isJobFailed(job.status as JobStatus)) {
    throw new Error(`Job failed with error message ${job.error_message}.`);
  }

  console.log(
    'Initial job complete, executing scorers asynchronously. Current status:'
  );

  await getScorerJobsStatus(projectName, runId);
  return job.id;
};

// TODO Get from generated resources
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
 */
export const getScorerJobsStatus = async (
  projectName: string,
  runId: string
): Promise<void> => {
  await apiClient.init({ projectName, runId });

  const scorerJobs = await apiClient.getJobsForProjectRun(runId);

  for (const job of scorerJobs) {
    const requestData = job.request_data as RequestData;
    let scorerName: string | undefined;

    if (requestData?.prompt_scorer_settings?.scorer_name) {
      scorerName = requestData.prompt_scorer_settings.scorer_name;
    } else if (requestData?.scorer_config?.name) {
      scorerName = requestData.scorer_config.name;
    }

    if (!scorerName) {
      console.debug(`Scorer job ${job.id} has no scorer name.`);
      continue;
    }

    const canonicalScorerName = getCanonicalScorerName(scorerName);
    const cleanName = canonicalScorerName.replace(/^_+/, '');

    if (isJobIncomplete(job.status as JobStatus)) {
      console.log(`${cleanName}: Computing 🚧`);
    } else if (isJobFailed(job.status as JobStatus)) {
      console.log(`${cleanName}: Failed ❌, error was: ${job.error_message}`);
    } else {
      console.log(`${cleanName}: Done ✅`);
    }
  }
};

export const getScorerJobs = async (projectName: string, runId: string) => {
  await apiClient.init({ projectName, runId });
  return apiClient.getJobsForProjectRun(runId);
};
