# openai-agents Handler — Orientation

This directory implements `GalileoTracingProcessor`, an adapter that consumes the OpenAI Agents SDK (`@openai/agents-core`) `TracingProcessor` interface and translates agent-run trees into Galileo spans.

Public exports (from `src/index.ts`): `GalileoTracingProcessor`, `registerGalileoTraceProcessor`, `GalileoCustomSpan` (alias for `createGalileoCustomSpanData`), `GalileoCustomSpanData`, `GalileoSpanLike`.

`@openai/agents` is an **optional peerDependency** — the module loads safely when it's missing; the lazy `import('@openai/agents-core')` logs a warning and `registerGalileoTraceProcessor` / `addGalileoCustomSpan` no-op (or run the callback untraced).

## File Map

| File                 | Role                                                                                                                                                                                                                                                                  |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.ts`           | `GalileoTracingProcessor` class, trace/span lifecycle hooks, in-memory node tree, commit logic, `addGalileoCustomSpan` static helper, and `registerGalileoTraceProcessor` factory.                                                                                    |
| `span-mapping.ts`    | `mapSpanType(spanData)` → `'llm' \| 'tool' \| 'agent' \| 'workflow' \| GALILEO_CUSTOM_TYPE`, and `mapSpanName(spanData, spanType)` for display names. Includes the `__galileoCustom` sentinel check.                                                                  |
| `data-extraction.ts` | `extractLlmData` (generation vs response), `extractToolData` (function / guardrail), `extractWorkflowData` (agent / handoff / custom), `extractGalileoCustomData` (inner `_galileoSpan` dispatch). Re-exports `parseUsage` from the openai handler.                   |
| `node.ts`            | Tiny `Node` shape + `createNode` helper. `NodeType = 'llm' \| 'tool' \| 'workflow' \| 'agent'`.                                                                                                                                                                       |
| `custom-span.ts`     | `GalileoSpanLike`, `GalileoCustomSpanData`, `createGalileoCustomSpanData` (aliased as `GalileoCustomSpan`), and `isGalileoCustomSpanData` type guard.                                                                                                                 |
| `embedded-tools.ts`  | Extracts tool calls embedded inside a `ResponseSpanData._response.output[]` (`code_interpreter_call`, `file_search_call`, `web_search_call`, `computer_call`, `custom_tool_call`) and flattens them into `EmbeddedToolCall` records for the LLM span's `tools` field. |

## How It Works

### 1. Registration

```ts
const processor = await registerGalileoTraceProcessor({
  galileoLogger?, flushOnTraceEnd?, ingestionHook?
});
```

Dynamically imports `@openai/agents-core`, calls its `addTraceProcessor(processor)`, and returns the `GalileoTracingProcessor`. Constructor-time logger resolution mirrors the openai handler: explicit logger → ingestionHook → singleton.

### 2. Node tree build-up (the key data structure)

Every trace is assembled into a transient map `_nodes: Map<string, Node>` keyed by `traceId`/`spanId`. Each node holds its own children array. The shape is:

```
Trace.traceId   → root Node (nodeType='agent')
 ├─ Span.spanId → Node (llm / tool / agent / workflow)
 │   └─ …
 └─ Span.spanId → Node
