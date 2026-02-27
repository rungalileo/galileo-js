import { GalileoLegacyApiClient, RequestMethod } from '../legacy-api-client';
import { getSdkLogger } from 'galileo-generated';
import { Node } from '../types/node.types';
import { Routes } from '../types/routes.types';
import { RunTag } from './../types/tag.types';
import {
  CustomizedScorer,
  RegisteredScorer,
  ScorersConfiguration
} from '../types/scorer.types';
import { timestampName } from '../utils/utils';
import { ProjectTypes } from '../types/project.types';

const sdkLogger = getSdkLogger();

export default class GalileoEvaluateApiClient extends GalileoLegacyApiClient {
  constructor() {
    super();
    this.type = ProjectTypes.evaluate;
  }

  public async createRun(
    runName?: string,
    runTags?: RunTag[]
  ): Promise<string> {
    if (!this.projectId) throw new Error('❗ Init a project to create a run.');

    const run = await this.makeRequest<{ id: string }>(
      RequestMethod.POST,
      Routes.runs,
      {
        name: runName ?? timestampName('run'),
        project_id: this.projectId,
        task_type: 12,
        run_tags: runTags ?? []
      }
    );

    sdkLogger.info(`✨ ${runName ?? timestampName('run')} created.`);

    return run.id;
  }

  public async ingestChain(
    rows: Node[],
    prompt_scorers_configuration: ScorersConfiguration,
    prompt_registered_scorers_configuration?: RegisteredScorer[],
    prompt_customized_scorers_configuration?: CustomizedScorer[]
  ): Promise<{
    num_rows: number;
    message: string;
  }> {
    return await this.makeRequest(RequestMethod.POST, Routes.evaluateIngest, {
      rows,
      prompt_scorers_configuration,
      prompt_registered_scorers_configuration,
      prompt_customized_scorers_configuration
    });
  }
}
