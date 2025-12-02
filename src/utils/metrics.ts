import {
  CreateCustomLlmMetricParams,
  CreateCustomCodeMetricParams,
  DeleteMetricParams,
  DeleteMetricByNameParams,
  OutputType,
  ScorerTypes,
  ScorerVersion,
  StepType
} from '../types';

import {
  createScorer,
  createLlmScorerVersion,
  createCodeScorerVersion,
  validateCodeScorer,
  deleteScorer,
  getScorers,
  getScorerVersion
} from './scorers';
import {
  GalileoScorers,
  LocalMetricConfig,
  Metric,
  MetricValueType
} from '../types/metrics.types';
import { ScorerConfig } from '../types/scorer.types';
import { GalileoApiClient } from '../api-client';
import { Trace } from '../types/logging/trace.types';
import { Span, StepWithChildSpans } from '../types/logging/span.types';
import {
  LogRecordsMetricsQueryRequest,
  LogRecordsMetricsResponse
} from '../types/metrics.types';
import fs from 'fs/promises';
import path from 'path';

/**
 * Metrics class for managing metrics in the Galileo platform.
 * Public-facing API that delegates to internal utilities and GalileoApiClient.
 */
export class Metrics {
  /**
   * Creates a custom LLM metric.
   *
   * @param params - The parameters for creating the custom LLM metric.
   * @returns A promise that resolves when the metric is created.
   */
  public async createCustomLlmMetric({
    name,
    userPrompt,
    nodeLevel = StepType.llm,
    cotEnabled = true,
    modelName = 'gpt-4.1-mini',
    numJudges = 3,
    description = '',
    tags = [],
    outputType = OutputType.BOOLEAN
  }: CreateCustomLlmMetricParams): Promise<ScorerVersion> {
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
  }

  /**
   * Creates a custom code-based metric.
   *
   * @param params - The parameters for creating the custom code metric.
   * @returns A promise that resolves with the created scorer version.
   */
  public async createCustomCodeMetric({
    name,
    codePath,
    nodeLevel,
    description = '',
    tags = []
  }: CreateCustomCodeMetricParams): Promise<ScorerVersion> {
    console.log(`Creating custom code metric: ${name}`);

    // Read the code file
    const absolutePath = path.resolve(codePath);

    // Check if the file exists and is accessible
    try {
      await fs.access(absolutePath);
    } catch {
      throw new Error(
        `Code file not found at path: ${absolutePath}. Please provide a valid file path.`
      );
    }

    // Check if the path is a file (not a directory)
    const stats = await fs.stat(absolutePath);
    if (!stats.isFile()) {
      throw new Error(
        `Path is not a file: ${absolutePath}. Please provide a path to a file, not a directory.`
      );
    }

    // Read the file content asynchronously
    const codeContent = await fs.readFile(absolutePath, 'utf-8');
    console.log(`Read code file: ${codeContent.length} bytes`);

    // Check if the file is empty
    if (!codeContent || codeContent.trim().length === 0) {
      throw new Error(
        `Code file is empty: ${absolutePath}. Please provide a file with valid code content.`
      );
    }

    const scoreableNodeTypes = [nodeLevel];

    // Validate the code metric first
    console.log(`Validating code metric...`);
    const validationResult = await validateCodeScorer(
      codeContent,
      scoreableNodeTypes
    );

    // Create the scorer with type 'code'
    console.log(`Creating metric: ${name}`);
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
    console.log(`Metric created: ${scorer.id}`);

    // Create a code scorer version with the code content and validation result
    console.log(`Creating code metric version...`);
    const scorerVersion = await createCodeScorerVersion(
      scorer.id,
      codeContent,
      JSON.stringify(validationResult)
    );
    console.log(`Custom code metric created successfully: ${name}`);
    return scorerVersion;
  }

