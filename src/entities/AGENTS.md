# entities — Orientation

`src/entities/` holds the SDK's high-level domain classes. Each file wraps a logical resource (experiments, datasets, scorers, …) on top of `GalileoApiClient`, encapsulates multi-step workflows, and exposes a stateful API that the thin `src/utils/*` helper modules delegate to.

## File Map

| File                 | Role                                                                                                                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `experiments.ts`     | `Experiments` class — **primary orchestrator** for experiment lifecycle (`runExperiment`, `createExperiment`, `getExperiment`, `updateExperiment`, `deleteExperiment`). Owns the full run pipeline. See deep dive below. |
| `experiment-tags.ts` | `ExperimentTags` class — upsert/list/delete key-value tags on experiments (`tagType: 'generic'`).                                                                                                                        |
| `datasets.ts`        | `Datasets` class — fetch, create, append, and convert dataset records. Used during experiment runs for row loading.                                                                                                      |
| `runs.ts`            | Run-level queries and updates (trace runs inside an experiment).                                                                                                                                                         |
| `scorers.ts`         | `Scorers` class — resolve scorer IDs/labels to API-registered scorers (used by metric configuration).                                                                                                                    |
| `log-streams.ts`     | `LogStreams` class — create/fetch log streams that group traces in the Galileo console.                                                                                                                                  |
| `serialization.ts`   | JSON serialisation helpers specific to entity records (distinct from `src/utils/serialization.ts` which is generic).                                                                                                     |

## How the layers fit together

```
src/utils/experiments.ts       ← thin stateless wrappers exported to users
         │  delegates to
         ▼
src/entities/experiments.ts    ← Experiments class: orchestration, validation, workflow
         │  uses
         ▼
src/api-client/                ← GalileoApiClient (HTTP)
```

The utils layer is the **public surface**; the entities layer holds the **logic**. Don't leak orchestration into utils.

## `Experiments.runExperiment()` — the one workflow to know

Source: `src/entities/experiments.ts`. Single entry point for both processing modes (user function vs prompt template) across three dataset sources (inline, by ID, by name). Each call goes through 11 steps:

1. **Determine mode** — `'function' in params` vs `'promptTemplate' in params`. Neither → throws.
2. **Array+template gate** — inline `Array` dataset with `promptTemplate` → throws ("Prompt template experiments cannot be run with a local dataset").
3. **Resolve project** — explicit `projectId`/`projectName` → `GALILEO_PROJECT_ID` → `GALILEO_PROJECT` env fallback. None → throws.
4. **Validate project name** — project must have a name.
5. **Deduplicate experiment name** — name collision appends ISO timestamp, logs a warning.
6. **Create experiment** — resolves `ExperimentDatasetRequest` via `getDatasetMetadata` (dataset object, string=name, ID, or null for inline arrays), then POSTs.
7. **Configure tags** — `experimentTags?` upserted one by one; individual failures are logged, never abort the run.
8. **Configure metrics** — `Metrics.createMetricConfigs` categorises each input into server-side (scorer configs) or client-side (`LocalMetricConfig`). Unknown names/IDs → throws. Validates `aggregatableTypes` ⊆ `['trace','workflow']` and non-overlap with `scorableTypes`.
9. **Local-metrics+template gate** — local metrics with `promptTemplate` → throws.
10. **Load dataset records** — `Datasets.loadDatasetAndRecords` resolves by priority: `datasetId` → `datasetName` → `dataset:string` (name) → `dataset:object` → `dataset:array` (inline). Empty for function mode → throws; missing dataset object for prompt template → throws.
11. **Branch and execute**:
    - **Function branch** (`processExperimentFunction` → `runExperimentWithFunction`): wraps execution in `experimentContext.run({ experimentId, projectName })`, initialises the singleton logger with local metrics, processes rows sequentially (`for...of`), wraps each user function with `log()` to emit a span, **swallows user-function errors as `"Error: ..."` strings** (never rethrows), flushes, returns `{ results, experiment, link, message }`.
    - **Prompt-template branch** (`processExperimentPromptTemplate`): resolves `promptTemplateVersionId` from `PromptTemplate.selectedVersionId` or `PromptTemplateVersion.id`, submits a server-side prompt run job via `client.createPromptRunJob`, returns `{ experiment, link, message }` (no `results` — server executes asynchronously).

