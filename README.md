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

Additionally, this library has a `getLoggedData` method which takes a `start_time` and `end_time` as an ISO string with a timezone, `filters` which takes an array of information such as `"col_name":"model"`, a `sort_spec` which takes an array of information such as `"sort_dir": "asc"`, a `limit` which takes a number of items to return, and `include_chains` which is a boolean to return chains data.
