import { GalileoApiClient, ProjectTypes, RequestMethod } from "../api-client";
import { Node } from "../types/node.types";
import { Routes } from "../types/routes.types";
import { RunTag } from './../types/tag.types';
import { CustomizedScorer, RegisteredScorer, ScorersConfiguration } from "../types/scorer.types";

export default class GalileoEvaluateApiClient extends GalileoApiClient {
  constructor() {
    super();
    this.type = ProjectTypes.evaluate;
  }

  public async createRun(run_name?: string, run_tags?: RunTag[]): Promise<{ id: string }> {
    return await this.makeRequest<{ id: string }>(RequestMethod.POST, Routes.projects, {
      name: run_name,
      project_id: this.project_id,
      task_type: 12,
      run_tags
    })
  }

  public async ingestChain(
    rows: Node[],
    prompt_scorers_configuration: ScorersConfiguration,
    prompt_registered_scorers_configuration?: RegisteredScorer[],
    prompt_customized_scorers_configuration?: CustomizedScorer[],
  ) {
    return await this.makeRequest<string>(
      RequestMethod.POST,
      Routes.evaluateIngest,
      {
        rows,
        prompt_scorers_configuration,
        prompt_registered_scorers_configuration,
        prompt_customized_scorers_configuration,
      },
    );
  }
}