import cliProgress from 'cli-progress';
import { GalileoApiClient } from '../api-client';
import { JobDbType, JobStatus, RequestData, Scorers } from '../types/job.types';
import { getSdkLogger, type GalileoSdkLogger } from 'galileo-generated';

export interface JobProgressLogger extends Partial<
  Pick<GalileoSdkLogger, 'info' | 'debug'>
> {}

export interface PollJobOptions {
  timeout?: number;
  initialBackoff?: number;
  maxBackoff?: number;
  onProgress?: (job: JobDbType) => void;
  signal?: AbortSignal;
  showProgressBar?: boolean;
  logger?: JobProgressLogger;
}

const normalizeScorerName = (scorerName: string): string => {
  const canonicalKey = Object.keys(Scorers).find(
    (key) => Scorers[key as keyof typeof Scorers] === scorerName
  );

  return canonicalKey ?? scorerName;
};

const isJobIncomplete = (status: JobStatus | string): boolean => {
  const statusEnum =
    typeof status === 'string' ? (status as JobStatus) : status;
  return [JobStatus.pending, JobStatus.processing].includes(statusEnum);
};

const isJobFailed = (status: JobStatus | string): boolean => {
  const statusEnum =
    typeof status === 'string' ? (status as JobStatus) : status;
  return [JobStatus.failed, JobStatus.cancelled].includes(statusEnum);
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Creates a progress bar for CLI display.
 * @param total Total steps.
 * @param startValue Starting value.
 * @param message Progress message.
 * @returns Progress bar instance.
 */
const createProgressBar = (
  total: number,
  startValue: number,
  message: string
): cliProgress.SingleBar => {
  const bar = new cliProgress.SingleBar(
    {
      format: '{message} {bar} {percentage}% | {value}/{total}',
      hideCursor: true
    },
    cliProgress.Presets.shades_classic
  );
  bar.start(total, startValue, { message: message || 'Processing...' });
  return bar;
};

/**
 * Generates a random backoff value between min and max.
 * @param min Minimum backoff in milliseconds.
 * @param max Maximum backoff in milliseconds.
 * @returns Random backoff value in milliseconds.
 */
const getRandomBackoff = (min: number, max: number): number => {
  return Math.random() * (max - min) + min;
};

/**
 * Extracts scorer name from job request data.
 * @param requestData The job request data.
 * @returns The scorer name if found, undefined otherwise.
 */
const extractScorerName = (
  requestData: RequestData | Record<string, unknown>
): string | undefined => {
  const data = requestData as RequestData;
  if (data?.prompt_scorer_settings?.scorer_name) {
    return data.prompt_scorer_settings.scorer_name;
  }
  if (data?.scorer_config?.name) {
    return data.scorer_config.name;
  }
  return undefined;
};

/**
 * Gets and logs the status of all scorer jobs for a given project and run.
 * @param service The JobProgressService instance.
 * @param projectId The unique identifier of the project.
 * @param runId The unique identifier of the run.
 * @param logger Optional logger interface (defaults to console).
 */
export async function logScorerJobsStatus(
  projectId: string,
  runId: string,
  logger: JobProgressLogger = {}
): Promise<void> {
  const {
    info = getSdkLogger().info.bind(getSdkLogger()),
    debug = getSdkLogger().debug.bind(getSdkLogger())
  } = logger;
  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectId, runId });

  const scorerJobs = await apiClient.getRunScorerJobs(projectId, runId);

  for (const job of scorerJobs) {
    const scorerName = extractScorerName(job.requestData || {});

    if (!scorerName) {
      debug(`Scorer job ${job.id} has no scorer name.`);
      continue;
    }

    const canonicalScorerName = normalizeScorerName(scorerName);
    const cleanName = canonicalScorerName.replace(/^_+/, '');

    debug(`Scorer job ${job.id} has scorer ${canonicalScorerName}.`);

    if (isJobIncomplete(job.status)) {
      info(`${cleanName}: Computing 🚧`);
    } else if (isJobFailed(job.status)) {
      info(
        `${cleanName}: Failed ❌, error was: ${job.errorMessage || 'Unknown error'}`
      );
    } else {
      info(`${cleanName}: Done ✅`);
    }
  }
}

/**
 * Monitors job progress with progress bar and logs scorer jobs status after completion.
 * This function polls a job until completion and then reports on scorer job statuses.
 * @param jobId The unique identifier of the job to monitor.
 * @param projectId The unique identifier of the project.
 * @param runId The unique identifier of the run.
 * @param options Polling options.
 * @returns The unique identifier of the completed job.
 */
