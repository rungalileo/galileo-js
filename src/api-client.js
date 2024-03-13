"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiClient = void 0;
const jsonwebtoken_1 = require("jsonwebtoken");
const axios_1 = __importDefault(require("axios"));
const routes_constants_js_1 = require("./constants/routes.constants.js");
const querystring_1 = __importDefault(require("querystring"));
var RequestMethod;
(function (RequestMethod) {
    RequestMethod["GET"] = "GET";
    RequestMethod["POST"] = "POST";
    RequestMethod["PUT"] = "PUT";
    RequestMethod["DELETE"] = "DELETE";
})(RequestMethod || (RequestMethod = {}));
class ApiClient {
    constructor() {
        this.project_id = '';
        this.api_url = '';
        this.token = '';
    }
    async init(project_name) {
        this.api_url = this.getApiUrl();
        if (await this.healthcheck()) {
            this.token = await this.getToken();
            try {
                this.project_id = await this.getProjectIdByName(project_name);
            }
            catch (e) {
                if (e.message.includes('not found')) {
                    const project = await this.createProject(project_name);
                    this.project_id = project.id;
                    console.log(`🚀 Creating new project... project ${project_name} created!`);
                }
                else {
                    throw e;
                }
            }
        }
    }
    getApiUrl() {
        const console_url = process.env.GALILEO_CONSOLE_URL;
        if (!console_url) {
            throw new Error('GALILEO_CONSOLE_URL must be set');
        }
        if (console_url.includes('localhost') ||
            console_url.includes('127.0.0.1')) {
            return 'http://localhost:8088';
        }
        else {
            return console_url.replace('console', 'api');
        }
    }
    async getToken() {
        const apiKey = process.env.GALILEO_API_KEY;
        if (apiKey) {
            const loginResponse = await this.apiKeyLogin(apiKey);
            return loginResponse.access_token || '';
        }
        const username = process.env.GALILEO_USERNAME;
        const password = process.env.GALILEO_PASSWORD;
        if (username && password) {
            const loginResponse = await this.usernameLogin(username, password);
            return loginResponse.access_token || '';
        }
        throw new Error('GALILEO_API_KEY or GALILEO_USERNAME and GALILEO_PASSWORD must be set');
    }
    async healthcheck() {
        await this.makeRequest(RequestMethod.GET, routes_constants_js_1.Routes.healthcheck);
        return true;
    }
    async usernameLogin(username, password) {
        return await this.makeRequest(RequestMethod.POST, routes_constants_js_1.Routes.login, querystring_1.default.stringify({
            username,
            password
        }));
    }
    async apiKeyLogin(apiKey) {
        return await this.makeRequest(RequestMethod.POST, routes_constants_js_1.Routes.api_key_login, {
            api_key: apiKey
        });
    }
    async getAuthHeader(token) {
        return { Authorization: `Bearer ${token}` };
    }
    async validateResponse(response) {
        if (response.status >= 300) {
            const msg = `Something didn't go quite right. The API returned a non-ok status code ${response.status} with output: ${response.data}`;
            // TODO: Better error handling.
            throw new Error(msg);
        }
    }
    async makeRequest(request_method, endpoint, data, params) {
        // Check to see if our token is expired before making a request
        // and refresh token if it's expired
        let headers = {};
        if (endpoint !== routes_constants_js_1.Routes.login && this.token) {
            const claims = (0, jsonwebtoken_1.decode)(this.token, { complete: true });
            if (claims.payload.exp < Math.floor(Date.now() / 1000)) {
                this.token = await this.getToken();
            }
        }
        if (this.token) {
            headers = await this.getAuthHeader(this.token);
        }
        const config = {
            method: request_method,
            url: `${this.api_url}/${endpoint}`,
            params,
            headers,
            data
        };
        const response = await axios_1.default.request(config);
        await this.validateResponse(response);
        return response.data;
    }
    async ingestBatch(transaction_batch) {
        return await this.makeRequest(RequestMethod.POST, routes_constants_js_1.Routes.ingest.replace('{project_id}', this.project_id), transaction_batch);
    }
    async getProjectIdByName(project_name) {
        const projects = await this.makeRequest(RequestMethod.GET, routes_constants_js_1.Routes.projects, null, {
            project_name,
            type: 'llm_monitor'
        });
        if (projects.length < 1) {
            throw new Error(`Galileo project ${project_name} not found`);
        }
        return projects[0].id;
    }
    async createProject(project_name) {
        return await this.makeRequest(RequestMethod.POST, routes_constants_js_1.Routes.projects, {
            name: project_name,
            type: 'llm_monitor'
        });
    }
    async getLoggedData(start_time, end_time, filters = [], sort_spec = [], limit, offset, include_chains, chain_id) {
        return await this.makeRequest(RequestMethod.POST, routes_constants_js_1.Routes.rows.replace('{project_id}', this.project_id), {
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
    async getMetrics(start_time, end_time, filters = [], interval, group_by) {
        return await this.makeRequest(RequestMethod.POST, routes_constants_js_1.Routes.metrics.replace('{project_id}', this.project_id), {
            filters
        }, {
            start_time,
            end_time,
            interval,
            group_by
        });
    }
}
exports.ApiClient = ApiClient;
//# sourceMappingURL=api-client.js.map