```

Parent linkage uses `span.parentId ?? span.traceId`. If `onSpanStart` can't find the parent (out-of-order delivery), it **warns and drops the span** — there's no reparenting later.

**Nothing is written to GalileoLogger during the run**; logging happens once at `onTraceEnd` via `_commitTrace → _logNodeTree`. This is deliberate — agent runs emit span-start/end interleaved, and the Galileo parent-stack model would receive them in the wrong order.

### 3. Lifecycle callbacks

- **`onTraceStart(trace)`** — create the root `agent` node keyed by `traceId`. Stash `trace.metadata` (via `toStringRecord`) and `startedAt`.
- **`onSpanStart(span)`** — call `mapSpanType(spanData)` to pick the effective `NodeType`:
  - `generation` / `response` → `llm`
  - `function` / `guardrail` / `transcription` / `speech` / `speech_group` / `mcp_tools` → `tool`
  - `agent` → `agent`
  - `handoff` / `custom` / default → `workflow`
  - `__galileoCustom === true` → `GALILEO_CUSTOM_TYPE` (delegates to inner `_galileoSpan`)
    Extract initial data via the matching extractor, create and register the node, push its id to `parent.children`.
- **`onSpanEnd(span)`** — compute `durationNs`, call `_refreshSpanData` to re-extract fields that are only populated at end time, handle `span.error` (sets `statusCode=500`, merges `error_message`/`error_type`/`error_details` into metadata), update `_lastOutput` for workflow/agent nodes, and capture `_firstInput` (the first meaningful `llm`/`tool` input — used as trace-level input at commit time).
- **`onTraceEnd(trace)`** — stamp final duration on the root, `_commitTrace` walks the tree and emits to `GalileoLogger`, then `conclude({concludeAll:true})` and optional `flush()`. State is cleared before return.
- **`shutdown()` / `forceFlush()`** — both just call `logger.flush()`.

### 4. End-time refresh (`_refreshSpanData`)

Why: several fields on `ResponseSpanData`, `HandoffSpanData`, and `GalileoCustomSpanData` are mutated by the SDK **after** `onSpanStart` fires. Re-running extraction at span-end picks up:

- `response` type: final `_response` object, usage, embedded tool calls (via `extractEmbeddedToolCalls` — `code_interpreter`, `file_search`, `web_search`, `computer`, `custom_tool` items are flattened into the LLM span's `tools` array; the private `_responseObject` is stripped from `spanParams`).
- `generation` type: updated `usage` / `model_config` / `output`.
- `handoff` type: `to_agent` is only set inside `withHandoffSpan`'s callback — refresh recomputes `from_agent`/`to_agent` and `mapSpanName`.
- `__galileoCustom`: `_galileoSpan.output` is typically assigned inside the custom-span callback; re-extract to pick it up.

### 5. Commit (`_commitTrace` → `_logNodeTree`)

Walks depth-first, parent before children:

1. For the root → `logger.startTrace(...)` using `_firstInput` / `_lastOutput` if available (falls back to root name).
2. For each child — dispatches on `nodeType`:
   - `llm` → `addLlmSpan` (tokens, temperature, tools, model, …).
   - `tool` → `addToolSpan`.
   - `workflow` / `agent` (or anything else) → `addWorkflowSpan`, recurse, then `logger.conclude(...)` with the computed output.
3. `_computeWorkflowOutput(node)` prefers `node.spanParams.output`, falls back to the last child's output, and overrides with a JSON-serialised `error` when present.

At the end, `onTraceEnd` calls `logger.conclude({concludeAll:true, statusCode: _lastStatusCode})` to pop any workflow/agent spans still on the parent stack.

### 6. Custom spans (`GalileoCustomSpan` / `addGalileoCustomSpan`)

`createGalileoCustomSpanData(galileoSpan, name?, extraData?)` builds a `CustomSpanData` whose `data` payload carries a reference to a Galileo-shaped span (`GalileoSpanLike`) and the sentinel `__galileoCustom: true`. When the processor sees that sentinel it:

- Uses `extractGalileoCustomData` which reads `type` ('tool' | 'workflow' | 'agent' — else falls back to `'workflow'`), `input`, `output`, `metadata`, `tags`, `statusCode` from `_galileoSpan`.
- Treats the node as whatever `nodeType` the caller declared — enabling Galileo-specific semantics inside the agent SDK tracing tree.

`GalileoTracingProcessor.addGalileoCustomSpan(galileoSpan, callback, options?)` calls `@openai/agents-core.withCustomSpan`, so any SDK spans created inside `callback` are auto-nested under it. `galileoSpan` is **mutable** — callers are expected to assign to `galileoSpan.output` inside the callback; `_refreshSpanData` picks it up on span-end.

### 7. Usage & embedded tools

- Token usage comes from `parseUsage` (imported from the openai handler) — the shapes across Chat Completions, Responses API, and the Agents SDK legacy `details` object are all handled there.
- `extractEmbeddedToolCalls(response)` produces `EmbeddedToolCall[]` with shape `{ type:'function', function:{name}, tool_call_id, tool_call_type, tool_call_input, tool_call_output, tool_call_status }`. These are appended to the LLM span's existing `tools` (not emitted as separate tool spans).

## Main Workflows

```
Trace lifecycle:
  onTraceStart  → create root agent node
  onSpanStart*  → for each span: create node, link to parent (warn+drop if missing)
  onSpanEnd*    → refresh data, compute duration, capture error metadata, track _firstInput/_lastOutput
  onTraceEnd    → stamp root duration → _commitTrace → conclude(concludeAll) → optional flush
                → clear _nodes / _lastOutput / _lastStatusCode / _firstInput

