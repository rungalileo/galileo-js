import { createNode } from '../../../src/handlers/openai-agents/node';

describe('createNode()', () => {
  test('test creates node with correct nodeType llm', () => {
    const node = createNode({
      nodeType: 'llm',
      spanParams: { name: 'GPT Call' },
      runId: 'span-001',
      parentRunId: 'trace-001'
    });

    expect(node.nodeType).toBe('llm');
    expect(node.spanParams).toEqual({ name: 'GPT Call' });
    expect(node.runId).toBe('span-001');
    expect(node.parentRunId).toBe('trace-001');
  });

  test('test creates node with correct nodeType tool', () => {
    const node = createNode({
      nodeType: 'tool',
      spanParams: { name: 'Search Tool' },
      runId: 'span-002',
      parentRunId: 'span-001'
    });

    expect(node.nodeType).toBe('tool');
  });

  test('test creates node with correct nodeType workflow', () => {
    const node = createNode({
      nodeType: 'workflow',
      spanParams: {},
      runId: 'span-003',
      parentRunId: null
    });

    expect(node.nodeType).toBe('workflow');
  });

  test('test creates node with correct nodeType agent', () => {
    const node = createNode({
      nodeType: 'agent',
      spanParams: { name: 'Planning Agent' },
      runId: 'span-004',
      parentRunId: 'trace-001'
    });

    expect(node.nodeType).toBe('agent');
  });

  test('test initializes children as empty array', () => {
    const node = createNode({
      nodeType: 'llm',
      spanParams: {},
      runId: 'span-001',
      parentRunId: null
    });

    expect(Array.isArray(node.children)).toBe(true);
    expect(node.children.length).toBe(0);
  });

  test('test preserves all spanParams fields', () => {
    const spanParams = {
      name: 'Test Span',
      input: 'test input',
      output: 'test output',
      model: 'gpt-4',
      metadata: { key: 'value' }
    };

    const node = createNode({
      nodeType: 'llm',
      spanParams,
      runId: 'span-001',
      parentRunId: 'trace-001'
    });

    expect(node.spanParams).toEqual(spanParams);
  });

  test('test children array is mutable', () => {
    const node = createNode({
      nodeType: 'agent',
      spanParams: {},
      runId: 'span-001',
      parentRunId: null
    });

    node.children.push('child-001');
    node.children.push('child-002');

    expect(node.children).toEqual(['child-001', 'child-002']);
  });

  test('test node has required Node interface properties', () => {
    const node = createNode({
      nodeType: 'llm',
      spanParams: { name: 'Test' },
      runId: 'span-001',
      parentRunId: 'parent-001'
    });

    // Verify all required properties exist
    expect('nodeType' in node).toBe(true);
    expect('spanParams' in node).toBe(true);
    expect('runId' in node).toBe(true);
    expect('parentRunId' in node).toBe(true);
    expect('children' in node).toBe(true);
  });

  test('test empty spanParams preserved correctly', () => {
    const node = createNode({
      nodeType: 'tool',
      spanParams: {},
      runId: 'span-001',
      parentRunId: 'trace-001'
    });

    expect(Object.keys(node.spanParams).length).toBe(0);
  });

  test('test parentRunId can be null', () => {
    const node = createNode({
      nodeType: 'agent',
      spanParams: {},
      runId: 'trace-001',
      parentRunId: null
    });

    expect(node.parentRunId).toBeNull();
  });
});
