# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository.

## Project Overview

This is the galileo-js package - a TypeScript/JavaScript client library for the Galileo observability and experimentation platform. It provides logging, tracing, and evaluation capabilities for LLM applications.

For installation, usage examples, and API overview, see [README.md](README.md).

## Project Structure

galileo-js/
├── src/ # TypeScript source (index, singleton, utils, api-client, types, wrappers)
├── tests/ # Jest tests (\*.test.ts), mirroring src/
├── examples/ # Example scripts (logger, openai, datasets, experiments, etc.)
├── scripts/ # Build/transform scripts
└── dist/ # Compiled output (from npm run build)

## Build & Development Commands

### Building

```bash
npm run build          # Format, lint, and compile TypeScript
npm run format         # Format source files with Prettier
npm run lint           # Run ESLint
npm run lint-fix       # Auto-fix ESLint issues
```

The build process:

1. Runs Prettier formatting on `src/**/*.ts`
2. Runs ESLint
3. Compiles TypeScript from `src/` to `dist/`

### Testing

```bash
npm test               # Run all tests with Jest
```

Tests are in the `tests/` directory and use Jest with ts-jest preset. Test files mirror the `src/` structure.

### Running Examples

Examples are in the `examples/` directory. To run them:

```bash
# From root directory
npm i && npm link

# From examples directory
cd examples
npm i && npm link galileo

# Run an example
node examples/logger/workflow.js
```

## Architecture

### Core Components

**1. GalileoLogger (`src/utils/galileo-logger.ts`)**

- The primary logging class for capturing traces and spans
- Supports two modes:
  - **Batch mode** (default): Collects traces in memory, uploads on `flush()`. Use when you can call `flush()` at the end (e.g. scripts, batch jobs).
  - **Streaming mode**: Sends traces/spans immediately as they're created via TaskHandler. Use when you need traces sent as they happen (e.g. long-running or serverless).
- Hierarchical span model: Trace → Workflow/Agent spans (can contain children) → Leaf spans (LLM, Tool, Retriever)
- Uses `parentStack` to track nesting context

**2. Singleton Management (`src/singleton.ts`)**

- `GalileoSingleton`: Manages multiple logger instances keyed by (project, logstream/experimentId, mode)
- Provides global functions: `init()`, `getLogger()`, `flush()`, `reset()`, etc.
- Uses `AsyncLocalStorage` for context propagation across async boundaries
- Two contexts: `experimentContext` and `loggerContext`

**3. API Client (`src/api-client/`)**

- `GalileoApiClient` (`galileo-client.ts`): Main client for API interactions
- Service-oriented architecture with separate service classes:
  - `AuthService`: Authentication
  - `ProjectService`, `LogStreamService`: Project/stream management
  - `TraceService`: Trace ingestion and querying
  - `DatasetService`: Dataset CRUD operations
  - `ExperimentService`: Experiment management
  - `ScorerService`: Custom metrics/scorers
  - And more in `services/`
- `BaseClient`: Shared HTTP client using axios

**4. Wrappers (`src/wrappers.ts`, `src/openai.ts`)**

- `log()`: Function decorator that automatically logs execution as spans
- `wrapOpenAI()`: Proxy-based wrapper for OpenAI client that auto-logs LLM calls
- Both integrate with the singleton to get/create loggers automatically

**5. Type System (`src/types/`)**

- Extensive TypeScript types mirroring API schemas
- Key types:
  - `logging/trace.types.ts`: Trace, TraceSchema
  - `logging/span.types.ts`: Span types (LlmSpan, ToolSpan, WorkflowSpan, etc.)
  - `logging/step.types.ts`: Metrics, allowed input/output types
  - `dataset.types.ts`, `experiment.types.ts`, etc.

### Data Flow

**Batch Mode:**

1. User calls `logger.startTrace()` → creates Trace, pushes to parentStack
2. User calls `logger.addLlmSpan()` → creates span, adds to current parent
3. User calls `logger.conclude()` → pops from parentStack
4. User calls `logger.flush()` → uploads all traces via API client

**Streaming Mode:**

