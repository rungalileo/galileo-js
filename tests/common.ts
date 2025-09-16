import { http, HttpResponse } from 'msw';
import { Project, ProjectTypes } from '../src/types';
import { LogStream } from '../src/types/log-stream.types';
export const TEST_HOST = 'http://localhost:8088';

export const mockProject: Project = {
  id: 'proj-123',
  name: 'test-project',
  type: ProjectTypes.genAI
};

export const mockLogStream: LogStream = {
  id: 'ls-123',
  name: 'default',
  created_at: new Date('2021-09-10T00:00:00Z'),
  updated_at: new Date('2021-09-10T00:00:00Z'),
  project_id: mockProject.id,
  created_by: null
};

const getProjectByNameHandler = jest.fn().mockImplementation(() => {
  return HttpResponse.json([mockProject]);
});

const getLogStreamsHandler = jest.fn().mockImplementation(() => {
  return HttpResponse.json([]);
});

const createLogStreamHandler = jest.fn().mockImplementation(() => {
  return HttpResponse.json(mockLogStream);
});

export const commonHandlers = [
  http.get(`${TEST_HOST}/healthcheck`, () =>
    HttpResponse.json({ status: 'ok' })
  ),

  http.post(`${TEST_HOST}/login/api_key`, () =>
    HttpResponse.json({
      access_token: 'placeholder'
    })
  ),
  http.get(`${TEST_HOST}/projects`, getProjectByNameHandler),
  http.get(
    `${TEST_HOST}/projects/${mockProject.id}/log_streams`,
    getLogStreamsHandler
  ),
  http.post(
    `${TEST_HOST}/projects/${mockProject.id}/log_streams`,
    createLogStreamHandler
  )
];
