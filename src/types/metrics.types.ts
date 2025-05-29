import { Trace } from './logging/trace.types';
import { Span } from './logging/span.types';
import { StepType } from './logging/step.types';

export type SingleMetricValue = number | string | boolean;
export type MetricValueType =
  | SingleMetricValue
  | SingleMetricValue[]
  | Record<string, SingleMetricValue>;

/**
 * LocalMetricConfig is a configuration object for a metric that can be computed locally.
 * It contains the name of the metric, a scorer function that computes the metric value for a given input,
 * an aggregator function that aggregates the metric values for multiple inputs, and the types of nodes that the metric can be scored and aggregated for.
 */
export interface LocalMetricConfig<T extends MetricValueType> {
  name: string;
  scorer_fn: (input: Trace | Span) => Promise<T>;
  aggregator_fn?: (values: T[]) => Promise<T | Record<string, T>>;
  scorable_types: StepType[];
  aggregatable_types: StepType[];
}

/**
 * Creates a LocalMetricConfig object from a given configuration.
 * If scorable_types or aggregatable_types are not provided, they default to [NodeType.llm] and [NodeType.trace] respectively.
 */
export function createLocalScorerConfig<T extends MetricValueType>(config: {
  name: string;
  scorer_fn: (input: Trace | Span) => Promise<T>;
  aggregator_fn?: (values: T[]) => Promise<T | Record<string, T>>;
  scorable_types?: StepType[];
  aggregatable_types?: StepType[];
}): LocalMetricConfig<T> {
  return {
    name: config.name,
    scorer_fn: config.scorer_fn,
    aggregator_fn: config.aggregator_fn || undefined,
    scorable_types: config.scorable_types || [StepType.llm],
    aggregatable_types: config.aggregatable_types || [StepType.trace]
  };
}