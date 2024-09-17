# Observe-js

NodeJS client for Galileo Observe.

## Testing
In the root directory, run:
- `npm i`
- `npm link`

In the examples directory, run:
- `npm i`
- `npm link @rungalileo/observe`
- `node openai.js`

## Making changes
When updating the code, only modify the *.ts files and then run:
- `npm run format`
- `npm run lint-fix` (this doesn't currently pass)
- `npm run build`

## Logging data to Galileo Observe
```
import { GalileoObserveCallback } from "@rungalileo/observe";
const observe_callback = new GalileoObserveCallback("llm_monitor_example", "app_v1")// project and version
await observe_callback.init();
```

Add the callback `{callbacks: [observe_callback]}` in the Langchain invoke step of your application.

## Logging workflows to Galileo Observe

Initialize workflow logging.

```
import { GalileoObserveWorkflows } from "@rungalileo/observe";
const observeWorkflows = new GalileoObserveWorkflows("llm_monitor_example");
await observeWorkflows.init();
```

### Adding workflows

Workflows can be added using  `addWorkflow`, `addAgentWorkflow`, and `addSingleStepWorkflow`.

```
observeWorkflows.addWorkflow(new WorkflowStep({ ...step }));
```

### Adding steps and nested workflows

*** Note: steps and nested workflows can only be added with `addWorkflow` and `addAgentWorkflow`. ***

Workflow steps can be added using  `addLlmStep`, `addRetrieverStep`, `addToolStep`.

```
observeWorkflows.addLlmStep(new LlmStep({ ...step }));
```

Nested workflows can be added using  `addWorkflowStep` and `addAgentStep`.

```
observeWorkflows.addWorkflowStep(new WorkflowStep({ ...step }));
```

The next step you add will be a child of this workflow.

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

## Retrieving data from Galileo Observe

```
import { ApiClient } from "@rungalileo/observe";
const apiClient = new ApiClient();
await apiClient.init("llm_monitor_test_1");// project
```

You can use this with `getLoggedData` to retrieve the raw data.
```
const rows = await apiClient.getLoggedData(
    "2024-03-11T16:15:28.294Z",// ISO start_time string with timezone
    "2024-03-12T16:15:28.294Z",// ISO end_time string with timezone
    filters,// an array of information like "col_name":"model"
    sort_spec,// an array of information like "sort_dir":"asc"
    limit// a number of items to return
);
console.log(rows);
```

You can use `getMetrics` to get corresponding metrics.

```
const metrics = await apiClient.getMetrics(
    "2024-03-11T16:15:28.294Z",
    "2024-03-12T16:15:28.294Z",
    filters
);
console.log(metrics);
```