  /**
   * Deletes a metric by its name and type.
   *
   * @param params - The parameters for deleting the metric.
   * @returns A promise that resolves when the scorer is deleted.
   * @throws Error if the scorer with the given name is not found.
   */
  public async deleteMetric(params: DeleteMetricParams): Promise<void>;
  /**
   * Deletes a metric by its name only. Deletes all scorers with the given name.
   *
   * @param params - The parameters for deleting the metric by name.
   * @returns A promise that resolves when all matching scorers are deleted.
   * @throws Error if no scorer with the given name is found.
   */
  public async deleteMetric(params: DeleteMetricByNameParams): Promise<void>;
  public async deleteMetric(
    params: DeleteMetricParams | DeleteMetricByNameParams
  ): Promise<void> {
    if ('scorerType' in params) {
      // Delete by name and type
      const { scorerName, scorerType } = params;
      const names: string[] = [scorerName];
      const scorers = await getScorers({ type: scorerType, names: names });
      if (scorers.length === 0) {
        throw new Error(`Scorer with name ${scorerName} not found.`);
      }
      const scorer = scorers[0]; // There should only ever be one here
      await deleteScorer(scorer.id);
    } else {
      // Delete by name only
      const { name } = params;
      const scorersToDelete = await getScorers({ names: [name] });
      if (scorersToDelete.length === 0) {
        throw new Error(`Scorer with name ${name} not found.`);
      }
      for (const scorer of scorersToDelete) {
        await deleteScorer(scorer.id);
      }
    }
  }

  /**
   * Queries for metrics in a project.
   *
   * @param projectId - The ID of the project to search in.
   * @param options - The query options.
   * @param options.startTime - The start time for the metrics query (ISO date-time string).
   * @param options.endTime - The end time for the metrics query (ISO date-time string).
   * @param options.logStreamId - (Optional) The log stream ID to filter by.
   * @param options.experimentId - (Optional) The experiment ID to filter by.
   * @param options.metricsTestingId - (Optional) The metrics testing ID to filter by.
   * @param options.interval - (Optional) The time interval for aggregating metrics.
   * @param options.groupBy - (Optional) The field to group metrics by.
   * @param options.filters - (Optional) Filters to apply to the query.
   * @returns A promise that resolves to the metrics search results.
   */
  public async query(
    projectId: string,
    options: LogRecordsMetricsQueryRequest
  ): Promise<LogRecordsMetricsResponse> {
    const apiClient = new GalileoApiClient();
    await apiClient.init({ projectId, projectScoped: true });
    return await apiClient.searchMetrics(options);
  }

