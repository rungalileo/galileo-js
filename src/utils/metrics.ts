import { LocalMetricConfig, MetricValueType } from '../types';
import { Trace } from '../types/logging/trace.types';
import { Span, StepWithChildSpans } from '../types/logging/span.types';
import { ChainPollTemplate, ScorerTypes } from '../types';
import {
  createScorer,
  createLlmScorerVersion,
  deleteScorer,
  getScorers
} from './scorers';

/**
 * Populates local metrics for a step and its children
 * @param step The trace or span to populate metrics for
 * @param localMetrics List of local metric configurations
 */
export async function populateLocalMetrics(
  step: Trace | Span,
  localMetrics: LocalMetricConfig<MetricValueType>[]
): Promise<void> {
  for (const localMetric of localMetrics) {
    await populateLocalMetric(step, localMetric, []);
  }
}

/**
 * Helper function to populate a single local metric for a step and its children
 * @param step The trace or span to populate the metric for
 * @param localMetric The local metric configuration
 * @param scores Accumulated scores for aggregation
 */
export async function populateLocalMetric<T extends MetricValueType>(
  step: Trace | Span,
  localMetric: LocalMetricConfig<T>,
  scores: T[]
): Promise<void> {
  if (step instanceof StepWithChildSpans) {
    for (const span of step.spans) {
      await populateLocalMetric(span, localMetric, scores);
    }

    if (
      localMetric.aggregator_fn &&
      scores.length > 0 &&
      localMetric.aggregatable_types.includes(step.type)
    ) {
      const aggregateMetricResult = await localMetric.aggregator_fn(scores);

      if (
        typeof aggregateMetricResult === 'object' &&
        aggregateMetricResult !== null &&
        !Array.isArray(aggregateMetricResult)
      ) {
        for (const [suffix, value] of Object.entries(aggregateMetricResult)) {
          const metricName = localMetric.name + '_' + suffix.replace(/^_/, '');
          step.metrics[metricName] = value;
        }
      } else {
        step.metrics[localMetric.name] = aggregateMetricResult;
      }
    }
  }

  if (localMetric.scorable_types.includes(step.type)) {
    const metricValue = await localMetric.scorer_fn(step);
    step.metrics[localMetric.name] = metricValue;
    scores.push(metricValue);
  }
}

/**
 * Creates a custom LLM metric.
 *
 * @param name - The name of the custom metric.
 * @param instructions - Instructions for the LLM scorer version.
 * @param chainPollTemplate - The chain poll template for the scorer version.
 * @param modelName - (Optional) The model name to use. Defaults to 'GPT-4o'.
 * @param numJudges - (Optional) The number of judges to use. Defaults to 3.
 * @param description - (Optional) A description for the metric.
 * @param tags - (Optional) Tags to associate with the metric.
 * @returns A promise that resolves when the metric is created.
 */
export const createCustomLlmMetric = async (
  name: string,
  instructions: string,
  chainPollTemplate: ChainPollTemplate,
  modelName: string = 'GPT-4o',
  numJudges: number = 3,
  description: string = '',
  tags: string[] = []
): Promise<void> => {
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
    undefined
  );

  await createLlmScorerVersion(
    scorer.id,
    instructions,
    chainPollTemplate,
    modelName,
    numJudges
  );
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
  scorerName: string,
  scorerType: ScorerTypes
): Promise<void> => {
  const scorers = await getScorers(scorerType);
  const scorer = scorers.find((s) => s.name === scorerName);
  if (!scorer) {
    throw new Error(`Scorer with name ${scorerName} not found.`);
  }
  await deleteScorer(scorer.id);
};
