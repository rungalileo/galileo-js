import { 
  LocalMetricConfig, 
  MetricValueType, 
  createLocalScorerConfig
} from '../../src/types';
import { 
  NodeType,
  Trace,
  Span,
  LlmSpan,
  WorkflowSpan,
} from '../../src/types';
import { populateLocalMetrics, populateLocalMetric } from '../../src/utils/metrics';

// Define real scorer and aggregator functions for testing

/**
 * A simple scorer that returns 1.0 for any LLM span
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function simpleScorer(step: Trace | Span): Promise<number> {
  // Just return 1.0 for any step
  return 1.0;
}

/**
 * A simple aggregator that sums all scores
 */
async function simpleAggregator(scores: MetricValueType[]): Promise<number> {
  return (scores as number[]).reduce((sum, score) => sum + (score as number), 0);
}

/**
 * An aggregator that returns both mean and sum as a dictionary
 */
async function dictAggregator(scores: MetricValueType[]): Promise<Record<string, number>> {
  const numScores = scores.length;
  const sum = (scores as number[]).reduce((sum, score) => sum + (score as number), 0);
  return { 
    '_mean': numScores ? sum / numScores : 0, 
    '_sum': sum 
  };
}

describe('metrics utility', () => {
  // Test fixtures
  let simpleMetricConfig: LocalMetricConfig;
  let aggregatingMetricConfig: LocalMetricConfig;
  let dictAggregatingMetricConfig: LocalMetricConfig;
  let llmSpan: LlmSpan;
  let workflowSpan: WorkflowSpan;
  let traceWithSpans: Trace;
  let nestedTrace: Trace;

  beforeEach(() => {
    // Create test fixtures
    simpleMetricConfig = createLocalScorerConfig({
      name: 'test_metric',
      scorer_fn: simpleScorer,
      scorable_types: [NodeType.llm]
    });

    aggregatingMetricConfig = createLocalScorerConfig({
      name: 'test_metric',
      scorer_fn: simpleScorer,
      aggregator_fn: simpleAggregator,
      scorable_types: [NodeType.llm],
      aggregatable_types: [NodeType.trace]
    });

    dictAggregatingMetricConfig = createLocalScorerConfig({
      name: 'test_metric',
      scorer_fn: simpleScorer,
      aggregator_fn: dictAggregator,
      scorable_types: [NodeType.llm],
      aggregatable_types: [NodeType.trace]
    });

    // Create test spans and traces with proper class instances
    llmSpan = new LlmSpan({
      input: { content: 'test input' },
      output: { content: 'test output' }
    });

    workflowSpan = new WorkflowSpan({
      input: 'test input'
    });

    // Create a trace with the LLM span as a child
    traceWithSpans = new Trace({
      input: 'test input',
      spans: [llmSpan]
    });

    // Create nested trace structure
    const nestedLlmSpan = new LlmSpan({
      input: { content: 'test input' },
      output: { content: 'test output' }
    });

    const middleSpan = new WorkflowSpan({
      input: 'test input',
      spans: [nestedLlmSpan]
    });

    nestedTrace = new Trace({
      input: 'test input',
      spans: [middleSpan]
    });
  });

  describe('populateLocalMetrics', () => {
    it('should handle empty metrics list without errors', async () => {
      await populateLocalMetrics(traceWithSpans, []);
      // No assertions needed, just verifying it doesn't throw exceptions
    });

    it('should populate metrics for a single metric config', async () => {
      await populateLocalMetrics(traceWithSpans, [simpleMetricConfig]);

      // Verify metrics were set on the span
      expect(llmSpan.metrics['test_metric']).toBe(1.0);
    });

    it('should populate metrics for multiple metric configs', async () => {
      // Create two different scorers that return different values
      async function metric1Scorer(): Promise<number> { return 2.0; }
      async function metric2Scorer(): Promise<number> { return 3.0; }
      
      const localMetrics = [
        createLocalScorerConfig({
          name: 'metric1',
          scorer_fn: metric1Scorer,
          scorable_types: [NodeType.llm]
        }),
        createLocalScorerConfig({
          name: 'metric2',
          scorer_fn: metric2Scorer,
          scorable_types: [NodeType.llm]
        })
      ];

      await populateLocalMetrics(traceWithSpans, localMetrics);

      // Verify both metrics were set on the span
      expect(llmSpan.metrics['metric1']).toBe(2.0);
      expect(llmSpan.metrics['metric2']).toBe(3.0);
    });
  });

  describe('populateLocalMetric', () => {
    it('should populate metrics for a scorable type', async () => {
      const scores: MetricValueType[] = [];
      await populateLocalMetric(llmSpan, simpleMetricConfig, scores);

      // Verify the metric was set on the span
      expect(llmSpan.metrics['test_metric']).toBe(1.0);
      expect(scores).toEqual([1.0]);
    });

    it('should not populate metrics for a non-scorable type', async () => {
      const scores: MetricValueType[] = [];
      await populateLocalMetric(workflowSpan, simpleMetricConfig, scores);

      // Verify the metric was not set on the span
      expect(workflowSpan.metrics['test_metric']).toBeUndefined();
      expect(scores).toEqual([]); // Scores array should be empty
    });

    it('should populate metrics for child spans', async () => {
      const scores: MetricValueType[] = [];
      await populateLocalMetric(traceWithSpans, simpleMetricConfig, scores);

      // Verify metrics were set on child spans but not on the trace
      expect(llmSpan.metrics['test_metric']).toBe(1.0);
      expect(traceWithSpans.metrics['test_metric']).toBeUndefined();
      expect(scores).toEqual([1.0]);
    });

    it('should aggregate metrics for parent spans', async () => {
      const scores: MetricValueType[] = [];
      await populateLocalMetric(traceWithSpans, aggregatingMetricConfig, scores);

      // Verify metrics were set on child spans and aggregated on the trace
      expect(llmSpan.metrics['test_metric']).toBe(1.0);
      expect(traceWithSpans.metrics['test_metric']).toBe(1.0); // Sum of one score
      expect(scores).toEqual([1.0]);
    });

    it('should handle dictionary aggregation', async () => {
      const scores: MetricValueType[] = [];
      await populateLocalMetric(traceWithSpans, dictAggregatingMetricConfig, scores);

      // Verify metrics were set on child spans and aggregated metrics were set on the trace
      expect(llmSpan.metrics['test_metric']).toBe(1.0);
      expect(traceWithSpans.metrics['test_metric_mean']).toBe(1.0);
      expect(traceWithSpans.metrics['test_metric_sum']).toBe(1.0);
      expect(scores).toEqual([1.0]);
    });

    it('should handle nested spans recursively', async () => {
      // Create a custom metric config for nested spans
      async function nestedMetricScorer(): Promise<number> { return 1.0; }
      async function nestedMetricAggregator(scores: MetricValueType[]): Promise<number> {
        return (scores as number[]).reduce((sum, score) => sum + (score as number), 0);
      }
      
      const nestedMetricConfig = createLocalScorerConfig({
        name: 'test_metric',
        scorer_fn: nestedMetricScorer,
        aggregator_fn: nestedMetricAggregator,
        scorable_types: [NodeType.llm],
        aggregatable_types: [NodeType.trace, NodeType.workflow]
      });

      const scores: MetricValueType[] = [];
      await populateLocalMetric(nestedTrace, nestedMetricConfig, scores);

      // Get the nested span and middle span
      const middleSpan = nestedTrace.spans[0] as WorkflowSpan;
      const nestedSpan = middleSpan.spans[0];

      // Verify metrics were set correctly at all levels
      expect(nestedSpan.metrics['test_metric']).toBe(1.0);
      expect(middleSpan.metrics['test_metric']).toBe(1.0);
      expect(nestedTrace.metrics['test_metric']).toBe(1.0);
      expect(scores).toEqual([1.0]);
    });
  });
});
