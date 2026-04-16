# tests — Standards and Orientation

This is the canonical reference for writing tests in the galileo-js SDK. All new and modified tests must follow these conventions.

Reference test: `tests/utils/prompt-templates.test.ts` — mirror its structure for any API-level test.

## Framework and Tooling

- **Test runner:** Jest with `ts-jest` preset
- **Environment:** Node.js (`testEnvironment: 'node'`)
- **HTTP mocking:** MSW 2.x (`msw` / `msw/node`) — no other HTTP mocking libraries
- **Module mocking:** `jest.mock()`, `jest.fn()`, `jest.spyOn()`
- **Timers:** `jest.useFakeTimers()` / `jest.useRealTimers()` for time-dependent tests

### Running Tests

```bash
npm run test                                        # Full suite (--detectOpenHandles --forceExit --silent)
npx jest tests/path/to/test.test.ts                 # Single file
npx jest tests/path/to/test.test.ts --no-coverage   # Single file, skip coverage
```

## Directory Structure

Tests live in `tests/` and mirror the `src/` directory tree. Shared test utilities live in `tests/common.ts`.

```
tests/
├── common.ts                    # Shared MSW handlers, TEST_HOST, mockProject, mockLogStream
├── singleton.test.ts            # Mirrors src/singleton.ts
├── wrappers.test.ts             # Mirrors src/wrappers.ts
├── api-client/                  # Mirrors src/api-client/
│   ├── base-client.test.ts
│   └── services/
│       ├── auth-service.test.ts
│       ├── scorer-service.test.ts
│       └── ...
├── handlers/                    # Mirrors src/handlers/
│   ├── openai/
│   ├── openai-agents/
│   └── langchain/
├── utils/                       # Mirrors src/utils/
│   ├── prompt-templates.test.ts # Canonical reference test
│   ├── datasets.test.ts
│   └── ...
├── entities/                    # Mirrors src/entities/
└── types/                       # Mirrors src/types/
```

## File Naming

- Test files: `[source-file-name].test.ts` (kebab-case, matching the source file)
- One test file per source file. Place it in the mirror location under `tests/`.

## Test Naming Conventions

### Test cases

Use the pattern `test('test [verb] [resource] [condition]', ...)` with lowercase throughout:

```typescript
test('test create prompt template', async () => { ... });
test('test get prompt template by name', async () => { ... });
test('test delete prompt template with projectId', async () => { ... });
test('test get prompt error: neither id nor name provided', async () => { ... });
```

Inside `describe` blocks, `it('should ...')` is also acceptable:

```typescript
describe('createDatasetRecord', () => {
  it('should create a record with string input/output', () => { ... });
  it('should handle null metadata', () => { ... });
  it('should throw an error for invalid metadata type', () => { ... });
});
```

### Describe blocks

Use the resource, class, or function name. PascalCase for classes, camelCase for functions:

```typescript
describe('BaseClient Headers', () => { ... });
describe('createDatasetRecord', () => { ... });
describe('GalileoTracingProcessor lifecycle', () => { ... });
```

Nest describes for sub-categories (error paths, variants, sub-features).

### Handler mock names

Pattern: `[verb][Resource]Handler` — camelCase, suffixed with `Handler`:

```typescript
const createGlobalPromptTemplateHandler = jest.fn().mockImplementation(() => { ... });
const getProjectByNameHandler = jest.fn().mockImplementation(() => { ... });
const deleteDatasetHandler = jest.fn().mockImplementation(() => { ... });
const addRowsToDatasetHandler = jest.fn().mockImplementation(() => { ... });
```

### Fixture constants

Pattern: `EXAMPLE_[RESOURCE]` — ALL*CAPS, prefixed with `EXAMPLE*`:

```typescript
const EXAMPLE_PROMPT_TEMPLATE: PromptTemplate = { ... };
const EXAMPLE_DATASET: DatasetDBType = { ... };
const EXAMPLE_DATASET_ROW: DatasetRow = { ... };
const EXAMPLE_VERSION_HISTORY = { ... };
```

## Canonical Test Structure

Reference file: `tests/utils/prompt-templates.test.ts`. Follow this layout:

