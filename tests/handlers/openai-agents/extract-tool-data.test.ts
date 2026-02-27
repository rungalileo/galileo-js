import { extractToolData } from '../../../src/handlers/openai-agents/data-extraction';

describe('extractToolData', () => {
  test('test extract function span data string input/output', () => {
    const spanData = {
      type: 'function',
      input: '{"query":"hello"}',
      output: 'result text'
    };
    const result = extractToolData(spanData);
    expect(result.input).toBe('{"query":"hello"}');
    expect(result.output).toBe('result text');
  });

  test('test extract function span data object input serialised', () => {
    const spanData = {
      type: 'function',
      input: { query: 'hello' },
      output: { answer: 'world' }
    };
    const result = extractToolData(spanData);
    expect(result.input).toBe(JSON.stringify({ query: 'hello' }));
    expect(result.output).toBe(JSON.stringify({ answer: 'world' }));
  });

  test('test extract function span data missing output', () => {
    const spanData = { type: 'function', input: 'test' };
    const result = extractToolData(spanData);
    expect(result.output).toBeUndefined();
  });

  test('test extract function span with mcp_data in metadata', () => {
    const spanData = {
      type: 'function',
      input: 'test',
      mcp_data: { server: 'my-server', tool: 'my-tool' }
    };
    const result = extractToolData(spanData);
    const meta = result.metadata as Record<string, string>;
    expect(meta.mcp_data).toBe(
      JSON.stringify({ server: 'my-server', tool: 'my-tool' })
    );
  });

  test('test extract guardrail span triggered', () => {
    const spanData = { type: 'guardrail', triggered: true, name: 'PII Filter' };
    const result = extractToolData(spanData);
    expect(result.input).toBe('');
    expect(result.output).toBe('Guardrail triggered');
    const meta = result.metadata as Record<string, string>;
    expect(meta.triggered).toBe('true');
    expect(meta.guardrail_name).toBe('PII Filter');
  });

  test('test extract guardrail span not triggered', () => {
    const spanData = { type: 'guardrail', triggered: false, name: 'Safety' };
    const result = extractToolData(spanData);
    expect(result.output).toBe('Guardrail passed');
    const meta = result.metadata as Record<string, string>;
    expect(meta.triggered).toBe('false');
  });

  test('test extract tool data for transcription returns empty', () => {
    const result = extractToolData({ type: 'transcription' });
    expect(result.input).toBe('');
    expect(result.output).toBeUndefined();
  });

  test('test extract tool data for mcp_tools returns empty', () => {
    const result = extractToolData({ type: 'mcp_tools' });
    expect(result.input).toBe('');
  });
});
