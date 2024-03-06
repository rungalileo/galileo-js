"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeRequest = exports.HttpHeaders = void 0;
const axios_1 = __importDefault(require("axios"));
class HttpHeaders {
    constructor() {
        this.accept = 'accept';
        this.content_type = 'Content-Type';
        this.application_json = 'application/json';
    }
    static acceptJson() {
        const headers = new HttpHeaders();
        return { [headers.accept]: headers.application_json };
    }
    static json() {
        return { ...HttpHeaders.acceptJson(), ...HttpHeaders.contentTypeJson() };
    }
    static contentTypeJson() {
        const headers = new HttpHeaders();
        return { [headers.content_type]: headers.application_json };
    }
}
exports.HttpHeaders = HttpHeaders;
function validateResponse(response) {
    if (response.status >= 300) {
        const msg = `Something didn't go quite right. The API returned a non-ok status code ${response.status} with output: ${response.data}`;
        // TODO: Better error handling.
        throw new Error(msg);
    }
}
async function makeRequest(requestMethod, baseUrl, endpoint, body, data, files, params, headers, timeout) {
    const response = await (0, axios_1.default)(`${baseUrl}${endpoint}`, {
        method: requestMethod,
        headers: {
            ...headers,
            ...HttpHeaders.json()
        },
        data: body || data,
        params,
        timeout: timeout || 60000
    });
    validateResponse(response);
    return response.data;
}
exports.makeRequest = makeRequest;
//# sourceMappingURL=request.js.map