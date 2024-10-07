import GalileoWorkflows from "../workflow";
import GalileoEvaluateApiClient from "./api-client";

export default class GalileoEvaluateWorkflows extends GalileoWorkflows {
  private apiClient: GalileoEvaluateApiClient = new GalileoEvaluateApiClient();

  public async init(): Promise<void> {
    await this.apiClient.init(this.projectName);
  }
}