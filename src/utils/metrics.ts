import { ScorerTypes } from '../types';
import {
  createScorer,
  createLlmScorerVersion,
  deleteScorer,
  getScorers
} from './scorers';

/**
 * Creates a custom LLM metric.
 *
 * @param name - The name of the custom metric.
 * @param instructions - Instructions for the LLM scorer version.
 * @param chainPollTemplate - The chain poll template for the scorer version.
 * @param modelName - (Optional) The model name to use. Defaults to 'GPT-4o'.
 * @param numJudges - (Optional) The number of judges to use. Defaults to 3.
 * @param description - (Optional) A description for the metric.
 * @param tags - (Optional) Tags to associate with the metric.
 * @returns A promise that resolves when the metric is created.
 */
export const createCustomLlmMetric = async (
  name: string,
  userPrompt: string,
  nodeLevel: string = 'llm',
  cotEnabled: boolean = true,
  modelName: string = 'GPT-4o',
  numJudges: number = 3,
  description: string = '',
  tags: string[] = []
): Promise<void> => {
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

  await createLlmScorerVersion(
    scorer.id,
    undefined,
    undefined,
    userPrompt,
    nodeLevel,
    cotEnabled,
    modelName,
    numJudges
  );
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
  const scorers = await getScorers(scorerType);
  const scorer = scorers.find((s) => s.name === scorerName);
  if (!scorer) {
    throw new Error(`Scorer with name ${scorerName} not found.`);
  }
  await deleteScorer(scorer.id);
};
