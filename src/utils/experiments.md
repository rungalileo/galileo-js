# `experiments.ts` — Utility Reference

## Overview

`src/utils/experiments.ts` is the public-facing utility module for the Galileo experiment system. It exposes 6 top-level async functions that serve as the SDK's experiment API surface. Each function instantiates the `Experiments` entity class (`src/entities/experiments.ts`) and delegates to it, so this file acts as a stateless convenience layer — no class instantiation or lifecycle management is required by the caller.

### Exported Functions

| Function                                                            | Purpose                                                                         |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `getExperiments(projectName?, projectId?)`                          | List all experiments for a project                                              |
| `getExperiment({ id?, name?, projectName })`                        | Fetch a single experiment by ID or name                                         |
| `createExperiment(name, projectName, dataset?, metrics?)`           | Create a new experiment with optional dataset and metrics                       |
| `runExperiment(params)`                                             | **Primary orchestrator** — create, configure, and execute a full experiment run |
| `updateExperiment({ id, projectId?, projectName?, updateRequest })` | Update experiment metadata                                                      |
| `deleteExperiment({ id, projectId })`                               | Delete an experiment                                                            |

### Architecture

The module sits between callers (user code, CLI) and two lower layers:

- **Entity layer** (`src/entities/experiments.ts`) — the `Experiments` class holds the orchestration logic, API client lifecycle, and multi-step workflows.
- **API client layer** (`src/api-client/`) — `GalileoApiClient` handles HTTP communication with the Galileo backend.

Supporting subsystems used during experiment runs:

| Subsystem               | File(s)                                             | Role                                                                                                                                    |
| ----------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Datasets**            | `src/utils/datasets.ts`, `src/entities/datasets.ts` | Load, parse, and convert dataset records from inline arrays, server IDs, or names                                                       |
| **Metrics**             | `src/utils/metrics.ts`                              | Categorize metrics into server-side (scorer configs) and client-side (local metrics), validate, and register with the API               |
| **Experiment Tags**     | `src/entities/experiment-tags.ts`                   | Upsert key-value tags on experiment records                                                                                             |
| **Singleton / Context** | `src/singleton.ts`                                  | `AsyncLocalStorage`-based context propagation for `experimentId` and `projectName` across async boundaries; logger init/flush lifecycle |
| **Wrappers**            | `src/wrappers.ts`                                   | `log()` function that wraps user functions to emit trace spans                                                                          |
| **Projects**            | `src/utils/projects.ts`                             | `getProjectWithEnvFallbacks()` — resolves project from explicit params or `GALILEO_PROJECT` / `GALILEO_PROJECT_ID` env vars             |

### Key Types

Defined in `src/types/experiment.types.ts`:

- **`RunExperimentParams<T>`** — union of 6 type intersections encoding all valid (processing mode x dataset source) combinations
- **`RunExperimentOutput`** — `{ results?: string[], experiment, link, message? }`
- **`PromptRunSettings`** — server-side prompt execution configuration with defaults in `DEFAULT_PROMPT_RUN_SETTINGS`
- **`PromptTemplateType`** — `PromptTemplate | PromptTemplateVersion`

Metric inputs accept any of: `GalileoMetrics` const values (e.g. `GalileoMetrics.correctness`), plain `string` labels or UUIDs, `Metric` objects `{ name, version? }`, or `LocalMetricConfig` objects `{ name, scorerFn, aggregatorFn?, scorableTypes?, aggregatableTypes? }`.

---

# `runExperiment` — Complete Workflow Analysis

This report details every input combination, code path, validation gate, and resulting workflow for `runExperiment` in `src/utils/experiments.ts` and its backing entity class `src/entities/experiments.ts`.

---

## 1. Entry Point

```typescript
// src/utils/experiments.ts:95-100
export async function runExperiment<T extends Record<string, unknown>>(
  params: RunExperimentParams<T>
): Promise<RunExperimentOutput>;
```

This is a thin wrapper that instantiates `new Experiments()` and delegates to `experiments.runExperiment(params)`.

---

## 2. Type System — All Valid Input Combinations

