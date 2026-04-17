## Project Overview

This is the galileo-js package — a TypeScript/JavaScript client library for the Galileo observability and experimentation platform. It provides logging, tracing, and evaluation capabilities for LLM applications. For installation, usage examples, and API overview, see [README.md](README.md).

## Common Commands

```bash
# Build
npm run build              # Format (Prettier), lint (ESLint), compile TypeScript → dist/
npm run format             # Prettier on src/**/*.ts
npm run lint               # ESLint
npm run lint-fix            # ESLint with auto-fix

# Testing
npm run test                   # Jest (tests in tests/, mirroring src/)
npx jest tests/path/to/test.test.ts   # Run single test

# Examples (from repo root)
npm i && npm link
cd examples && npm i && npm link galileo
node examples/logger/workflow.js     # Run an example
```

## Architecture

### Logger and Singleton

- **GalileoLogger** (`src/utils/galileo-logger.ts`): Primary logging class. Two modes—**batch** (collect in memory, upload on `flush()`) and **streaming** (ingest via TaskHandler as spans are created). Hierarchical spans: Trace → Workflow/Agent (can have children) → Leaf (LLM, Tool, Retriever). Uses `parentStack` for nesting.
- **GalileoSingleton** (`src/singleton.ts`): Manages loggers keyed by (project, logstream/experimentId, mode). Global helpers: `init()`, `getLogger()`, `flush()`, `flushAll()`, `reset()`, `resetAll()`. Uses `AsyncLocalStorage` (`experimentContext`, `loggerContext`) for context across async boundaries.

### API Client and Services

- **GalileoApiClient** (`src/api-client/galileo-client.ts`): Main API client. Call `init({ projectName })` or `init({ projectId })` before using project-scoped methods. Services: AuthService, ProjectService, LogStreamService, TraceService, DatasetService, ExperimentService, ScorerService, and others in `src/api-client/services/`. Shared HTTP via `BaseClient` (axios).

### Wrappers, Handlers, and Types

- **log()** (`src/wrappers.ts`): Wraps a function to log its execution as a span; integrates with singleton.
- **Handlers** (`src/handlers/`): Integration adapters that instrument third-party SDKs and emit Galileo spans.
  - `src/handlers/openai/` — `wrapOpenAI()` / `wrapAzureOpenAI()` (Proxy-based instrumentation of the OpenAI SDK). See [`src/handlers/openai/AGENTS.md`](src/handlers/openai/AGENTS.md).
  - `src/handlers/openai-agents/` — `GalileoTracingProcessor` for `@openai/agents-core`. See [`src/handlers/openai-agents/AGENTS.md`](src/handlers/openai-agents/AGENTS.md).
  - `src/handlers/langchain/` — `GalileoCallback` for LangChain / LangGraph. See [`src/handlers/langchain/AGENTS.md`](src/handlers/langchain/AGENTS.md).
- **Types** (`src/types/`): Trace/span/step types (`logging/trace.types.ts`, `logging/span.types.ts`, `logging/step.types.ts`), dataset/experiment types, etc.

### Data Flow

- **Batch:** `startTrace()` → `addLlmSpan()` / `addWorkflowSpan()` / etc. → `conclude()` → `flush()` uploads via API.
- **Streaming:** `startTrace()` / `addLlmSpan()` etc. ingest immediately via TaskHandler; `conclude()` updates trace/span; retry with exponential backoff.

### Key Directories

- `src/utils/` – GalileoLogger, serialization, retry, errors, metrics, task-handler
- `src/singleton.ts` – GalileoSingleton and global init/getLogger/flush
- `src/api-client/` – GalileoApiClient, services, BaseClient
- `src/wrappers.ts` – `log()` function
- `src/handlers/` – Integration adapters: `openai/`, `openai-agents/`, `langchain/` (each has its own AGENTS.md)
- `src/types/` – TypeScript types for logging, datasets, experiments, etc.
- `src/entities/` – High-level entities: experiments, datasets, scorers, log-streams, runs (see `src/entities/AGENTS.md`)
- `tests/` – Jest tests (\*.test.ts), `tests/common.ts` (MSW handlers, TEST_HOST, mockProject). See `tests/AGENTS.md` for conventions.
- `docs/` – Reference documentation (e.g. `docs/experiments-reference.md`)
- `examples/` – Example scripts
- `scripts/` – Build/transform scripts

### Key Patterns (conceptual)

- **Span hierarchy:** Trace → Workflow/Agent (nested ok) → Leaf (LLM, Tool, Retriever; no children). Use `addWorkflowSpan()` / `addAgentSpan()` for parents, `conclude()` to pop.
- **Context:** AsyncLocalStorage in singleton propagates context; logger obtained via `experimentContext.getStore()` / `getLogger()`.
- **Errors:** API errors via `APIException`, `ExperimentAPIException`, etc. (`src/utils/errors.ts`). Streaming uses retry (exponential backoff) in `src/utils/retry-utils.ts`.

## Key Patterns

### Init and Get Logger

```typescript
import { init, getLogger, flush } from 'galileo';

await init({ projectName: 'my-project', logstream: 'default' });
const logger = getLogger({ projectName: 'my-project' });
// ... use logger
await flush();
```

### Logging a Function as a Span

```typescript
import { log, getLogger } from 'galileo';

const myFn = log(
  { spanType: 'tool', name: 'myTool' },
  async (input: string) => {
    const logger = getLogger();
    // ...
    return result;
  }
);
```

### Wrapping OpenAI

```typescript
import { wrapOpenAI } from 'galileo';
import OpenAI from 'openai';

const openai = wrapOpenAI(new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));
// LLM calls are auto-logged
const completion = await openai.chat.completions.create({ ... });
```

