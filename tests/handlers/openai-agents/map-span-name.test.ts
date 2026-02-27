import {
  mapSpanName,
  GALILEO_CUSTOM_TYPE
} from '../../../src/handlers/openai-agents/span-mapping';

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
