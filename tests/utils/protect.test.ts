import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { invoke } from '../../src/utils/protect';
import { commonHandlers, TEST_HOST } from '../common';
import {
  Request as ApiRequest,
  Response as ApiResponse,
  Project,
  ProjectTypes,
  LogStream,
} from '../../src/types';

const MOCK_API_REQUEST: ApiRequest = {
  payload: {
    input: 'This is a test input.',
  },
};

const MOCK_API_RESPONSE: ApiResponse = {
  text: 'Processed: This is a test input.',
  trace_metadata: {
    id: 'mock-trace-id',
    received_at: 1234567890,
    response_at: 1234567990,
    execution_time: 100,
  },
};

const MOCK_PROJECT: Project = {
  id: 'mock-project-id-from-init',
  name: 'test-project',
  type: ProjectTypes.genAI,
};
const MOCK_DEFAULT_LOG_STREAM: LogStream = {
  id: 'mock-logstream-id-default',
  name: 'default',
  created_at: new Date(),
  updated_at: new Date(),
  project_id: MOCK_PROJECT.id,
  created_by: 'test-user',
};

const MOCK_ERROR_RESPONSE = {
  detail: 'An unexpected error occurred.',
};

const protectInvokeHandler = jest.fn().mockImplementation(() => {
  return HttpResponse.json(MOCK_API_RESPONSE);
});

const protectInvokeErrorHandler = jest.fn().mockImplementation(() => {
  return HttpResponse.json(MOCK_ERROR_RESPONSE, { status: 500 });
});

const getLogStreamsHandler = jest.fn().mockImplementation(({ params }) => {
  const projectId = params.projectId;
  if (projectId === MOCK_PROJECT.id) {
    return HttpResponse.json([MOCK_DEFAULT_LOG_STREAM]);
  }
  return HttpResponse.json([], { status: 404 });
});
const getProjectsHandler = jest.fn().mockImplementation(({ request }) => {
  const url = new URL(request.url);
  const projectNameSearch = url.searchParams.get('project_name');
  if (projectNameSearch === MOCK_PROJECT.name) {
    return HttpResponse.json([MOCK_PROJECT]);
  }
  return HttpResponse.json([], { status: 404 });
});

export const handlers = [
  ...commonHandlers,
  http.get(`${TEST_HOST}/projects`, getProjectsHandler),
  http.get(`${TEST_HOST}/projects/:projectId/log_streams`, getLogStreamsHandler),
  http.post(`${TEST_HOST}/protect/invoke`, protectInvokeHandler),
];

const server = setupServer(...handlers);

describe('utils.invoke', () => {
  beforeAll(() => {
    process.env.GALILEO_CONSOLE_URL = TEST_HOST;
    process.env.GALILEO_API_KEY = 'test-api-key';
    process.env.GALILEO_PROJECT = MOCK_PROJECT.name;
    server.listen();
  });

  afterEach(() => {
    server.resetHandlers();
    protectInvokeHandler.mockClear();
    protectInvokeErrorHandler.mockClear();
    getProjectsHandler.mockClear();
    getLogStreamsHandler.mockClear();
  });

  afterAll(() => {
    server.close();
    delete process.env.GALILEO_PROJECT;
  });

  it('should call the /protect/invoke endpoint and return the response', async () => {
    const result = await invoke(MOCK_API_REQUEST);

    expect(protectInvokeHandler).toHaveBeenCalledTimes(1);
    // TODO: Add more specific checks for the request body if needed, e.g., using req.json() in handler
    expect(result).toEqual(MOCK_API_RESPONSE);
  });

  it('should handle API errors gracefully', async () => {
    server.use(
      http.post(`${TEST_HOST}/protect/invoke`, protectInvokeErrorHandler)
    );

    await expect(invoke(MOCK_API_REQUEST)).rejects.toThrow();
    // More specific error checking can be added if BaseClient transforms errors
    // For example, if it throws a custom error class or specific message format.
    // For now, just checking it throws.
    expect(protectInvokeErrorHandler).toHaveBeenCalledTimes(1);
  });

});