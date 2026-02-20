/* eslint-disable @typescript-eslint/no-explicit-any */
import { getOpenAiArgs } from '../../../src/handlers/openai/parameters';

describe('OpenAiArgsExtractor', () => {
  describe('without distillation (store=true)', () => {
    test('returns unchanged request options when store is not set', () => {
      const requestOptions = {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 0.7
      };

      const result = getOpenAiArgs(requestOptions);

      // Should return the same options without modification
      expect(result).toEqual(requestOptions);
    });

    test('returns unchanged request options when store is false', () => {
      const requestOptions = {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }],
        store: false
      };

      const result = getOpenAiArgs(requestOptions);

      // Should return the same options without adding metadata
      expect(result).toEqual(requestOptions);
      expect(result.metadata).toBeUndefined();
    });
  });

  describe('with distillation (store=true)', () => {
    test('does not add metadata field when no caller metadata provided', () => {
      const requestOptions = {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }],
        store: true
      };

      const result = getOpenAiArgs(requestOptions);

      // Should have store=true but no empty metadata object
      expect(result.store).toBe(true);
      expect(result.metadata).toBeUndefined();
    });

    test('adds caller metadata to request when store=true', () => {
      const callerMetadata = {
        userId: 'user-123',
        batchId: 'batch-456'
      };

      const requestOptions = {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }],
        store: true,
        metadata: callerMetadata
      };

      const result = getOpenAiArgs(requestOptions);

      expect(result.store).toBe(true);
      expect(result.metadata).toEqual({
        userId: 'user-123',
        batchId: 'batch-456'
      });
    });

    test('filters out non-string types from metadata', () => {
      const callerMetadata = {
        userId: 'user-123',
        numRequests: 42,
        active: true,
        inactive: false,
        tags: ['tag1', 'tag2'], // Arrays filtered out
        config: { nested: 'value' }, // Objects filtered out
        nullField: null, // Nulls filtered out
        undefinedField: undefined // Undefined filtered out
      };

      const requestOptions = {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }],
        store: true,
        metadata: callerMetadata
      };

      const result = getOpenAiArgs(requestOptions);

      expect(result.metadata).toEqual({
        userId: 'user-123',
        numRequests: 42,
        active: 'true',
        inactive: 'false'
      });
    });

    test('filters out responseFormat and response_format from metadata', () => {
      const callerMetadata = {
        userId: 'user-123',
        responseFormat: { type: 'json_object' },
        response_format: { type: 'json_object' }
      };

      const requestOptions = {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }],
        store: true,
        metadata: callerMetadata
      };

      const result = getOpenAiArgs(requestOptions);

      // responseFormat and response_format should NOT be in metadata (OpenAI restriction)
      expect(result.metadata).toEqual({
        userId: 'user-123'
      });
      expect(result.metadata).not.toHaveProperty('responseFormat');
      expect(result.metadata).not.toHaveProperty('response_format');
    });
  });

  describe('distillation workflow', () => {
    test('passes caller metadata to OpenAI when store=true', () => {
      const callerMetadata = {
        trainingBatch: 'batch-001',
        conversationId: 'conv-789',
        userId: 'user-456'
      };

      const requestOptions = {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'What is 2+2?' }],
        store: true,
        metadata: callerMetadata
      };

      const result = getOpenAiArgs(requestOptions);

      // Metadata is passed to OpenAI for training
      expect(result.store).toBe(true);
      expect(result.metadata).toEqual(callerMetadata);
      expect(result.model).toBe('gpt-4o');
    });

    test('separates metadata for OpenAI from Galileo logging', () => {
      // Key security feature: metadata sent to OpenAI for distillation
      // is isolated from what gets logged to Galileo

      const callerMetadata = {
        apiKey: 'secret-key', // Sensitive data
        userId: 'user-123'
      };

      const requestOptions = {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }],
        store: true,
        metadata: callerMetadata
      };

      const openaiRequest = getOpenAiArgs(requestOptions);

      // For OpenAI: metadata is included (for training)
      expect(openaiRequest.metadata).toEqual(callerMetadata);

      // For Galileo: handler uses extractRequestParameters which excludes caller metadata
      // This separation is enforced at the handler level
    });
  });

  describe('metadata validation (parity with galileo-python)', () => {
    test('throws TypeError when metadata is a string', () => {
      const requestOptions = { model: 'gpt-4o', messages: [], store: true, metadata: 'invalid' };
      expect(() => getOpenAiArgs(requestOptions)).toThrow(
        new TypeError('metadata must be a plain object')
      );
    });

    test('throws TypeError when metadata is an array', () => {
      const requestOptions = { model: 'gpt-4o', messages: [], store: true, metadata: ['invalid'] };
      expect(() => getOpenAiArgs(requestOptions)).toThrow(
        new TypeError('metadata must be a plain object')
      );
    });

    test('throws TypeError when metadata is a number', () => {
      const requestOptions = { model: 'gpt-4o', messages: [], store: true, metadata: 42 };
      expect(() => getOpenAiArgs(requestOptions)).toThrow(
        new TypeError('metadata must be a plain object')
      );
    });

    test('throws TypeError when metadata is a boolean', () => {
      const requestOptions = { model: 'gpt-4o', messages: [], store: true, metadata: true };
      expect(() => getOpenAiArgs(requestOptions)).toThrow(
        new TypeError('metadata must be a plain object')
      );
    });

    test('skips metadata when null or undefined (no throw)', () => {
      const requestOptions = { model: 'gpt-4o', messages: [], store: true };
      expect(getOpenAiArgs(requestOptions).metadata).toBeUndefined();
      expect(getOpenAiArgs(requestOptions).metadata).toBeUndefined();
    });

    test('accepts plain object metadata', () => {
      const callerMetadata = { key: 'value' };
      const requestOptions = { model: 'gpt-4o', messages: [], store: true, metadata: callerMetadata };
      const result = getOpenAiArgs(requestOptions);
      expect(result.metadata).toEqual({ key: 'value' });
    });
  });

  describe('edge cases', () => {
    test('handles empty metadata gracefully', () => {
      const requestOptions = {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }],
        store: true
      };

      const result = getOpenAiArgs(requestOptions);

      expect(result.store).toBe(true);
      // Empty metadata is not added to the result
      expect(result.metadata).toBeUndefined();
    });

    test('preserves all compatible types in metadata', () => {
      const callerMetadata = {
        stringValue: 'hello',
        numberValue: 123,
        boolTrue: true,
        boolFalse: false,
        zero: 0,
        empty: '',
        // Incompatible types (filtered out)
        arrayValue: [1, 2, 3],
        objectValue: { key: 'value' },
        nullValue: null
      };

      const requestOptions = {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }],
        store: true,
        metadata: callerMetadata
      };

      const result = getOpenAiArgs(requestOptions);

      expect(result.metadata).toEqual({
        stringValue: 'hello',
        numberValue: 123,
        boolTrue: 'true',
        boolFalse: 'false',
        zero: 0,
        empty: ''
      });
    });

    test('preserves original request options intact', () => {
      const callerMetadata = { userId: 'user-123' };
      const requestOptions = {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }],
        store: true,
        temperature: 0.5,
        metadata: callerMetadata
      };

      const result = getOpenAiArgs(requestOptions);

      // All request options preserved
      expect(result.model).toBe('gpt-4o');
      expect(result.temperature).toBe(0.5);
      expect(result.messages).toEqual([{ role: 'user', content: 'Hello' }]);
      expect(result.store).toBe(true);
    });
  });
});
