/* eslint-disable @typescript-eslint/no-explicit-any */

export type LANGCHAIN_NODE_TYPE =
  | 'agent'
  | 'chain'
  | 'chat'
  | 'llm'
  | 'retriever'
  | 'tool';

/**
 * A node in the LangChain trace.
 */
export class Node {
  nodeType: LANGCHAIN_NODE_TYPE;
  spanParams: Record<string, any>;
  runId: string;
  parentRunId?: string;
  children: string[] = [];

  constructor(
    nodeType: LANGCHAIN_NODE_TYPE,
    spanParams: Record<string, any>,
    runId: string,
    parentRunId?: string
  ) {
    this.nodeType = nodeType;
    this.spanParams = spanParams;
    this.runId = runId;
    this.parentRunId = parentRunId;
  }
}

// Root node tracking
let _rootNode: Node | null = null;

export const rootNodeContext = {
  get: (): Node | null => _rootNode,
  set: (value: Node | null): void => {
    _rootNode = value;
  }
};
