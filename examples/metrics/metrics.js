const dotenv = await import('dotenv/config');

const { enableMetrics, GalileoScorers } = await import('../../dist/index.js');

// Enable metric for a specific log stream and project
await enableMetrics({
  projectName: 'js-project',
  logStreamName: 'js-log-stream',
  metrics: [
    GalileoScorers.Correctness,
    GalileoScorers.Completeness,
    'context_relevance',
    'instruction_adherence'
  ]
});

// -------------------------------------
// Local metric with custom scorer function
// -------------------------------------

// Custom scorer function
function responseLengthScorer(traceOrSpan) {
  if (traceOrSpan.output) {
    // Normalize response length to 0-1 scale
    return Math.min(traceOrSpan.output.length / 100.0, 1.0);
  }
  return 0.0;
}

// Enable custom and local metrics
const localMetrics = await enableMetrics({
  projectName: 'js-project',
  logStreamName: 'js-log-stream',
  metrics: [
    // Built-in metrics
    GalileoScorers.Correctness,
    'completeness',
    // Custom metric with specific version
    { name: 'my_custom_metric', version: 2 },
    // Local custom metric
    {
      name: 'response_length',
      scorerFn: responseLengthScorer,
      scorableTypes: ['llm'],
      aggregatableTypes: ['trace']
    }
  ]
});
