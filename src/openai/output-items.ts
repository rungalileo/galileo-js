/**
 * Processes Responses API output items into consolidated span data.
 * Extracts message content, reasoning (as events), tool calls, and dispatches
 * to tool extractors for tool span creation.
 */

import type { GalileoLogger } from '../utils/galileo-logger';
import type { JsonObject } from '../types/base.types';
import { EventType, type Event } from '../types/logging/span.types';
import type {
  LlmSpanAllowedInputType,
  LlmSpanAllowedOutputType
} from '../types/logging/step.types';
import { getToolExtractor, TOOL_SPAN_TYPES } from './tool-extractors';
import { parseUsage } from './usage';

export interface ProcessOutputItemsOptions {
  outputItems: unknown[];
  logger: GalileoLogger;
  model?: string;
  originalInput?: unknown;
  tools?: Record<string, unknown>[];
  usage?: unknown;
  statusCode?: number;
  metadata?: Record<string, string>;
}

function toRecord(item: unknown): Record<string, unknown> | null {
  if (item == null) return null;
  if (typeof item === 'object' && !Array.isArray(item))
    return item as Record<string, unknown>;
  if (
    typeof (item as { model_dump?: () => Record<string, unknown> })
      .model_dump === 'function'
  ) {
    try {
      return (
        item as { model_dump: () => Record<string, unknown> }
      ).model_dump();
    } catch {
      return null;
    }
  }
  return null;
}

function extractMessageContent(item: Record<string, unknown>): string {
  const content = item.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const parts = content
      .map((c) => {
        if (typeof c === 'object' && c != null && 'text' in c)
          return (c as { text?: string }).text ?? '';
        return typeof c === 'string' ? c : JSON.stringify(c);
      })
      .filter((s): s is string => s != null && s !== '');
    return parts.join('');
  }
  return String(content ?? '');
}

/**
 * Extract reasoning text from a reasoning output item.
 * OpenAI Responses API uses `summary` (array of { text }) for reasoning, not `content`.
 * Matches galileo-python _extract_reasoning_content (extractors.py).
 */
function extractReasoningContent(item: Record<string, unknown>): string[] {
  const summary = item.summary;
  if (Array.isArray(summary) && summary.length > 0) {
    return summary
      .map((s) => {
        if (typeof s === 'object' && s != null && 'text' in s)
          return (s as { text?: string }).text ?? '';
        return typeof s === 'string' ? s : '';
      })
      .filter((t): t is string => t != null && t !== '');
  }
  // Fallback: some variants may use content
  const content = item.content;
  if (typeof content === 'string' && content) return [content];
  if (Array.isArray(content)) {
    return content
      .map((c) => {
        if (typeof c === 'object' && c != null && 'text' in c)
          return (c as { text?: string }).text ?? '';
        return typeof c === 'string' ? c : '';
      })
      .filter((s): s is string => s != null && s !== '');
  }
  return [];
}

/**
 * Process Responses API output items: consolidate message/reasoning, create tool spans,
 * and add the main LLM span. Returns the consolidated output for trace conclusion.
 */
export function processOutputItems(
  options: ProcessOutputItemsOptions
): Record<string, unknown> {
  const {
    outputItems,
    logger,
    model,
    tools,
    usage = null,
    statusCode = 200,
    metadata = {},
    originalInput
  } = options;

  const parsedUsage = parseUsage(usage);
  const events: Event[] = [];
  const toolCalls: Array<{
    id: string;
    function: { name: string; arguments: string };
  }> = [];
  let messageContent = '';

  // First pass: extract message, reasoning, function_call
  for (const rawItem of outputItems) {
    const item = toRecord(rawItem);
    if (!item) continue;

    const type = item.type as string;
    if (type === 'reasoning') {
      const parts = extractReasoningContent(item);
      for (const text of parts) {
        if (text) {
          events.push({ type: EventType.reasoning, content: text });
        }
      }
    } else if (type === 'message') {
      messageContent += extractMessageContent(item);
    } else if (type === 'function_call') {
      toolCalls.push({
        id: String(item.id ?? item.call_id ?? ''),
        function: {
          name: String((item as { name?: string }).name ?? ''),
          arguments: String((item as { arguments?: string }).arguments ?? '')
        }
      });
    }
  }

  // Second pass: create tool spans for TOOL_SPAN_TYPES (parity with galileo-python: metadata on tool span)
  for (const rawItem of outputItems) {
    const item = toRecord(rawItem);
    if (!item) continue;

    const type = item.type as string;
    if (TOOL_SPAN_TYPES.has(type)) {
      const extractor = getToolExtractor(type);
      const { input, output } = extractor(item);
      const name = (item.name as string) || type;
      const toolId = item.id != null ? String(item.id) : '';
      const toolStatus = item.status != null ? String(item.status) : '';
      const toolSpanMetadata: Record<string, string> = {
        tool_id: toolId,
        tool_type: type,
        tool_status: toolStatus,
        ...metadata
      };
      logger.addToolSpan({ input, output, name, metadata: toolSpanMetadata });
    }
  }

  // Build consolidated output for LLM span
  const output: Record<string, unknown> = {
    content: messageContent,
    role: 'assistant'
  };
  if (toolCalls.length > 0) {
    output.tool_calls = toolCalls.map((tc) => ({
      id: tc.id,
      function: { name: tc.function.name, arguments: tc.function.arguments }
    }));
  }

  const spanMetadata: Record<string, string> = {
    ...metadata,
    type: 'consolidated_response',
    includes_reasoning: String(events.length > 0),
    reasoning_count: String(
      events.filter((e) => e.type === EventType.reasoning).length
    )
  };

  const inputForSpan =
    originalInput != null
      ? Array.isArray(originalInput)
        ? originalInput
        : [originalInput]
      : [];

  logger.addLlmSpan({
    input: inputForSpan as LlmSpanAllowedInputType,
    output: output as LlmSpanAllowedOutputType,
    model: model || 'unknown',
    name: 'openai-responses-generation',
    tools: tools as JsonObject[] | undefined,
    statusCode,
    numInputTokens: parsedUsage.inputTokens,
    numOutputTokens: parsedUsage.outputTokens,
    totalTokens: parsedUsage.totalTokens ?? undefined,
    numReasoningTokens: parsedUsage.reasoningTokens,
    numCachedInputTokens: parsedUsage.cachedTokens,
    metadata: spanMetadata,
    events
  });

  return output;
}

