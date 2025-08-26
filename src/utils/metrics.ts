import { OutputType, ScorerTypes, ScorerVersion, StepType } from '../types';
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
 * @param userPrompt - The user prompt for the metric.
 * @param nodeLevel - (Optional) The node level for the metric, i.e. StepType.llm, StepType.trace. Defaults to StepType.llm.
 * @param cotEnabled - (Optional) Whether chain of thought is enabled. Defaults to true.
 * @param modelName - (Optional) The model name to use. Defaults to 'gpt-4.1-mini'.
 * @param numJudges - (Optional) The number of judges to use. Defaults to 3.
 * @param description - (Optional) A description for the metric.
 * @param tags - (Optional) Tags to associate with the metric.
 * @param outputType - (Optional) The output type for the metric. Defaults to OutputType.BOOLEAN.
 * @returns A promise that resolves when the metric is created.
 */
export const createCustomLlmMetric = async (
  name: string,
  userPrompt: string,
  nodeLevel: StepType = StepType.llm,
  cotEnabled: boolean = true,
  modelName: string = 'gpt-4.1-mini',
  numJudges: number = 3,
  description: string = '',
  tags: string[] = [],
  outputType: OutputType = OutputType.BOOLEAN
): Promise<ScorerVersion> => {
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
  return await createLlmScorerVersion(
    scorer.id,
    undefined,
    undefined,
    userPrompt,
    scoreableNodeTypes,
    cotEnabled,
    modelName,
    numJudges,
    outputType
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
  const names: string[] = [scorerName];
  console.log('Deleting metric with names:', names);
  const scorers = await getScorers({ type: scorerType, names: names });
  if (scorers.length === 0) {
    throw new Error(`Scorer with name ${scorerName} not found.`);
  }
  const scorer = scorers[0]; // There should only ever be one here
  await deleteScorer(scorer.id);
};
