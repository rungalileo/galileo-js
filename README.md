# Galileo

The Typescript client library for the Galileo platform.

## Getting Started

### Installation

`npm i galileo`

### Setup

Set the following environment variables:

- `GALILEO_API_KEY`: Your Galileo API key
- `GALILEO_PROJECT`: (Optional) Project name
- `GALILEO_LOG_STREAM`: (Optional) Log stream name

Note: if you would like to point to an environment other than app.galileo.ai, you'll need to set the GALILEO_CONSOLE_URL environment variable.

### Usage

#### Logging

Logging with the OpenAI wrapper

```js
import { wrapOpenAI, flush, log, init } from 'galileo';
import { OpenAI } from 'openai';

const openai = wrapOpenAI(new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));

// Optionally initialize the logger if you haven't set GALILEO_PROJECT and GALILEO_LOG_STREAM environment variables
await init({
  projectName: 'my-test-project-4',
  logStreamName: 'my-test-log-stream'
});

const result = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ content: 'Say hello world!', role: 'user' }]
});

console.log(result);

// Upload the trace to Galileo
await flush();
```

Using the `log` function wrapper

```js
import { wrapOpenAI, flush, log, init } from 'galileo';
import { OpenAI } from 'openai';

const openai = wrapOpenAI(new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));

// This will automatically create an llm span since we're using the `wrapOpenAI` wrapper
const callOpenAI = async (input) => {
  const result = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ content: `Say hello ${input}!`, role: 'user' }]
  });
  return result;
};

// Optionally initialize the logger if you haven't set GALILEO_PROJECT and GALILEO_LOG_STREAM environment variables
await init({
  projectName: 'my-test-project-4',
  logStreamName: 'my-test-log-stream'
});

const wrappedToolCall = log(
  { name: 'tool span', spanType: 'tool' },
  (input) => {
    return 'tool call result';
  }
);

const wrappedFunc = await log({ name: 'workflow span' }, async (input) => {
  const result = await callOpenAI(input);
  return wrappedToolCall(result);
});

// This will create a workflow span with an llm span and a tool span
const result = await wrappedFunc('world');

// Upload the trace to Galileo
await flush();
```

Logging with the GalileoLogger

```js
import { GalileoLogger } from 'galileo';

// You can set the GALILEO_PROJECT and GALILEO_LOG_STREAM environment variables
const logger = new GalileoLogger({
  projectName: 'my-test-project',
  logStreamName: 'my-test-log-stream'
});

console.log('Creating trace with spans...');

// Create a new trace
const trace = logger.startTrace(
  'Example trace input', // input
  undefined, // output (will be set later)
  'Example Trace', // name
  Date.now() * 1000000, // createdAt in nanoseconds
  undefined, // durationNs
  { source: 'test-script' }, // metadata
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
  userMetadata: { temperature: '0.7' }, // userMetadata
  tags: ['llm', 'chat'] // tags
});

// Conclude the workflow span
logger.conclude({
  output: 'Workflow completed successfully',
  durationNs: 2000000000 // 2 seconds
});

// Conclude the trace
logger.conclude({
  output: 'Final trace output with all spans completed',
  durationNs: 3000000000 // 3 seconds
});

// Upload the traces to Galileo
const flushedTraces = await logger.flush();
```

#### Datasets

Create a dataset and upload it to Galileo:

```js
import { createDataset } from 'galileo';

const dataset = await createDataset({
  name: 'names',
  dataset: [
    { name: 'John' },
    { name: 'Jane' },
    { name: 'Bob' },
    { name: 'Alice' }
  ]
});
```

Retrieve an existing dataset:

```js
import { getDataset } from 'galileo';

const dataset = await getDataset({ name: 'names' });
```

Get a list of all datasets:

```js
import { getDatasets } from 'galileo';

const datasets = await getDatasets();
```

#### Experimentation

Create a prompt template and use it to run a prompt experiment:

```js
import { createPromptTemplate, runExperiment } from 'galileo';

const template = await createPromptTemplate({
  template: [{ role: 'user', content: 'Say "Hello, {name}"!' }],
  projectName: 'my-test-project-5',
  name: `Hello name prompt`
});

// Run the experiment. You'll receive a URL to view the results.
await runExperiment({
  name: `Test Experiment`,
  datasetName: 'names',
  promptTemplate: template,
  metrics: ['output_tone'],
  projectName: 'my-test-project-5'
});
```

You can also use an existing template and a dataset object:

```js
import { getPromptTemplate, getDataset, runExperiment } from 'galileo';

const template = await getPromptTemplate({
  projectName: 'my-test-project-5',
  name: 'Hello name prompt'
});

const dataset = await getDataset({
  name: 'names'
});

await runExperiment({
  name: `Test Experiment`,
  dataset: dataset,
  promptTemplate: template,
  metrics: ['output_tone'],
  projectName: 'my-test-project-5'
});
```

You can also use a runner function to run an experiment with a dataset:

```js
import { runExperiment } from 'galileo';
import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const runner = async (input) => {
  const result = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [{ content: `Say hello ${input['name']}!`, role: 'user' }]
  });
  return result;
};

await runExperiment({
  name: `Test Experiment`,
  datasetName: 'names',
  runner: runner,
  metrics: ['output_tone'],
  projectName: 'my-test-project-5'
});
```

Here's how you can use a locally generated dataset with a runner function:

```js
import { runExperiment } from 'galileo';
import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const dataset = [
  { name: 'John' },
  { name: 'Jane' },
  { name: 'Bob' },
  { name: 'Alice' }
];

const runner = async (input) => {
  const result = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [{ content: `Say hello ${input['name']}!`, role: 'user' }]
  });
  return result;
};

await runExperiment({
  name: `Test Experiment`,
  dataset: dataset,
  runner: runner,
  metrics: ['output_tone'],
  projectName: 'my-test-project-5'
});
```

## Making changes

When updating the code, only modify the `*.ts` files in `src` and then run:

- `npm run build`

## Examples Setup

In the root directory, run:

- `npm i`
- `npm link`

In the examples directory, run:

- `npm i`
- `npm link @rungalileo/galileo`

Use `node` to run examples, e.g. `node examples/logger/workflow.js`.
