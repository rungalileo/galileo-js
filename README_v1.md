# Galileo

JS client for Galileo.

Note: This README is for the deprecated v1 version of the client. For the v2 version, see [README.md](README.md).

## Setup

_Note: Optional LangChain dependencies are only needed for Observe Callback and may be excluded if not being used._

Without optional dependencies

`npm i @rungalileo/galileo --no-optional`

With optional dependencies

`npm i @rungalileo/galileo`

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

Copy `examples/.env.example` as `examples/.env` and set all variables.

Use `node` to run examples, e.g. `node examples/evaluate/workflow.js`.

# Evaluate Usage

## Workflow

Initialize workflow logging.

_Note: If the given project name exists, workflows will be logged to that existing project. A new project will be created
if the project name does not exist. A timestamped generic name will be created if no project name is set._

```
import { GalileoEvaluateWorkflow } from "@rungalileo/galileo";

const evaluateWorkflow = new GalileoEvaluateWorkflow("Evaluate Example Project"); // Accepts project name

await evaluateWorkflow.init();
```

### Adding workflows

Workflows can be added using `addWorkflow`, `addAgentWorkflow`, and `addSingleStepWorkflow`.

_Note: Steps and nested workflows can only be added on `addWorkflow` and `addAgentWorkflow`._

```
evaluateWorkflow.addWorkflow(new WorkflowStep({input, output, ...step}));
```

### Adding steps and nested workflows

Workflow steps can be added using `addLlmStep`, `addRetrieverStep`, `addToolStep`, `addWorkflow`, and `addAgentWorkflow`.

```
evaluateWorkflow.addLlmStep(new LlmStep({input, output, ...step}));
```

Nested workflows can be added using `addWorkflowStep` and `addAgentStep`.

_The next step you add will be a child of this workflow._

```
evaluateWorkflow.addWorkflowStep(new WorkflowStep({input, output, ...step}));
```

### Concluding workflows

To end a workflow or step out of the nested workflow, use `concludeWorkflow`.

```
evaluateWorkflow.concludeWorkflow(output, durationNs, statusCode);
```

### Uploading workflows

Use `uploadWorkflows` to upload workflows to Galileo Observe.

```
const scorers_config = {...config}

await observeWorkflows.uploadWorkflows(scorers_config);
```

# Observe Usage

## Workflow

Initialize workflow logging.

_Note: If the given project name exists, workflows will be logged to that existing project. A new project will be created
if the project name does not exist. A timestamped generic name will be created if no project name is set._

```
import { GalileoObserveWorkflow } from "@rungalileo/galileo";

const observeWorkflow = new GalileoObserveWorkflow("Observe Example Project"); // Accepts project name

await observeWorkflow.init();
```

### Adding workflows

Workflows can be added using `addWorkflow`, `addAgentWorkflow`, and `addSingleStepWorkflow`.

_Note: Steps and nested workflows can only be added on `addWorkflow` and `addAgentWorkflow`._

```
observeWorkflow.addWorkflow(new WorkflowStep({input, output, ...step}));
```

### Adding steps and nested workflows

Workflow steps can be added using `addLlmStep`, `addRetrieverStep`, `addToolStep`, `addWorkflow`, and `addAgentWorkflow`.

```
observeWorkflow.addLlmStep(new LlmStep({input, output, ...step}));
```

Nested workflows can be added using `addWorkflowStep` and `addAgentStep`.

_The next step you add will be a child of this workflow._

```
observeWorkflows.addWorkflowStep(new WorkflowStep({input, output, ...step}));
```

### Concluding workflows

To end a workflow or step out of the nested workflow, use `concludeWorkflow`.

```
observeWorkflows.concludeWorkflow(output, durationNs, statusCode);
```

### Uploading workflows

Use `uploadWorkflows` to upload workflows to Galileo Observe.

```
await observeWorkflows.uploadWorkflows();
```

## Callback

Initialize callbacks.

```
import { GalileoObserveCallback } from "@rungalileo/galileo";

const observe_callback = new GalileoObserveCallback("Observe Example Project")

await observe_callback.init();
```

Add the callback `{callbacks: [observe_callback]}` in the Langchain invoke step of your application.

## Retrieving data from Observe

Initialize the API Client.

```
import { ApiClient } from "@rungalileo/observe";

const apiClient = new ApiClient();

await apiClient.init("Observe Example Project");
```

You can use this with `getLoggedData` to retrieve the raw data.

```
const rows = await apiClient.getLoggedData(
    start_time,
    end_time,
    filters,
    sort_spec,
    limit
);

console.log(rows);
```

You can use `getMetrics` to get corresponding metrics.

```
const metrics = await apiClient.getMetrics(
    start_time,
    end_time,
    filters
);

console.log(metrics);
```
