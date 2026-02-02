## Project Overview

This is the galileo-js package—a TypeScript/JavaScript client library for the Galileo observability and experimentation platform. It provides logging, tracing, and evaluation capabilities for LLM applications. For installation, usage examples, and API overview, see [README.md](README.md).

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

### Wrappers and Types

- **log()** (`src/wrappers.ts`): Wraps a function to log its execution as a span; integrates with singleton.
- **wrapOpenAI()** (`src/openai.ts`): Wraps an OpenAI client to auto-log LLM calls.
- **Types** (`src/types/`): Trace/span/step types (`logging/trace.types.ts`, `logging/span.types.ts`, `logging/step.types.ts`), dataset/experiment types, etc.

### Data Flow

- **Batch:** `startTrace()` → `addLlmSpan()` / `addWorkflowSpan()` / etc. → `conclude()` → `flush()` uploads via API.
- **Streaming:** `startTrace()` / `addLlmSpan()` etc. ingest immediately via TaskHandler; `conclude()` updates trace/span; retry with exponential backoff.

### Key Directories

- `src/utils/` – GalileoLogger, serialization, retry, errors
- `src/singleton.ts` – GalileoSingleton and global init/getLogger/flush
- `src/api-client/` – GalileoApiClient, services, BaseClient
- `src/wrappers.ts`, `src/openai.ts` – log(), wrapOpenAI()
- `src/types/` – TypeScript types for logging, datasets, experiments, etc.
- `src/entities/` – High-level entities (experiments, datasets, scorers, …)
- `tests/` – Jest tests (\*.test.ts), `tests/common.ts` (MSW handlers, TEST_HOST, mockProject)
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

- Jest with ts-jest. Tests in `tests/`, file naming `*.test.ts`. Run single test: `npx jest tests/path/to/test.test.ts`.
- **HTTP mocking:** MSW 2.x. Use `http`, `HttpResponse` from `msw`, `setupServer` from `msw/node`. Shared `commonHandlers`, `TEST_HOST`, `mockProject` from `tests/common.ts`.
- **Structure:** Imports → example constants (e.g. `EXAMPLE_PROMPT_TEMPLATE`) → handlers → `handlers = [...commonHandlers, ...]` → `setupServer(...handlers)` with `beforeAll` (set `GALILEO_CONSOLE_URL`, `GALILEO_API_KEY`, `server.listen()`), `afterEach(server.resetHandlers)`, `afterAll(server.close())` → test cases.
- **Naming:** Tests as `test('test [action] [resource] [condition]', ...)`. Handlers like `createPromptTemplateHandler`. Example constants `EXAMPLE_[RESOURCE]`.
- **Reference:** `tests/utils/prompt-templates.test.ts` is the canonical example.

### Key Fixtures / MSW Setup

```typescript
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { commonHandlers, TEST_HOST, mockProject } from '../common';

const createPromptTemplateHandler = jest
  .fn()
  .mockImplementation(() => HttpResponse.json(EXAMPLE_PROMPT_TEMPLATE));
const handlers = [
  ...commonHandlers,
  http.post(
    `${TEST_HOST}/projects/${mockProject.id}/prompt_templates`,
    createPromptTemplateHandler
  )
];
const server = setupServer(...handlers);
beforeAll(() => {
  process.env.GALILEO_CONSOLE_URL = TEST_HOST;
  process.env.GALILEO_API_KEY = 'test-key';
  server.listen();
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

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
