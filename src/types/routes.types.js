"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Routes = void 0;
var Routes;
(function (Routes) {
    Routes["healthCheck"] = "healthheck";
    Routes["login"] = "login";
    Routes["apiKeyLogin"] = "login/api_key";
    Routes["getToken"] = "get-token";
    Routes["projects"] = "projects";
    Routes["observeMetrics"] = "projects/{project_id}/observe/metrics";
    Routes["observeIngest"] = "projects/{project_id}/observe/ingest";
    Routes["observeRows"] = "projects/{project_id}/observe/rows";
    Routes["observeDelete"] = "projects/{project_id}/observe/delete";
    Routes["evaluateIngest"] = "projects/{project_id}/runs/{run_id}/chains/ingest";
})(Routes || (exports.Routes = Routes = {}));
;
//# sourceMappingURL=routes.types.js.map