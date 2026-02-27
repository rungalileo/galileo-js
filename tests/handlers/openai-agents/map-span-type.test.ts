import {
  mapSpanType,
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
