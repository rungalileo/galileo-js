import type { components } from './api.types';

//import type { GalileoCoreSchemasLoggingLlmMessage as MessageOpenAPI } from './openapi.types';
//import type { GalileoCoreSchemasLoggingLlmMessage as Message } from './new-api.types';

//export type { Message };
//export type { MessageOpenAPI };

// Use API types as source of truth
export type Message =
  components['schemas']['galileo_core__schemas__logging__llm__Message'];
export type ToolCall = components['schemas']['ToolCall'];
export type ToolCallFunction = components['schemas']['ToolCallFunction'];
export type MessageRole =
  components['schemas']['galileo_core__schemas__logging__llm__MessageRole'];

// Convert enum to const object with compile-time validation using satisfies
// TypeScript will error if this doesn't exactly match the MessageRole type
export const MessageRole = {
  agent: 'agent',
  assistant: 'assistant',
  developer: 'developer', // ← Must include all roles from API
  function: 'function',
  system: 'system',
  tool: 'tool',
  user: 'user'
} as const satisfies Record<MessageRole, MessageRole>;

// Type guard with runtime validation
/* eslint-disable @typescript-eslint/no-explicit-any */
export function isMessage(obj: any): obj is Message {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    typeof obj.content === 'string' &&
    obj.role in MessageRole && // Direct validation against const object
    (obj.tool_call_id === undefined ||
      obj.tool_call_id === null ||
      typeof obj.tool_call_id === 'string') &&
    (obj.tool_calls === undefined ||
      obj.tool_calls === null ||
      (Array.isArray(obj.tool_calls) &&
        obj.tool_calls.every(
          (call: any) => 'id' in call && 'function' in call
        )))
  );
}
