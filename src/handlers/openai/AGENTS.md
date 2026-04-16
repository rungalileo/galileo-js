# openai Handler — Orientation

This directory implements `wrapOpenAI()` (and its alias `wrapAzureOpenAI()`), a Proxy-based wrapper that instruments an `OpenAI` client instance so that `chat.completions.create` and `responses.create` calls are automatically logged to Galileo as `llm` / `tool` spans.

Public entry point is `src/handlers/openai/index.ts`; it is re-exported from `src/index.ts` as `wrapOpenAI` / `wrapAzureOpenAI`.

## File Map

| File                 | Role                                                                                                                                                                                                                                                                        |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.ts`           | `wrapOpenAI`, `wrapAzureOpenAI`, the two Proxy factories (`generateChatCompletionProxy`, `generateResponseApiProxy`), the error-path `processErrorSpan`, and the `StreamWrapper` class for streaming responses.                                                             |
| `parameters.ts`      | `extractRequestParameters` (scalar params → `metadata`, `tools` → span tools) and `getOpenAiArgs` (filters caller `metadata` for OpenAI distillation when `store=true`).                                                                                                    |
| `output-items.ts`    | Responses API post-processing: `convertInputToMessages`, `processOutputItems`, `processFunctionCallOutputs`, `hasPendingFunctionCalls`, `isResponsesApiResponse`.                                                                                                           |
| `tool-extractors.ts` | `{ input, output }` extractors for every Responses-API tool call type (`web_search_call`, `mcp_call`, `file_search_call`, `code_interpreter_call`, `local_shell_call`, …) plus `getToolExtractor` dispatcher and the `TOOL_SPAN_TYPES` set.                                 |
| `usage.ts`           | `parseUsage` — normalises Chat Completions (`prompt_tokens`/`completion_tokens`) and Responses API (`input_tokens`/`output_tokens`) shapes + `prompt_tokens_details` / `output_tokens_details` for reasoning + cached tokens. Also consumed by the `openai-agents` handler. |

## How It Works

### 1. Proxy installation

`wrapOpenAI(client, logger?, ingestionHook?)` returns a `Proxy<T>` whose `get` trap intercepts only `client.chat` and `client.responses`. Each of those is itself wrapped in another Proxy that eventually intercepts `.create`. All other properties pass through untouched, so the wrapped client is a drop-in replacement.

The `openai` package is loaded via a dynamic `import('openai').catch(...)` at module load, purely for a friendly warning — we never hard-depend on it.

### 2. Logger resolution

At the top of each `wrappedCreate`:

```
if (!logger) {
  if (ingestionHook) logger = new GalileoLogger({ ingestionHook });
  else               logger = GalileoSingleton.getInstance().getClient();
}
```

Note `logger` is a closure variable — once resolved it's memoized for the lifetime of the wrapper. The `ingestionHook` is threaded all the way through to `GalileoLogger` so callers can inspect / mutate the `LogTracesIngestRequest` before it goes out.

### 3. Trace-vs-span semantics (`isParentTraceValid`)

Every call checks `logger.currentParent()`:

- **No parent** → start a fresh trace (`startTrace(...)`), log the span, `conclude()` at the end. The wrapper owns the trace lifecycle.
- **Has a parent** (we're nested inside a `log()`/`wrapOpenAI` outer call, LangChain, or openai-agents processor) → do NOT start/end a trace. Just add an `addLlmSpan` under the existing parent.

The `shouldCompleteTrace` flag passed to `StreamWrapper` carries this decision forward to streaming finalisation.

### 4. Chat Completions path (`generateChatCompletionProxy`)

1. `convertInputToMessages(requestData.messages)` — normalises the request messages into the shape Galileo's ingestion API validates.
2. If non-streaming: await response → extract `choices[*].message` as `output`, `parseUsage(response.usage)`, `extractRequestParameters(requestData)` for metadata/tools, then `addLlmSpan(...)`.
3. If `requestData.stream === true`: return a `StreamWrapper` (AsyncIterable) that records chunks, extracts deltas to build `completeOutput.content` / `tool_calls`, and finalises on stream end.
4. On error: `processErrorSpan` records an `addLlmSpan` with `status = extractStatusFromError(error) ?? 500` and `output: { content: "Error: ..." }`, then `conclude()` — only when we started the trace.

### 5. Responses API path (`generateResponseApiProxy`)

1. `convertInputToMessages(requestData.input)` — `input` items can be raw `function_call` / `function_call_output` objects, which lack `role`/`content`; we synthesise valid `Message` objects (tool_call on assistant, content on tool, etc.). Without this, ingestion validation fails.
2. `processFunctionCallOutputs(requestData.input, logger)` is called BEFORE processing output — it walks the input array, joins `function_call` + `function_call_output` pairs by `call_id`, and emits a completed tool span for each (captures tool executions from previous turns in multi-turn conversations).
3. `processOutputItems(...)` does two passes over `response.output[]`:
   - **Pass 1**: collect `reasoning` summaries into `events` (as `EventType.reasoning`), collect `message` chunks into `messageContent`, collect `function_call` items into `toolCalls`.
   - **Pass 2**: for every item whose `type` is in `TOOL_SPAN_TYPES`, call the appropriate extractor and emit an `addToolSpan`.
     Finally it emits a single consolidated `addLlmSpan` with `output = { content, role: 'assistant', tool_calls? }`, carrying `events` for reasoning, and metadata flags `includes_reasoning`, `reasoning_count`, `serialized_messages`.
4. `hasPendingFunctionCalls(outputItems)` — if any `function_call` lacks a matching `function_call_output` we do NOT `conclude()`; the trace stays open for the next turn.

### 6. Streaming (`StreamWrapper`)

Implements `AsyncIterable<any>` by delegating to the underlying stream iterator and intercepting `next` / `return` / `throw`. Chunks are pushed into `this.chunks`; the first chunk timestamps `completionStartTime` (used for `timeToFirstToken`-style metrics).

Two modes, detected by `isResponseStreamEvent`:

- **Chat Completions**: merge deltas incrementally (`content`, `tool_calls[index]`, `function_call` legacy format). Usage comes from the last chunk if present.
- **Responses API**: all intermediate events (`response.output_text.delta`, `response.output_item.added`, …) are progress indicators — **do not** merge them. Wait for `response.completed` / `response.done`, extract its `response.output` array, and run the non-streaming `processOutputItems` logic. The completion event is authoritative; deltas would only risk duplication / partial data.

`finalize()` is guarded by `this.finalized` so it runs exactly once regardless of `next` returning done, `return()` being called early, or `throw()` propagating an error.

### 7. Parameter extraction (`parameters.ts`)

`extractRequestParameters` produces `{ metadata: Record<string,string>, tools? }`:

- Scalar params from `OPENAI_SCALAR_PARAMETERS` are stringified into metadata, **skipping values equal to OpenAI defaults** (`OPENAI_PARAMETER_DEFAULTS`) — reduces noise.
- `reasoning_effort` is picked up from both the top-level field and nested `reasoning.effort` (Responses API). Nested `reasoning.summary` → `reasoning_verbosity`; `reasoning.generate_summary` → `reasoning_generate_summary`.
- `tool_choice`, `response_format`, `tools`, `input_type` (array vs string), `instructions_length`, `store`, `prediction.type`, and `tools_include_strict` all get recorded.
- `tools` are also returned verbatim for the span's `tools` field.

`getOpenAiArgs` only mutates the request when `store === true` (model distillation). In that case `metadata` must be a plain object (throws `TypeError` for parity with galileo-python), and values are filtered: strings/numbers pass through, booleans → strings, `response_format` is stripped, complex types dropped. Otherwise the request is returned as-is.

### 8. Usage parsing (`usage.ts`)

`parseUsage` handles three shapes in one pass:

- Chat Completions: `prompt_tokens` / `completion_tokens` / `prompt_tokens_details` / `completion_tokens_details`.
- Responses API: `input_tokens` / `output_tokens` / `input_tokens_details` / `output_tokens_details`.
- Agents SDK legacy: a single `details` object used for both directions.

Also handles top-level `reasoning_tokens` / `cached_tokens` / `rejected_prediction_tokens` as fallbacks. Output is always a fully-populated `ParsedUsage`.

## Main Workflows

```
Chat Completions (non-streaming)
  wrapOpenAI → chat.completions.create
    → [startTrace if no parent]
    → await create(args)           (throws → processErrorSpan)
    → parseUsage + extractRequestParameters
    → addLlmSpan
    → [conclude if we started the trace]

