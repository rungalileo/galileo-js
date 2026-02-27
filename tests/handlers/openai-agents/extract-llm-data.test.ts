import {
  extractLlmData,
  parseUsage
} from '../../../src/handlers/openai-agents/data-extraction';

describe('parseUsage', () => {
  test('test parse usage null returns zeros', () => {
    const result = parseUsage(null);
    expect(result).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: null,
      reasoningTokens: 0,
      cachedTokens: 0
    });
  });

  test('test parse usage undefined returns zeros', () => {
    const result = parseUsage(undefined);
    expect(result).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: null,
      reasoningTokens: 0,
      cachedTokens: 0
    });
  });

  test('test parse usage with input_tokens and output_tokens', () => {
    const result = parseUsage({
      input_tokens: 10,
      output_tokens: 20,
      total_tokens: 30
    });
    expect(result.inputTokens).toBe(10);
    expect(result.outputTokens).toBe(20);
    expect(result.totalTokens).toBe(30);
  });

  test('test parse usage with legacy prompt_tokens and completion_tokens', () => {
    const result = parseUsage({ prompt_tokens: 5, completion_tokens: 15 });
    expect(result.inputTokens).toBe(5);
    expect(result.outputTokens).toBe(15);
  });

  test('test parse usage extracts reasoning_tokens from details', () => {
    const result = parseUsage({
      input_tokens: 10,
      output_tokens: 5,
      details: { reasoning_tokens: 3, cached_tokens: 2 }
    });
    expect(result.reasoningTokens).toBe(3);
    expect(result.cachedTokens).toBe(2);
  });

  test('test parse usage extracts reasoning_tokens at top level', () => {
    const result = parseUsage({
      input_tokens: 10,
      output_tokens: 5,
      reasoning_tokens: 4
    });
    expect(result.reasoningTokens).toBe(4);
  });
});

describe('extractLlmData generation', () => {
  test('test extract generation span data', () => {
    const spanData = {
      type: 'generation',
      input: [{ role: 'user', content: 'Hello' }],
      output: [{ role: 'assistant', content: 'Hi' }],
      model: 'gpt-4o',
      model_config: { temperature: 0.7, max_tokens: 100 },
      usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 }
    };
    const result = extractLlmData(spanData);
    expect(result.model).toBe('gpt-4o');
    expect(result.temperature).toBe(0.7);
    expect(result.numInputTokens).toBe(10);
    expect(result.numOutputTokens).toBe(5);
    expect(result.totalTokens).toBe(15);
    expect(result.input).toBe(JSON.stringify(spanData.input));
    expect(result.output).toBe(JSON.stringify(spanData.output));
  });

  test('test extract generation span with null usage', () => {
    const spanData = { type: 'generation', model: 'gpt-4o' };
    const result = extractLlmData(spanData);
    expect(result.numInputTokens).toBe(0);
    expect(result.numOutputTokens).toBe(0);
    expect(result.totalTokens).toBeUndefined();
  });

  test('test extract generation metadata includes gen_ai_system openai', () => {
    const spanData = { type: 'generation' };
    const result = extractLlmData(spanData);
    const meta = result.metadata as Record<string, string>;
    expect(meta.gen_ai_system).toBe('openai');
  });
});

describe('extractLlmData response', () => {
  test('test extract response span data with _input and _response', () => {
    const spanData = {
      type: 'response',
      _input: [{ role: 'user', content: 'Hello' }],
      _response: {
        model: 'gpt-4o',
        usage: { input_tokens: 8, output_tokens: 4 },
        temperature: 0.5,
        output: [{ type: 'message', content: 'Hi' }]
      }
    };
    const result = extractLlmData(spanData);
    expect(result.model).toBe('gpt-4o');
    expect(result.temperature).toBe(0.5);
    expect(result.numInputTokens).toBe(8);
    expect(result.numOutputTokens).toBe(4);
  });

  test('test extract response span data with fallback input/response keys', () => {
    const spanData = {
      type: 'response',
      input: 'some input',
      response: {
        model: 'gpt-3.5-turbo',
        usage: { input_tokens: 2, output_tokens: 1 }
      }
    };
    const result = extractLlmData(spanData);
    expect(result.model).toBe('gpt-3.5-turbo');
    expect(result.numInputTokens).toBe(2);
  });

  test('test extract response span with null response returns unknown model', () => {
    const spanData = { type: 'response' };
    const result = extractLlmData(spanData);
    expect(result.model).toBe('unknown');
    expect(result.numInputTokens).toBe(0);
  });
});

describe('extractLlmData unknown type', () => {
  test('test extract returns empty record for unknown type', () => {
    const result = extractLlmData({ type: 'unknown' });
    expect(Object.keys(result).length).toBe(0);
  });
});
