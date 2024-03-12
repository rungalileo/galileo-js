interface Routes {
  healthcheck: string;
  login: string;
  api_key_login: string;
  get_token: string;
  projects: string;
  metrics: string;
  ingest: string;
  rows: string;
}

const Routes: Routes = {
  healthcheck: 'healthcheck',
  login: 'login',
  api_key_login: 'login/api_key',
  get_token: 'get-token',
  projects: 'projects',
  metrics: 'projects/{project_id}/llm_monitor/metrics',
  ingest: 'projects/{project_id}/llm_monitor/ingest',
  rows: 'projects/{project_id}/llm_monitor/rows'
};

export { Routes };