1. User calls `logger.startTrace()` → creates Trace, immediately ingests via `ingestTraceStreaming()`
2. User calls `logger.addLlmSpan()` → creates span, immediately ingests via `ingestSpanStreaming()`
3. TaskHandler manages async ingestion with retry logic
4. User calls `logger.conclude()` → updates trace/span via `updateTraceStreaming()/updateSpanStreaming()`

### Key Patterns

**Span Hierarchy:**

- Trace (root) can contain Workflow/Agent spans
- Workflow/Agent spans can contain other Workflow/Agent spans (nested) and leaf spans
- Leaf spans (LLM, Tool, Retriever) cannot contain children
- Use `addWorkflowSpan()` or `addAgentSpan()` for parent spans, `conclude()` to exit nesting

**Context Propagation:**

- `AsyncLocalStorage` in `singleton.ts` maintains context across async operations
- Logger retrieves context automatically via `experimentContext.getStore()`
- Allows implicit logger lookup without passing references

**Error Handling:**

- API errors wrapped in custom exceptions: `APIException`, `ExperimentAPIException`, etc. (`src/utils/errors.ts`)
- Streaming mode uses retry logic with exponential backoff (`src/utils/retry-utils.ts`)
- TaskHandler tracks failed tasks and retry counts

## Environment Variables

```bash
GALILEO_API_KEY           # Required: API authentication
GALILEO_PROJECT           # Optional: Default project name
GALILEO_LOG_STREAM        # Optional: Default log stream name
GALILEO_CONSOLE_URL       # Optional: Override API endpoint (default: app.galileo.ai)
GALILEO_DISABLE_LOGGING   # Optional: Disable logging (set to any non-empty value except '0' or 'false')
```

## Code Conventions

- Use TypeScript strict mode
- Do not use `any` types anywhere; use proper types
- Do not use `require()` for implementation; use ES module `import`
- ESLint enforces: no-unused-vars, prefer-const, no-undef
- Console warnings for no-console (but used extensively for logging)
- Prettier for code formatting
- Export all public APIs through `src/index.ts`
- Avoid over-engineering: functions should be simple and focused
- Keep backward compatibility for legacy clients (GalileoObserve*, GalileoEvaluate*)

## Testing Notes

- Tests use Jest with ts-jest
- **HTTP mocking**: MSW (Mock Service Worker) 2.x. Use `import { http, HttpResponse } from 'msw'`, `import { setupServer } from 'msw/node'`, and shared `commonHandlers`, `TEST_HOST`, `mockProject` from `tests/common.ts`
- Test file naming: `*.test.ts` in `tests/` directory
- Run single test: `npx jest tests/path/to/test.test.ts`

### Test file structure and patterns

- **Order**: Imports (MSW, source under test, types, common) → example data constants → mock handlers → `handlers = [...commonHandlers, ...]` → `setupServer(...handlers)` with `beforeAll` (set `GALILEO_CONSOLE_URL`, `GALILEO_API_KEY`, `server.listen()`), `afterEach(server.resetHandlers)`, `afterAll(server.close())` → test cases
- **Naming**: Tests as `test('test [action] [resource] [condition]', ...)`. Handlers as `[action][Resource]Handler` (e.g. `createPromptTemplateHandler`). Example constants as `EXAMPLE_[RESOURCE]` with variants like `EXAMPLE_[RESOURCE]_[VARIANT]`
- **Example data**: Use realistic UUIDs and ISO 8601 dates; match TypeScript types. Handlers use `jest.fn().mockImplementation(() => HttpResponse.json(mockData))`
- **Error tests**: `await expect(fn(...)).rejects.toThrow('message')`; use type assertions for invalid inputs. No `any`; use proper types; avoid `require`
- **Reference**: `tests/utils/prompt-templates.test.ts` is the canonical example. See also [Test Generation Prompt Template](../AI%20analysis/Prompts/Test%20Generation%20Prompt%20Template.md) for the full template

## Semantic Release

This project uses semantic-release for versioning. Commit message format determines version bumps:

- `fix:`, `perf:`, `chore:`, `docs:`, `style:`, `refactor:` → patch
- `feat:` → minor
- `BREAKING CHANGE:` → major

When making PRs, ensure commit messages follow this convention.
