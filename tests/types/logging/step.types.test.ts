import {
  isDocument,
  isLlmSpanAllowedInputType,
  isLlmSpanAllowedOutputType,
  isRetrieverSpanAllowedOutputType,
  isStepAllowedInputType,
  isStepAllowedOutputType,
  BaseStep,
  StepType,
  Metrics,
  StepAllowedInputType,
  StepAllowedOutputType
} from '../../../src/types/logging/step.types';
import { Document } from '../../../src/types/document.types';

describe('step.types', () => {
  describe('isDocument', () => {
    it('should return true for a Document instance', () => {
      const doc = new Document({ content: 'test content' });
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

  describe('BaseStep', () => {
    describe('constructor', () => {
      it('should properly set basic fields', () => {
        const step = new BaseStep(StepType.tool, {
          input: 'test input',
          output: 'test output',
          name: 'test step'
        });

        expect(step.type).toBe(StepType.tool);
        expect(step.input).toBe('test input');
        expect(step.output).toBe('test output');
        expect(step.name).toBe('test step');
        expect(step.redactedInput).toBeUndefined();
        expect(step.redactedOutput).toBeUndefined();
      });

      it('should properly set redacted fields when provided', () => {
        const step = new BaseStep(StepType.tool, {
          input: 'sensitive input data',
          redactedInput: 'input [REDACTED]',
          output: 'sensitive output data',
          redactedOutput: 'output [REDACTED]',
          name: 'test step'
        });

        expect(step.input).toBe('sensitive input data');
        expect(step.redactedInput).toBe('input [REDACTED]');
        expect(step.output).toBe('sensitive output data');
        expect(step.redactedOutput).toBe('output [REDACTED]');
      });

      it('should handle undefined redacted fields', () => {
        const step = new BaseStep(StepType.tool, {
          input: 'regular input',
          output: 'regular output'
        });

        expect(step.redactedInput).toBeUndefined();
        expect(step.redactedOutput).toBeUndefined();
      });

      it('should set default values correctly', () => {
        const step = new BaseStep(StepType.workflow, {
          input: 'test input'
        });

        expect(step.type).toBe(StepType.workflow);
        expect(step.name).toBe('workflow');
        expect(step.createdAt).toBeInstanceOf(Date);
        expect(step.userMetadata).toEqual({});
        expect(step.tags).toEqual([]);
        expect(step.metrics).toBeInstanceOf(Metrics);
        expect(step.datasetMetadata).toEqual({});
      });

      it('should handle custom metadata and tags', () => {
        const customDate = new Date('2023-01-01');
        const customMetrics = new Metrics({ durationNs: 1000 });

        const step = new BaseStep(StepType.llm, {
          input: 'test input',
          createdAt: customDate,
          metadata: { key1: 'value1', key2: 'value2' },
          tags: ['tag1', 'tag2'],
          statusCode: 200,
          metrics: customMetrics,
          externalId: 'ext-123',
          stepNumber: 5,
          datasetInput: 'dataset-input',
          datasetOutput: 'dataset-output',
          datasetMetadata: { dataset: 'test' }
        });

        expect(step.createdAt).toBe(customDate);
        expect(step.userMetadata).toEqual({ key1: 'value1', key2: 'value2' });
        expect(step.tags).toEqual(['tag1', 'tag2']);
        expect(step.statusCode).toBe(200);
        expect(step.metrics).toBe(customMetrics);
        expect(step.externalId).toBe('ext-123');
        expect(step.stepNumber).toBe(5);
        expect(step.datasetInput).toBe('dataset-input');
        expect(step.datasetOutput).toBe('dataset-output');
        expect(step.datasetMetadata).toEqual({ dataset: 'test' });
      });
    });

    describe('validateInputOutputSerializable', () => {
      let step: BaseStep;

      beforeEach(() => {
        step = new BaseStep(StepType.tool, { input: 'test' });
      });

      it('should validate serializable values correctly', () => {
        expect(() =>
          step.validateInputOutputSerializable('string')
        ).not.toThrow();
        expect(() =>
          step.validateInputOutputSerializable(['array'])
        ).not.toThrow();
        expect(() =>
          step.validateInputOutputSerializable({ key: 'value' })
        ).not.toThrow();
        expect(() => step.validateInputOutputSerializable(123)).not.toThrow();
        expect(() => step.validateInputOutputSerializable(null)).not.toThrow();
      });

      it('should throw error for non-serializable values', () => {
        const circular: Record<string, unknown> = {};
        circular.self = circular;

        expect(() => step.validateInputOutputSerializable(circular)).toThrow(
          'Input/output is not serializable'
        );
      });

      it('should validate redacted fields during construction', () => {
        const circular: Record<string, unknown> = {};
        circular.self = circular;

        expect(() => {
          new BaseStep(StepType.tool, {
            input: 'valid input',
            redactedInput: circular as unknown as StepAllowedInputType // This should throw
          });
        }).toThrow('Input/output is not serializable');

        expect(() => {
          new BaseStep(StepType.tool, {
            input: 'valid input',
            output: 'valid output',
            redactedOutput: circular as unknown as StepAllowedOutputType // This should throw
          });
        }).toThrow('Input/output is not serializable');
      });
    });

    describe('toJSON', () => {
      it('should include all fields in JSON output', () => {
        const customDate = new Date('2023-01-01T12:00:00.000Z');
        const step = new BaseStep(StepType.agent, {
          id: 'step-123',
          input: 'test input',
          redactedInput: 'redacted input',
          output: 'test output',
          redactedOutput: 'redacted output',
          name: 'test step',
          createdAt: customDate,
          metadata: { key: 'value' },
          tags: ['tag1'],
          statusCode: 200,
          metrics: new Metrics({ durationNs: 1000 }),
          externalId: 'ext-123',
          stepNumber: 3,
          datasetInput: 'dataset-input',
          datasetOutput: 'dataset-output',
          datasetMetadata: { dataset: 'test' }
        });

        const json = step.toJSON();

        expect(json).toEqual({
          type: 'agent',
          id: 'step-123',
          input: 'test input',
          redactedInput: 'redacted input',
          output: 'test output',
          redactedOutput: 'redacted output',
          name: 'test step',
          createdAt: new Date('2023-01-01T12:00:00.000Z').toISOString(),
          userMetadata: { key: 'value' },
          tags: ['tag1'],
          statusCode: 200,
          metrics: new Metrics({ durationNs: 1000 }),
          externalId: 'ext-123',
          stepNumber: 3,
          datasetInput: 'dataset-input',
          datasetOutput: 'dataset-output',
          datasetMetadata: { dataset: 'test' }
        });
      });

      it('should handle undefined redacted fields in JSON output', () => {
        const step = new BaseStep(StepType.tool, {
          input: 'test input',
          output: 'test output'
        });

        const json = step.toJSON();

        expect(json.redactedInput).toBeUndefined();
        expect(json.redactedOutput).toBeUndefined();
        expect(json.input).toBe('test input');
        expect(json.output).toBe('test output');
      });

      it('should handle partial redacted fields in JSON output', () => {
        const step1 = new BaseStep(StepType.tool, {
          input: 'test input',
          redactedInput: 'redacted input',
          output: 'test output'
          // no redactedOutput
        });

        const step2 = new BaseStep(StepType.tool, {
          input: 'test input',
          output: 'test output',
          redactedOutput: 'redacted output'
          // no redactedInput
        });

        const json1 = step1.toJSON();
        const json2 = step2.toJSON();

        expect(json1.redactedInput).toBe('redacted input');
        expect(json1.redactedOutput).toBeUndefined();

        expect(json2.redactedInput).toBeUndefined();
        expect(json2.redactedOutput).toBe('redacted output');
      });
    });

    describe('redacted data types', () => {
      it('should handle different data types for redacted fields', () => {
        const messageInput = { role: 'user', content: 'Hello' };
        const redactedMessageInput = { role: 'user', content: '[REDACTED]' };
        const documentOutput = new Document({ content: 'Document content' });
        const redactedDocumentOutput = new Document({ content: '[REDACTED]' });

        const step = new BaseStep(StepType.retriever, {
          input: messageInput,
          redactedInput: redactedMessageInput,
          output: documentOutput,
          redactedOutput: redactedDocumentOutput
        });

        expect(step.input).toEqual(messageInput);
        expect(step.redactedInput).toEqual(redactedMessageInput);
        expect(step.output).toEqual(documentOutput);
        expect(step.redactedOutput).toEqual(redactedDocumentOutput);
      });

      it('should handle array types for redacted fields', () => {
        const arrayInput = ['input1', 'input2'];
        const redactedArrayInput = ['[REDACTED]', '[REDACTED]'];
        const arrayOutput = [
          new Document({ content: 'doc1' }),
          new Document({ content: 'doc2' })
        ];
        const redactedArrayOutput = [
          new Document({ content: '[REDACTED]' }),
          new Document({ content: '[REDACTED]' })
        ];

        const step = new BaseStep(StepType.retriever, {
          input: arrayInput,
          redactedInput: redactedArrayInput,
          output: arrayOutput,
          redactedOutput: redactedArrayOutput
        });

        expect(step.input).toEqual(arrayInput);
        expect(step.redactedInput).toEqual(redactedArrayInput);
        expect(step.output).toEqual(arrayOutput);
        expect(step.redactedOutput).toEqual(redactedArrayOutput);
      });
    });
  });
});