/**
 * Process function_call and function_call_output items from the input.
 * Creates tool spans for completed tool executions from previous turns.
 *
 * This is called BEFORE processing output items to log tool executions
 * that were passed in the input (multi-turn conversations).
 *
 * Mirrors galileo-python process_function_call_outputs() from extractors.py lines 480-531.
 */
export function processFunctionCallOutputs(
  inputItems: unknown[],
  logger: GalileoLogger
): void {
  // Collect function_calls by call_id
  const functionCalls = new Map<
    string,
    {
      name: string;
      arguments: string;
      callId: string;
    }
  >();

  for (const rawItem of inputItems) {
    const item = toRecord(rawItem);
    if (!item) continue;

    const type = item.type as string;
    if (type !== 'function_call') continue;

    const callId = String(item.call_id ?? item.id ?? '');
    functionCalls.set(callId, {
      name: String(item.name ?? ''),
      arguments: String(item.arguments ?? ''),
      callId
    });
  }

  // Process function_call_output items
  for (const rawItem of inputItems) {
    const item = toRecord(rawItem);
    if (!item) continue;

    const type = item.type as string;
    if (type !== 'function_call_output') continue;

    const callId = String(item.call_id ?? '');
    const output = item.output;
    const functionCall = functionCalls.get(callId);

    if (!output && !functionCall) continue;

    // Create tool span joining call + output
    const toolInput = JSON.stringify(
      {
        name: functionCall?.name || 'function',
        arguments: functionCall?.arguments || '',
        call_id: callId
      },
      null,
      2
    );

    const toolOutput =
      typeof output === 'object' && output !== null
        ? JSON.stringify(output, null, 2)
        : String(output ?? '');

    logger.addToolSpan({
      input: toolInput,
      output: toolOutput,
      name: functionCall?.name || 'function_call',
      metadata: {
        tool_id: callId,
        tool_type: 'function_call'
      }
    });
  }
}

/**
 * Check if output items contain pending function calls (function_call without matching function_call_output).
 * If pending calls exist, trace should NOT be concluded yet (multi-turn conversation continues).
 * Mirrors galileo-python has_pending_function_calls() from extractors.py lines 715-742.
 */
export function hasPendingFunctionCalls(outputItems: unknown[]): boolean {
  const functionCallIds = new Set<string>();
  const functionCallOutputIds = new Set<string>();

  for (const rawItem of outputItems) {
    const item = toRecord(rawItem);
    if (!item) continue;

    const type = item.type as string;
    if (type === 'function_call') {
      const callId = String(item.call_id ?? item.id ?? '');
      if (callId) {
        functionCallIds.add(callId);
      }
    } else if (type === 'function_call_output') {
      const callId = String(item.call_id ?? '');
      if (callId) {
        functionCallOutputIds.add(callId);
      }
    }
  }

  // Check if any function_call lacks a corresponding function_call_output
  for (const callId of functionCallIds) {
    if (!functionCallOutputIds.has(callId)) {
      return true; // Pending function call found
    }
  }

  return false; // All function calls have outputs
}

/**
 * Check if a response is from the Responses API (has output array).
 */
export function isResponsesApiResponse(response: unknown): boolean {
  const r = response as Record<string, unknown> | null;
  return r != null && Array.isArray(r.output) && !('choices' in r);
}
