import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { invoke } from '../../src/utils/protect'; // Assuming invoke is exported via src/index.ts then src/utils/protect.ts
import { commonHandlers, TEST_HOST } from '../common';
import {
  Request as ApiRequest,
  Response as ApiResponse,
  // Import Payload if it's a distinct type, otherwise inline its structure for mock
  // For now, assuming Request and Response are from 'components.schemas' via re-export
  Project, // Add Project type
  ProjectTypes, // Add ProjectTypes enum
  LogStream, // Added LogStream type
} from '../../src/types'; // Adjust path if types are re-exported differently

// Define mock data structures based on your actual API schemas
// This is components['schemas']['Request']
const MOCK_API_REQUEST: ApiRequest = {
  payload: {
    // Based on components['schemas']['Payload']
    input: 'This is a test input.',
    // output can be omitted as it's optional
  },
  // Other fields from Request schema are optional, can be omitted for a minimal test
};

// This is components['schemas']['Response']
const MOCK_API_RESPONSE: ApiResponse = {
  // Based on components['schemas']['Response']
  text: 'Processed: This is a test input.', // Required
  trace_metadata: { // Required, even if fields within are optional
    id: 'mock-trace-id',
    received_at: 1234567890,
    response_at: 1234567990,
    execution_time: 100,
  },
  // status is optional in Response schema
  // status: 'not_triggered', // Example from ExecutionStatus
  // Additional properties allowed by '& { [key: string]: unknown; }' can be omitted
};

const MOCK_PROJECT: Project = {
  id: 'mock-project-id-from-init',
  name: 'test-project', // Should match what GalileoApiClient.init might look for
  type: ProjectTypes.genAI, // Or any valid ProjectType, ensure ProjectTypes is imported
};
const MOCK_DEFAULT_LOG_STREAM: LogStream = {
  id: 'mock-logstream-id-default',
  name: 'default', // Important for default lookup in GalileoApiClient
  created_at: new Date(), // Or a fixed string date if preferred for consistency
  updated_at: new Date(), // Or a fixed string date
  project_id: MOCK_PROJECT.id, // Link to our mock project
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

// Handler for project lookup during GalileoApiClient.init()
const getLogStreamsHandler = jest.fn().mockImplementation(({ params }) => {
  const projectId = params.projectId;
  if (projectId === MOCK_PROJECT.id) {
    return HttpResponse.json([MOCK_DEFAULT_LOG_STREAM]);
  }
  // Return empty array or error if project ID doesn't match,
  // simulating no log streams found for a different/invalid project.
  return HttpResponse.json([], { status: 404 });
});
const getProjectsHandler = jest.fn().mockImplementation(({ request }) => {
  const url = new URL(request.url);
  const projectNameSearch = url.searchParams.get('project_name');
  if (projectNameSearch === MOCK_PROJECT.name) {
    return HttpResponse.json([MOCK_PROJECT]);
  }
  return HttpResponse.json([], { status: 404 }); // Or appropriate empty/error response
});

export const handlers = [
  ...commonHandlers,
  http.get(`${TEST_HOST}/projects`, getProjectsHandler), // Handler for project lookup
  http.get(`${TEST_HOST}/projects/:projectId/log_streams`, getLogStreamsHandler), // Handler for log streams
  http.post(`${TEST_HOST}/protect/invoke`, protectInvokeHandler),
];

const server = setupServer(...handlers);

describe('utils.invoke', () => {
  beforeAll(() => {
    // Ensure required environment variables for GalileoApiClient are set
    process.env.GALILEO_CONSOLE_URL = TEST_HOST;
    process.env.GALILEO_API_KEY = 'test-api-key';
    // GalileoApiClient.init may try to use GALILEO_PROJECT if no specific project is passed to init
    // Ensure it matches the name of MOCK_PROJECT if init() relies on env var.
    process.env.GALILEO_PROJECT = MOCK_PROJECT.name;
    server.listen();
  });

  afterEach(() => {
    server.resetHandlers();
    protectInvokeHandler.mockClear();
    protectInvokeErrorHandler.mockClear();
    getProjectsHandler.mockClear(); // Clear call count for the new handler
    getLogStreamsHandler.mockClear(); // Clear call count for log streams handler
  });

  afterAll(() => {
    server.close();
    // Clean up env var
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

  // Add more tests as needed:
  // - Test with different request parameters if they affect the call
  // - Test specific fields in the response
});