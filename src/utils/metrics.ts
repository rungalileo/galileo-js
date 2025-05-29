import { LocalMetricConfig, MetricValueType } from '../types';
import { Trace } from '../types/logging/trace.types';
import { Span, StepWithChildSpans } from '../types/logging/span.types';

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
    
    if (localMetric.aggregator_fn && scores.length > 0 &&
      localMetric.aggregatable_types.includes(step.type)) {
      const aggregateMetricResult = await localMetric.aggregator_fn(scores);
      
      if (typeof aggregateMetricResult === 'object' &&
        aggregateMetricResult !== null &&
        !Array.isArray(aggregateMetricResult)) {
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