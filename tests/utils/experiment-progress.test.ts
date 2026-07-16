import { monitorExperimentProgress } from '../../src/utils/job-progress';
import type { ExperimentResponseType } from '../../src/types/experiment.types';

const mockInit = jest.fn<Promise<void>, [object]>();
const mockGetExperiment = jest.fn<Promise<ExperimentResponseType>, [string]>();

jest.mock('../../src/api-client', () => {
  return {
    GalileoApiClient: jest.fn().mockImplementation(() => ({
      init: mockInit,
      getExperiment: mockGetExperiment
    }))
  };
});

jest.mock('cli-progress', () => ({
  SingleBar: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    update: jest.fn(),
    stop: jest.fn()
  })),
  Presets: { shades_classic: {} }
}));

const makeResponse = (progressPercent: number | null): ExperimentResponseType =>
  ({
    id: 'exp-id',
    projectId: 'proj-id',
    status:
      progressPercent === null ? {} : { logGeneration: { progressPercent } }
  }) as unknown as ExperimentResponseType;

describe('monitorExperimentProgress', () => {
  const experimentId = 'exp-id';
  const projectId = 'proj-id';

  beforeEach(() => {
    jest.clearAllMocks();
    mockInit.mockResolvedValue(undefined);
  });

  it('resolves immediately when already complete', async () => {
    mockGetExperiment.mockResolvedValue(makeResponse(1.0));

    await monitorExperimentProgress(experimentId, projectId, {
      showProgressBar: false
    });

    expect(mockGetExperiment).toHaveBeenCalledTimes(1);
  });

  it('polls until progress reaches 100%', async () => {
    mockGetExperiment
      .mockResolvedValueOnce(makeResponse(0.0))
      .mockResolvedValueOnce(makeResponse(0.5))
      .mockResolvedValueOnce(makeResponse(1.0));

    await monitorExperimentProgress(experimentId, projectId, {
      pollIntervalMs: 0,
      showProgressBar: false
    });

    expect(mockGetExperiment).toHaveBeenCalledTimes(3);
  });

  it('respects AbortSignal cancellation', async () => {
    mockGetExperiment.mockResolvedValue(makeResponse(0.0));

    const controller = new AbortController();
    controller.abort();

    await expect(
      monitorExperimentProgress(experimentId, projectId, {
        signal: controller.signal,
        pollIntervalMs: 0,
        showProgressBar: false
      })
    ).rejects.toThrow('cancelled');
  });

  it('initialises the api client with the correct ids', async () => {
    mockGetExperiment.mockResolvedValue(makeResponse(1.0));

    await monitorExperimentProgress(experimentId, projectId, {
      showProgressBar: false
    });

    expect(mockInit).toHaveBeenCalledWith({
      projectId,
      runId: experimentId
    });
  });

  it('throws when timeoutMs is exceeded', async () => {
    mockGetExperiment.mockResolvedValue(makeResponse(0.0));

    await expect(
      monitorExperimentProgress(experimentId, projectId, {
        pollIntervalMs: 0,
        showProgressBar: false,
        timeoutMs: 0
      })
    ).rejects.toThrow('timed out');
  });

  it('throws when progress is stalled with no data', async () => {
    mockGetExperiment.mockResolvedValue(makeResponse(null));

    await expect(
      monitorExperimentProgress(experimentId, projectId, {
        pollIntervalMs: 0,
        showProgressBar: false,
        stalledProgressMaxAttempts: 3
      })
    ).rejects.toThrow('stalled');
  });

  it('throws when progress does not advance', async () => {
    mockGetExperiment.mockResolvedValue(makeResponse(0.3));

    await expect(
      monitorExperimentProgress(experimentId, projectId, {
        pollIntervalMs: 0,
        showProgressBar: false,
        stalledProgressMaxAttempts: 3
      })
    ).rejects.toThrow('stalled');
  });

  it('resets stall counter when progress advances', async () => {
    mockGetExperiment
      .mockResolvedValueOnce(makeResponse(0.1))
      .mockResolvedValueOnce(makeResponse(0.1))
      .mockResolvedValueOnce(makeResponse(0.5))
      .mockResolvedValueOnce(makeResponse(1.0));

    await monitorExperimentProgress(experimentId, projectId, {
      pollIntervalMs: 0,
      showProgressBar: false,
      stalledProgressMaxAttempts: 3
    });

    expect(mockGetExperiment).toHaveBeenCalledTimes(4);
  });

  it('clamps progressPercent to 0-100 range', async () => {
    const cliProgress = require('cli-progress');
    const mockUpdate = jest.fn();
    cliProgress.SingleBar.mockImplementationOnce(() => ({
      start: jest.fn(),
      update: mockUpdate,
      stop: jest.fn()
    }));

    mockGetExperiment.mockResolvedValue(makeResponse(1.5));

    await monitorExperimentProgress(experimentId, projectId, {
      showProgressBar: true
    });

    expect(mockUpdate).toHaveBeenCalledWith(100);
  });
});
