# Observe-js

NodeJS client for Galileo Observe.

## Testing
In the root direcory, rum:
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

## Sample usage
```
import { GalileoObserveCallback } from "@rungalileo/observe";
const observe_callback = new GalileoObserveCallback("llm_monitor_example", "app_v1")// project and version
await observe_callback.init();
```

Add the callback `{callbacks: [observe_callback]}` in the invoke step of your application.

## Data logging

```
import { ApiClient } from "@rungalileo/observe";
const apiClient = new ApiClient();
await apiClient.init("llm_monitor_test_1");// project
```

You can use this with `getLoggedData` to retrieve the raw data.
```
const rows = await apiClient.getLoggedData(
    "2024-03-11T16:15:28.294Z",// ISO start_stime string with timezone
    "2024-03-12T16:15:28.294Z",// ISO end_stime string with timezone
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
