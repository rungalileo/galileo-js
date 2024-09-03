"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Routes = void 0;
const Routes = {
    healthcheck: 'healthcheck',
    login: 'login',
    api_key_login: 'login/api_key',
    get_token: 'get-token',
    projects: 'projects',
    metrics: 'projects/{project_id}/observe/metrics',
    ingest: 'projects/{project_id}/observe/ingest',
    rows: 'projects/{project_id}/observe/rows',
    delete: 'projects/{project_id}/observe/delete'
};
exports.Routes = Routes;
//# sourceMappingURL=routes.constants.js.map