### Trace and Span Flow (batch)

```typescript
const logger = getLogger();
await logger.startTrace({ name: 'my-trace' });
logger.addWorkflowSpan({ name: 'workflow-1' });
logger.addLlmSpan({ name: 'llm-call', input: '...', output: '...' });
logger.conclude();
await logger.flush();
```

### Exception Handling

```typescript
import { APIException, ExperimentAPIException } from 'galileo'; // or from src/utils/errors

try {
  await apiClient.someMethod();
} catch (err) {
  if (err instanceof APIException) {
    // statusCode, message, etc.
  }
}
```

## Testing

- Jest with ts-jest. Tests live in `tests/` mirroring `src/`, named `*.test.ts`. Run a single file: `npx jest tests/path/to/test.test.ts`.
- Canonical reference test: `tests/utils/prompt-templates.test.ts`.
- **Full conventions, MSW patterns, mocking, lifecycle hooks, import rules, and the new-test checklist are in [`tests/AGENTS.md`](tests/AGENTS.md).** Read that before writing or modifying tests.

## Configuration

### Environment Variables

| Variable                  | Purpose                                                                   |
| ------------------------- | ------------------------------------------------------------------------- |
| `GALILEO_API_KEY`         | Required: API authentication                                              |
| `GALILEO_PROJECT`         | Optional: Default project name                                            |
| `GALILEO_LOG_STREAM`      | Optional: Default log stream name                                         |
| `GALILEO_CONSOLE_URL`     | Optional: Override API endpoint (default: app.galileo.ai)                 |
| `GALILEO_DISABLE_LOGGING` | Optional: Disable logging (any non-empty value except `'0'` or `'false'`) |

### Required Practices

- Use TypeScript strict mode. No `any`; use proper types. Use ES module `import`, not `require()` for implementation.
- ESLint: no-unused-vars, prefer-const, no-undef. Prettier for formatting. Export public API via `src/index.ts`.
- Keep backward compatibility for legacy clients (GalileoObserve*, GalileoEvaluate*). Prefer simple, focused functions.
- **Semantic release:** Commit format drives version—`fix:`, `feat:`, etc. → patch/minor; `BREAKING CHANGE:` → major. Follow convention for PRs.

## `galileo-generated` Dependency

`galileo-generated` is the auto-generated OpenAPI client for the Galileo backend. It exposes four things the SDK consumes — know what lives where, then grep for the import when you need specifics:

| Export                                                                                             | Where to look                                                                                             | Purpose                                                                                                                              |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `getSdkLogger()`                                                                                   | Module-scope import in any file that does internal logging                                                | Shared diagnostic logger (`debug`/`info`/`warn`/`error`). Pattern: `const sdkLogger = getSdkLogger()` near the top of the file.      |
| `enableLogging` / `disableLogging` / `setCustomLogger` / `resetSdkLogger`                          | Re-exported from `src/index.ts`                                                                           | Public API for users to control SDK log output.                                                                                      |
| `GalileoGenerated` (typed HTTP client)                                                             | `src/api-client/services/trace-service.ts` and `dataset-service.ts` only                                  | Direct OpenAPI calls for **trace ingest** and **dataset row append**. All other API work goes through the hand-written `BaseClient`. |
| `GalileoConfig` / `GalileoConfigInput`                                                             | Read by `src/api-client/galileo-client.ts` during `init()`; re-exported via `src/index.ts`                | Singleton configuration: API URL + auth credentials + project type.                                                                  |
| Span schemas, extended records, ingest types (`AgentSpan`, `LlmSpan`, `LogTracesIngestRequest`, …) | Type-only imports in `src/types/logging/trace.types.ts`, which aliases/re-exports for the rest of the SDK | Wire-format shapes. The SDK's `ExtendedSpanRecord` / `SpanSchema` union types are composed from these.                               |
| `DatasetAppendRow`                                                                                 | `src/api-client/services/dataset-service.ts`, `src/api-client/galileo-client.ts`                          | Row shape for dataset content-append.                                                                                                |

**Rule of thumb:** never import from `galileo-generated` directly in new code outside the boundaries above. Go through the local re-export (`src/types/logging/trace.types.ts` for types, `src/index.ts` for public API) so refactors stay confined.

## Further Reading

Nested `AGENTS.md` files carry the deep dives for individual subsystems. Read them before making non-trivial changes in that directory.

| Path                                                                           | Covers                                                                                                                      |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| [`src/handlers/openai/AGENTS.md`](src/handlers/openai/AGENTS.md)               | `wrapOpenAI` / `wrapAzureOpenAI`: Proxy-based Chat Completions + Responses API instrumentation, streaming, tool extractors. |
| [`src/handlers/openai-agents/AGENTS.md`](src/handlers/openai-agents/AGENTS.md) | `GalileoTracingProcessor` for `@openai/agents-core`: node-tree build-up, end-time refresh, custom spans.                    |
| [`src/handlers/langchain/AGENTS.md`](src/handlers/langchain/AGENTS.md)         | `GalileoCallback`: LangChain / LangGraph callback handler, node lifecycle, tool-message dispatch.                           |
| [`src/entities/AGENTS.md`](src/entities/AGENTS.md)                             | Entities layer — experiments orchestrator, dataset loading, metrics categorisation, tags.                                   |
| [`tests/AGENTS.md`](tests/AGENTS.md)                                           | Test standards: Jest + MSW 2.x, naming, fixtures, mocking, lifecycle hooks, import rules, checklist.                        |
| [`docs/experiments-reference.md`](docs/experiments-reference.md)               | Full `runExperiment` reference: 12 scenarios, 12-entry error catalogue, metric categorisation, defaults.                    |
