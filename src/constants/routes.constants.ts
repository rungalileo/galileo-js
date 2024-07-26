interface Routes {
  healthcheck: string;
  login: string;
  api_key_login: string;
  get_token: string;
  projects: string;
  metrics: string;
  ingest: string;
  rows: string;
  delete: string;
}

const Routes: Routes = {
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

export { Routes };