```typescript
// 1. Imports: MSW, galileo-generated, source functions, types, common utilities
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { GalileoConfig } from 'galileo-generated';
import { createPrompt, getPrompts } from '../../src/utils/prompt-templates';
import type { PromptTemplate } from '../../src/types/prompt-template.types';
import { commonHandlers, TEST_HOST, mockProject } from '../common';

// 2. Fixture constants (EXAMPLE_*)
const EXAMPLE_PROMPT_TEMPLATE: PromptTemplate = {
  /* realistic data */
};

// 3. Handler mocks (jest.fn().mockImplementation)
const createPromptHandler = jest.fn().mockImplementation(() => {
  return HttpResponse.json(EXAMPLE_PROMPT_TEMPLATE);
});

// 4. Handler array (spread commonHandlers first, then test-specific handlers)
export const handlers = [
  ...commonHandlers,
  http.post(`${TEST_HOST}/templates`, createPromptHandler)
];

// 5. Server setup
const server = setupServer(...handlers);

// 6. Lifecycle hooks
beforeAll(() => {
  process.env.GALILEO_CONSOLE_URL = TEST_HOST;
  process.env.GALILEO_API_KEY = 'placeholder';
  GalileoConfig.reset();
  server.listen();
});

afterEach(() => server.resetHandlers());

afterAll(() => server.close());

// 7. Test cases
test('test create prompt template', async () => {
  const result = await createPrompt({ template: 'Hello', name: 'test' });
  expect(result).toEqual(EXAMPLE_PROMPT_TEMPLATE);
  expect(createPromptHandler).toHaveBeenCalled();
});
```

## Shared Test Utilities (`tests/common.ts`)

All API-level tests should use these shared exports:

| Export           | Type               | Purpose                                                                                         |
| ---------------- | ------------------ | ----------------------------------------------------------------------------------------------- |
| `TEST_HOST`      | `string`           | `'http://localhost:8088'` — base URL for all MSW handlers                                       |
| `mockProject`    | `Project`          | Realistic project fixture (`id: 'proj-123'`, `name: 'test-project'`)                            |
| `mockLogStream`  | `LogStreamType`    | Realistic log stream fixture (`id: 'ls-123'`, `name: 'default'`)                                |
| `commonHandlers` | `RequestHandler[]` | Pre-configured MSW handlers for healthcheck, API key login, project lookup, and log stream CRUD |

Always spread `commonHandlers` into your handler array: `[...commonHandlers, ...testSpecificHandlers]`.

## MSW Patterns

### Basic handler

```typescript
const getDatasetHandler = jest.fn().mockImplementation(() => {
  return HttpResponse.json(EXAMPLE_DATASET);
});
```

### Response types

```typescript
HttpResponse.json(data); // JSON response (200)
HttpResponse.json(data, { status: 400 }); // JSON with status code
new HttpResponse(null, { status: 204 }); // Empty response
HttpResponse.json(data, { headers: { etag: 'abc' } }); // With headers
```

### Capturing request bodies

```typescript
let capturedBody: Record<string, unknown> | null = null;
server.use(
  http.patch(`${TEST_HOST}/datasets/${id}/content`, async ({ request }) => {
    capturedBody = (await request.json()) as Record<string, unknown>;
    return new HttpResponse(null, { status: 204 });
  })
);
```

### Capturing request headers

```typescript
let capturedHeaders: Record<string, string> = {};
const server = setupServer(
  http.get(`${TEST_HOST}/healthcheck`, ({ request }) => {
    capturedHeaders = {};
    request.headers.forEach((value, key) => {
      capturedHeaders[key] = value;
    });
    return HttpResponse.json({ status: 'ok' });
  })
);
```

### Stateful handlers (changing response per call)

```typescript
let callCount = 0;
const handler = jest.fn().mockImplementation(() => {
  callCount++;
  if (callCount === 1) return HttpResponse.json({ status: 'processing' });
  return HttpResponse.json({ status: 'complete' });
});
```

### Overriding handlers mid-test

```typescript
server.use(
  http.get(`${TEST_HOST}/path`, () => HttpResponse.json({ override: true }))
);
```

## Module Mocking

Used when testing code that depends on singletons or external modules. Place `jest.mock()` calls at the top of the file, **before** imports of the mocked module are evaluated.

### Mocking the API client (most common)

