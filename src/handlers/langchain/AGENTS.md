# langchain Handler — Orientation

This directory implements `GalileoCallback`, a LangChain `BaseCallbackHandler` subclass that listens to LangChain's lifecycle callbacks (`handleChainStart`, `handleLLMStart`, `handleToolStart`, …) and translates them into a Galileo span tree. Includes first-class support for LangGraph agents.

Public export from `src/index.ts`: `GalileoCallback`.

`@langchain/core` is an **optional peer dependency**. The module loads safely without it (stub base class), but constructing `GalileoCallback` throws a clear error. `instanceof` / `extends` rely on the runtime package being present.

## File Map

| File             | Role                                                                                                                                                                                                                                                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `index.ts`       | `GalileoCallback` class — implements `CallbackHandlerMethods`. Owns `_nodes` + `_rootNode` state, the `_startNode`/`_endNode`/`_commit`/`_handleError` plumbing, and all `handle*` callbacks.                                                                                                                                                          |
| `node.ts`        | `Node` class and `LANGCHAIN_NODE_TYPE = 'agent' \| 'chain' \| 'chat' \| 'llm' \| 'retriever' \| 'tool'`.                                                                                                                                                                                                                                               |
| `tree-logger.ts` | `logNodeTree(node, nodes, logger)` — depth-first recursive writer that dispatches each node to `addAgentSpan` / `addWorkflowSpan` / `addLlmSpan` / `addRetrieverSpan` / `addToolSpan` and concludes workflow-like spans.                                                                                                                               |
| `utils.ts`       | Helpers: `getNodeName` (resolve display name from `Serialized.name`, `Serialized.id`, `runName`, metadata), `getAgentName` (`parentName:Agent` hierarchical naming), `findToolMessage` (detect `ToolMessage` including LangGraph `Command.update.messages[]`), `updateRootToAgent` (retroactive root-chain → agent upgrade on `langgraph_*` metadata). |

## How It Works

### 1. Construction

```ts
new GalileoCallback(galileoLogger?, startNewTrace=true, flushOnChainEnd=true, ingestionHook?)
```

Logger resolution mirrors the other handlers: explicit → ingestionHook → singleton. `_rootNode` and `_nodes` are **instance fields** (per SC-43798 fix — previously module-level `rootNodeContext`, which broke under concurrency).

### 2. Node lifecycle (`_startNode` / `_endNode`)

Every `handle*Start` ends up in `_startNode(nodeType, parentRunId, runId, params)`:

1. Stamp `startTime` (`performance.now()`) and `createdAt` (`new Date()`) as defaults.
2. Create a `Node` keyed by `runId` in `this._nodes`.
3. If `_rootNode` is null, set it to this node (first-seen wins).
4. If `parentRunId` is provided and the parent exists, append `runId` to `parent.children`. If the parent is missing, just debug-log (orphan nodes are tolerated).

Every `handle*End` flows through `_endNode(runId, params)`:

1. Compute `durationNs = round((performance.now() - startTime) * 1e6)` (clamped ≥0 for schema safety).
2. `Object.assign(node.spanParams, params)` — merge end-time fields (output, token counts, statusCode, …).
3. If this `runId` matches `_rootNode.runId` → `_commit()`.

Errors flow through `_handleError(err, runId)` which reads `err.response.status` when present, falls back to 500, and calls `_endNode` with `output: "Error: Name: message"` and the status.

### 3. Commit (`_commit`)

Runs inside `try/finally` so `_nodes = {}` / `_rootNode = null` always clear, even on a thrown commit. Steps:

1. Bail with a warning if `_nodes` is empty or `_rootNode` is missing.
2. If `_startNewTrace`: call `logger.startTrace({ input, name, metadata })` using root's params (metadata coerced via `toStringRecord`).
3. `logNodeTree(rootNode, this._nodes, this._galileoLogger)` — emits the full tree.
4. If `_startNewTrace`: `logger.conclude({ output, statusCode })` from the root's span params.
5. If `_flushOnChainEnd`: `await logger.flush()`.

### 4. Tree emission (`tree-logger.ts`)

Depth-first, parent-first, with **span-stack management**:

