/**
 * Internal node data structure used to build an in-memory span tree
 * during an OpenAI Agents run before committing to GalileoLogger.
 */

/**
 * Span type for an openai-agents node.
 */
export type NodeType = 'llm' | 'tool' | 'workflow' | 'agent';

/**
 * Represents a node in the span tree built during an OpenAI Agents run.
 */
export interface Node {
  nodeType: NodeType;
  spanParams: Record<string, unknown>;
  runId: string;
  parentRunId: string | null;
  children: string[];
}

/**
 * Creates a new Node with an empty children array.
 * @param opts - The node configuration without the children field.
 * @returns A new Node with an empty children array.
 */
export function createNode(opts: Omit<Node, 'children'>): Node {
  return { ...opts, children: [] };
}
