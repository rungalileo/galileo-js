export enum Routes {
  healthCheck = 'healthheck',
  login = 'login',
  apiKeyLogin = 'login/api_key',
  getToken = 'get-token',
  projects = 'projects',
  observeMetrics = 'projects/{project_id}/observe/metrics',
  observeIngest = 'projects/{project_id}/observe/ingest',
  observeRows = 'projects/{project_id}/observe/rows',
  observeDelete = 'projects/{project_id}/observe/delete',
  evaluateIngest = 'projects/{project_id}/runs/{run_id}/chains/ingest',
};