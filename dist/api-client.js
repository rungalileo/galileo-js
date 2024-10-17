"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GalileoApiClient = exports.RequestMethod = void 0;
const jsonwebtoken_1 = require("jsonwebtoken");
const axios_1 = __importDefault(require("axios"));
const routes_types_js_1 = require("./types/routes.types.js");
const querystring_1 = __importDefault(require("querystring"));
var RequestMethod;
(function (RequestMethod) {
    RequestMethod["GET"] = "GET";
    RequestMethod["POST"] = "POST";
    RequestMethod["PUT"] = "PUT";
    RequestMethod["DELETE"] = "DELETE";
})(RequestMethod || (exports.RequestMethod = RequestMethod = {}));
class GalileoApiClient {
    constructor() {
        this.type = undefined;
        this.projectId = '';
        this.runId = '';
        this.apiUrl = '';
        this.token = '';
    }
    async init(projectName) {
        this.apiUrl = this.getApiUrl();
        if (await this.healthCheck()) {
            this.token = await this.getToken();
            try {
                this.projectId = await this.getProjectIdByName(projectName);
                // eslint-disable-next-line no-console
                console.log(`✅ Using ${projectName}`);
            }
            catch (err) {
                const error = err;
                if (error.message.includes('not found')) {
                    const project = await this.createProject(projectName);
                    this.projectId = project.id;
                    // eslint-disable-next-line no-console
                    console.log(`✨ ${projectName} created!`);
                }
                else {
                    throw err;
                }
            }
        }
    }
    getApiUrl() {
        const consoleUrl = process.env.GALILEO_CONSOLE_URL;
        if (!consoleUrl) {
            throw new Error('❗ GALILEO_CONSOLE_URL must be set');
        }
        if (consoleUrl.includes('localhost') || consoleUrl.includes('127.0.0.1')) {
            return 'http://localhost:8088';
        }
        else {
            return consoleUrl.replace('console', 'api');
        }
    }
    async healthCheck() {
        return await this.makeRequest(RequestMethod.GET, routes_types_js_1.Routes.healthCheck);
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
        throw new Error('❗ GALILEO_API_KEY or GALILEO_USERNAME and GALILEO_PASSWORD must be set');
    }
    async apiKeyLogin(api_key) {
        return await this.makeRequest(RequestMethod.POST, routes_types_js_1.Routes.apiKeyLogin, {
            api_key
        });
    }
    async usernameLogin(username, password) {
        return await this.makeRequest(RequestMethod.POST, routes_types_js_1.Routes.login, querystring_1.default.stringify({
            username,
            password
        }));
    }
    async getProjectIdByName(project_name) {
        const projects = await this.makeRequest(RequestMethod.GET, routes_types_js_1.Routes.projects, null, {
            project_name,
            type: this.type
        });
        if (projects.length < 1) {
            throw new Error(`Galileo project ${project_name} not found`);
        }
        return projects[0].id;
    }
    async createProject(project_name) {
        return await this.makeRequest(RequestMethod.POST, routes_types_js_1.Routes.projects, {
            name: project_name,
            type: this.type
        });
    }
    getAuthHeader(token) {
        return { Authorization: `Bearer ${token}` };
    }
    validateResponse(response) {
        if (response.status >= 300) {
            const msg = `❗ Something didn't go quite right. The API returned a non-ok status code ${response.status} with output: ${response.data}`;
            // TODO: Better error handling
            throw new Error(msg);
        }
    }
    async makeRequest(request_method, endpoint, 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data, params) {
        // Check to see if our token is expired before making a request
        // and refresh token if it's expired
        if (endpoint !== routes_types_js_1.Routes.login && this.token) {
            const payload = (0, jsonwebtoken_1.decode)(this.token, { json: true });
            if (payload?.exp && payload.exp < Math.floor(Date.now() / 1000)) {
                this.token = await this.getToken();
            }
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let headers = {};
        if (this.token) {
            headers = this.getAuthHeader(this.token);
        }
        const config = {
            method: request_method,
            url: `${this.apiUrl}/${endpoint.replace('{project_id}', this.projectId).replace('{run_id}', this.runId)}`,
            params,
            headers,
            data
        };
        const response = await axios_1.default.request(config);
        this.validateResponse(response);
        return response.data;
    }
}
exports.GalileoApiClient = GalileoApiClient;
//# sourceMappingURL=api-client.js.map