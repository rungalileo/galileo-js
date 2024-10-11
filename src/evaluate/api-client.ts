import { GalileoApiClient, RequestMethod } from "../api-client";
import { Node } from "../types/node.types";
import { Routes } from "../types/routes.types";
import { RunTag } from './../types/tag.types';
import { CustomizedScorer, RegisteredScorer, ScorersConfiguration } from "../types/scorer.types";
import { timestampName } from "../utils/utils";
import { ProjectTypes } from "../types/project.types";

export default class GalileoEvaluateApiClient extends GalileoApiClient {
  constructor() {
    super();
    this.type = ProjectTypes.evaluate;
  }

  public async createRun(run_name?: string, run_tags?: RunTag[]): Promise<string> {
    if (!this.project_id) throw new Error('Init a project to create a run.');

    const run = await this.makeRequest<{ id: string }>(RequestMethod.POST, Routes.projects, {
      name: run_name ?? timestampName('run'),
      project_id: this.project_id,
      task_type: 12,
      run_tags: run_tags ?? []
    })

    return run.id
  }

  public async ingestChain(
    rows: Node[],
    prompt_scorers_configuration: ScorersConfiguration,
    prompt_registered_scorers_configuration?: RegisteredScorer[],
    prompt_customized_scorers_configuration?: CustomizedScorer[],
  ): Promise<{
    num_rows: number;
    message: string;
  }> {
    return await this.makeRequest(
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