Commit walk (_logNodeTree):
  root node      → startTrace(input=_firstInput ?? name, output=_lastOutput ?? …)
  llm child      → addLlmSpan
  tool child     → addToolSpan
  wf/agent child → addWorkflowSpan → recurse → conclude
```

## Points of Concern

- **All-or-nothing commit**: spans are only written at `onTraceEnd`. A crash or a missing `onTraceEnd` leaves the whole run unlogged. If the user's app `process.exit`s before the SDK flushes, nothing reaches Galileo.
- **Dropped spans on missing parent**: `onSpanStart` warns and returns when `parentId` isn't in `_nodes`. Out-of-order delivery or a forgotten `onTraceStart` → silent data loss for that subtree (descendants pointing to it will also drop).
- **Node-tree state is per-processor**: a single `GalileoTracingProcessor` instance is shared across concurrent traces. Concurrent traces are fine because each keys its subtree by unique `traceId`/`spanId`, but mixing with other processors that mutate the SDK's `spanData` can corrupt our end-time refresh.
- **`__galileoCustom` sentinel collision**: any caller who sets `__galileoCustom: true` on a raw `CustomSpanData` will be routed through `extractGalileoCustomData`. Treat that flag as reserved.
- **`_firstInput` only captures LLM/Tool**: workflow/agent inputs are ignored when choosing the trace-level input. If your first LLM call has empty input, the trace will fall back to its name.
- **`_lastOutput` uses insertion order**: it's updated on every `workflow`/`agent` span end in chronological order; the final value wins. For parallel sub-agents, whichever finishes last provides the trace output.
- **`_refreshSpanData` is type-switched**: only `generation`, `response`, `handoff`, and `__galileoCustom` get re-extracted. New span types added by `@openai/agents-core` will be logged with their `onSpanStart` snapshot only.
- **`_lastStatusCode` coupling**: `conclude({concludeAll:true})` at `onTraceEnd` uses the **last** workflow/agent status code observed during `_logNodeTree`. If the root succeeded but an inner workflow errored, the trace conclusion carries the inner error code.
- **Optional peer dependency**: the runtime checks for `@openai/agents-core` via `import(...)` and only warns. Calling `registerGalileoTraceProcessor` without it installed will throw on the actual `addTraceProcessor` lookup. `addGalileoCustomSpan` degrades gracefully — it runs the callback untraced.
- **`agentType` parity with galileo-python**: `extractAgentType` exists but is unused — we currently emit everything as `addAgentSpan` / `addWorkflowSpan` without an `AgentType`. Do not enable it unilaterally; it must change in both TS and Python simultaneously per the SC-43798 decision.
- **Response tools mutation**: `_refreshSpanData` concatenates embedded tool calls onto existing `spanParams.tools`. Calling it twice on the same `response` span would duplicate — rely on it firing exactly once at `onSpanEnd`.
- **Logger resolution timing**: the processor resolves its logger **at construction**, unlike `wrapOpenAI` which resolves at first call. Construct after `init()` to pick up the configured singleton.
