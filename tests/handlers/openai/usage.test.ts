import { parseUsage } from '../../../src/handlers/openai/usage';

describe('parseUsage', () => {
  test('returns zeros for null/undefined', () => {
    expect(parseUsage(null)).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: null,
      reasoningTokens: 0,
      cachedTokens: 0,
      rejectedPredictionTokens: 0
    });
    expect(parseUsage(undefined)).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: null,
      reasoningTokens: 0,
      cachedTokens: 0,
      rejectedPredictionTokens: 0
    });
  });

  test('test if parsing of Chat Completions API data fills expected fields', () => {
    const result = parseUsage({
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150
    });
    expect(result.inputTokens).toBe(100);
    expect(result.outputTokens).toBe(50);
    expect(result.totalTokens).toBe(150);
  });

  test('test if parsing of Response API data fills expected fields', () => {
    const result = parseUsage({
      input_tokens: 80,
      output_tokens: 40,
      total_tokens: 120
    });
    expect(result.inputTokens).toBe(80);
    expect(result.outputTokens).toBe(40);
    expect(result.totalTokens).toBe(120);
  });

  test('computes total_tokens when missing', () => {
    const result = parseUsage({
      prompt_tokens: 10,
      completion_tokens: 5
    });
    expect(result.totalTokens).toBe(15);
  });

  test('extracts reasoning_tokens from output_tokens_details', () => {
    const result = parseUsage({
      input_tokens: 50,
      output_tokens: 100,
      total_tokens: 150,
      output_tokens_details: {
        reasoning_tokens: 30
      }
    });
    expect(result.reasoningTokens).toBe(30);
  });

  test('extracts reasoning_tokens from completion_tokens_details (Chat Completions)', () => {
    const result = parseUsage({
      prompt_tokens: 20,
      completion_tokens: 200,
      total_tokens: 220,
      completion_tokens_details: {
        reasoning_tokens: 150
      }
    });
    expect(result.reasoningTokens).toBe(150);
  });

  test('extracts cached_tokens from input_tokens_details', () => {
    const result = parseUsage({
      input_tokens: 100,
      output_tokens: 50,
      total_tokens: 150,
      input_tokens_details: {
        cached_tokens: 20
      }
    });
    expect(result.cachedTokens).toBe(20);
  });

  test('extracts top-level reasoning_tokens and cached_tokens when present', () => {
    const result = parseUsage({
      prompt_tokens: 50,
      completion_tokens: 80,
      reasoning_tokens: 25,
      cached_tokens: 10
    });
    expect(result.reasoningTokens).toBe(25);
    expect(result.cachedTokens).toBe(10);
  });

  test('extracts rejected_prediction_tokens from output_tokens_details', () => {
    const result = parseUsage({
      input_tokens: 50,
      output_tokens: 100,
      output_tokens_details: {
        rejected_prediction_tokens: 15
      }
    });
    expect(result.rejectedPredictionTokens).toBe(15);
  });

  test('handles plain JavaScript objects from OpenAI SDK', () => {
    // OpenAI JavaScript SDK returns plain objects, not Pydantic models
    // This test verifies we correctly handle the actual SDK response format
    const result = parseUsage({
      input_tokens: 60,
      output_tokens: 40,
      total_tokens: 100
    });
    expect(result.inputTokens).toBe(60);
    expect(result.outputTokens).toBe(40);
    expect(result.totalTokens).toBe(100);
  });
});
