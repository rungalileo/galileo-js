import { ScorerTypes } from '../types';
import {
  createScorer,
  createLlmScorerVersion,
  deleteScorer,
  getScorers
} from './scorers';
import { components } from '../types/api.types';

export const createCustomLlmMetric = async (
  name: string,
  instructions: string,
  chainPollTemplate: components['schemas']['ChainPollTemplate'],
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
    instructions,
    chainPollTemplate,
    modelName,
    numJudges
  );
};

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
