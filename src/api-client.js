"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiClient = void 0;
var jsonwebtoken_1 = require("jsonwebtoken");
var axios_1 = require("axios");
var routes_constants_js_1 = require("./constants/routes.constants.js");
var RequestMethod;
(function (RequestMethod) {
    RequestMethod["GET"] = "GET";
    RequestMethod["POST"] = "POST";
    RequestMethod["PUT"] = "PUT";
    RequestMethod["DELETE"] = "DELETE";
})(RequestMethod || (RequestMethod = {}));
var HttpHeaders = /** @class */ (function () {
    function HttpHeaders() {
        this.accept = 'accept';
        this.content_type = 'Content-Type';
        this.application_json = 'application/json';
    }
    HttpHeaders.acceptJson = function () {
        var _a;
        var headers = new HttpHeaders();
        return _a = {}, _a[headers.accept] = headers.application_json, _a;
    };
    HttpHeaders.json = function () {
        return __assign(__assign({}, HttpHeaders.acceptJson()), HttpHeaders.contentTypeJson());
    };
    HttpHeaders.contentTypeJson = function () {
        var _a;
        var headers = new HttpHeaders();
        return _a = {}, _a[headers.content_type] = headers.application_json, _a;
    };
    return HttpHeaders;
}());
var ApiClient = /** @class */ (function () {
    function ApiClient() {
        this.project_id = '';
        this.api_url = '';
        this.token = '';
    }
    ApiClient.prototype.init = function (project_name) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, _b, _c, e_1;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        _a = this;
                        return [4 /*yield*/, this.getApiUrl()];
                    case 1:
                        _a.api_url = _d.sent();
                        return [4 /*yield*/, this.healthcheck()];
                    case 2:
                        if (!_d.sent()) return [3 /*break*/, 10];
                        _b = this;
                        return [4 /*yield*/, this.getToken()];
                    case 3:
                        _b.token = _d.sent();
                        _d.label = 4;
                    case 4:
                        _d.trys.push([4, 6, , 10]);
                        _c = this;
                        return [4 /*yield*/, this.getProjectIdByName(project_name)];
                    case 5:
                        _c.project_id = _d.sent();
                        return [3 /*break*/, 10];
                    case 6:
                        e_1 = _d.sent();
                        if (!e_1.message.includes('not found')) return [3 /*break*/, 8];
                        return [4 /*yield*/, this.createProject(project_name)];
                    case 7:
                        _d.sent();
                        console.log("\uD83D\uDE80 Creating new project... project ".concat(project_name, " created!"));
                        return [3 /*break*/, 9];
                    case 8: throw e_1;
                    case 9: return [3 /*break*/, 10];
                    case 10: return [2 /*return*/];
                }
            });
        });
    };
    ApiClient.prototype.getApiUrl = function () {
        return __awaiter(this, void 0, void 0, function () {
            var console_url;
            return __generator(this, function (_a) {
                console_url = process.env.GALILEO_CONSOLE_URL;
                if (!console_url) {
                    throw new Error('GALILEO_CONSOLE_URL must be set');
                }
                if (console_url.includes('localhost') ||
                    console_url.includes('127.0.0.1')) {
                    return [2 /*return*/, 'http://localhost:8088'];
                }
                else {
                    return [2 /*return*/, console_url.replace('console', 'api')];
                }
                return [2 /*return*/];
            });
        });
    };
    ApiClient.prototype.getToken = function () {
        return __awaiter(this, void 0, void 0, function () {
            var username, password, loginResponse;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        username = process.env.GALILEO_USERNAME;
                        password = process.env.GALILEO_PASSWORD;
                        if (!username || !password) {
                            throw new Error('GALILEO_USERNAME and GALILEO_PASSWORD must be set');
                        }
                        return [4 /*yield*/, this.usernameLogin(username, password)];
                    case 1:
                        loginResponse = _a.sent();
                        return [2 /*return*/, loginResponse.access_token || ''];
                }
            });
        });
    };
    ApiClient.prototype.healthcheck = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.makeRequest(RequestMethod.GET, this.api_url, routes_constants_js_1.Routes.healthcheck)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, true];
                }
            });
        });
    };
    ApiClient.prototype.usernameLogin = function (username, password) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.makeRequest(RequestMethod.POST, this.api_url, routes_constants_js_1.Routes.login, {
                            username: username,
                            password: password,
                            auth_method: 'email'
                        })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    ApiClient.prototype.get_auth_header = function () {
        return { Authorization: "Bearer ".concat(this.token) };
    };
    ApiClient.prototype.validateResponse = function (response) {
        return __awaiter(this, void 0, void 0, function () {
            var msg;
            return __generator(this, function (_a) {
                if (response.status >= 300) {
                    msg = "Something didn't go quite right. The API returned a non-ok status code ".concat(response.status, " with output: ").concat(response.data);
                    // TODO: Better error handling.
                    throw new Error(msg);
                }
                return [2 /*return*/];
            });
        });
    };
    ApiClient.prototype.makeRequest = function (request_method, endpoint, body, data, files, params, timeout, json_request_only) {
        return __awaiter(this, void 0, void 0, function () {
            var claims, _a, headers, config, response;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!(endpoint !== routes_constants_js_1.Routes.login && this.token)) return [3 /*break*/, 2];
                        claims = (0, jsonwebtoken_1.decode)(this.token, { complete: true });
                        if (!(claims.payload.exp < Math.floor(Date.now() / 1000))) return [3 /*break*/, 2];
                        _a = this;
                        return [4 /*yield*/, this.getToken()];
                    case 1:
                        _a.token = _b.sent();
                        _b.label = 2;
                    case 2:
                        headers = __assign(__assign({}, this.get_auth_header()), (json_request_only ? HttpHeaders.acceptJson() : HttpHeaders.json()));
                        config = __assign(__assign({ method: request_method, url: "".concat(this.api_url).concat(endpoint), headers: headers, timeout: timeout, params: params, data: data }, (body && { body: body })), (files && { files: files }));
                        return [4 /*yield*/, axios_1.default.request(config)];
                    case 3:
                        response = _b.sent();
                        return [4 /*yield*/, this.validateResponse(response)];
                    case 4:
                        _b.sent();
                        return [2 /*return*/, response.data];
                }
            });
        });
    };
    ApiClient.prototype.ingestBatch = function (transaction_batch) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.makeRequest(RequestMethod.POST, routes_constants_js_1.Routes.ingest.replace('{project_id}', this.project_id), transaction_batch)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    ApiClient.prototype.getProjectIdByName = function (project_name) {
        return __awaiter(this, void 0, void 0, function () {
            var projects;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.makeRequest(RequestMethod.GET, routes_constants_js_1.Routes.projects, {
                            project_name: project_name,
                            type: 'llm_monitor'
                        })];
                    case 1:
                        projects = _a.sent();
                        if (projects.length < 1) {
                            throw new Error("Galileo project ".concat(project_name, " not found"));
                        }
                        return [2 /*return*/, projects[0].id];
                }
            });
        });
    };
    ApiClient.prototype.createProject = function (project_name) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.makeRequest(RequestMethod.POST, routes_constants_js_1.Routes.projects, {
                            name: project_name,
                            type: 'llm_monitor'
                        })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    return ApiClient;
}());
exports.ApiClient = ApiClient;
