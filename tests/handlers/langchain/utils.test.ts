import { ToolMessage } from '@langchain/core/messages';
import { Serialized } from '@langchain/core/load/serializable';
import { Node } from '../../../src/handlers/langchain/node';
import {
  getNodeName,
  getAgentName,
  findToolMessage,
  updateRootToAgent
} from '../../../src/handlers/langchain/utils';

describe('getNodeName', () => {
  it('test return serialized.name when present', () => {
    const serialized = {
      name: 'MyChain',
      lc: 1,
      type: 'secret',
      id: ['test']
    } as Serialized;

    expect(getNodeName('chain', serialized)).toBe('MyChain');
  });

  it('test return last element of serialized.id when name is absent', () => {
    const serialized = {
      lc: 1,
      type: 'secret',
      id: ['langchain', 'llms', 'ChatOpenAI']
    } as Serialized;

    expect(getNodeName('llm', serialized)).toBe('ChatOpenAI');
  });

  it('test return runName when serialized has no name or id', () => {
    expect(getNodeName('llm', undefined, 'my-custom-run')).toBe(
      'my-custom-run'
    );
  });

  it('test return metadata.name when runName is absent', () => {
    expect(
      getNodeName('tool', undefined, undefined, { name: 'MetaTool' })
    ).toBe('MetaTool');
  });

  it('test fallback to capitalised nodeType', () => {
    expect(getNodeName('retriever')).toBe('Retriever');
    expect(getNodeName('llm')).toBe('Llm');
    expect(getNodeName('agent')).toBe('Agent');
  });

  it('test skip empty serialized.name', () => {
    const serialized = {
      name: '',
      lc: 1,
      type: 'secret',
      id: ['Fallback']
    } as Serialized;

    expect(getNodeName('chain', serialized)).toBe('Fallback');
  });

  it('test skip empty runName', () => {
    expect(getNodeName('tool', undefined, '', { name: 'FromMeta' })).toBe(
      'FromMeta'
    );
  });

  it('test priority order: serialized.name > id > runName > metadata', () => {
    const serialized = {
      name: 'Winner',
      lc: 1,
      type: 'secret',
      id: ['Second']
    } as Serialized;

    expect(getNodeName('chain', serialized, 'Third', { name: 'Fourth' })).toBe(
      'Winner'
    );
  });
});

describe('getAgentName', () => {
  it('test build hierarchical name from parent', () => {
    const nodes: Record<string, Node> = {
      'parent-1': new Node('agent', { name: 'RootAgent' }, 'parent-1')
    };

    expect(getAgentName(nodes, 'parent-1', 'Agent')).toBe('RootAgent:Agent');
  });

  it('test return defaultName when parent not found', () => {
    expect(getAgentName({}, 'missing', 'Agent')).toBe('Agent');
  });

  it('test return defaultName when parentRunId is undefined', () => {
    expect(getAgentName({}, undefined, 'Agent')).toBe('Agent');
  });
});

describe('findToolMessage', () => {
  it('test detect direct ToolMessage', () => {
    const msg = new ToolMessage({ content: 'result', tool_call_id: 'tc-1' });

    expect(findToolMessage(msg)).toBe(msg);
  });

  it('test detect ToolMessage in LangGraph Command update.messages', () => {
    const msg = new ToolMessage({ content: 'result', tool_call_id: 'tc-2' });
    const output = { update: { messages: [msg] } };

    expect(findToolMessage(output)).toBe(msg);
  });

  it('test return null for non-ToolMessage output', () => {
    expect(findToolMessage('plain string')).toBeNull();
    expect(findToolMessage({ content: 'not a ToolMessage' })).toBeNull();
    expect(findToolMessage(null)).toBeNull();
    expect(findToolMessage(undefined)).toBeNull();
  });

  it('test return null for empty messages array', () => {
    const output = { update: { messages: [] } };

    expect(findToolMessage(output)).toBeNull();
  });

  it('test return null when last message is not ToolMessage', () => {
    const output = { update: { messages: ['not a ToolMessage'] } };

    expect(findToolMessage(output)).toBeNull();
  });
});

describe('updateRootToAgent', () => {
  it('test upgrade root chain to agent on langgraph metadata', () => {
    const root = new Node('chain', { name: 'Chain' }, 'root-1');
    const nodes: Record<string, Node> = { 'root-1': root };

    updateRootToAgent('root-1', { langgraph_step: '0' }, nodes);

    expect(root.nodeType).toBe('agent');
  });

  it('test skip when no langgraph keys', () => {
    const root = new Node('chain', { name: 'Chain' }, 'root-1');
    const nodes: Record<string, Node> = { 'root-1': root };

    updateRootToAgent('root-1', { some_key: 'value' }, nodes);

    expect(root.nodeType).toBe('chain');
  });

  it('test skip when parent is not root (has parentRunId)', () => {
    const parent = new Node(
      'chain',
      { name: 'Chain' },
      'parent-1',
      'grandparent'
    );
    const nodes: Record<string, Node> = { 'parent-1': parent };

    updateRootToAgent('parent-1', { langgraph_step: '0' }, nodes);

    expect(parent.nodeType).toBe('chain');
  });

  it('test skip when parent is already agent', () => {
    const root = new Node('agent', { name: 'Agent' }, 'root-1');
    const nodes: Record<string, Node> = { 'root-1': root };

    updateRootToAgent('root-1', { langgraph_step: '0' }, nodes);

    expect(root.nodeType).toBe('agent');
  });

  it('test skip when parentRunId is undefined', () => {
    const nodes: Record<string, Node> = {};

    updateRootToAgent(undefined, { langgraph_step: '0' }, nodes);
    // No error thrown
  });

  it('test skip when metadata is undefined', () => {
    const root = new Node('chain', {}, 'root-1');
    const nodes: Record<string, Node> = { 'root-1': root };

    updateRootToAgent('root-1', undefined, nodes);

    expect(root.nodeType).toBe('chain');
  });
});
