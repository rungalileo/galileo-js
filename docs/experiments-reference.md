# `runExperiment` — Reference

Exhaustive catalogue of input combinations and error conditions for `runExperiment`. For a concise orientation (the 11-step workflow, the entity layout, points of concern), see [`src/entities/AGENTS.md`](../src/entities/AGENTS.md). This document is the drill-down: every valid input shape reproduced with the corresponding code path, and every possible error with its exact message and validation gate.

---

## 1. Type System — All Valid Input Combinations

`RunExperimentParams<T>` is a **union of 6 concrete type intersections** (defined in `src/types/experiment.types.ts`). Every call must satisfy exactly one of these.

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

## 2. Metric categorisation (within `Metrics.createMetricConfigs`)

| Input Type                                                                                         | Categorization                                                         |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `string` matching UUID regex                                                                       | Server-side: looked up by scorer ID                                    |
| `string` (non-UUID)                                                                                | Server-side: looked up by label name (e.g. `"Correctness"`)            |
| `GalileoMetrics` const value (e.g. `GalileoMetrics.correctness`)                                   | Server-side: looked up by label string `"Correctness"`                 |
| `Metric` object `{ name, version? }`                                                               | Server-side: looked up by label, optionally pinned to specific version |
| `LocalMetricConfig` object `{ name, scorerFn, aggregatorFn?, scorableTypes?, aggregatableTypes? }` | Client-side: validated and returned separately                         |

Validation (same method):

- `LocalMetricConfig.aggregatableTypes` must not overlap with `scorableTypes`.
- `aggregatableTypes` can only contain `'trace'` or `'workflow'`.
- Any unresolved metric name/ID throws.

Returns `[ScorerConfig[], LocalMetricConfig[]]`.

---

## 3. Complete Error Catalog

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

## 4. Scenario Catalogue

### Scenario 1: Function + Inline Array Dataset, No Metrics

```typescript
runExperiment({
  name: 'test-exp',
  projectName: 'my-project',
  dataset: [{ input: 'hello', output: 'world' }],
  function: async (input) => callLLM(input)
});
```

**Flow:** Resolve project → validate name → create experiment (no dataset reference since array) → skip tags → skip metrics → load: convert array to DatasetRecords, `loadedDatasetObj=null` → function branch → init logger → process each row locally → flush → return results + link.

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

**Flow:** Resolve project → validate name → create experiment (with dataset reference from ID lookup) → skip tags → configure metrics: resolve "Correctness" and "Completeness" labels via API, register scorers → load dataset records by ID → function branch → init logger → process rows → flush → log "metrics still being calculated" → return results + link.

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

**Flow:** Resolve project → validate name → create experiment (with dataset reference from name lookup) → skip tags → configure metrics: identify LocalMetricConfig, validate aggregatable/scorable types, return `[[], [localMetric]]` → load dataset records by name → function branch → init logger **with localMetrics** → process rows (local metrics computed during flush) → flush → return results + link.

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

**Flow:** Resolve project → validate name → create experiment → configure tags: upsert `version=v2`, upsert `team=ml` (tolerant of individual failures) → configure metrics: `correctness` server-side, `custom_score` local → load records → function branch → init logger with local metrics → process rows → flush → return results + link.

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

**Flow:** Resolve project → validate name → create experiment (with dataset reference) → skip tags → configure metrics: server-side only → validate no local metrics → load dataset by ID → prompt template branch → resolve `selectedVersionId` from PromptTemplate → create prompt run job with `DEFAULT_PROMPT_RUN_SETTINGS` → return link + server message. **No `results` field in output.**

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

**Flow:** Resolve project → validate name → create experiment → skip tags → skip metrics → load dataset by name → prompt template branch → resolve version ID from `PromptTemplateVersion.id` → create prompt run job with custom settings → return link + server message.

### Scenario 7: Prompt Template + Dataset as String (Name Shortcut)

```typescript
runExperiment({
  name: 'test-exp',
  projectName: 'my-project',
  dataset: 'my-dataset-name', // string treated as dataset name
  promptTemplate: myPromptTemplate
});
```

**Flow:** Resolve project → validate name → `getDatasetMetadata` sees string, looks up by name → create experiment (with dataset reference) → load dataset: `loadDatasetAndRecords` sees string, looks up by name, returns `[Dataset, records]` → prompt template branch → create job → return link.

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

**Flow:** Resolve project → `getDatasetMetadata` looks up by name → create experiment with dataset reference → `loadDatasetAndRecords` resolves string as name, fetches records → function branch → process rows → return results.

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

**Flow:** Resolve project → `validateExperimentName` finds collision → appends timestamp → experiment created as `"existing-exp 2026-04-14 at 12:30:45.123"` → logs warning → continues normally.

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

**Flow:** `getProjectWithEnvFallbacks({ name: undefined, projectId: undefined })` → reads `GALILEO_PROJECT` env var → resolves project → continues normally.

---

## 5. Error Scenarios (runnable reproductions)

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

## 6. Behavioural Notes

1. **Sequential row processing** — rows are processed in a `for...of` loop; no parallelism.
2. **User function errors are swallowed** — `processRow` catches all errors and converts them to `"Error: ..."` strings. Experiment completes.
3. **Tag failures are tolerant** — individual tag upsert failures are logged but don't abort the experiment.
4. **Prompt template experiments are async on the server** — `createPromptRunJob` submits a job. The response `message` confirms submission. Results appear later in the console.
5. **`results` field is only present for function-based experiments.** Prompt template experiments return `undefined` for `results`.
6. **`deserializeInputFromString`** — if the `row.input` is not valid JSON, it wraps the raw string as `{ value: rawString }` rather than throwing.
7. **`GALILEO_CONSOLE_URL` rewriting** — if the URL contains `api.galileo.ai`, it's automatically rewritten to `app.galileo.ai` for the console link.
8. **Metric versions** — the `Metric` object type supports `{ name: string, version?: number }` to pin to a specific scorer version. Without `version`, the latest version is used.

## 7. `DEFAULT_PROMPT_RUN_SETTINGS`

```typescript
{ n: 1, echo: false, tools: null, top_k: 40, top_p: 1.0,
  logprobs: true, max_tokens: 256, model_alias: 'GPT-4o',
  temperature: 0.8, tool_choice: null, top_logprobs: 5,
  stop_sequences: null, deployment_name: null, response_format: null,
  presence_penalty: 0.0, frequency_penalty: 0.0 }
```
