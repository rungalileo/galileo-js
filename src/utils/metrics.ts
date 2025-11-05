import {
  CreateCustomLlmMetricParams,
  CreateCustomCodeMetricParams,
  DeleteMetricParams,
  OutputType,
  ScorerTypes,
  ScorerVersion,
  StepType
} from '../types';
import {
  createScorer,
  createLlmScorerVersion,
  deleteScorer,
  getScorers,
  getScorerVersion
} from './scorers';
import {
  GalileoScorers,
  LocalMetricConfig,
  Metric
} from '../types/metrics.types';
import { ScorerConfig } from '../types/scorer.types';
import { GalileoApiClient } from '../api-client';

/**
 * Creates a custom LLM metric.
 *
 * @param params - The parameters for creating the custom LLM metric.
 * @returns A promise that resolves when the metric is created.
 */
export const createCustomLlmMetric = async ({
  name,
  userPrompt,
  nodeLevel = StepType.llm,
  cotEnabled = true,
  modelName = 'gpt-4.1-mini',
  numJudges = 3,
  description = '',
  tags = [],
  outputType = OutputType.BOOLEAN
}: CreateCustomLlmMetricParams): Promise<ScorerVersion> => {
  const scoreableNodeTypes = [nodeLevel];

  const scorer = await createScorer(
    name,
    ScorerTypes.llm,
    description,
    tags,
    {
      model_name: modelName,
      num_judges: numJudges
    },
    undefined,
    undefined,
    scoreableNodeTypes,
    outputType,
    undefined
  );

  return await createLlmScorerVersion({
    scorerId: scorer.id,
    userPrompt,
    cotEnabled,
    modelName,
    numJudges
  });
};

/**
 * Creates a custom code-based metric.
 *
 * @param params - The parameters for creating the custom code metric.
 * @returns A promise that resolves with the created scorer.
 */
export const createCustomCodeMetric = async ({
  name,
  codePath,
  nodeLevel,
  description = '',
  tags = [],
}: CreateCustomCodeMetricParams): Promise<any> => {
  const fs = await import('fs');
  const path = await import('path');
  
  // Read the code file
  const absolutePath = path.resolve(codePath);
  const codeContent = fs.readFileSync(absolutePath, 'utf-8');
  
  const scoreableNodeTypes = [nodeLevel];

  // Create the scorer with type 'code'
  const scorer = await createScorer(
    name,
    ScorerTypes.code,
    description,
    tags,
    undefined, // No defaults for code scorers
    undefined, // No model type
    undefined, // No default version ID
    scoreableNodeTypes,
    undefined
  );

  // Create a code scorer version with the code content
  const { createCodeScorerVersion } = await import('./scorers');
  const scorerVersion = await createCodeScorerVersion(scorer.id, codeContent);

  return {
    scorer,
    version: scorerVersion,
  };
};

/**
 * Deletes a metric by its name and type.
 *
 * @param scorerName - The name of the scorer to delete.
 * @param scorerType - The type of the scorer.
 * @returns A promise that resolves when the scorer is deleted.
 * @throws Error if the scorer with the given name is not found.
 */
export const deleteMetric = async (
  params: DeleteMetricParams
): Promise<void> => {
  const { scorerName, scorerType } = params;
  const names: string[] = [scorerName];
  const scorers = await getScorers({ type: scorerType, names: names });
  if (scorers.length === 0) {
    throw new Error(`Scorer with name ${scorerName} not found.`);
  }
  const scorer = scorers[0]; // There should only ever be one here
  await deleteScorer(scorer.id);
};

