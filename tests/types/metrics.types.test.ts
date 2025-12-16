import { GalileoMetrics } from '../../src/types/metrics.types';
import { snakeCase } from 'lodash';

describe('GalileoScorers', () => {
  /**
   * A "primary scorer" is a const object member where its camelCase key, when converted to
   * snake_case, is identical to its string value.
   *
   * An "additional scorer" is another const object member that maps to the same string value
   * as a primary scorer (i.e., an alias).
   */
  const testCases: [
    keyof typeof GalileoMetrics,
    (keyof typeof GalileoMetrics)[]
  ][] = [
    ['actionCompletionLuna', []],
    ['actionAdvancementLuna', []],
    ['agenticSessionSuccess', ['actionCompletion']],
    ['agenticWorkflowSuccess', ['actionAdvancement']],
    ['bleu', []],
    ['chunkAttributionUtilizationLuna', []],
    ['chunkAttributionUtilization', []],
    ['completenessLuna', []],
    ['completeness', []],
    ['contextAdherence', []],
    ['contextAdherenceLuna', []],
    ['contextRelevance', []],
    ['correctness', []],
    ['groundTruthAdherence', []],
    ['inputPii', []],
    ['inputSexist', ['inputSexism']],
    ['inputSexistLuna', ['inputSexismLuna']],
    ['inputTone', []],
    ['inputToxicity', []],
    ['inputToxicityLuna', []],
    ['instructionAdherence', []],
    ['outputPii', []],
    ['outputSexist', ['outputSexism']],
    ['outputSexistLuna', ['outputSexismLuna']],
    ['outputTone', []],
    ['outputToxicity', []],
    ['outputToxicityLuna', []],
    ['promptInjection', []],
    ['promptInjectionLuna', []],
    ['promptPerplexity', []],
    ['rouge', []],
    ['toolErrorRate', []],
    ['toolErrorRateLuna', []],
    ['toolSelectionQuality', []],
    ['toolSelectionQualityLuna', []],
    ['uncertainty', []]
  ];

  test.each(testCases)(
    'scorer %s has correct value and aliases',
    (primaryScorerKey, additionalScorerKeys) => {
      const primaryScorerValue = GalileoMetrics[primaryScorerKey];

      // For non-alias enums, the snake_cased key should equal the value
      if (snakeCase(primaryScorerKey as string) === primaryScorerValue) {
        expect(snakeCase(primaryScorerKey as string)).toBe(primaryScorerValue);
      }

      additionalScorerKeys.forEach((aliasKey) => {
        expect(GalileoMetrics[aliasKey]).toBe(primaryScorerValue);
      });
    }
  );
});
