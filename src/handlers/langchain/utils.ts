import type { ToolMessage } from '@langchain/core/messages';
import type { Serialized } from '@langchain/core/load/serializable.js';
import { Node } from './node';

// Runtime import — ToolMessage is used for instanceof checks.
// Guarded so the module loads safely when @langchain/core is not installed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _ToolMessage: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  _ToolMessage = require('@langchain/core/messages').ToolMessage;
} catch {
  // @langchain/core not installed — instanceof checks will safely return false
}

/**
 * Resolve a node name from serialized data, runName, or metadata.
 * Falls back to capitalised nodeType.
 */
export function getNodeName(
  nodeType: string,
  serialized?: Serialized | null,
  runName?: string,
  metadata?: Record<string, unknown>
): string {
  try {
    if (serialized?.name && serialized.name.length > 0) {
      return serialized.name;
    }
    const idArr = serialized?.id;
    if (Array.isArray(idArr) && idArr.length > 0) {
      return String(idArr[idArr.length - 1]);
    }
    if (typeof runName === 'string' && runName.length > 0) {
      return runName;
    }
    const metaName = metadata?.name;
    if (typeof metaName === 'string' && metaName.length > 0) {
      return metaName;
    }
    return nodeType.charAt(0).toUpperCase() + nodeType.slice(1);
  } catch {
    return nodeType.charAt(0).toUpperCase() + nodeType.slice(1);
  }
}

/**
 * Build a hierarchical agent name from the parent node.
 */
export function getAgentName(
  nodes: Record<string, Node>,
  parentRunId: string | undefined,
  defaultName: string
): string {
  if (parentRunId !== undefined && nodes[parentRunId]) {
    return `${nodes[parentRunId].spanParams.name}:${defaultName}`;
  }
  return defaultName;
}

/**
 * Detect a ToolMessage inside a tool output, including LangGraph Command objects
 * that carry a messages array.
 */
export function findToolMessage(output: unknown): ToolMessage | null {
  if (_ToolMessage && output instanceof _ToolMessage)
    return output as ToolMessage;
  const update = (output as Record<string, unknown>)?.update;
  if (
    typeof update === 'object' &&
    update !== null &&
    Array.isArray((update as Record<string, unknown>).messages)
  ) {
    const messages = (update as Record<string, unknown>).messages as unknown[];
    const last = messages.length === 0 ? null : messages[messages.length - 1];
    if (_ToolMessage && last instanceof _ToolMessage)
      return last as ToolMessage;
  }
  return null;
}

/**
 * Retroactively upgrade a root-level chain node to agent type when any of its
 * children carry langgraph_* metadata keys.
 */
export function updateRootToAgent(
  parentRunId: string | undefined,
  metadata: Record<string, unknown> | undefined,
  nodes: Record<string, Node>
): void {
  if (!parentRunId) return;
  if (!metadata) return;
  const hasLangGraphKey = Object.keys(metadata).some((k) =>
    k.startsWith('langgraph_')
  );
  if (!hasLangGraphKey) return;
  const parentNode = nodes[parentRunId];
  if (!parentNode) return;
  if (parentNode.nodeType === 'chain' && parentNode.parentRunId === undefined) {
    parentNode.nodeType = 'agent';
  }
}