  /**
   * Process metrics and create scorer configurations for log streams or experiments.
   *
   * This function categorizes metrics into server-side and client-side types,
   * validates they exist, and registers server-side metrics with Galileo.
   *
   * @param projectId - The ID of the project
   * @param runId - The ID of the run (can be experiment ID or log stream ID)
   * @param metrics - List of metrics to configure. Can include:
   *                  - GalileoScorers const object values (e.g., GalileoScorers.correctness)
   *                  - Metric objects with name and optional version
   *                  - LocalMetricConfig objects for client-side scoring
   *                  - String names of metrics
   * @returns A promise that resolves to a tuple containing:
   *          - Array of ScorerConfig objects for server-side metrics
   *          - Array of LocalMetricConfig objects for client-side metrics
   * @throws Error if any specified metrics are unknown or don't exist in Galileo
   *
   * @example
   * ```typescript
   * const [scorerConfigs, localMetrics] = await metrics.createMetricConfigs(
   *   'project-123',
   *   'log-stream-456',
   *   [
   *     GalileoScorers.correctness,
   *     GalileoScorers.completeness,
   *     'toxicity',
   *     { name: 'custom_metric', version: 2 }
   *   ]
   * );
   * ```
   */
  public async createMetricConfigs(
    projectId: string,
    runId: string,
    metrics: (GalileoScorers | Metric | LocalMetricConfig | string)[]
  ): Promise<[ScorerConfig[], LocalMetricConfig[]]> {
    const localMetricConfigs: LocalMetricConfig[] = [];
    const scorerNameVersions: Array<[string, number | undefined]> = [];

    // Categorize metrics by type - match Python order: const object value first, then Metric, then LocalMetricConfig, then string
    for (const metric of metrics) {
      // Check if it's a GalileoScorers const object value
      // When you use GalileoScorers.correctness, it's actually the string value
      // So we check if it's a string that matches a const object value first
      if (typeof metric === 'string') {
        const constValue = Object.values(GalileoScorers).find(
          (val) => val === metric
        );
        if (constValue) {
          scorerNameVersions.push([constValue, undefined]);
        } else {
          scorerNameVersions.push([metric, undefined]);
        }
      } else if (isMetric(metric)) {
        scorerNameVersions.push([metric.name, metric.version]);
      } else if (isLocalMetricConfig(metric)) {
        // Validate LocalMetricConfig
        this.validateLocalMetricConfig(metric);
        localMetricConfigs.push(metric);
      } else {
        throw new Error(
          `Invalid metric format. Expected string, GalileoScorers const object value, Metric object with 'name' property, or LocalMetricConfig with 'name' and 'scorerFn'. Received: ${JSON.stringify(metric)}`
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
  }

  /**
   * Populates local metrics on a trace or span by computing scores client-side.
   *
   * This function recursively processes child spans and applies aggregator functions
   * when applicable.
   *
   * @param step - The trace or span to populate metrics on
   * @param localMetrics - List of local metric configurations to apply
   */
  public populateLocalMetrics(
    step: Trace | Span,
    localMetrics: LocalMetricConfig[]
  ): void {
    for (const localMetric of localMetrics) {
      this._populateLocalMetric(step, localMetric, []);
    }
  }

  /**
   * Internal helper method to recursively populate a single local metric.
   *
   * @param step - The trace or span to process
   * @param localMetric - The local metric configuration
   * @param scores - Accumulated scores from child spans (for aggregation)
   */
  private _populateLocalMetric(
    step: Trace | Span,
    localMetric: LocalMetricConfig,
    scores: MetricValueType[]
  ): void {
    // Get defaults for scorableTypes and aggregatableTypes
    const scorableTypes = localMetric.scorableTypes ?? ['llm'];
    const aggregatableTypes = localMetric.aggregatableTypes ?? ['trace'];

    // If step has child spans, process them recursively
    if (step instanceof StepWithChildSpans && step.spans.length > 0) {
      for (const span of step.spans) {
        this._populateLocalMetric(span, localMetric, scores);
      }

      // Apply aggregation if applicable
      if (
        localMetric.aggregatorFn &&
        scores.length > 0 &&
        aggregatableTypes.includes(step.type)
      ) {
        const aggregateMetricResult = localMetric.aggregatorFn(scores);
        if (
          typeof aggregateMetricResult === 'object' &&
          aggregateMetricResult !== null &&
          !Array.isArray(aggregateMetricResult)
        ) {
          // If result is a dict/object, set each key as a separate metric
          for (const [suffix, value] of Object.entries(aggregateMetricResult)) {
            const metricName =
              localMetric.name + '_' + suffix.replace(/^_/, '');
            step.metrics[metricName] = value;
          }
        } else {
          // Otherwise, set the result directly
          step.metrics[localMetric.name] = aggregateMetricResult;
        }
      }
    }

    // If step type is scorable, compute and set the metric
    if (scorableTypes.includes(step.type)) {
      const metricValue = localMetric.scorerFn(step);
      step.metrics[localMetric.name] = metricValue;
      scores.push(metricValue);
    }
  }

  /**
   * Validates a LocalMetricConfig to ensure it meets requirements.
   *
   * @param localMetric - The local metric configuration to validate
   * @throws Error if validation fails
   */
  private validateLocalMetricConfig(localMetric: LocalMetricConfig): void {
    const scorableTypes = localMetric.scorableTypes ?? ['llm'];
    const aggregatableTypes = localMetric.aggregatableTypes ?? ['trace'];

    // Validate aggregatableTypes doesn't contain any scorableTypes
    const overlap = aggregatableTypes.filter((type) =>
      scorableTypes.includes(type)
    );
    if (overlap.length > 0) {
      throw new Error(
        `aggregatableTypes cannot contain any types in scorableTypes. Overlap: ${overlap.join(', ')}`
      );
    }

    // Validate aggregatableTypes only contains trace or workflow
    const validAggregatableTypes = ['trace', 'workflow'];
    const invalidTypes = aggregatableTypes.filter(
      (type) => !validAggregatableTypes.includes(type)
    );
    if (invalidTypes.length > 0) {
      throw new Error(
        `aggregatableTypes can only contain 'trace' or 'workflow' step types. Invalid types: ${invalidTypes.join(', ')}`
      );
    }
  }
}

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

// Standalone utility functions that instantiate the Metrics class

/**
 * Creates a custom LLM metric.
 *
 * @param params - The parameters for creating the custom LLM metric.
 * @returns A promise that resolves when the metric is created.
 */
export const createCustomLlmMetric = async (
  params: CreateCustomLlmMetricParams
): Promise<ScorerVersion> => {
  console.log('################### params: ', params);

  const metrics = new Metrics();
  return await metrics.createCustomLlmMetric(params);
};

/**
 * Creates a custom code-based metric.
 *
 * @param params - The parameters for creating the custom code metric.
 * @returns A promise that resolves with the created scorer version.
 */
export const createCustomCodeMetric = async (
  params: CreateCustomCodeMetricParams
): Promise<ScorerVersion> => {
  const metrics = new Metrics();
  return await metrics.createCustomCodeMetric(params);
};

/**
 * Deletes a metric by its name and type.
 *
 * @param params - The parameters for deleting the metric.
 * @returns A promise that resolves when the scorer is deleted.
 * @throws Error if the scorer with the given name is not found.
 */
export const deleteMetric = async (
  params: DeleteMetricParams | DeleteMetricByNameParams
): Promise<void> => {
  const metrics = new Metrics();
  // TypeScript needs explicit type narrowing for overloads
  if ('scorerType' in params) {
    return await metrics.deleteMetric(params as DeleteMetricParams);
  } else {
    return await metrics.deleteMetric(params as DeleteMetricByNameParams);
  }
};

/**
 * Searches for metrics in a project.
 * @param options - The search query parameters.
 * @param options.projectId - The ID of the project to search in.
 * @param options.startTime - The start time for the metrics query (ISO date-time string).
 * @param options.endTime - The end time for the metrics query (ISO date-time string).
 * @param options.logStreamId - (Optional) The log stream ID to filter by.
 * @param options.experimentId - (Optional) The experiment ID to filter by.
 * @param options.metricsTestingId - (Optional) The metrics testing ID to filter by.
 * @param options.filters - (Optional) Filters to apply to the query.
 * @param options.interval - (Optional) The time interval for aggregating metrics.
 * @param options.groupBy - (Optional) The field to group metrics by.
 * @returns A promise that resolves to the search results.
 */
export const getMetrics = async (
  options: LogRecordsMetricsQueryRequest & { projectId: string }
): Promise<LogRecordsMetricsResponse> => {
  const metrics = new Metrics();
  return await metrics.query(options.projectId, options);
};

/**
 * Process metrics and create scorer configurations for log streams or experiments.
 *
 * This function categorizes metrics into server-side and client-side types,
 * validates they exist, and registers server-side metrics with Galileo.
 *
 * @param projectId - The ID of the project
 * @param runId - The ID of the run (can be experiment ID or log stream ID)
 * @param metrics - List of metrics to configure. Can include:
 *                  - GalileoScorers const object values (e.g., GalileoScorers.correctness)
 *                  - Metric objects with name and optional version
 *                  - LocalMetricConfig objects for client-side scoring
 *                  - String names of metrics
 * @returns A promise that resolves to a tuple containing:
 *          - Array of ScorerConfig objects for server-side metrics
 *          - Array of LocalMetricConfig objects for client-side metrics
 * @throws Error if any specified metrics are unknown or don't exist in Galileo
 *
 * @example
 * ```typescript
 * const [scorerConfigs, localMetrics] = await createMetricConfigs(
 *   'project-123',
 *   'log-stream-456',
 *   [
 *     GalileoScorers.correctness,
 *     GalileoScorers.completeness,
 *     'toxicity',
 *     { name: 'custom_metric', version: 2 }
 *   ]
 * );
 * ```
 */
export const createMetricConfigs = async (
  projectId: string,
  runId: string,
  metrics: (GalileoScorers | Metric | LocalMetricConfig | string)[]
): Promise<[ScorerConfig[], LocalMetricConfig[]]> => {
  const metricsInstance = new Metrics();
  return await metricsInstance.createMetricConfigs(projectId, runId, metrics);
};

/**
 * Populates local metrics on a trace or span by computing scores client-side.
 *
 * This function recursively processes child spans and applies aggregator functions
 * when applicable.
 *
 * @param step - The trace or span to populate metrics on
 * @param localMetrics - List of local metric configurations to apply
 */
export const populateLocalMetrics = (
  step: Trace | Span,
  localMetrics: LocalMetricConfig[]
): void => {
  const metrics = new Metrics();
  metrics.populateLocalMetrics(step, localMetrics);
};
