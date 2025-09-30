import {
  CreateCustomLlmMetricParams,
  OutputType,
  ScorerTypes,
  ScorerVersion,
  StepType
} from '../types';
import {
  createScorer,
  createLlmScorerVersion,
  deleteScorer,
  getScorers
} from './scorers';

/**
 * Creates a custom LLM metric.
 *
 * @param params - The parameters for creating the custom LLM metric.
 * @returns A promise that resolves when the metric is created.
 */
export const createCustomLlmMetric = async ({
  name,
  userPrompt,
  nodeLevel = StepType.llm,
  cotEnabled = true,
  modelName = 'gpt-4.1-mini',
  numJudges = 3,
  description = '',
  tags = [],
  outputType = OutputType.BOOLEAN
}: CreateCustomLlmMetricParams): Promise<ScorerVersion> => {
  const scorer = await createScorer(
    name,
    ScorerTypes.llm,
    description,
    tags,
    {
      model_name: modelName,
      num_judges: numJudges
    },
    undefined,
    undefined
  );

  const scoreableNodeTypes = [nodeLevel];
  return await createLlmScorerVersion({
    scorerId: scorer.id,
    userPrompt,
    scoreableNodeTypes,
    cotEnabled,
    modelName,
    numJudges,
    outputType
  });
};

/**
 * Deletes a metric by its name and type.
 *
 * @param scorerName - The name of the scorer to delete.
 * @param scorerType - The type of the scorer.
 * @returns A promise that resolves when the scorer is deleted.
 * @throws Error if the scorer with the given name is not found.
 */
export const deleteMetric = async (
  scorerName: string,
  scorerType: ScorerTypes
): Promise<void> => {
  const names: string[] = [scorerName];
  console.log('Deleting metric with names:', names);
  const scorers = await getScorers({ type: scorerType, names: names });
  if (scorers.length === 0) {
    throw new Error(`Scorer with name ${scorerName} not found.`);
  }
  const scorer = scorers[0]; // There should only ever be one here
  await deleteScorer(scorer.id);
};