## Key Types (from `src/types/experiment.types.ts`)

- **`RunExperimentParams<T>`** — union of 6 intersections covering every valid (mode × dataset-source) combination.
- **`RunExperimentOutput`** — `{ results?: string[], experiment, link, message? }`. `results` is only populated in function mode.
- **`PromptRunSettings`** + `DEFAULT_PROMPT_RUN_SETTINGS` — server-side prompt run configuration.
- **Metric inputs** accept any of: `GalileoMetrics` const value, plain `string` (UUID or label), `Metric` object `{ name, version? }`, or `LocalMetricConfig` `{ name, scorerFn, aggregatorFn?, scorableTypes?, aggregatableTypes? }`.

## Subsystems this entity depends on

| Subsystem         | File(s)                                             | Role                                                                                                           |
| ----------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Datasets          | `src/entities/datasets.ts`, `src/utils/datasets.ts` | Load/parse/convert dataset records                                                                             |
| Metrics           | `src/utils/metrics.ts`                              | Categorise server-side vs client-side, validate, register                                                      |
| Experiment tags   | `src/entities/experiment-tags.ts`                   | Upsert key-value tags                                                                                          |
| Singleton/Context | `src/singleton.ts`                                  | `experimentContext` (`AsyncLocalStorage`) propagates `experimentId`/`projectName`; logger init/flush lifecycle |
| Wrappers          | `src/wrappers.ts`                                   | `log()` — wraps user fns to emit spans                                                                         |
| Projects          | `src/utils/projects.ts`                             | `getProjectWithEnvFallbacks()` — resolves project from params or env                                           |

## Points of Concern

- **User function errors are non-fatal** — `processRow` catches everything and emits `"Error: <message>"` in the `results` array. The run completes successfully. If a caller wants hard-fail semantics, they must check `results` themselves.
- **Sequential row processing** — rows run one at a time (no parallelism). For large datasets, expect linear wall-clock time. Do not add parallelism without considering logger/`experimentContext` safety.
- **Tag-failure tolerance** — individual tag upserts are caught and warned; the experiment proceeds. Don't gate business logic on `experimentTags` being present post-run.
- **`getDatasetMetadata` vs `loadDatasetAndRecords`** — two separate dataset resolutions happen (creation vs execution). They share logic but diverge for inline arrays (creation returns `null`, execution returns records). When changing resolution rules, update both.
- **Name collision appends ISO timestamp** — callers relying on their exact name must check the response's `experiment.name`. The override is silent (warning-only).
- **`prompt template` branch has no `results`** — callers must handle `results === undefined`. Status surfaces via `message` + async server-side completion.
- **`GALILEO_CONSOLE_URL` rewriting** — URLs containing `api.galileo.ai` are rewritten to `app.galileo.ai` for the results link. Custom deploys that legitimately use `api.*` in the console URL will be mutated.
- **Local metrics + prompt template is explicitly rejected** — local scorers need client-side span data, which server-side prompt runs don't expose. Enforced in step 9; don't try to route around it.
- **Metric version pinning** — `Metric` objects support `{ name, version? }`; absent `version` uses the latest scorer version. Bumping a scorer server-side changes behaviour for un-pinned runs.
- **All errors are plain `Error` throws** (not `APIException` subclasses) except those that bubble from the API client. Catch at the call site if you need exit-code semantics.

## Reference

The full scenario catalogue (12 concrete input shapes + 12-entry error catalogue with reproductions and flows) lives in **[`docs/experiments-reference.md`](../../docs/experiments-reference.md)**. Read that when debugging a specific input combination or tracing an error message back to its validation gate.
