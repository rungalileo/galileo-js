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
