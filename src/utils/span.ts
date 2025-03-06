import { Document, ChunkMetaDataValueType } from '../types/document.types';
import { Message, MessageRole, ToolCall } from '../types/message.types';
import {
  LlmStepAllowedIOType,
  RetrieverStepAllowedOutputType
} from '../types/step.types';

/**
 * Attempt to convert an object to a Message, or return null if not possible
 */
export const tryConvertToMessage = (
  obj: string | Record<string, string> | Message
): Message | null => {
  try {
    // If it has role and content but they need type conversion
    if (obj && typeof obj === 'object' && 'role' in obj && 'content' in obj) {
      const role = obj.role;
      // Check if the role value is valid
      if (
        typeof role === 'string' &&
        Object.values(MessageRole).includes(role as MessageRole)
      ) {
        const message: Message = {
          content: String(obj.content),
          role: role as MessageRole
        };

        // Add optional tool properties if they exist and are valid
        if ('tool_call_id' in obj && obj.tool_call_id !== null) {
          message.tool_call_id = String(obj.tool_call_id);
        }

        if ('tool_calls' in obj && Array.isArray(obj.tool_calls)) {
          // Basic validation of tool calls structure
          if (
            obj.tool_calls.every(
              (call: typeof obj | ToolCall | Record<string, string>) =>
                typeof call === 'object' &&
                call !== null &&
                'id' in call &&
                typeof call.id === 'string' &&
                'function' in call &&
                typeof call.function === 'object' &&
                'name' in call.function &&
                typeof call.function.name === 'string' &&
                'arguments' in call.function &&
                typeof call.function.arguments === 'string'
            )
          ) {
            message.tool_calls = obj.tool_calls as ToolCall[];
          }
        }

        return message;
      }
    }
  } catch (e) {
    console.log('Unable to convert to Message', e);
  }

  return null;
};

export const convertLlmInputOutput = (
  value: LlmStepAllowedIOType,
  defaultRole: MessageRole = MessageRole.user
): Message[] => {
  // Already a Message array
  if (Array.isArray(value) && value.length > 0) {
    try {
      return value as Message[];
    } catch (e) {
      console.log('Unable to convert to Message', e);
    }
  }

  // Single Message
  if (!Array.isArray(value)) {
    const message = tryConvertToMessage(value);
    if (message) {
      return [message];
    }
  }

  // Array of potential Messages
  if (Array.isArray(value)) {
    const messages: Message[] = [];

    for (const item of value) {
      const message = tryConvertToMessage(item);
      if (message) {
        messages.push(message);
      } else if (typeof item === 'string') {
        messages.push({
          content: item,
          role: defaultRole
        });
      } else {
        messages.push({
          content: JSON.stringify(item),
          role: defaultRole
        });
      }
    }

    return messages;
  }

  // String
  if (typeof value === 'string') {
    return [
      {
        content: value,
        role: defaultRole
      }
    ];
  }

  // Record that didn't convert to a Message
  return [
    {
      content: JSON.stringify(value),
      role: defaultRole
    }
  ];
};

export const tryConvertToDocument = (value: object): Document | null => {
  if (
    value &&
    typeof value === 'object' &&
    'content' in value &&
    'metadata' in value
  ) {
    try {
      return new Document({
        content: value['content'] as string,
        metadata: value['metadata'] as Record<string, ChunkMetaDataValueType>
      });
    } catch (e) {
      console.log('Unable to convert to Document', e);
    }
  }
  return null;
};

export const convertRetrieverOutput = (
  value: RetrieverStepAllowedOutputType
): Document[] => {
  try {
    if (!Array.isArray(value)) {
      if (value instanceof Document) {
        return [value];
      } else if (typeof value === 'string') {
        return [new Document({ content: value })];
      } else if (
        value &&
        typeof value === 'object' &&
        'content' in value &&
        'metadata' in value
      ) {
        const doc = tryConvertToDocument(value);
        if (doc) {
          return [doc];
        }
      }
    } else {
      if (value.every((doc) => doc instanceof Document)) {
        return value.map((doc) => new Document(doc));
      } else if (value.every((doc) => typeof doc === 'string')) {
        return value.map((doc) => new Document({ content: doc }));
      } else if (
        value.every((doc) => typeof doc === 'object' && doc !== null)
      ) {
        const docs = value.map((doc) => tryConvertToDocument(doc));
        if (docs && docs.every((doc) => doc !== null)) {
          return docs;
        }
      }
    }
    return [new Document({ content: JSON.stringify(value) })];
  } catch (e) {
    console.log('Unable to set output', e);
    return [new Document({ content: '' })];
  }
};
