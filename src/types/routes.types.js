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
    Routes["metrics"] = "projects/{project_id}/observe/metrics";
    Routes["ingest"] = "projects/{project_id}/observe/ingest";
    Routes["rows"] = "projects/{project_id}/observe/rows";
    Routes["delete"] = "projects/{project_id}/observe/delete";
})(Routes || (exports.Routes = Routes = {}));
;
//# sourceMappingURL=routes.types.js.map