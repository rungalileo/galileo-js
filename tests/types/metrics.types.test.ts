import { GalileoScorers } from '../../src/types/metrics.types';
import { snakeCase } from 'lodash';

describe('GalileoScorers', () => {
  /**
   * A "primary scorer" is an enum member where its PascalCase key, when converted to
   * snake_case, is identical to its string value.
   *
   * An "additional scorer" is another enum member that maps to the same string value
   * as a primary scorer (i.e., an alias).
   */
  const testCases: [
    keyof typeof GalileoScorers,
    (keyof typeof GalileoScorers)[]
  ][] = [
    ['ActionCompletionLuna', []],
    ['ActionAdvancementLuna', []],
    ['AgenticSessionSuccess', ['ActionCompletion']],
    ['AgenticWorkflowSuccess', ['ActionAdvancement']],
    ['AgentEfficiency', []],
    ['AgentFlow', []],
    ['Bleu', []],
    ['ChunkAttributionUtilizationLuna', []],
    ['ChunkAttributionUtilization', []],
    ['CompletenessLuna', []],
    ['Completeness', []],
    ['ContextAdherence', []],
    ['ContextAdherenceLuna', []],
    ['ContextRelevance', []],
    ['ConversationQuality', []],
    ['Correctness', []],
    ['GroundTruthAdherence', []],
    ['InputPii', []],
    ['InputPiiGPT', []],
    ['InputSexist', ['InputSexism']],
    ['InputSexistLuna', ['InputSexismLuna']],
    ['InputTone', []],
    ['InputToneGPT', []],
    ['InputToxicity', []],
    ['InputToxicityLuna', []],
    ['InstructionAdherence', []],
    ['OutputPii', []],
    ['OutputPiiGPT', []],
    ['OutputSexist', ['OutputSexism']],
    ['OutputSexistLuna', ['OutputSexismLuna']],
    ['OutputTone', []],
    ['OutputToneGPT', []],
    ['OutputToxicity', []],
    ['OutputToxicityLuna', []],
    ['PromptInjection', []],
    ['PromptInjectionLuna', []],
    ['PromptPerplexity', []],
    ['Rouge', []],
    ['ToolErrorRate', []],
    ['ToolErrorRateLuna', []],
    ['ToolSelectionQuality', []],
    ['ToolSelectionQualityLuna', []],
    ['Uncertainty', []],
    ['UserIntentChange', []]
  ];

  test.each(testCases)(
    'scorer %s has correct value and aliases',
    (primaryScorerKey, additionalScorerKeys) => {
      const primaryScorerValue = GalileoScorers[primaryScorerKey];

      // For non-alias enums, the snake_cased key should equal the value
      if (snakeCase(primaryScorerKey as string) === primaryScorerValue) {
        expect(snakeCase(primaryScorerKey as string)).toBe(primaryScorerValue);
      }

      additionalScorerKeys.forEach((aliasKey) => {
        expect(GalileoScorers[aliasKey]).toBe(primaryScorerValue);
      });
    }
  );
});
