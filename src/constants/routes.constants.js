"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Routes = void 0;
var Routes = {
    healthcheck: 'healthcheck',
    login: 'login',
    get_token: 'get-token',
    current_user: 'current_user',
    projects: 'projects',
    all_projects: 'projects/all',
    templates: 'projects/{project_id}/templates',
    versions: 'projects/{project_id}/templates/{template_id}/versions',
    version: 'projects/{project_id}/templates/{template_id}/versions/{version}',
    dataset: 'projects/{project_id}/upload_prompt_dataset',
    runs: 'projects/{project_id}/runs',
    jobs: 'jobs',
    metrics: 'projects/{project_id}/runs/{run_id}/metrics',
    integrations: 'integrations/{integration_name}',
    ingest: '/projects/{project_id}/llm_monitor/ingest'
};
exports.Routes = Routes;
