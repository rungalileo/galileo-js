import dotenv from 'dotenv';
import { GalileoLogger } from '../../dist/index.js';

const logger = new GalileoLogger({
  projectName: 'SDK_test_project',
  logStreamName: 'log_stream_test'
});

dotenv.config();

// Create a new trace
const trace = logger.startTrace({
  input: 'Example trace input',
  name: 'Example Trace',
  createdAt: new Date(),
  durationNs: undefined,
  metadata: { source: 'test-script' },
  tags: ['test', 'example'],
  datasetInput: undefined,
  datasetOutput: undefined,
  datasetMetadata: undefined
});

// Add a workflow span (parent span)
const workflowSpan = logger.addWorkflowSpan({
  input: 'Processing workflow',
  name: 'Main Workflow',
  durationNs: undefined,
  createdAt: new Date(),
  metadata: { workflow_type: 'test' },
  tags: ['workflow']
});

// Add a tool span as a child of the workflow span
logger.addToolSpan({
  input: 'Tool input data',
  output: 'Tool output result',
  name: 'Example Tool',
  durationNs: 500000000, // durationNs (500ms)
  createdAt: new Date(),
  metadata: { tool_type: 'utility' },
  tags: ['tool']
});

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
  metadata: { temperature: '0.7' },
  tags: ['llm', 'chat']
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
  metadata: { temperature: '0.7' },
  tags: ['agent', 'span']
});

// Conclude the workflow span
logger.conclude({
  output: 'Workflow completed successfully',
  durationNs: 2000000000 // 2 seconds
});

// Add a retriever span directly to the trace
logger.addRetrieverSpan({
  input: 'Search query',
  output: [
    {
      id: '1',
      content: 'Document content',
      metadata: { source: 'database' }
    }
  ],
  name: 'Document Retrieval',
  durationNs: 300000000, // durationNs (300ms)
  createdAt: new Date(),
  metadata: { retriever_type: 'vector_db' },
  tags: ['retrieval']
});

// Conclude the trace
logger.conclude({
  output: 'Final trace output with all spans completed',
  durationNs: 3000000000 // 3 seconds
});

// Flush the traces to Galileo
console.log('Flushing traces to Galileo...');
await logger.flush();
