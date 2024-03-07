interface Routes {
  healthcheck: string;
  login: string;
  get_token: string;
  current_user: string;
  projects: string;
  all_projects: string;
  templates: string;
  versions: string;
  version: string;
  dataset: string;
  runs: string;
  jobs: string;
  metrics: string;
  integrations: string;
  ingest: string;
}

const Routes: Routes = {
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
  ingest: 'projects/{project_id}/llm_monitor/ingest'
};

export { Routes };
