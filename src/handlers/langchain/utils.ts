import { ToolMessage } from '@langchain/core/messages';
import { Serialized } from '@langchain/core/load/serializable.js';
import { Node } from './node';

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
  if (output instanceof ToolMessage) return output;
  const update = (output as Record<string, unknown>)?.update;
  if (
    typeof update === 'object' &&
    update !== null &&
    Array.isArray((update as Record<string, unknown>).messages)
  ) {
    const messages = (update as Record<string, unknown>).messages as unknown[];
    const last = messages.length === 0 ? null : messages[messages.length - 1];
    if (last instanceof ToolMessage) return last;
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
