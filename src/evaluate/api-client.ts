import { GalileoApiClient, ProjectTypes } from "../api-client";

export default class GalileoEvaluateApiClient extends GalileoApiClient {
  constructor() {
    super();
    this.type = ProjectTypes.evaluate;
  }
}