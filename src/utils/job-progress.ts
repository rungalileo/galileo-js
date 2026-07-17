import cliProgress from 'cli-progress';
import { GalileoApiClient } from '../api-client';

export interface ExperimentProgressOptions {
  pollIntervalMs?: number;
  signal?: AbortSignal;
  showProgressBar?: boolean;
  timeoutMs?: number;
  stalledProgressMaxAttempts?: number;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Monitors the progress of an experiment with a progress bar.
 *
 * Polls the experiment status via the API until log_generation reaches 100%,
 * displaying a cli-progress bar. No jobs-table dependency.
 *
 * @param experimentId The unique identifier of the experiment (run).
 * @param projectId The unique identifier of the project.
 * @param options Polling options.
 */
export async function monitorExperimentProgress(
  experimentId: string,
  projectId: string,
  options: ExperimentProgressOptions = {}
): Promise<void> {
  const {
    pollIntervalMs = 2000,
    signal,
    showProgressBar = true,
    timeoutMs,
    stalledProgressMaxAttempts = 30
  } = options;

  const apiClient = new GalileoApiClient();
  await apiClient.init({ projectId, runId: experimentId });

  let progressBar: cliProgress.SingleBar | null = null;
  if (showProgressBar) {
    progressBar = new cliProgress.SingleBar(
      {
        format: 'Experiment progress {bar} {percentage}%',
        hideCursor: true
      },
      cliProgress.Presets.shades_classic
    );
    progressBar.start(100, 0);
  }

  const startTime = Date.now();
  let lastProgressPercent = -1;
  let stalledAttempts = 0;

  try {
    let progressPercent = 0;
    while (progressPercent < 100) {
      if (signal?.aborted) {
        throw new Error('Experiment progress monitoring was cancelled');
      }

      if (timeoutMs !== undefined && Date.now() - startTime >= timeoutMs) {
        throw new Error(
          `Experiment progress monitoring timed out after ${timeoutMs}ms`
        );
      }

      const experiment = await apiClient.getExperiment(experimentId);
      const rawPercent =
        experiment.status?.logGeneration?.progressPercent ?? null;

      if (rawPercent === null) {
        stalledAttempts++;
        if (stalledAttempts >= stalledProgressMaxAttempts) {
          throw new Error(
            `Experiment progress monitoring stalled: no progress data received after ${stalledProgressMaxAttempts} attempts`
          );
        }
      } else {
        progressPercent = Math.min(100, Math.max(0, rawPercent * 100));

        if (progressPercent === lastProgressPercent) {
          stalledAttempts++;
          if (stalledAttempts >= stalledProgressMaxAttempts) {
            throw new Error(
              `Experiment progress monitoring stalled: progress stuck at ${progressPercent.toFixed(1)}% for ${stalledProgressMaxAttempts} consecutive polls`
            );
          }
        } else {
          stalledAttempts = 0;
          lastProgressPercent = progressPercent;
        }
      }

      if (progressBar) {
        progressBar.update(progressPercent);
      }

      if (progressPercent < 100) {
        await sleep(pollIntervalMs);
      }
    }
  } finally {
    if (progressBar) {
      progressBar.stop();
    }
  }
}