export async function getJobProgress(
  jobId: string,
  projectId: string,
  runId: string,
  options: PollJobOptions = {}
): Promise<string> {
  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectId, runId });

  const {
    timeout,
    initialBackoff = 0,
    maxBackoff = 5000,
    onProgress,
    signal,
    showProgressBar = true
  } = options;

  const startTime = Date.now();
  let job = await apiClient.getJob(jobId);
  let backoff = getRandomBackoff(initialBackoff, Math.min(maxBackoff, 1000));
  let progressBar: cliProgress.SingleBar | null = null;

  // Check timeout
  if (timeout && Date.now() - startTime > timeout) {
    throw new Error(`Job polling timed out after ${timeout}ms`);
  }

  // Check cancellation
  if (signal?.aborted) {
    throw new Error('Job polling was cancelled');
  }

  // Initialize progress bar if requested
  if (showProgressBar && isJobIncomplete(job.status)) {
    const completed = job.stepsCompleted || 0;
    progressBar = createProgressBar(
      job.stepsTotal || 100,
      completed,
      job.progressMessage || 'Processing...'
    );
  }

  // Poll while job is incomplete
  while (isJobIncomplete(job.status)) {
    // Check timeout
    if (timeout && Date.now() - startTime > timeout) {
      if (progressBar) {
        progressBar.stop();
      }
      throw new Error(`Job polling timed out after ${timeout}ms`);
    }

    // Check cancellation
    if (signal?.aborted) {
      if (progressBar) {
        progressBar.stop();
      }
      throw new Error('Job polling was cancelled');
    }

    // Wait with backoff
    await sleep(backoff);

    // Fetch updated job status
    job = await apiClient.getJob(jobId);

    // Update progress bar
    if (progressBar) {
      progressBar.update(job.stepsCompleted || 0, {
        message: job.progressMessage || 'Processing...'
      });
    }

    // Call progress callback
    if (onProgress) {
      onProgress(job);
    }

    // Generate new random backoff
    backoff = getRandomBackoff(initialBackoff, maxBackoff);
  }

  // Stop progress bar
  if (progressBar) {
    progressBar.stop();
  }

  // Call progress callback with final job state
  // This ensures the callback is called at least once, even if the job completed immediately
  // or if the while loop never executed
  if (onProgress) {
    onProgress(job);
  }

  // Check for failure
  if (isJobFailed(job.status)) {
    throw new Error(
      `Job failed with error message: ${job.errorMessage || 'Unknown error'}`
    );
  }

  // Log debug message
  const {
    debug = getSdkLogger().debug.bind(getSdkLogger()),
    info = getSdkLogger().info.bind(getSdkLogger())
  } = options.logger || {};
  debug(`Job ${jobId} status: ${job.status}.`);

  // Log scorer jobs status
  info(
    'Initial job complete, executing scorers asynchronously. Current status as follows:'
  );
  await logScorerJobsStatus(projectId, runId, { info, debug });

  return job.id;
}

/**
 * Gets a single job by its ID.
 * @param jobId The unique identifier of the job.
 * @returns The job object.
 */
export async function getJob(jobId: string): Promise<JobDbType> {
  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectScoped: false });
  return apiClient.getJob(jobId);
}

/**
 * Gets all scorer jobs for a project run.
 * @param projectId The unique identifier of the project.
 * @param runId The unique identifier of the run.
 * @returns Array of scorer jobs.
 */
export async function getRunScorerJobs(
  projectId: string,
  runId: string
): Promise<JobDbType[]> {
  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectId, runId });
  return apiClient.getRunScorerJobs(projectId, runId);
}

/**
 * Gets the status of all scorer jobs for a given project and run.
 * Legacy function matching Python scorer_jobs_status() behavior.
 * @param projectId The ID of the project.
 * @param runId The ID of the run.
 */
export const getScorerJobsStatus = async (
  projectId: string,
  runId: string
): Promise<void> => {
  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectId, runId });

  const scorerJobs = await apiClient.getJobsForProjectRun(projectId, runId);

  for (const job of scorerJobs) {
    const requestData = job.requestData as RequestData;
    let scorerName: string | undefined;

    if (requestData?.prompt_scorer_settings?.scorer_name) {
      scorerName = requestData.prompt_scorer_settings.scorer_name;
    } else if (requestData?.scorer_config?.name) {
      scorerName = requestData.scorer_config.name;
    }

    if (!scorerName) {
      getSdkLogger().debug(`Scorer job ${job.id} has no scorer name.`);
      continue;
    }

    const canonicalScorerName = normalizeScorerName(scorerName);
    const cleanName = canonicalScorerName.replace(/^_+/, '');

    if (isJobIncomplete(job.status)) {
      getSdkLogger().info(`${cleanName}: Computing 🚧`);
    } else if (isJobFailed(job.status)) {
      getSdkLogger().info(
        `${cleanName}: Failed ❌, error was: ${job.errorMessage}`
      );
    } else {
      getSdkLogger().info(`${cleanName}: Done ✅`);
    }
  }
};

/**
 * Gets all scorer jobs for a given project and run.
 * Legacy function for backward compatibility.
 * @param projectId The ID of the project.
 * @param runId The ID of the run.
 * @returns Array of scorer jobs.
 */
export const getScorerJobs = async (
  projectId: string,
  runId: string
): Promise<JobDbType[]> => {
  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectId, runId });
  return apiClient.getJobsForProjectRun(projectId, runId);
};