`RunExperimentParams<T>` is a **union of 6 concrete type intersections** (defined in `src/types/experiment.types.ts:125-131`). Every call must satisfy exactly one of these:

### Axis 1: Processing Mode (mutually exclusive)

| Variant             | Required Field(s)                                                                                        | Description                                                          |
| ------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **Function**        | `function: (input: T, metadata?) => Promise<unknown>`                                                    | User-supplied async function that processes each dataset row locally |
| **Prompt Template** | `promptTemplate: PromptTemplate \| PromptTemplateVersion`, optional `promptSettings?: PromptRunSettings` | Server-side execution via a Galileo prompt template                  |

### Axis 2: Dataset Source (mutually exclusive)

| Variant             | Required Field        | Accepted Types                                                                                                                   |
| ------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Inline dataset**  | `dataset`             | `DatasetDBType` (server-fetched object), `Record<string, unknown>[]` (array of row objects), or `string` (dataset name shortcut) |
| **Dataset by ID**   | `datasetId: string`   | UUID of an existing dataset                                                                                                      |
| **Dataset by name** | `datasetName: string` | Name of an existing dataset                                                                                                      |

### Axis 3: Common Optional Fields (from `BaseRunExperimentParams`)

| Field            | Type                                                           | Default                                    | Description                       |
| ---------------- | -------------------------------------------------------------- | ------------------------------------------ | --------------------------------- |
| `name`           | `string`                                                       | **(required)**                             | Experiment name                   |
| `projectName`    | `string?`                                                      | Falls back to `GALILEO_PROJECT` env var    | Project to run under              |
| `projectId`      | `string?`                                                      | Falls back to `GALILEO_PROJECT_ID` env var | Project ID (alternative to name)  |
| `metrics`        | `(GalileoMetrics \| string \| Metric \| LocalMetricConfig)[]?` | `undefined` (no metrics)                   | Evaluation metrics                |
| `experimentTags` | `Record<string, string>?`                                      | `undefined` (no tags)                      | Key-value tags for the experiment |

### The 6 Union Members

```
1. function + dataset        (local execution, inline data)
2. function + datasetId      (local execution, server dataset by ID)
3. function + datasetName    (local execution, server dataset by name)
4. promptTemplate + dataset  (server execution, inline data — but Array is rejected at runtime!)
5. promptTemplate + datasetId      (server execution, server dataset by ID)
6. promptTemplate + datasetName    (server execution, server dataset by name)
```

---

## 3. Orchestration Flow — `Experiments.runExperiment()`

Source: `src/entities/experiments.ts:337-428`. Below is the step-by-step flow with every branch point.

### Step 1: Determine Processing Mode (lines 341-348)

```typescript
const isFunction = 'function' in params;
const isPromptTemplate = 'promptTemplate' in params;
```

