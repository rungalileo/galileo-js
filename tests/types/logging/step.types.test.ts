import {
  isDocument,
  isLlmSpanAllowedInputType,
  isLlmSpanAllowedOutputType,
  isRetrieverSpanAllowedOutputType,
  isStepAllowedInputType,
  isStepAllowedOutputType
} from '../../../src/types/logging/step.types';
import { Document } from '../../../src/types/document.types';

describe('step.types', () => {
  describe('isDocument', () => {
    it('should return true for a Document instance', () => {
      class Doc extends Document {
        constructor(content: string, metadata?: Record<string, any>) {
          super({ content, metadata });
        }
      }
      const doc = new Doc('test content');
      expect(isDocument(doc)).toBe(true);
    });

    it('should return false for other objects', () => {
      expect(isDocument({})).toBe(false);
      expect(isDocument({ pageContent: 'test' })).toBe(false);
      expect(isDocument(null)).toBe(false);
      expect(isDocument(undefined)).toBe(false);
    });
  });

  describe('isStepAllowedInputType', () => {
    it('should return true for valid input types', () => {
      expect(isStepAllowedInputType('test string')).toBe(true);
      expect(isStepAllowedInputType(['str1', 'str2'])).toBe(true);
      expect(isStepAllowedInputType({ role: 'user', content: 'hello' })).toBe(
        true
      );
      expect(isStepAllowedInputType([{ role: 'user', content: 'hello' }])).toBe(
        true
      );
      expect(isStepAllowedInputType({ key: 'value' })).toBe(true);
      expect(isStepAllowedInputType([{ key: 'value' }])).toBe(true);
    });

    it('should return false for invalid input types', () => {
      expect(isStepAllowedInputType(123)).toBe(false);
      expect(isStepAllowedInputType(null)).toBe(false);
      expect(isStepAllowedInputType(undefined)).toBe(false);
      expect(isStepAllowedInputType({ key: 123 })).toBe(false);
      expect(isStepAllowedInputType(['str1', { key: 123 }])).toBe(false);
    });
  });

  describe('isStepAllowedOutputType', () => {
    it('should return true for valid output types', () => {
      expect(isStepAllowedOutputType('test string')).toBe(true);
      expect(isStepAllowedOutputType(['str1', 'str2'])).toBe(true);
      expect(isStepAllowedOutputType({ role: 'user', content: 'hello' })).toBe(
        true
      );
      expect(
        isStepAllowedOutputType(new Document({ content: 'doc content' }))
      ).toBe(true);
      expect(
        isStepAllowedOutputType([
          new Document({ content: 'doc1' }),
          new Document({ content: 'doc2' })
        ])
      ).toBe(true);
      expect(isStepAllowedOutputType({ key: 'value' })).toBe(true);
      expect(isStepAllowedOutputType([{ key: 'value' }])).toBe(true);
    });

    it('should return false for invalid output types', () => {
      expect(isStepAllowedOutputType(123)).toBe(false);
      expect(isStepAllowedOutputType(null)).toBe(false);
      expect(isStepAllowedOutputType(undefined)).toBe(false);
      expect(isStepAllowedOutputType({ key: 123 })).toBe(false);
      expect(isStepAllowedOutputType(['str1', { key: 123 }])).toBe(false);
    });
  });

  describe('isLlmSpanAllowedInputType', () => {
    it('should return true for valid llm span input types', () => {
      expect(isLlmSpanAllowedInputType('test string')).toBe(true);
      expect(isLlmSpanAllowedInputType(['str1', 'str2'])).toBe(true);
      expect(
        isLlmSpanAllowedInputType({ role: 'user', content: 'hello' })
      ).toBe(true);
    });

    it('should return false for invalid llm span input types', () => {
      expect(isLlmSpanAllowedInputType(123)).toBe(false);
    });
  });

  describe('isLlmSpanAllowedOutputType', () => {
    it('should return true for valid llm span output types', () => {
      expect(isLlmSpanAllowedOutputType('test string')).toBe(true);
      expect(
        isLlmSpanAllowedOutputType({ role: 'assistant', content: 'response' })
      ).toBe(true);
      expect(isLlmSpanAllowedOutputType({ key: 'value' })).toBe(true);
    });

    it('should return false for invalid llm span output types', () => {
      expect(isLlmSpanAllowedOutputType(123)).toBe(false);
      expect(isLlmSpanAllowedOutputType(new Document({ content: 'doc' }))).toBe(
        false
      );
      expect(isLlmSpanAllowedOutputType(['string'])).toBe(false);
    });
  });

  describe('isRetrieverSpanAllowedOutputType', () => {
    it('should return true for valid retriever span output types', () => {
      expect(isRetrieverSpanAllowedOutputType('test string')).toBe(true);
      expect(
        isRetrieverSpanAllowedOutputType(new Document({ content: 'doc' }))
      ).toBe(true);
      expect(isRetrieverSpanAllowedOutputType({ key: 'value' })).toBe(true);
      expect(isRetrieverSpanAllowedOutputType(['str1', 'str2'])).toBe(true);
      expect(
        isRetrieverSpanAllowedOutputType([
          new Document({ content: 'doc1' }),
          new Document({ content: 'doc2' })
        ])
      ).toBe(true);
      expect(isRetrieverSpanAllowedOutputType([{ key: 'value' }])).toBe(true);
    });

    it('should return false for invalid retriever span output types', () => {
      expect(isRetrieverSpanAllowedOutputType(123)).toBe(false);
      expect(
        isRetrieverSpanAllowedOutputType({
          role: 'assistant',
          content: 'response'
        })
      ).toBe(false);
    });
  });
});