```typescript
jest.mock('../../src/api-client', () => {
  const mockClient = {
    init: jest.fn().mockResolvedValue(undefined),
    getProject: jest.fn().mockResolvedValue(mockProject)
    // ... other methods
  };
  return {
    GalileoApiClient: Object.assign(
      jest.fn().mockImplementation(() => mockClient),
      { getTimestampRecord: jest.fn().mockReturnValue(new Date()) }
    )
  };
});
```

### Mocking galileo-generated

```typescript
jest.mock('galileo-generated', () => ({
  getSdkLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }),
  GalileoConfig: { reset: jest.fn() }
}));
```

### Mocking internal modules

```typescript
jest.mock('../../src/utils/galileo-logger', () => ({
  GalileoLogger: jest.fn().mockImplementation(() => mockLogger)
}));
```

### Manual mock objects (for logger)

```typescript
function createMockLogger() {
  return {
    startTrace: jest.fn().mockReturnValue({}),
    addLlmSpan: jest.fn().mockReturnValue({}),
    addToolSpan: jest.fn().mockReturnValue({}),
    addWorkflowSpan: jest.fn().mockReturnValue({}),
    addAgentSpan: jest.fn().mockReturnValue({}),
    conclude: jest.fn().mockReturnValue(undefined),
    flush: jest.fn().mockResolvedValue(undefined)
  };
}
```

### Spy on existing functions

```typescript
jest.spyOn(axios, 'request').mockRejectedValue(networkError);
```

## Async Testing

### Standard async test

```typescript
test('test async operation', async () => {
  const result = await someAsyncFunction();
  expect(result).toEqual(expected);
});
```

### Testing rejections

```typescript
await expect(someAsyncFunction()).rejects.toThrow('error message');
await expect(someAsyncFunction()).rejects.toThrow(/regex pattern/);
```

### Testing resolved values

```typescript
await expect(someAsyncFunction()).resolves.toEqual(expected);
```

### Fake timers (for polling, retry, delay-dependent code)

```typescript
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

test('test retry with delay', async () => {
  const promise = withRetry(fn);
  await jest.advanceTimersByTimeAsync(1000);
  const result = await promise;
  expect(result).toBe('success');
});
```

When using fake timers with MSW in `beforeAll`, set them up after `server.listen()` and tear down before `server.close()`:

```typescript
beforeAll(() => {
  // ... env vars, GalileoConfig.reset()
  server.listen();
  jest.useFakeTimers();
});

afterEach(() => {
  server.resetHandlers();
  jest.clearAllTimers();
});

afterAll(() => {
  server.close();
  jest.useRealTimers();
});
```

## Environment Variable Setup

Set required env vars in `beforeAll`. Restore original values in `afterEach` when testing env-var-dependent behavior:

```typescript
// Standard setup for API-level tests
beforeAll(() => {
  process.env.GALILEO_CONSOLE_URL = TEST_HOST;
  process.env.GALILEO_API_KEY = 'placeholder';
  GalileoConfig.reset();
  server.listen();
});

// When testing env-var branches specifically
describe('environment variable tests', () => {
  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.GALILEO_PROJECT = 'test-project';
    process.env.GALILEO_LOG_STREAM = 'test-log-stream';
  });

  afterEach(() => {
    process.env = originalEnv;
  });
});
```

## Error Testing

### Expected exceptions

```typescript
test('test error when neither id nor name provided', async () => {
  await expect(getPrompt({} as { id?: string; name?: string })).rejects.toThrow(
    'Either id or name must be provided'
  );
});
```

### Synchronous throws

```typescript
it('should throw an error for invalid metadata type', () => {
  expect(() => {
    createDatasetRecord({ id: '1', input: 'input', metadata: 12345 });
  }).toThrow('Dataset metadata must be a string or object');
});
```

### API error responses (MSW)

```typescript
test('test error response from API', async () => {
  server.use(
    http.get(`${TEST_HOST}/healthcheck`, () =>
      HttpResponse.json(
        { standard_error: { error_code: 1006, message: 'Not found' } },
        { status: 400 }
      )
    )
  );

  let err: unknown;
  try {
    await client.testRequest();
  } catch (e) {
    err = e;
  }

  expect(err).toBeInstanceOf(GalileoAPIError);
  const apiErr = err as GalileoAPIError;
  expect(apiErr.message).toBe('Not found');
  expect(apiErr.errorCode).toBe(1006);
});
```

## Parameterized Tests

Use `test.each` for data-driven tests:

```typescript
const createDatasetCases: DatasetType[] = [
  { col1: ['val1', 'val2'] },
  [{ col1: 'val1', col2: 'val2' }]
];

test.each(createDatasetCases)('create dataset with data: %j', async (data) => {
  const dataset = await createDataset(data, 'My Dataset');
  expect(dataset).toEqual(EXAMPLE_DATASET);
});
```

## Helper Functions in Tests

For tests that need repeated setup of complex mock objects, define helper functions at the top of the file:

```typescript
function makeTrace(overrides: Partial<AgentTrace> = {}): AgentTrace {
  return {
    traceId: 'trace-001',
    name: 'Test Agent Run',
    metadata: {},
    startedAt: new Date('2024-01-01T00:00:00Z').toISOString(),
    endedAt: new Date('2024-01-01T00:00:10Z').toISOString(),
    ...overrides
  };
}
```

## Testing Private/Protected Methods

When a method is `protected` on a class, create a `TestClient` subclass that exposes it:

```typescript
class TestClient extends BaseClient {
  constructor() {
    super();
    this.apiUrl = TEST_HOST;
    this.token = 'test-token';
    this.initializeClient();
  }

  public async testRequest() {
    return this.makeRequest(RequestMethod.GET, Routes.healthCheck);
  }
}
```

## Import Rules

### Required patterns

```typescript
import { http, HttpResponse } from 'msw'; // MSW request handlers
import { setupServer } from 'msw/node'; // MSW server (node)
import { GalileoConfig } from 'galileo-generated'; // Config reset
import { commonHandlers, TEST_HOST, mockProject } from '../common'; // Shared utilities
import type { SomeType } from '../../src/types/...'; // Type-only imports when possible
```

### Prohibited patterns

- **No `require()`** — use ES module `import` exclusively
- **No `any` type** — use explicit types. If unavoidable, add `/* eslint-disable @typescript-eslint/no-explicit-any */` at the file top
- **No alternative HTTP mocking** — use MSW, not `nock`, `axios-mock-adapter`, or manual stubs

## ESLint in Tests

The ESLint config includes `jest: true` in `env`, so Jest globals (`describe`, `test`, `expect`, `beforeAll`, etc.) are available without imports.

When `any` is truly needed (e.g., testing OpenAI handler extraction with complex untyped objects), disable the rule at the file level:

```typescript
/* eslint-disable @typescript-eslint/no-explicit-any */
```

Prefer inline disables for one-off cases:

```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const result = processor.process(untypedInput as any);
```

## Lifecycle Hook Patterns

### API-level tests (with MSW)

```typescript
beforeAll(() => {
  process.env.GALILEO_CONSOLE_URL = TEST_HOST;
  process.env.GALILEO_API_KEY = 'placeholder';
  GalileoConfig.reset();
  server.listen();
});

afterEach(() => server.resetHandlers());

afterAll(() => server.close());
```

### Unit tests (with module mocks)

```typescript
beforeEach(() => {
  jest.clearAllMocks();
});
```

### Timer-dependent tests

```typescript
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});
```

## Coverage

Coverage is collected automatically on `npm run test`. Configuration:

- **Collected from:** `src/**/*.{ts,tsx}`
- **Excluded:** Pure type-definition files (no runtime logic), generated OpenAPI type files, declaration files (`.d.ts`)
- **Kept for coverage:** Files with runtime logic — enums, consts, classes, utility functions
- **Reporters:** text, lcov, json, html
- **Output directory:** `coverage/`

No coverage thresholds are enforced, but new code should have corresponding tests.

## Checklist for New Tests

1. File placed in `tests/` mirroring the `src/` path
2. File named `[source-file].test.ts`
3. Uses `commonHandlers` + `TEST_HOST` + `mockProject` from `tests/common.ts` (for API tests)
4. Fixture constants named `EXAMPLE_[RESOURCE]`
5. Handler mocks named `[verb][Resource]Handler`
6. Test names follow `test('test [verb] [resource] [condition]')` or `it('should ...')` inside describe
7. `GalileoConfig.reset()` called in `beforeAll` when using MSW
8. `server.resetHandlers()` in `afterEach`, `server.close()` in `afterAll`
9. No `require()`, no untyped `any` (without eslint-disable)
10. Error paths tested alongside happy paths
11. Async code tested with `async/await` — no raw promise chains
