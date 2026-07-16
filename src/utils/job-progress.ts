import cliProgress from 'cli-progress';
import { GalileoApiClient } from '../api-client';

export interface ExperimentProgressOptions {
  pollIntervalMs?: number;
  signal?: AbortSignal;
  showProgressBar?: boolean;
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
  const { pollIntervalMs = 2000, signal, showProgressBar = true } = options;

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

  try {
    let progressPercent = 0;
    while (progressPercent < 100) {
      if (signal?.aborted) {
        throw new Error('Experiment progress monitoring was cancelled');
      }

      const experiment = await apiClient.getExperiment(experimentId);
      progressPercent =
        (experiment.status?.logGeneration?.progressPercent ?? 0) * 100;

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
