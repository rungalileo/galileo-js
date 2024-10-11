"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const api_client_1 = require("../api-client");
const project_types_1 = require("../types/project.types");
const routes_types_1 = require("../types/routes.types");
class GalileoObserveApiClient extends api_client_1.GalileoApiClient {
    constructor() {
        super();
        this.type = project_types_1.ProjectTypes.observe;
    }
    // TODO: This should have a more accurate return type
    async getLoggedData(start_time, end_time, filters = [], sort_spec = [], limit, offset, include_chains, chain_id) {
        return await this.makeRequest(api_client_1.RequestMethod.POST, routes_types_1.Routes.observeRows, {
            filters,
            sort_spec
        }, {
            start_time,
            end_time,
            chain_id,
            limit,
            offset,
            include_chains
        });
    }
    // TODO: This should have a more accurate return type
    async getMetrics(start_time, end_time, filters = [], interval, group_by) {
        return await this.makeRequest(api_client_1.RequestMethod.POST, routes_types_1.Routes.observeMetrics, {
            filters
        }, {
            start_time,
            end_time,
            interval,
            group_by
        });
    }
    // TODO: This should have a more accurate return type
    async deleteLoggedData(filters = []) {
        return await this.makeRequest(api_client_1.RequestMethod.POST, routes_types_1.Routes.observeDelete, {
            filters
        });
    }
    async ingestBatch(transaction_batch) {
        return await this.makeRequest(api_client_1.RequestMethod.POST, routes_types_1.Routes.observeIngest, transaction_batch);
    }
}
exports.default = GalileoObserveApiClient;
//# sourceMappingURL=api-client.js.map