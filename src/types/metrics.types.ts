import { NodeType, Span, Trace } from './log.types';

export type SingleMetricValue = number | string | boolean;
export type MetricValueType = SingleMetricValue | SingleMetricValue[] | Record<string, SingleMetricValue>

export interface Metrics {
  durationNs?: number;
  [key: string]: MetricValueType | undefined;
}

export interface LlmMetrics extends Metrics {
  numInputTokens?: number;
  numOutputTokens?: number;
  numTotalTokens?: number;
  timeToFirstTokenNs?: number;
}


/**
 * LocalMetricConfig is a configuration object for a metric that can be computed locally.
 * It contains the name of the metric, a scorer function that computes the metric value for a given input,
 * an aggregator function that aggregates the metric values for multiple inputs, and the types of nodes that the metric can be scored and aggregated for.
 */
export interface LocalMetricConfig {
  name: string;
  scorer_fn: (input: Trace | Span) => Promise<MetricValueType>;
  aggregator_fn?: (values: MetricValueType[]) => Promise<MetricValueType | Record<string, MetricValueType>>;
  scorable_types: NodeType[];
  aggregatable_types: NodeType[];
}

/**
 * Creates a LocalMetricConfig object from a given configuration.
 * If scorable_types or aggregatable_types are not provided, they default to [NodeType.llm] and [NodeType.trace] respectively.
 */
export function createLocalScorerConfig(config: {
  name: string;
  scorer_fn: (input: Trace | Span) => Promise<MetricValueType>;
  aggregator_fn?: (values: MetricValueType[]) => Promise<MetricValueType | Record<string, MetricValueType>>;
  scorable_types?: NodeType[];
  aggregatable_types?: NodeType[];
}): LocalMetricConfig {
  return {
    name: config.name,
    scorer_fn: config.scorer_fn,
    aggregator_fn: config.aggregator_fn,
    scorable_types: config.scorable_types || [NodeType.llm],
    aggregatable_types: config.aggregatable_types || [NodeType.trace],
  };
}