/**
 * Process metrics and create scorer configurations for log streams or experiments.
 *
 * This function categorizes metrics into server-side and client-side types,
 * validates they exist, and registers server-side metrics with Galileo.
 *
 * @param projectId - The ID of the project
 * @param runId - The ID of the run (can be experiment ID or log stream ID)
 * @param metrics - List of metrics to configure
 * @returns A promise that resolves to a tuple containing:
 *          - Array of ScorerConfig objects for server-side metrics
 *          - Array of LocalMetricConfig objects for client-side metrics
 * @throws Error if any specified metrics are unknown or don't exist in Galileo
 *
 * @example
 * ```typescript
 * import { GalileoScorers } from '../types/metrics.types';
 *
 * const [scorerConfigs, localMetrics] = await createMetricConfigs(
 *   'project-123',
 *   'log-stream-456',
 *   [
 *     GalileoScorers.Correctness,
 *     GalileoScorers.Completeness,
 *     'toxicity',
 *     { name: 'custom_metric', version: 2 },
 *     {
 *       name: 'local_scorer',
 *       scorerFn: (span) => 0.85,
 *       scorableTypes: ['llm']
 *     }
 *   ]
 * );
 * ```
 */
export const createMetricConfigs = async (
  projectId: string,
  runId: string,
  metrics: (GalileoScorers | Metric | LocalMetricConfig | string)[]
): Promise<[ScorerConfig[], LocalMetricConfig[]]> => {
  const localMetricConfigs: LocalMetricConfig[] = [];
  const scorerNameVersions: Array<[string, number | undefined]> = [];

  // Categorize metrics by type
  for (const metric of metrics) {
    if (typeof metric === 'string') {
      // Check if it's a GalileoScorers enum value
      const enumValue = Object.values(GalileoScorers).find(
        (val) => val === metric
      );
      if (enumValue) {
        scorerNameVersions.push([enumValue, undefined]);
      } else {
        scorerNameVersions.push([metric, undefined]);
      }
    } else if (isMetric(metric)) {
      scorerNameVersions.push([metric.name, metric.version]);
    } else if (isLocalMetricConfig(metric)) {
      localMetricConfigs.push(metric);
    } else {
      throw new Error(
        `Invalid metric format. Expected string, GalileoScorers enum, Metric object with 'name' property, or LocalMetricConfig with 'name' and 'scorerFn'. Received: ${JSON.stringify(metric)}`
      );
    }
  }

  // Process server-side metrics
  const scorers: ScorerConfig[] = [];
  if (scorerNameVersions.length > 0) {
    const metricNames = scorerNameVersions.map(([name]) => name);
    const allScorers = await getScorers({ names: metricNames });
    const knownMetrics = new Map(allScorers.map((s) => [s.name, s]));
    const unknownMetrics: string[] = [];

    for (const [scorerName, scorerVersion] of scorerNameVersions) {
      if (knownMetrics.has(scorerName)) {
        const scorer = knownMetrics.get(scorerName)!;
        const scorerConfig: ScorerConfig = {
          id: scorer.id,
          name: scorer.name,
          scorer_type: scorer.scorer_type
        };

        // Set the version on the ScorerConfig if provided
        if (scorerVersion !== undefined) {
          const rawVersion = await getScorerVersion(scorer.id, scorerVersion);
          scorerConfig.scorer_version = rawVersion;
        }

        scorers.push(scorerConfig);
      } else {
        unknownMetrics.push(scorerName);
      }
    }

    if (unknownMetrics.length > 0) {
      throw new Error(
        `One or more non-existent metrics are specified: ${unknownMetrics.map((m) => `'${m}'`).join(', ')}`
      );
    }

    // Register server-side metrics with Galileo
    if (scorers.length > 0) {
      const apiClient = new GalileoApiClient();
      await apiClient.init({ projectId });

      // Use the run scorer settings endpoint (works for both experiments and log streams)
      await apiClient.createRunScorerSettings(runId, projectId, scorers);
    }
  }

  return [scorers, localMetricConfigs];
};

/**
 * Type guard to check if a value is a Metric interface
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isMetric(value: any): value is Metric {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    typeof value.name === 'string' &&
    (!('version' in value) || typeof value.version === 'number') &&
    !('scorerFn' in value)
  );
}

/**
 * Type guard to check if a value is a LocalMetricConfig interface
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isLocalMetricConfig(value: any): value is LocalMetricConfig {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    'scorerFn' in value &&
    typeof value.name === 'string' &&
    typeof value.scorerFn === 'function'
  );
}
