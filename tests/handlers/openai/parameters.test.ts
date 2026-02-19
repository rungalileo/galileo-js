/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  extractRequestParameters,
  mergeWithRequestMetadata,
  type ExtractedParameters
} from '../../../src/handlers/openai/parameters';

describe('Parameters Extraction', () => {
  describe('extractRequestParameters', () => {
    test('extracts no parameters when request is empty', () => {
      const request = {};

      const result = extractRequestParameters(request);

      expect(result.metadata).toEqual({});
      expect(result.tools).toBeUndefined();
    });

    test('ignores default values (temperature=1, top_p=1, etc)', () => {
      const request = {
        temperature: 1,
        top_p: 1,
        n: 1,
        frequency_penalty: 0,
        presence_penalty: 0
      };

      const result = extractRequestParameters(request);

      // Default values should not be in metadata
      expect(Object.keys(result.metadata).length).toBe(0);
    });

    test('extracts non-default scalar parameters', () => {
      const request = {
        temperature: 0.5,
        top_p: 0.9,
        max_tokens: 500,
        frequency_penalty: 0.5,
        presence_penalty: -0.5,
        n: 2,
        seed: 42
      };

      const result = extractRequestParameters(request);

      expect(result.metadata['temperature']).toBe('0.5');
      expect(result.metadata['top_p']).toBe('0.9');
      expect(result.metadata['max_tokens']).toBe('500');
      expect(result.metadata['frequency_penalty']).toBe('0.5');
      expect(result.metadata['presence_penalty']).toBe('-0.5');
      expect(result.metadata['n']).toBe('2');
      expect(result.metadata['seed']).toBe('42');
    });

    test('extracts top-level reasoning_effort', () => {
      const request = {
        reasoning_effort: 'high',
        model: 'o3'
      };

      const result = extractRequestParameters(request);

      expect(result.metadata['reasoning_effort']).toBe('high');
    });

    test('extracts nested reasoning parameters', () => {
      const request = {
        reasoning: {
          effort: 'medium',
          summary: true,
          generate_summary: false
        }
      };

      const result = extractRequestParameters(request);

      expect(result.metadata['reasoning_effort']).toBe('medium');
      expect(result.metadata['reasoning_verbosity']).toBe('true');
      expect(result.metadata['reasoning_generate_summary']).toBe('false');
    });

    test('prefers top-level reasoning_effort over nested effort', () => {
      const request = {
        reasoning_effort: 'high',
        reasoning: {
          effort: 'low'
        }
      };

      const result = extractRequestParameters(request);

      // Top-level should be used
      expect(result.metadata['reasoning_effort']).toBe('high');
    });

    test('handles invalid reasoning object gracefully', () => {
      const request = {
        reasoning: 'not an object'
      };

      const result = extractRequestParameters(request);

      // Should not crash and should not add reasoning parameters
      expect(result.metadata['reasoning_effort']).toBeUndefined();
    });

    test('extracts tool_choice as string', () => {
      const request = {
        tool_choice: 'auto'
      };

      const result = extractRequestParameters(request);

      expect(result.metadata['tool_choice']).toBe('auto');
    });

    test('extracts tool_choice as object (JSON stringified)', () => {
      const request = {
        tool_choice: { type: 'function', function: { name: 'get_weather' } }
      };

      const result = extractRequestParameters(request);

      expect(result.metadata['tool_choice']).toContain('get_weather');
    });

    test('extracts simple response_format as type only', () => {
      const request = {
        response_format: { type: 'json_object' }
      };

      const result = extractRequestParameters(request);

      expect(result.metadata['response_format']).toBe('json_object');
    });

    test('extracts complex response_format as pretty-printed JSON', () => {
      const request = {
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'Weather',
            strict: true
          }
        }
      };

      const result = extractRequestParameters(request);

      expect(result.metadata['response_format']).toContain('json_schema');
      expect(result.metadata['response_format']).toContain('Weather');
    });

    test('extracts response_format as string', () => {
      const request = {
        response_format: 'text'
      };

      const result = extractRequestParameters(request);

      expect(result.metadata['response_format']).toBe('text');
    });

    test('extracts tools and adds count to metadata', () => {
      const request = {
        tools: [
          { type: 'function', function: { name: 'get_weather' } },
          { type: 'function', function: { name: 'get_location' } }
        ]
      };

      const result = extractRequestParameters(request);

      expect(result.metadata['tools_count']).toBe('2');
      expect(result.tools).toHaveLength(2);
      expect(result.tools![0]).toEqual({
        type: 'function',
        function: { name: 'get_weather' }
      });
    });

    test('handles non-object tools gracefully', () => {
      const request = {
        tools: ['string_tool', 123, { valid: 'tool' }]
      };

      const result = extractRequestParameters(request);

      expect(result.metadata['tools_count']).toBe('3');
      expect(result.tools![0]).toEqual({ raw: 'string_tool' });
      expect(result.tools![1]).toEqual({ raw: 123 });
      expect(result.tools![2]).toEqual({ valid: 'tool' });
    });

    test('detects tools with strict mode (Structured Outputs)', () => {
      const request = {
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_weather',
              strict: true
            }
          }
        ]
      };

      const result = extractRequestParameters(request);

      expect(result.metadata['tools_include_strict']).toBe('true');
    });

    test('does not flag strict mode if not present', () => {
      const request = {
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_weather',
              strict: false
            }
          }
        ]
      };

      const result = extractRequestParameters(request);

      expect(result.metadata['tools_include_strict']).toBeUndefined();
    });

    test('extracts input type from Responses API', () => {
      const request = {
        input: [{ type: 'message', content: 'Hello', role: 'user' }]
      };

      const result = extractRequestParameters(request);

      expect(result.metadata['input_type']).toBe('array');
    });

    test('extracts input type as string from Responses API', () => {
      const request = {
        input: 'Hello'
      };

      const result = extractRequestParameters(request);

      expect(result.metadata['input_type']).toBe('string');
    });

    test('extracts instructions length from Responses API', () => {
      const request = {
        instructions:
          'You are a helpful assistant that specializes in weather forecasting. Always provide accurate information.'
      };

      const result = extractRequestParameters(request);

      expect(result.metadata['instructions_length']).toBe('105');
    });

    test('extracts store parameter from Responses API', () => {
      const request = {
        store: true
      };

      const result = extractRequestParameters(request);

      expect(result.metadata['store']).toBe('true');
    });

    test('extracts prediction type', () => {
      const request = {
        prediction: { type: 'content' }
      };

      const result = extractRequestParameters(request);

      expect(result.metadata['prediction_type']).toBe('content');
    });

    test('handles prediction as non-object', () => {
      const request = {
        prediction: 'some_value'
      };

      const result = extractRequestParameters(request);

      expect(result.metadata['prediction_type']).toBe('unknown');
    });

    test('ignores null and undefined values', () => {
      const request = {
        temperature: 0.8,
        max_tokens: null,
        seed: undefined,
        instructions: 'test'
      };

      const result = extractRequestParameters(request);

      expect(result.metadata['temperature']).toBe('0.8');
      expect(result.metadata['max_tokens']).toBeUndefined();
      expect(result.metadata['seed']).toBeUndefined();
      expect(result.metadata['instructions_length']).toBe('4');
    });

    test('combines scalar parameters with API-specific parameters', () => {
      const request = {
        temperature: 0.7,
        model: 'gpt-4o',
        input: ['hello'],
        instructions: 'Be helpful',
        tools: [{ type: 'function', function: { name: 'test' } }],
        reasoning_effort: 'medium',
        response_format: { type: 'json_object' },
        tool_choice: 'auto'
      };

      const result = extractRequestParameters(request);

      expect(result.metadata['temperature']).toBe('0.7');
      expect(result.metadata['input_type']).toBe('array');
      expect(result.metadata['instructions_length']).toBe('10');
      expect(result.metadata['tools_count']).toBe('1');
      expect(result.metadata['reasoning_effort']).toBe('medium');
      expect(result.metadata['response_format']).toBe('json_object');
      expect(result.metadata['tool_choice']).toBe('auto');
    });
  });

  describe('mergeWithRequestMetadata', () => {
    test('returns extracted metadata when request metadata is empty', () => {
      const extracted: ExtractedParameters = {
        metadata: {
          temperature: '0.8',
          tools_count: '2'
        }
      };

      const result = mergeWithRequestMetadata(extracted, {});

      expect(result).toEqual({
        temperature: '0.8',
        tools_count: '2'
      });
    });

    test('merges extracted and request metadata', () => {
      const extracted: ExtractedParameters = {
        metadata: {
          temperature: '0.8',
          tools_count: '2'
        }
      };
      const requestMetadata = {
        userId: 'user123',
        requestId: 'req456'
      };

      const result = mergeWithRequestMetadata(extracted, requestMetadata);

      expect(result).toEqual({
        temperature: '0.8',
        tools_count: '2',
        userId: 'user123',
        requestId: 'req456'
      });
    });

    test('request metadata takes precedence for overlapping keys', () => {
      const extracted: ExtractedParameters = {
        metadata: {
          temperature: '0.8'
        }
      };
      const requestMetadata = {
        temperature: '0.9'
      };

      const result = mergeWithRequestMetadata(extracted, requestMetadata);

      expect(result.temperature).toBe('0.9');
    });

    test('stringifies non-string values in request metadata', () => {
      const extracted: ExtractedParameters = {
        metadata: {}
      };
      const requestMetadata = {
        userId: 'user123',
        count: 42,
        data: { nested: 'value' },
        flag: true
      };

      const result = mergeWithRequestMetadata(extracted, requestMetadata);

      expect(result.userId).toBe('user123');
      expect(result.count).toBe('42');
      expect(result.data).toBe('{"nested":"value"}');
      expect(result.flag).toBe('true');
    });

    test('ignores null and undefined in request metadata', () => {
      const extracted: ExtractedParameters = {
        metadata: {
          temperature: '0.8'
        }
      };
      const requestMetadata = {
        userId: 'user123',
        nullValue: null,
        undefinedValue: undefined
      };

      const result = mergeWithRequestMetadata(extracted, requestMetadata);

      expect(result.userId).toBe('user123');
      expect(result.nullValue).toBeUndefined();
      expect(result.undefinedValue).toBeUndefined();
    });

    test('handles null request metadata', () => {
      const extracted: ExtractedParameters = {
        metadata: {
          temperature: '0.8'
        }
      };

      const result = mergeWithRequestMetadata(extracted, null);

      expect(result).toEqual({ temperature: '0.8' });
    });

    test('handles undefined request metadata', () => {
      const extracted: ExtractedParameters = {
        metadata: {
          temperature: '0.8'
        }
      };

      const result = mergeWithRequestMetadata(extracted, undefined);

      expect(result).toEqual({ temperature: '0.8' });
    });

    test('handles request metadata that is not an object', () => {
      const extracted: ExtractedParameters = {
        metadata: {
          temperature: '0.8'
        }
      };

      const result = mergeWithRequestMetadata(extracted, 'invalid' as any);

      expect(result).toEqual({ temperature: '0.8' });
    });
  });

  describe('Integration scenarios', () => {
    test('full Chat Completions request processing', () => {
      const request = {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 0.7,
        max_tokens: 1000,
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_weather',
              description: 'Get weather',
              strict: true
            }
          }
        ],
        tool_choice: 'auto',
        response_format: { type: 'json_object' },
        seed: 123
      };
      const metadata = {
        userId: 'user-001',
        conversationId: 'conv-123'
      };

      const extracted = extractRequestParameters(request);
      const result = mergeWithRequestMetadata(extracted, metadata);

      expect(result.temperature).toBe('0.7');
      expect(result.max_tokens).toBe('1000');
      expect(result.tools_count).toBe('1');
      expect(result.tools_include_strict).toBe('true');
      expect(result.tool_choice).toBe('auto');
      expect(result.response_format).toBe('json_object');
      expect(result.seed).toBe('123');
      expect(result.userId).toBe('user-001');
      expect(result.conversationId).toBe('conv-123');
    });

    test('full Responses API request processing', () => {
      const request = {
        model: 'gpt-4o',
        input: [{ type: 'message', content: 'Analyze this', role: 'user' }],
        instructions: 'You are an expert analyst',
        temperature: 0.5,
        tools: [
          { type: 'function', function: { name: 'analyze' } },
          { type: 'function', function: { name: 'summarize' } }
        ],
        reasoning_effort: 'high',
        store: true,
        prediction: { type: 'content' }
      };
      const metadata = {
        sessionId: 'session-456'
      };

      const extracted = extractRequestParameters(request);
      const result = mergeWithRequestMetadata(extracted, metadata);

      expect(result.temperature).toBe('0.5');
      expect(result.input_type).toBe('array');
      expect(result.instructions_length).toBe('25');
      expect(result.tools_count).toBe('2');
      expect(result.reasoning_effort).toBe('high');
      expect(result.store).toBe('true');
      expect(result.prediction_type).toBe('content');
      expect(result.sessionId).toBe('session-456');
    });
  });
});
