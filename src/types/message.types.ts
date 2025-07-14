export enum MessageRole {
  agent = 'agent',
  assistant = 'assistant',
  function = 'function',
  system = 'system',
  tool = 'tool',
  user = 'user'
}

export interface ToolCallFunction {
  name: string;
  arguments: string;
}

export interface ToolCall {
  id: string;
  function: ToolCallFunction;
}

export interface Message {
  content: string;
  role: MessageRole;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function isMessage(obj: any): obj is Message {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    typeof obj.content === 'string' &&
    obj.role in MessageRole &&
    (obj.tool_call_id === undefined || typeof obj.tool_call_id === 'string') &&
    (obj.tool_calls === undefined ||
      (Array.isArray(obj.tool_calls) &&
        obj.tool_calls.every(
          (call: any) => 'id' in call && 'function' in call
        )))
  );
}
