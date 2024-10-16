"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const api_client_1 = require("../api-client");
const routes_types_1 = require("../types/routes.types");
const utils_1 = require("../utils/utils");
const project_types_1 = require("../types/project.types");
class GalileoEvaluateApiClient extends api_client_1.GalileoApiClient {
    constructor() {
        super();
        this.type = project_types_1.ProjectTypes.evaluate;
    }
    async createRun(runName, runTags) {
        if (!this.projectId)
            throw new Error('Init a project to create a run.');
        const run = await this.makeRequest(api_client_1.RequestMethod.POST, routes_types_1.Routes.runs, {
            name: runName ?? (0, utils_1.timestampName)('run'),
            project_id: this.projectId,
            task_type: 12,
            run_tags: runTags ?? []
        });
        return run.id;
    }
    async ingestChain(rows, prompt_scorers_configuration, prompt_registered_scorers_configuration, prompt_customized_scorers_configuration) {
        return await this.makeRequest(api_client_1.RequestMethod.POST, routes_types_1.Routes.evaluateIngest, {
            rows,
            prompt_scorers_configuration,
            prompt_registered_scorers_configuration,
            prompt_customized_scorers_configuration
        });
    }
}
exports.default = GalileoEvaluateApiClient;
//# sourceMappingURL=api-client.js.map