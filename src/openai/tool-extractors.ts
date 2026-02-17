/**
 * Tool extractors for Responses API output items.
 * Each extractor returns { input, output } for logging as tool spans.
 * Mirrors Python TOOL_EXTRACTORS; designed for extensibility.
 */

export type ToolExtractor = (item: Record<string, unknown>) => {
  input: string;
  output: string;
};

function safeStringify(obj: unknown): string {
  try {
    return typeof obj === 'string' ? obj : JSON.stringify(obj ?? {}, null, 2);
  } catch {
    return String(obj);
  }
}

export const webSearchCall: ToolExtractor = (item) => {
  const action = (item.action as Record<string, unknown>) || {};
  const input: Record<string, unknown> = {
    type: item.type,
    query: action.query,
    url: action.url,
    pattern: action.pattern
  };
  const sources = action.sources;
  const output = sources != null ? { sources } : { status: item.status || '' };
  return { input: safeStringify(input), output: safeStringify(output) };
};

export const mcpCall: ToolExtractor = (item) => {
  const input = {
    name: item.name || '',
    server_label: item.server_label || '',
    arguments: item.arguments || ''
  };
  const output = { output: item.output || '' };
  return { input: safeStringify(input), output: safeStringify(output) };
};

export const mcpListTools: ToolExtractor = (item) => {
  const input = item.server_label || '';
  const tools = item.tools || [];
  return { input: String(input), output: safeStringify(tools) };
};

export const fileSearchCall: ToolExtractor = (item) => {
  const input = {
    queries: item.queries || [],
    results: item.results || []
  };
  return { input: safeStringify(input), output: String(item.status || '') };
};

export const computerCall: ToolExtractor = (item) => {
  const action = (item.action as Record<string, unknown>) || {};
  return { input: safeStringify(action), output: String(item.status || '') };
};

export const imageGenerationCall: ToolExtractor = (item) => {
  const input = { id: item.id || '', status: item.status || '' };
  return { input: safeStringify(input), output: String(item.result || '') };
};

export const codeInterpreterCall: ToolExtractor = (item) => {
  const input = {
    id: item.id || '',
    code: item.code || '',
    container_id: item.container_id || '',
    status: item.status || ''
  };
  const outputs = item.outputs || [];
  return { input: safeStringify(input), output: safeStringify(outputs) };
};

export const localShellCall: ToolExtractor = (item) => {
  const action = (item.action as Record<string, unknown>) || {};
  const input = {
    id: item.id || '',
    call_id: item.call_id || '',
    status: item.status || '',
    action
  };
  return { input: safeStringify(input), output: String(item.status || '') };
};

export const customToolCall: ToolExtractor = (item) => {
  const input = { name: item.name || '', arguments: item.arguments || '' };
  return { input: safeStringify(input), output: String(item.status || '') };
};

export const functionCallOutput: ToolExtractor = (item) => {
  const input = { call_id: item.call_id || '', output: item.output };
  return { input: safeStringify(input), output: safeStringify(item.output) };
};

const genericExtractor: ToolExtractor = (item) => {
  const input = {
    name: (item as Record<string, unknown>).name || '',
    arguments: (item as Record<string, unknown>).arguments || ''
  };
  const output = `${(item as Record<string, unknown>).status || ''}\nOutput: ${(item as Record<string, unknown>).output || ''}`;
  return { input: safeStringify(input), output };
};

/** Map of output item type to extractor. Register new types here for extensibility. */
export const TOOL_EXTRACTORS: Record<string, ToolExtractor> = {
  web_search_call: webSearchCall,
  mcp_call: mcpCall,
  mcp_list_tools: mcpListTools,
  file_search_call: fileSearchCall,
  computer_call: computerCall,
  image_generation_call: imageGenerationCall,
  code_interpreter_call: codeInterpreterCall,
  local_shell_call: localShellCall,
  custom_tool_call: customToolCall,
  function_call_output: functionCallOutput
};

export const TOOL_SPAN_TYPES = new Set(Object.keys(TOOL_EXTRACTORS));

export function getToolExtractor(type: string): ToolExtractor {
  return TOOL_EXTRACTORS[type] || genericExtractor;
}
