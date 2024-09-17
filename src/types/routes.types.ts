export enum Routes {
  healthCheck = 'healthheck',
  login = 'login',
  apiKeyLogin = 'login/api_key',
  getToken = 'get-token',
  projects = 'projects',
  metrics = 'projects/{project_id}/observe/metrics',
  ingest = 'projects/{project_id}/observe/ingest',
  rows = 'projects/{project_id}/observe/rows',
  delete = 'projects/{project_id}/observe/delete'
};