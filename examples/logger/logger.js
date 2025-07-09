import dotenv from 'dotenv';
import { GalileoLogger } from '../../dist/index.js';

const logger = new GalileoLogger({
  projectName: 'SDK_test_project',
  logStreamName: 'log_stream_test'
});

dotenv.config();

// Create a new trace
const trace = logger.startTrace(
  'Example trace input', // input
  undefined, // output (will be set later)
  'Example Trace', // name
  Date.now() * 1000000, // createdAt in nanoseconds
  undefined, // durationNs
  { source: 'test-script' }, // userMetadata
  ['test', 'example'] // tags
);

// Add a workflow span (parent span)
const workflowSpan = logger.addWorkflowSpan(
  'Processing workflow', // input
  undefined, // output (will be set later)
  'Main Workflow', // name
  undefined, // durationNs
  Date.now() * 1000000, // createdAt in nanoseconds
  { workflow_type: 'test' }, // userMetadata
  ['workflow'] // tags
);

// Add a tool span as a child of the workflow span
logger.addToolSpan(
  'Tool input data', // input
  'Tool output result', // output
  'Example Tool', // name
  500000000, // durationNs (500ms)
  Date.now() * 1000000, // createdAt in nanoseconds
  { tool_type: 'utility' }, // userMetadata
  ['tool'] // tags
);

// Add an LLM span as a child of the workflow span
logger.addLlmSpan({
  input: [{ role: 'user', content: 'Hello, how are you?' }], // input messages
  output: {
    role: 'assistant',
    content: 'I am doing well, thank you for asking!'
  }, // output message
  model: 'gpt-3.5-turbo', // model name
  name: 'Chat Completion', // name
  durationNs: 1000000000, // durationNs (1s)
  numInputTokens: 10, // number of input tokens
  numOutputTokens: 20, // number of output tokens
  totalTokens: 30, // total tokens
  timeToFirstTokenNs: 500000000, // time to first token in nanoseconds
  userMetadata: { temperature: '0.7' }, // userMetadata
  tags: ['llm', 'chat'] // tags
});

// Add an LLM span as a child of the workflow span
logger.addAgentSpan({
  input: [{ role: 'user', content: 'Hello, how are you?' }], // input messages
  output: {
    role: 'assistant',
    content: 'I am doing well, thank you for asking!'
  }, // output message
  model: 'gpt-3.5-turbo', // model name
  name: 'Agent Span', // name
  durationNs: 1000000000, // durationNs (1s)
  userMetadata: { temperature: '0.7' }, // userMetadata
  tags: ['agent', 'span'] // tags
});

// Conclude the workflow span
logger.conclude({
  output: 'Workflow completed successfully',
  durationNs: 2000000000 // 2 seconds
});

// Add a retriever span directly to the trace
logger.addRetrieverSpan(
  'Search query', // input
  [
    {
      id: '1',
      content: 'Document content',
      metadata: { source: 'database' }
    }
  ], // documents
  'Document Retrieval', // name
  300000000, // durationNs (300ms)
  Date.now() * 1000000, // createdAt in nanoseconds
  { retriever_type: 'vector_db' }, // userMetadata
  ['retrieval'] // tags
);

// Conclude the trace
logger.conclude({
  output: 'Final trace output with all spans completed',
  durationNs: 3000000000 // 3 seconds
});

// Flush the traces to Galileo
console.log('Flushing traces to Galileo...');
await logger.flush();
