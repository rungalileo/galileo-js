import { GalileoMetrics } from '../../src/types/metrics.types';

describe('GalileoMetrics', () => {
  test('all values are non-empty strings', () => {
    for (const [, value] of Object.entries(GalileoMetrics)) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });

  test('no duplicate values exist', () => {
    const values = Object.values(GalileoMetrics);
    expect(new Set(values).size).toBe(values.length);
  });

  test('PII/Tone naming convention: base = LLM, Luna = SLM', () => {
    expect(GalileoMetrics.inputPii).toBe('Input PII');
    expect(GalileoMetrics.inputPiiLuna).toBe('Input PII (SLM)');
    expect(GalileoMetrics.inputTone).toBe('Input Tone');
    expect(GalileoMetrics.inputToneLuna).toBe('Input Tone (SLM)');
    expect(GalileoMetrics.outputPii).toBe('Output PII');
    expect(GalileoMetrics.outputPiiLuna).toBe('Output PII (SLM)');
    expect(GalileoMetrics.outputTone).toBe('Output Tone');
    expect(GalileoMetrics.outputToneLuna).toBe('Output Tone (SLM)');
  });

  test('luna entries have (SLM) suffix, non-luna entries do not', () => {
    for (const [key, value] of Object.entries(GalileoMetrics)) {
      if (key.endsWith('Luna')) {
        expect(value).toContain('(SLM)');
      } else {
        expect(value).not.toContain('(SLM)');
      }
    }
  });

  test('deprecated entries are removed', () => {
    const keys = Object.keys(GalileoMetrics);
    expect(keys).not.toContain('bleu');
    expect(keys).not.toContain('rouge');
    expect(keys).not.toContain('promptPerplexity');
    expect(keys).not.toContain('uncertainty');
    expect(keys).not.toContain('agenticSessionSuccess');
    expect(keys).not.toContain('agenticWorkflowSuccess');
    expect(keys).not.toContain('inputPiiGpt');
    expect(keys).not.toContain('inputToneGpt');
    expect(keys).not.toContain('outputPiiGpt');
    expect(keys).not.toContain('outputToneGpt');
    expect(keys).not.toContain('inputSexist');
    expect(keys).not.toContain('outputSexist');
  });

  test('GalileoScorers is not exported', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const exports = require('../../src/types/metrics.types');
    expect(exports.GalileoScorers).toBeUndefined();
  });

  test('specific key-value pairs', () => {
    expect(GalileoMetrics.correctness).toBe('Correctness');
    expect(GalileoMetrics.contextAdherence).toBe('Context Adherence');
    expect(GalileoMetrics.completeness).toBe('Completeness');
    expect(GalileoMetrics.actionCompletion).toBe('Action Completion');
    expect(GalileoMetrics.actionAdvancement).toBe('Action Advancement');
    expect(GalileoMetrics.inputSexism).toBe('Input Sexism');
    expect(GalileoMetrics.precisionAtK).toBe('Precision@K');
    expect(GalileoMetrics.sqlInjection).toBe('SQL Injection');
    expect(GalileoMetrics.reasoningCoherence).toBe('Reasoning Coherence');
  });

  test('values are compatible with string type', () => {
    for (const value of Object.values(GalileoMetrics)) {
      const str: string = value;
      expect(str).toBe(value);
    }
  });
});