**Gate:** If `!isFunction && !isPromptTemplate` — throws `"Experiment not properly configured for either function or prompt template processing."` (this shouldn't happen if the TypeScript types are respected, but guards against runtime misuse).

### Step 2: Validate Array Dataset + Prompt Template Conflict (lines 351-359)

**Gate:** If `'dataset' in params && Array.isArray(params.dataset) && isPromptTemplate` — throws `"Prompt template experiments cannot be run with a local dataset"`.

This means prompt templates **cannot** use inline `Record<string, unknown>[]` arrays. They must reference a server-side dataset via `DatasetDBType` object, `datasetId`, `datasetName`, or `dataset` as a `string` (name shortcut).

### Step 3: Resolve Project (line 363)

Calls `getExperimentProject(projectName, projectId)` which delegates to `getProjectWithEnvFallbacks({ name: projectName, projectId })`.

**Resolution priority:**

1. Explicit `projectId` parameter
2. Explicit `projectName` parameter
3. `GALILEO_PROJECT_ID` environment variable
4. `GALILEO_PROJECT` environment variable

**Gate:** If none resolve — throws `"Exactly one of 'projectId' or 'projectName' must be provided, or set in the environment variables GALILEO_PROJECT_ID or GALILEO_PROJECT"`.

### Step 4: Validate Project Name (lines 364-368)

**Gate:** If `!project.name` — throws `"Experiment {name} could not be created, project name is required but not available."`.

### Step 5: Validate/Deduplicate Experiment Name (lines 370-373)

Calls `validateExperimentName(name, project.name)`:

- Looks up existing experiment by name in the project
- **If collision:** appends ISO timestamp (e.g. `"My Exp 2026-04-14 at 12:30:45.123"`) and logs a warning
- **If no collision:** returns name unchanged

### Step 6: Create Experiment (lines 374-378)

Calls `createNewExperiment(params, experimentName, project.name)`:

1. `getDatasetMetadata(params, projectName)` — resolves dataset metadata for the experiment record:
   - `dataset` field (non-array, non-string) — used directly as `Dataset` object
   - `dataset` field (string) — looked up by name via `Datasets.get({ name })`
   - `datasetId` — looked up by ID via `Datasets.get({ id })`
   - `datasetName` — looked up by name via `Datasets.get({ name })`
   - `dataset` field (array) — returns `null` (no server-side dataset reference)
2. Constructs `ExperimentDatasetRequest` with `{ datasetId, versionIndex }` if a dataset object was found
3. Calls `this.createExperiment({ name, projectName, dataset: datasetRequest })`
4. **Gate:** If creation returns falsy — throws `"Experiment {name} could not be created"`

### Step 7: Configure Experiment Tags (lines 381-385)

Calls `configureExperimentTags(params.experimentTags, project.id, experiment.id)`:

- **If `experimentTags` is undefined/null:** skipped entirely
- **Otherwise:** iterates each `[key, value]` pair and calls `ExperimentTags.upsertExperimentTag({ projectId, experimentId, key, value, tagType: 'generic' })`
- **Error handling:** individual tag failures are caught and logged as warnings — they do **not** abort the experiment

### Step 8: Configure Metrics (lines 386-387)

Calls `configureExperimentMetrics(metrics, project.id, experiment.id)`:

- **If `metrics` is undefined or empty:** returns `[[], []]`
- **Otherwise:** calls `Metrics.createMetricConfigs(projectId, experimentId, metrics)`

**Metric categorization in `createMetricConfigs`:**

| Input Type                                                                                         | Categorization                                                         |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `string` matching UUID regex                                                                       | Server-side: looked up by scorer ID                                    |
| `string` (non-UUID)                                                                                | Server-side: looked up by label name (e.g. `"Correctness"`)            |
| `GalileoMetrics` const value (e.g. `GalileoMetrics.correctness`)                                   | Server-side: looked up by label string `"Correctness"`                 |
| `Metric` object `{ name, version? }`                                                               | Server-side: looked up by label, optionally pinned to specific version |
| `LocalMetricConfig` object `{ name, scorerFn, aggregatorFn?, scorableTypes?, aggregatableTypes? }` | Client-side: validated and returned separately                         |

**Validation within metric configuration:**

- `LocalMetricConfig.aggregatableTypes` must not overlap with `scorableTypes`
- `aggregatableTypes` can only contain `'trace'` or `'workflow'`
- Any unresolved metric name/ID — throws `"One or more non-existent metrics are specified: ..."`

**Returns:** `[ScorerConfig[], LocalMetricConfig[]]`

### Step 9: Validate Local Metrics + Prompt Template (lines 390-394)

**Gate:** If `localMetricConfigs.length > 0 && isPromptTemplate` — throws `"Local metrics can only be used with a locally run experiment (function-based), not a prompt template experiment."`.

Local metrics require client-side execution (they call `scorerFn` on each span), so they are incompatible with server-side prompt template execution.

### Step 10: Load Dataset Records (lines 399-402)

Calls `loadExperimentData(params, project.name)` which delegates to `Datasets.loadDatasetAndRecords()`:

**Resolution priority within `loadDatasetAndRecords`:**

1. `datasetId` — fetch by ID, get records
2. `datasetName` — fetch by name, get records
3. `dataset` as `string` — treated as name, fetch by name, get records
4. `dataset` as `Dataset`/`DatasetDBType` object — use directly, get records
5. `dataset` as `Record<string, unknown>[]` — convert to `DatasetRecord[]` via `getDatasetRecordsFromArray()`, return `[null, records]`

**Post-load validation:**

- **Function mode + no records:** throws `"A dataset (records, id, or name) must be provided for the experiment."`
- **Prompt template mode + no `loadedDatasetObj`:** throws `"A dataset record, id, or name of a dataset must be provided when a prompt_template is used"`

### Step 11: Branch — Process by Mode (lines 405-427)

---

## 4. Branch A: Function-Based Experiment

Source: `processExperimentFunction()` then `runExperimentWithFunction()` (lines 577-618, 251-318)

### Execution Context Setup

The entire execution is wrapped in `experimentContext.run()` (an `AsyncLocalStorage` context) with `{ experimentId, projectName }`. This propagates the experiment identity through all nested async calls automatically.

### Sub-steps:

1. **Initialize singleton logger:** `init({ experimentId, projectName, localMetrics })` — creates/retrieves a `GalileoLogger` keyed by project+experiment, configured with local metrics

2. **Process each dataset row sequentially:**

   ```
   for (const row of dataset) {
     loggedProcessFn = log({ name: experimentName, datasetRecord: row }, processFn)
     output = await processRow(row, loggedProcessFn)
     outputs.push(output)
   }
   ```

   For each row:
   - `log()` wraps the user's function to create a trace span with the experiment name and dataset record context
   - `processRow()` calls `deserializeInputFromString(row.input)` to parse the JSON string input back to an object
   - Calls `processFn(deserializedInput, row.metadata)` — this is the user's function
   - JSON-stringifies the result
   - **Error handling:** catches any error from the user function and returns `"Error: {message}"` string — does NOT rethrow

3. **Flush logger:** `await flush({ projectName, experimentId })` — uploads all collected traces to the Galileo API

4. **Generate results link:** `getLinkToExperimentResults(experimentId, projectId)` constructs URL from `GALILEO_CONSOLE_URL` env var (default `https://app.galileo.ai`) as `{baseUrl}/project/{projectId}/experiments/{experimentId}`

5. **Post-processing log message:** If server-side `scorerConfigs.length > 0`, logs that metrics are still being calculated. Otherwise logs completion.

### Output:

```typescript
{
  results: string[],        // JSON-stringified outputs from each row
  experiment: ExperimentResponseType,
  link: string,             // URL to results in Galileo console
  message: string           // Human-readable completion message
}
```

---

## 5. Branch B: Prompt Template Experiment

Source: `processExperimentPromptTemplate()` (lines 620-666)

### Sub-steps:

1. **Resolve prompt template version ID:**
   - If `promptTemplate` has a `'version'` property — it's a `PromptTemplateVersion`, use its `id`
   - Otherwise — it's a `PromptTemplate`, use its `selectedVersionId`

2. **Initialize API client** scoped to the project

3. **Create prompt run job:** `client.createPromptRunJob(experimentId, projectId, promptTemplateVersionId, loadedDatasetObj.id, scorerConfigs, promptSettings)`
   - If `promptSettings` was not provided, uses `DEFAULT_PROMPT_RUN_SETTINGS`:
     ```typescript
     { n: 1, echo: false, tools: null, top_k: 40, top_p: 1.0,
       logprobs: true, max_tokens: 256, model_alias: 'GPT-4o',
       temperature: 0.8, tool_choice: null, top_logprobs: 5,
       stop_sequences: null, deployment_name: null, response_format: null,
       presence_penalty: 0.0, frequency_penalty: 0.0 }
     ```

4. **Generate results link**

### Output:

```typescript
{
  experiment: ExperimentResponseType,
  link: string,             // URL to results
  message: string           // From server response (job submission confirmation)
  // NOTE: no `results` field — prompt templates execute server-side
}
```

---

## 6. Complete Error Catalog

| #   | Condition                                                      | Error Message                                                                                                                                                                     | Stage                  |
| --- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| 1   | Neither `function` nor `promptTemplate` in params              | `"Experiment not properly configured for either function or prompt template processing."`                                                                                         | Param validation       |
| 2   | Array dataset + prompt template                                | `"Prompt template experiments cannot be run with a local dataset"`                                                                                                                | Param validation       |
| 3   | Project resolution fails (no ID, name, or env vars)            | `"Exactly one of 'projectId' or 'projectName' must be provided, or set in the environment variables GALILEO_PROJECT_ID or GALILEO_PROJECT"`                                       | Project resolution     |
| 4   | Resolved project has no name                                   | `"Experiment {name} could not be created, project name is required but not available."`                                                                                           | Project validation     |
| 5   | Experiment creation returns falsy                              | `"Experiment {name} could not be created"`                                                                                                                                        | Experiment creation    |
| 6   | Unknown metric names/IDs                                       | `"One or more non-existent metrics are specified: ..."`                                                                                                                           | Metric configuration   |
| 7   | `LocalMetricConfig.aggregatableTypes` overlaps `scorableTypes` | `"aggregatableTypes cannot contain any types in scorableTypes. Overlap: ..."`                                                                                                     | Metric validation      |
| 8   | `aggregatableTypes` contains invalid types                     | `"aggregatableTypes can only contain 'trace' or 'workflow' step types. Invalid types: ..."`                                                                                       | Metric validation      |
| 9   | Local metrics + prompt template                                | `"Local metrics can only be used with a locally run experiment (function-based), not a prompt template experiment."`                                                              | Metric/mode validation |
| 10  | Function mode + no dataset records                             | `"A dataset (records, id, or name) must be provided for the experiment."`                                                                                                         | Dataset validation     |
| 11  | Prompt template mode + no dataset object                       | `"A dataset record, id, or name of a dataset must be provided when a prompt_template is used"`                                                                                    | Dataset validation     |
| 12  | Invalid metric format                                          | `"Invalid metric format. Expected string, GalileoMetrics const object value, Metric object with 'name' property, or LocalMetricConfig with 'name' and 'scorerFn'. Received: ..."` | Metric categorization  |

---

## 7. All Possible Input Scenarios and Their Workflows

### Scenario 1: Function + Inline Array Dataset, No Metrics

```typescript
runExperiment({
  name: 'test-exp',
  projectName: 'my-project',
  dataset: [{ input: 'hello', output: 'world' }],
  function: async (input) => callLLM(input)
});
```

**Flow:** Resolve project -> validate name -> create experiment (no dataset reference since array) -> skip tags -> skip metrics -> load: convert array to DatasetRecords, `loadedDatasetObj=null` -> function branch -> init logger -> process each row locally -> flush -> return results + link.

### Scenario 2: Function + Dataset by ID, With Server Metrics

```typescript
runExperiment({
  name: 'test-exp',
  projectName: 'my-project',
  datasetId: 'uuid-of-dataset',
  function: async (input) => callLLM(input),
  metrics: [GalileoMetrics.correctness, 'Completeness']
});
```

**Flow:** Resolve project -> validate name -> create experiment (with dataset reference from ID lookup) -> skip tags -> configure metrics: resolve "Correctness" and "Completeness" labels via API, register scorers -> load dataset records by ID -> function branch -> init logger -> process rows -> flush -> log "metrics still being calculated" -> return results + link.

### Scenario 3: Function + Dataset by Name, With Local Metrics

```typescript
runExperiment({
  name: 'test-exp',
  projectName: 'my-project',
  datasetName: 'my-dataset',
  function: async (input) => callLLM(input),
  metrics: [
    {
      name: 'custom_score',
      scorerFn: (span) => (span.output?.length > 10 ? 1 : 0)
    }
  ]
});
```

**Flow:** Resolve project -> validate name -> create experiment (with dataset reference from name lookup) -> skip tags -> configure metrics: identify LocalMetricConfig, validate aggregatable/scorable types, return `[[], [localMetric]]` -> load dataset records by name -> function branch -> init logger **with localMetrics** -> process rows (local metrics computed during flush) -> flush -> return results + link.

### Scenario 4: Function + Dataset by Name, Mixed Metrics + Tags

```typescript
runExperiment({
  name: 'test-exp',
  projectName: 'my-project',
  datasetName: 'my-dataset',
  function: async (input) => callLLM(input),
  metrics: [
    GalileoMetrics.correctness,
    { name: 'custom_score', scorerFn: (span) => 1 }
  ],
  experimentTags: { version: 'v2', team: 'ml' }
});
```

**Flow:** Resolve project -> validate name -> create experiment -> configure tags: upsert `version=v2`, upsert `team=ml` (tolerant of individual failures) -> configure metrics: `correctness` server-side, `custom_score` local -> load records -> function branch -> init logger with local metrics -> process rows -> flush -> return results + link.

### Scenario 5: Prompt Template (PromptTemplate object) + Dataset by ID

```typescript
runExperiment({
  name: 'test-exp',
  projectName: 'my-project',
  datasetId: 'uuid-of-dataset',
  promptTemplate: myPromptTemplate, // PromptTemplate with selectedVersionId
  metrics: [GalileoMetrics.correctness]
});
```

**Flow:** Resolve project -> validate name -> create experiment (with dataset reference) -> skip tags -> configure metrics: server-side only -> validate no local metrics -> load dataset by ID -> prompt template branch -> resolve `selectedVersionId` from PromptTemplate -> create prompt run job with DEFAULT_PROMPT_RUN_SETTINGS -> return link + server message. **No `results` field in output.**

### Scenario 6: Prompt Template (PromptTemplateVersion) + Dataset by Name + Custom Settings

```typescript
runExperiment({
  name: 'test-exp',
  projectName: 'my-project',
  datasetName: 'my-dataset',
  promptTemplate: myPromptTemplateVersion, // PromptTemplateVersion with version property
  promptSettings: {
    ...DEFAULT_PROMPT_RUN_SETTINGS,
    temperature: 0.2,
    max_tokens: 512
  }
});
```

**Flow:** Resolve project -> validate name -> create experiment -> skip tags -> skip metrics -> load dataset by name -> prompt template branch -> resolve version ID from `PromptTemplateVersion.id` -> create prompt run job with custom settings -> return link + server message.

### Scenario 7: Prompt Template + Dataset as String (Name Shortcut)

```typescript
runExperiment({
  name: 'test-exp',
  projectName: 'my-project',
  dataset: 'my-dataset-name', // string treated as dataset name
  promptTemplate: myPromptTemplate
});
```

**Flow:** Resolve project -> validate name -> `getDatasetMetadata` sees string, looks up by name -> create experiment (with dataset reference) -> load dataset: `loadDatasetAndRecords` sees string, looks up by name, returns `[Dataset, records]` -> prompt template branch -> create job -> return link.

### Scenario 8: Prompt Template + Dataset as DatasetDBType Object

```typescript
runExperiment({
  name: 'test-exp',
  projectName: 'my-project',
  dataset: fetchedDatasetObject, // DatasetDBType from prior getDataset() call
  promptTemplate: myPromptTemplate
});
```

**Flow:** Same as scenario 7, but `getDatasetMetadata` returns the object directly, and `loadDatasetAndRecords` uses it directly.

### Scenario 9: Function + Dataset as String (Name Shortcut)

```typescript
runExperiment({
  name: 'test-exp',
  projectName: 'my-project',
  dataset: 'my-dataset-name',
  function: async (input) => callLLM(input)
});
```

**Flow:** Resolve project -> `getDatasetMetadata` looks up by name -> create experiment with dataset reference -> `loadDatasetAndRecords` resolves string as name, fetches records -> function branch -> process rows -> return results.

### Scenario 10: Function + Inline Array + Local Metrics with Aggregation

```typescript
runExperiment({
  name: 'test-exp',
  projectName: 'my-project',
  dataset: [{ input: 'q1' }, { input: 'q2' }],
  function: async (input) => callLLM(input),
  metrics: [
    {
      name: 'response_length',
      scorerFn: (span) => String(span.output).length,
      aggregatorFn: (scores) => ({
        avg: scores.reduce((a, b) => Number(a) + Number(b), 0) / scores.length,
        max: Math.max(...scores.map(Number))
      }),
      scorableTypes: ['llm'],
      aggregatableTypes: ['trace']
    }
  ]
});
```

**Flow:** Like scenario 3, but with aggregation. The `aggregatorFn` produces a dict result, which gets expanded to `response_length_avg` and `response_length_max` metrics on the trace.

### Scenario 11: Name Collision

```typescript
// "existing-exp" already exists in the project
runExperiment({
  name: 'existing-exp',
  projectName: 'my-project',
  datasetName: 'ds',
  function: async (input) => callLLM(input)
});
```

**Flow:** Resolve project -> `validateExperimentName` finds collision -> appends timestamp -> experiment created as `"existing-exp 2026-04-14 at 12:30:45.123"` -> logs warning -> continues normally.

### Scenario 12: Project from Environment Variables

```typescript
// GALILEO_PROJECT="env-project" is set
runExperiment({
  name: 'test-exp',
  // no projectName or projectId
  datasetName: 'ds',
  function: async (input) => callLLM(input)
});
```

**Flow:** `getProjectWithEnvFallbacks({ name: undefined, projectId: undefined })` -> reads `GALILEO_PROJECT` env var -> resolves project -> continues normally.

---

## 8. Error Scenarios

### Error A: Prompt Template + Array Dataset

```typescript
runExperiment({
  name: 'x',
  projectName: 'p',
  dataset: [{ input: 'hi' }],
  promptTemplate: pt
});
// -> Error: "Prompt template experiments cannot be run with a local dataset"
```

### Error B: Local Metrics + Prompt Template

```typescript
runExperiment({
  name: 'x',
  projectName: 'p',
  datasetName: 'ds',
  promptTemplate: pt,
  metrics: [{ name: 'm', scorerFn: () => 1 }]
});
// -> Error: "Local metrics can only be used with a locally run experiment..."
```

### Error C: Function + Empty Dataset

```typescript
runExperiment({
  name: 'x',
  projectName: 'p',
  dataset: [],
  function: async () => 'result'
});
// -> Error: "A dataset (records, id, or name) must be provided for the experiment."
```

### Error D: No Project Info

```typescript
// No env vars set either
runExperiment({
  name: 'x',
  datasetName: 'ds',
  function: async () => 'result'
});
// -> Error: "Exactly one of 'projectId' or 'projectName' must be provided..."
```

### Error E: Unknown Metric

```typescript
runExperiment({
  name: 'x',
  projectName: 'p',
  datasetName: 'ds',
  function: async () => 'result',
  metrics: ['nonexistent_metric']
});
// -> Error: "One or more non-existent metrics are specified: 'nonexistent_metric'"
```

### Error F: User Function Throws (Non-fatal)

```typescript
runExperiment({
  name: 'x',
  projectName: 'p',
  datasetName: 'ds',
  function: async () => {
    throw new Error('boom');
  }
});
// -> Does NOT throw. results array contains "Error: boom" for that row.
// Experiment completes successfully with error strings in results.
```

---

## 9. Key Behavioral Notes

1. **Sequential row processing:** Dataset rows are processed one at a time in a `for...of` loop — no parallelism.

2. **User function errors are swallowed:** `processRow` catches all errors and converts them to `"Error: ..."` strings. The experiment still completes.

3. **Tag failures are tolerant:** Individual tag upsert failures are logged but don't abort the experiment.

4. **Prompt template experiments are async on the server:** `createPromptRunJob` submits a job. The response `message` confirms submission. Results appear later in the console.

5. **`results` field is only present for function-based experiments.** Prompt template experiments return `undefined` for `results`.

6. **`deserializeInputFromString`:** If the `row.input` is not valid JSON, it wraps the raw string as `{ value: rawString }` rather than throwing.

7. **`GALILEO_CONSOLE_URL` rewriting:** If the URL contains `api.galileo.ai`, it's automatically rewritten to `app.galileo.ai` for the console link.

8. **Metric versions:** The `Metric` object type supports `{ name: string, version?: number }` to pin to a specific scorer version. Without `version`, the latest version is used.
