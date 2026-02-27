/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NodeType } from './node';

/**
 * The sentinel type string used to identify GalileoCustomSpan instances.
 */
export const GALILEO_CUSTOM_TYPE = 'galileo_custom';

/**
 * Maps an OpenAI Agents SDK SpanData type string to a Galileo node type.
 * @param spanData - The span data object with a type discriminant.
 * @returns The corresponding Galileo node type or 'galileo_custom'.
 */
export function mapSpanType(spanData: {
  type: string;
  [key: string]: unknown;
}): NodeType | typeof GALILEO_CUSTOM_TYPE {
  // Check for GalileoCustomSpan sentinel
  if ((spanData as any).__galileoCustom === true) {
    return GALILEO_CUSTOM_TYPE;
  }

  switch (spanData.type) {
    case 'generation':
    case 'response':
      return 'llm';

    case 'function':
    case 'guardrail':
    case 'transcription':
    case 'speech':
    case 'speech_group':
    case 'mcp_tools':
      return 'tool';

    case 'agent':
    case 'handoff':
    case 'custom':
      return 'workflow';

    default:
      return 'workflow';
  }
}

/**
 * Derives a display name for a span.
 * @param spanData - The span data object.
 * @param spanType - The resolved node type.
 * @returns A human-readable display name for the span.
 */
export function mapSpanName(
  spanData: { type: string; name?: string; [key: string]: unknown },
  spanType: NodeType | typeof GALILEO_CUSTOM_TYPE
): string {
  if (spanData.name) {
    return String(spanData.name);
  }

  // Handle galileo_custom sentinel before the switch
  if (spanType === GALILEO_CUSTOM_TYPE) {
    return 'Galileo Custom';
  }

  switch (spanData.type) {
    case 'generation':
      return 'Generation';
    case 'response':
      return 'Response';
    case 'function': {
      const funcData = spanData as any;
      return funcData.name || 'Function';
    }
    case 'guardrail': {
      const guardrailData = spanData as any;
      return guardrailData.name || 'Guardrail';
    }
    case 'agent': {
      const agentData = spanData as any;
      return agentData.name || 'Agent';
    }
    case 'handoff': {
      const handoffData = spanData as any;
      const from = handoffData.from_agent || handoffData.fromAgent || '';
      const to = handoffData.to_agent || handoffData.toAgent || '';
      if (from || to) {
        return `Handoff: ${from} → ${to}`;
      }
      return 'Handoff';
    }
    case 'custom':
      return 'Custom';
    case 'transcription':
      return 'Transcription';
    case 'speech':
      return 'Speech';
    case 'speech_group':
      return 'Speech Group';
    case 'mcp_tools':
      return 'MCP Tools';
    default:
      return 'Span';
  }
}