Chat Completions (streaming)
  … → await create({stream:true}) → return StreamWrapper
  (caller iterates)
    → processChunk per chunk (merge deltas)
    → finalize() once: addLlmSpan with merged output; conclude if owner

Responses API (non-streaming)
  … → await responses.create(args)
    → processFunctionCallOutputs(requestData.input)    # prior-turn tool spans
    → processOutputItems(response.output)              # tool spans + consolidated LLM span
    → conclude only if !hasPendingFunctionCalls

Responses API (streaming)
  … → StreamWrapper(isResponsesApi=true)
    → store chunks; capture response.completed.response
    → finalizeResponsesApi → same as non-streaming path
```

## Points of Concern

- **Closure-memoized logger**: once `wrappedCreate` resolves `logger`, subsequent calls on the same wrapped client reuse it. If the singleton is reset between calls, the wrapper will keep the stale logger. Pass a `logger` explicitly to `wrapOpenAI` for long-lived clients across test resets.
- **Silent `openai` dependency check**: `import('openai').catch(...)` prints a warning but never throws. If the package is missing at call time, failures surface deep in Proxy target access rather than at construction.
- **`extends BetaType`**: v5/v6 OpenAI SDKs remove `beta.chat`. We only proxy `chat` and `responses` — `beta.*` paths pass through untransformed (not logged).
- **Responses API input mutation risk**: `convertInputToMessages` is called at span time only; we do not rewrite `requestData.input` before sending to OpenAI. Keep it that way — OpenAI expects the raw items.
- **Responses API streaming choice**: we deliberately ignore `response.output_text.delta` et al. and rely on `response.completed`/`response.done`. If OpenAI ever ships a stream that omits the completion event, we'll record empty output — guard with last-chunk-output fallback already present (`chunks[...].output` concat), but be aware.
- **`hasPendingFunctionCalls` gates trace conclusion**: a Responses-API turn with an unmatched `function_call` keeps the trace open. If the caller never runs the next turn, the trace leaks until `flush()` / `conclude({concludeAll:true})`.
- **`getOpenAiArgs` throws**: passing non-plain-object metadata with `store:true` throws `TypeError`. This is intentional parity with galileo-python — don't silently swallow.
- **Stream finalisation on `return()`/`throw()`**: if a consumer breaks out of `for await` early, `return()` fires and we finalise with whatever chunks arrived. Usage may be 0 if the last chunk never arrived.
- **Error `statusCode` parsing**: `extractStatusFromError` (from `utils/errors.ts`) may return `undefined` — we coalesce to 500 in the non-streaming error path but preserve `undefined` in the streaming error path. Keep this consistent if refactoring.
- **`ingestionHook` + no explicit logger**: creates a **new** `GalileoLogger` per `wrapOpenAI` call, bypassing the singleton. Traces from that logger will not be visible via `getLogger()`/`flushAll()` unless the caller holds the wrapper reference and flushes its underlying logger. Prefer passing a shared `logger` when you want both.
- **Tool extractor fallback**: unknown tool types fall back to `genericExtractor` which uses `name` + `arguments` + `status` + `output`. Any new OpenAI tool type will be logged but may have awkward input/output until a dedicated extractor is added to `TOOL_EXTRACTORS`.