- `agent` → `addAgentSpan(…)` — then recurse → then `logger.conclude(…)` (parent pop).
- `chain` → `addWorkflowSpan(…)` — same pattern.
- `llm` / `chat` → `addLlmSpan(…)` — leaf, no recursion parent.
- `retriever` → `addRetrieverSpan(…)` — leaf.
- `tool` → `addToolSpan(…)`. **Special case**: if the tool node has children (agent-as-tool pattern), the returned tool span is pushed as parent via `logger.pushParent(toolSpan)` and treated as a workflow span so descendants nest correctly; a matching `conclude` fires after children.
- Any unknown nodeType → warn.

`stepNumber` is parsed from `metadata.langgraph_step` when present (LangGraph). Final output for workflow-like spans falls back to the last child's output when the node itself has none.

### 5. Per-callback behaviour

- **`handleChainStart`** — skips any chain tagged `langsmith:hidden`. Calls `updateRootToAgent` to retroactively upgrade a root `chain` node to `agent` if any child carries `langgraph_*` metadata keys (LangGraph's subchains tag themselves this way). Detects `langgraph` / `agent` names (case-insensitive) and assigns `nodeType='agent'` with hierarchical `parent:Agent` naming via `getAgentName`.
- **`handleChainEnd`** — may also receive `kwargs.inputs` in async execution (LangChain doesn't always supply input in `handleChainStart` for async), so we accept a late input assignment.
- **`handleAgentEnd`** — writes `finish` as output with `statusCode=200`.
- **`handleLLMStart`** — input is wrapped as `[{content: prompt, role: 'user'}]` for each prompt string. Captures `model_name` and `temperature` from `extraParams.invocation_params`. Initializes `timeToFirstTokenNs: null`.
- **`handleLLMNewToken`** — on first token only, stamps `timeToFirstTokenNs = round((now - startTime) * 1e6)`.
- **`handleChatModelStart`** — serialises `BaseMessage[][]` to `{content, role, tool_calls?}` objects. `role = msg.getType()`. Captures `tools` from `invocation_params`. Falls back to `String(messages)` on serialisation failure.
- **`handleLLMEnd`** — token counts are looked up across 4 aliases (`promptTokens` / `prompt_tokens` / `inputTokens` / `input_tokens` — same for output/total), then falls back to `generations[0].message.usage_metadata` when `llmOutput.tokenUsage` is absent (Anthropic via LangChain puts tokens on the message). Output is `flattenedOutput[0] = { text, generationInfo }`.
- **`handleToolStart`** — records raw flat `input` string. Noted JS/Python divergence: Python's `on_tool_start` gets a structured `inputs` via kwargs; the JS `CallbackHandlerMethods` interface doesn't expose one, so we drop richer structure.
- **`handleToolEnd`** — three-way dispatch:
  1. `findToolMessage(output)` — detects `instanceof ToolMessage` **or** `Command { update: { messages: [...ToolMessage] } }` from LangGraph. When found, uses `toolMessage.content` and captures `toolCallId`.
  2. `Array.isArray(output)` with `[0] instanceof ToolMessage` — handles the `response_format: "content_and_artifact"` tuple shape.
  3. Objects with `.content` → use `output.content`. Else stringify the whole output.
- **`handleRetrieverStart` / `handleRetrieverEnd`** — retriever inputs are the query string; outputs are `documents.map(d => ({pageContent, metadata}))`.

### 6. LangGraph-specific handling

- **Root-upgrade**: `updateRootToAgent` runs at every `handleChainStart`. If the parent is a root-level `chain` (no `parentRunId`) and any child's metadata starts with `langgraph_`, the root node is mutated in place to `nodeType='agent'`.
- **Agent naming**: when chain name is `langgraph` or `agent`, we rewrite to `parent:Agent` for readable nested names.
- **`stepNumber`**: parsed from `metadata.langgraph_step` in `logNodeTree`.
- **Command routing**: `findToolMessage` peeks into `output.update.messages[]` to extract the `ToolMessage` emitted by `Command` objects.

## Main Workflows

```
Straight chain run:
  handleChainStart   → _startNode('chain', …) → first call sets _rootNode
  handleLLMStart     → _startNode('llm',   …)
  handleLLMNewToken* → stamp timeToFirstTokenNs (once)
  handleLLMEnd       → _endNode(...) with token counts
  handleChainEnd     → _endNode(...) — root matches → _commit()
                       _commit: startTrace → logNodeTree → conclude → flush

LangGraph agent:
  handleChainStart(root) → chain node
  handleChainStart(sub, metadata.langgraph_step=1)
      → updateRootToAgent upgrades root to 'agent'
      → sub named `<parent>:Agent`
  handleToolStart/End, handleLLMStart/End, …
  handleChainEnd(root) → _commit()
      → addAgentSpan(root) → recurse → conclude

Error propagation:
  any handle*Error → _handleError → _endNode with status & "Error: ..." output
  (root error) → _commit flushes with the error output/status
```

## Points of Concern

- **Optional dependency, runtime check**: if `@langchain/core` is not installed, `require()` is caught and `_langchainAvailable=false`. Construction throws; type-level `extends BaseCallbackHandler` compiles against `import type`. Do **not** move any runtime use of `BaseMessage`/`ToolMessage` to top-level `import` — it would break non-LangChain consumers.
- **First-seen wins for root**: `_rootNode` is set the first time `_startNode` runs. If the callback is attached mid-flight and a grandchild fires first, that grandchild becomes the root and the real trace gets mis-parented. Attach the callback at the outermost invocation.
- **Single-instance reuse across runs**: `_nodes` + `_rootNode` are cleared in `_commit`'s `finally`. Concurrent chains on the **same** callback instance will cross-contaminate — share cautiously, or construct one per run.
- **`_commit` on non-root ends**: only runs when the run that ended is the root. If the root never ends (mid-call abort, missing `handleChainEnd`), nothing is committed.
- **Orphan nodes**: missing `parentRunId` → node exists in `_nodes` but is unreachable from root; `logNodeTree` will never emit it. No post-run reconciliation.
- **Token usage alias sprawl**: 4 camelCase/snake_case aliases + `usage_metadata` fallback. Any new provider with a 5th shape will silently report `undefined` — check `handleLLMEnd` when adding provider support.
- **`handleToolEnd` narrows hard**: it walks through four output shapes. New LangChain output conventions (streaming tool outputs, nested Command trees beyond `update.messages`) will fall to the generic `toStringValue(output)` and lose structure.
- **`duration` and `timeToFirstToken` are wall-clock**: computed via `performance.now()`, rounded and clamped to a safe non-negative integer for OpenAPI schema compliance. Short synchronous calls may round to 0.
- **`pushParent` for tool-with-children**: we explicitly call `logger.pushParent(toolSpan)` for tools that have children and `conclude` them afterwards. Changes to `GalileoLogger`'s parent-stack contract (see wrappers.ts notes in user memory) can break tool-as-agent nesting.
- **`langsmith:hidden` only on chains**: this tag is honoured in `handleChainStart` only. LLM/tool/retriever spans with that tag are still logged.
- **Retroactive root mutation**: `updateRootToAgent` mutates `parentNode.nodeType` in place. If the callback later dispatches on nodeType **before** this point, behaviour depends on order. Currently there's no such dispatch, but be careful when adding new start handlers.
- **`getNodeName` fallback chain**: `Serialized.name` → last segment of `Serialized.id` → `runName` → `metadata.name` → capitalised `nodeType`. Providers that return populated `id` arrays but no `name` get their class name (e.g. `ChatOpenAI`) surfaced — intentional.
- **`concludeAll`-free commit**: `_commit` issues a single `conclude` for the root trace; all intermediate workflow/agent/tool-with-children conclusions happen in `logNodeTree`. If that recursion throws mid-tree, the `finally` still clears state but parent-stack may be left with unclosed spans on the logger — prefer defensive testing for new node types.
- **Concurrent ingestion hook**: when constructed with `ingestionHook` but no explicit logger, a **new** `GalileoLogger` is created — its traces won't show up under the singleton, matching the openai / openai-agents behaviour.
