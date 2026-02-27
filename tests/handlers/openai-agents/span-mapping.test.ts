import {
  mapSpanType,
  mapSpanName,
  GALILEO_CUSTOM_TYPE
} from '../../../src/handlers/openai-agents/span-mapping';

describe('mapSpanType', () => {
  test('test maps generation to llm', () => {
    expect(mapSpanType({ type: 'generation' })).toBe('llm');
  });

  test('test maps response to llm', () => {
    expect(mapSpanType({ type: 'response' })).toBe('llm');
  });

  test('test maps function to tool', () => {
    expect(mapSpanType({ type: 'function' })).toBe('tool');
  });

  test('test maps guardrail to tool', () => {
    expect(mapSpanType({ type: 'guardrail' })).toBe('tool');
  });

  test('test maps transcription to tool', () => {
    expect(mapSpanType({ type: 'transcription' })).toBe('tool');
  });

  test('test maps speech to tool', () => {
    expect(mapSpanType({ type: 'speech' })).toBe('tool');
  });

  test('test maps speech_group to tool', () => {
    expect(mapSpanType({ type: 'speech_group' })).toBe('tool');
  });

  test('test maps mcp_tools to tool', () => {
    expect(mapSpanType({ type: 'mcp_tools' })).toBe('tool');
  });

  test('test maps agent to workflow', () => {
    expect(mapSpanType({ type: 'agent' })).toBe('workflow');
  });

  test('test maps handoff to workflow', () => {
    expect(mapSpanType({ type: 'handoff' })).toBe('workflow');
  });

  test('test maps custom to workflow', () => {
    expect(mapSpanType({ type: 'custom' })).toBe('workflow');
  });

  test('test maps galileo_custom sentinel to galileo_custom', () => {
    expect(mapSpanType({ type: 'custom', __galileoCustom: true })).toBe(
      GALILEO_CUSTOM_TYPE
    );
  });

  test('test maps unknown type to workflow fallback', () => {
    expect(mapSpanType({ type: 'unknown_future_type' })).toBe('workflow');
  });
});

describe('mapSpanName', () => {
  test('test returns spanData.name when present', () => {
    expect(mapSpanName({ type: 'generation', name: 'MySpan' }, 'llm')).toBe(
      'MySpan'
    );
  });

  test('test generation fallback is Generation', () => {
    expect(mapSpanName({ type: 'generation' }, 'llm')).toBe('Generation');
  });

  test('test response fallback is Response', () => {
    expect(mapSpanName({ type: 'response' }, 'llm')).toBe('Response');
  });

  test('test function fallback uses spanData.name or Function', () => {
    expect(mapSpanName({ type: 'function', name: 'my_tool' }, 'tool')).toBe(
      'my_tool'
    );
    expect(mapSpanName({ type: 'function' }, 'tool')).toBe('Function');
  });

  test('test guardrail fallback uses spanData.name or Guardrail', () => {
    expect(
      mapSpanName({ type: 'guardrail', name: 'content_filter' }, 'tool')
    ).toBe('content_filter');
    expect(mapSpanName({ type: 'guardrail' }, 'tool')).toBe('Guardrail');
  });

  test('test agent fallback uses spanData.name or Agent', () => {
    expect(
      mapSpanName({ type: 'agent', name: 'PlannerAgent' }, 'workflow')
    ).toBe('PlannerAgent');
    expect(mapSpanName({ type: 'agent' }, 'workflow')).toBe('Agent');
  });

  test('test handoff formats from-to arrow', () => {
    expect(
      mapSpanName(
        { type: 'handoff', from_agent: 'AgentA', to_agent: 'AgentB' },
        'workflow'
      )
    ).toBe('Handoff: AgentA → AgentB');
  });

  test('test handoff fallback when no agents', () => {
    expect(mapSpanName({ type: 'handoff' }, 'workflow')).toBe('Handoff');
  });

  test('test custom fallback is Custom', () => {
    expect(mapSpanName({ type: 'custom' }, 'workflow')).toBe('Custom');
  });

  test('test galileo_custom sentinel fallback is Galileo Custom', () => {
    expect(mapSpanName({ type: 'custom' }, GALILEO_CUSTOM_TYPE)).toBe(
      'Galileo Custom'
    );
  });

  test('test transcription fallback is Transcription', () => {
    expect(mapSpanName({ type: 'transcription' }, 'tool')).toBe(
      'Transcription'
    );
  });

  test('test speech fallback is Speech', () => {
    expect(mapSpanName({ type: 'speech' }, 'tool')).toBe('Speech');
  });

  test('test speech_group fallback is Speech Group', () => {
    expect(mapSpanName({ type: 'speech_group' }, 'tool')).toBe('Speech Group');
  });

  test('test mcp_tools fallback is MCP Tools', () => {
    expect(mapSpanName({ type: 'mcp_tools' }, 'tool')).toBe('MCP Tools');
  });
});
