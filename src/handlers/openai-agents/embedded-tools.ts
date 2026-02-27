/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * A single embedded tool call record extracted from a ResponseSpanData output array.
 */
export interface EmbeddedToolCall {
  type: string;
  function: { name: string };
  tool_call_id: string | null;
  tool_call_type: string;
  tool_call_input: string | null;
  tool_call_output: string | null;
  tool_call_status: string | null;
}

const EMBEDDED_TOOL_TYPES = new Set([
  'code_interpreter_call',
  'file_search_call',
  'web_search_call',
  'computer_call',
  'custom_tool_call'
]);

/**
 * Maps an OpenAI embedded tool call type to a display name.
 * @param type - The tool call type string.
 * @returns A human-readable tool name.
 */
export function getToolNameFromType(type: string): string {
  switch (type) {
    case 'code_interpreter_call':
      return 'code_interpreter';
    case 'file_search_call':
      return 'file_search';
    case 'web_search_call':
      return 'web_search';
    case 'computer_call':
      return 'computer';
    case 'custom_tool_call':
      return 'custom_tool';
    default:
      return type;
  }
}

/**
 * Extracts the input field from an embedded tool call item.
 * @param item - The raw output item from the response.
 * @param type - The tool call type string.
 * @returns The extracted input as a string, or null if none.
 */
export function extractToolInput(
  item: Record<string, unknown>,
  type: string
): string | null {
  switch (type) {
    case 'code_interpreter_call': {
      const code = item.code;
      return code !== undefined ? String(code) : null;
    }
    case 'file_search_call': {
      const queries = item.queries;
      if (queries === undefined) return null;
      return Array.isArray(queries) ? JSON.stringify(queries) : String(queries);
    }
    case 'web_search_call': {
      const action = item.action as Record<string, unknown> | undefined;
      const query = action?.query;
      return query !== undefined ? String(query) : null;
    }
    case 'computer_call': {
      const action = item.action;
      return action !== undefined ? JSON.stringify(action) : null;
    }
    case 'custom_tool_call': {
      const input = item.input;
      if (input === undefined) return null;
      return typeof input === 'string' ? input : JSON.stringify(input);
    }
    default:
      return null;
  }
}

/**
 * Extracts the output field from an embedded tool call item.
 * @param item - The raw output item from the response.
 * @param type - The tool call type string.
 * @returns The extracted output as a string, or null if none.
 */
export function extractToolOutput(
  item: Record<string, unknown>,
  type: string
): string | null {
  switch (type) {
    case 'code_interpreter_call': {
      // Concatenate all output logs and urls
      const outputs = item.outputs as
        | Array<Record<string, unknown>>
        | undefined;
      if (!Array.isArray(outputs) || outputs.length === 0) return null;
      const parts = outputs
        .map((o) => {
          if (o.logs !== undefined) return String(o.logs);
          if (o.url !== undefined) return String(o.url);
          return null;
        })
        .filter((p): p is string => p !== null);
      return parts.length > 0 ? parts.join('\n') : null;
    }
    case 'file_search_call': {
      const results = item.results;
      if (results === undefined) return null;
      return Array.isArray(results) ? JSON.stringify(results) : String(results);
    }
    case 'web_search_call': {
      const action = item.action;
      return action !== undefined ? JSON.stringify(action) : null;
    }
    case 'computer_call':
      return null;
    case 'custom_tool_call': {
      const output = item.output;
      if (output === undefined) return null;
      return typeof output === 'string' ? output : JSON.stringify(output);
    }
    default:
      return null;
  }
}

/**
 * Walks the _response.output array and returns all embedded tool call records.
 * @param response - The response object from a ResponseSpanData span.
 * @returns An array of EmbeddedToolCall records.
 */
export function extractEmbeddedToolCalls(
  response: Record<string, unknown> | null | undefined
): EmbeddedToolCall[] {
  if (!response) return [];

  const output = response.output;
  if (!Array.isArray(output)) return [];

  const results: EmbeddedToolCall[] = [];

  for (const item of output) {
    if (typeof item !== 'object' || item === null) continue;
    const typedItem = item as Record<string, unknown>;
    const itemType = typedItem.type as string | undefined;
    if (!itemType || !EMBEDDED_TOOL_TYPES.has(itemType)) continue;

    const toolName = getToolNameFromType(itemType);
    const toolCallId =
      (typedItem.id as string | undefined) ??
      (typedItem.tool_call_id as string | undefined) ??
      null;
    const status = (typedItem.status as string | undefined) ?? null;

    results.push({
      type: itemType,
      function: { name: toolName },
      tool_call_id: toolCallId,
      tool_call_type: itemType,
      tool_call_input: extractToolInput(typedItem, itemType),
      tool_call_output: extractToolOutput(typedItem, itemType),
      tool_call_status: status
    });
  }

  return results;
}
