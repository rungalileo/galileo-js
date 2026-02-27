import { extractWorkflowData } from '../../../src/handlers/openai-agents/data-extraction';

describe('extractWorkflowData', () => {
  test('test extract agent span data with tools and handoffs', () => {
    const spanData = {
      type: 'agent',
      name: 'PlannerAgent',
      tools: ['search', 'calculator'],
      handoffs: ['ReviewAgent'],
      output_type: 'string'
    };
    const result = extractWorkflowData(spanData);
    expect(result.input).toBe('');
    const meta = result.metadata as Record<string, string>;
    expect(meta.tools).toBe(JSON.stringify(['search', 'calculator']));
    expect(meta.handoffs).toBe(JSON.stringify(['ReviewAgent']));
    expect(meta.output_type).toBe(JSON.stringify('string'));
  });

  test('test extract agent span data without optional fields', () => {
    const result = extractWorkflowData({ type: 'agent' });
    expect(result.input).toBe('');
    expect(result.output).toBeUndefined();
    const meta = result.metadata as Record<string, string>;
    expect(Object.keys(meta).length).toBe(0);
  });

  test('test extract handoff span data', () => {
    const spanData = {
      type: 'handoff',
      from_agent: 'AgentA',
      to_agent: 'AgentB'
    };
    const result = extractWorkflowData(spanData);
    expect(result.input).toBe('AgentA');
    expect(result.output).toBe('AgentB');
    const meta = result.metadata as Record<string, string>;
    expect(meta.from_agent).toBe('AgentA');
    expect(meta.to_agent).toBe('AgentB');
  });

  test('test extract handoff span data with missing agents', () => {
    const result = extractWorkflowData({ type: 'handoff' });
    expect(result.input).toBe('');
    expect(result.output).toBe('');
  });

  test('test extract custom span data with input and output', () => {
    const spanData = {
      type: 'custom',
      data: {
        input: 'custom input',
        output: 'custom output',
        extra_key: 'extra value'
      }
    };
    const result = extractWorkflowData(spanData);
    expect(result.input).toBe('custom input');
    expect(result.output).toBe('custom output');
    const meta = result.metadata as Record<string, string>;
    expect(meta.extra_key).toBe('extra value');
    expect(meta.input).toBeUndefined();
    expect(meta.output).toBeUndefined();
  });

  test('test extract custom span data with object input serialised', () => {
    const spanData = {
      type: 'custom',
      data: { input: { query: 'hello' }, output: { answer: 'world' } }
    };
    const result = extractWorkflowData(spanData);
    expect(result.input).toBe(JSON.stringify({ query: 'hello' }));
    expect(result.output).toBe(JSON.stringify({ answer: 'world' }));
  });

  test('test extract custom span data with no data field', () => {
    const result = extractWorkflowData({ type: 'custom' });
    expect(result.input).toBe('');
    expect(result.output).toBeUndefined();
  });

  test('test extract unknown span type returns empty', () => {
    const result = extractWorkflowData({ type: 'future_type' });
    expect(result.input).toBe('');
    expect(result.output).toBeUndefined();
  });
});
