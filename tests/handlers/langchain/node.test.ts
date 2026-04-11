import {
  Node,
  rootNodeContext,
  LANGCHAIN_NODE_TYPE
} from '../../../src/handlers/langchain/node';

describe('Node', () => {
  it('test construct node with all properties', () => {
    const node = new Node(
      'llm',
      { name: 'test', input: 'hello' },
      'run-1',
      'parent-1'
    );

    expect(node.nodeType).toBe('llm');
    expect(node.spanParams).toEqual({ name: 'test', input: 'hello' });
    expect(node.runId).toBe('run-1');
    expect(node.parentRunId).toBe('parent-1');
    expect(node.children).toEqual([]);
  });

  it('test construct node without parentRunId', () => {
    const node = new Node('chain', { name: 'chain' }, 'run-2');

    expect(node.parentRunId).toBeUndefined();
  });

  it('test children array is mutable', () => {
    const node = new Node('agent', {}, 'run-3');

    node.children.push('child-1', 'child-2');

    expect(node.children).toEqual(['child-1', 'child-2']);
  });

  it('test all node types are valid', () => {
    const types: LANGCHAIN_NODE_TYPE[] = [
      'agent',
      'chain',
      'chat',
      'llm',
      'retriever',
      'tool'
    ];

    for (const type of types) {
      const node = new Node(type, {}, `run-${type}`);
      expect(node.nodeType).toBe(type);
    }
  });
});

describe('rootNodeContext', () => {
  beforeEach(() => {
    rootNodeContext.set(null);
  });

  it('test get returns null by default', () => {
    expect(rootNodeContext.get()).toBeNull();
  });

  it('test set and get a node', () => {
    const node = new Node('chain', {}, 'root-1');
    rootNodeContext.set(node);

    expect(rootNodeContext.get()).toBe(node);
  });

  it('test reset to null', () => {
    const node = new Node('chain', {}, 'root-1');
    rootNodeContext.set(node);
    rootNodeContext.set(null);

    expect(rootNodeContext.get()).toBeNull();
  });
});
