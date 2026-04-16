# Galileo

JS/TypeScript client library for the Galileo platform.

## Getting Started

### Installation

`npm i galileo`

### Setup

Set the following environment variables.
For credentials, either:

- `GALILEO_API_KEY`: Your Galileo API key
  or
- `GALILEO_USERNAME`: Your Galileo login
- `GALILEO_PASSWORD`: Your Galileo password

then:

- `GALILEO_PROJECT`: (Optional) Project name
- `GALILEO_LOG_STREAM`: (Optional) Log stream name

Note: if you would like to point to an environment other than app.galileo.ai, you'll need to set the GALILEO_CONSOLE_URL environment variable.

### Optional Peer Dependencies

Galileo integrates with several LLM frameworks via optional peer dependencies. Install only the ones you need:

```bash
# For LangChain integration
npm install @langchain/core

# For LangChain OpenAI models
npm install @langchain/core @langchain/openai

# For OpenAI direct integration
npm install openai

# For OpenAI Agents SDK
npm install @openai/agents
```

### Usage

#### Logging

Logging with the OpenAI wrapper

```js
import { wrapOpenAI, flush, log, init } from 'galileo';
import { OpenAI } from 'openai';

const openai = wrapOpenAI(new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));

const result = await openai.chat.completions.create({
  model: 'gpt-5-mini',
  messages: [{ content: 'Say hello world!', role: 'user' }]
});

console.log(result);

// Upload the trace to Galileo.
await flush();
```

Using `ingestionHook` with `wrapOpenAI` for custom trace handling:

```js
import { wrapOpenAI, flush } from 'galileo';
import { OpenAI } from 'openai';

const openai = wrapOpenAI(
  new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
  undefined, // no custom logger
  async (request) => {
    console.log(`Ingesting ${request.traces.length} traces`);
  }
);

const result = await openai.chat.completions.create({
  model: 'gpt-5-mini',
  messages: [{ content: 'Say hello world!', role: 'user' }]
});

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
    model: 'gpt-5-mini',
    messages: [{ content: `Say hello ${input}!`, role: 'user' }]
  });
  return result;
};

// Optionally initialize the logger if you haven't set GALILEO_PROJECT and GALILEO_LOG_STREAM environment variables
const config = {
  projectName: 'My Test Project',
  logstream: 'my-ts-test-log-stream'
};
await init(config);

const wrappedToolCall = log(
  { name: 'tool span', spanType: 'tool' },
  (input) => {
    return 'tool call result';
  }
);

const wrappedFunc = log({ name: 'workflow span' }, async (input) => {
  const result = await callOpenAI(input);
  return wrappedToolCall(result);
});

// This will create a workflow span with an llm span and a tool span
const result = await wrappedFunc('world');

// Upload the trace to Galileo. Standalone function requires the same
// config used in init, so the same internal logger flushes the traces
await flush(config);
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
const trace = logger.startTrace({
  input: 'Example trace input',
  name: 'Example Trace',
  createdAt: new Date(),
  metadata: { source: 'test-script' },
  tags: ['test', 'example']
});

// Add a workflow span (parent span)
const workflowSpan = logger.addWorkflowSpan({
  input: 'Processing workflow',
  name: 'Main Workflow',
  metadata: { workflow_type: 'test' },
  tags: ['workflow']
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
  metadata: { temperature: '0.7' }, // userMetadata
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

// Upload the trace to Galileo. Since logger was used
// directly, no additional config necessary for flush
const flushedTraces = await logger.flush();
```

#### LangChain Integration

Use `GalileoCallback` to automatically log LangChain traces. Requires `@langchain/core` as a peer dependency.

```bash
npm install @langchain/core @langchain/openai
```

```js
import { GalileoCallback, init, flush } from 'galileo';
import { ChatOpenAI } from '@langchain/openai';

await init({ projectName: 'my-project' });

const model = new ChatOpenAI({ model: 'gpt-4o' });
const callback = new GalileoCallback();

const response = await model.invoke('Say hello!', { callbacks: [callback] });

await flush();
```

#### OpenAI Agents SDK Integration

Use `GalileoTracingProcessor` to log traces from the OpenAI Agents SDK. Requires `@openai/agents` as a peer dependency.

```js
import { GalileoTracingProcessor } from 'galileo';

// Basic usage
const processor = new GalileoTracingProcessor();

// With custom ingestion hook
const processorWithHook = new GalileoTracingProcessor(
  undefined, // no custom logger
  true, // flush on trace end
  async (request) => {
    console.log(`Ingesting ${request.traces.length} traces`);
  }
);
```

#### Datasets

Create a dataset and upload it to Galileo:

```js
import { createDataset } from 'galileo';

const dataset = await createDataset({
  name: 'names',
  content: [
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
import { createPrompt, runExperiment } from 'galileo';

const template = await createPrompt({
  template: [{ role: 'user', content: 'Say "Hello, {name}"!' }],
  projectName: 'my-test-project-5',
  name: `Hello name prompt`
});

// Run the experiment. You'll receive a URL to view the results.
await runExperiment({
  name: `Test Experiment`,
  datasetName: 'names',
  promptTemplate: template,
  metrics: ['correctness'],
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
  metrics: ['correctness'],
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
    model: 'gpt-5-mini',
    messages: [{ content: `Say hello ${input['name']}!`, role: 'user' }]
  });
  return result;
};

await runExperiment({
  name: `Test Experiment`,
  datasetName: 'names',
  function: runner,
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
    model: 'gpt-5-mini',
    messages: [{ content: `Say hello ${input['name']}!`, role: 'user' }]
  });
  return result;
};

await runExperiment({
  name: `Test Experiment`,
  dataset: dataset,
  runner: runner,
  metrics: ['correctness'],
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
- `npm link galileo`

Use `node` to run examples, e.g. `node examples/logger/workflow.js`.
