import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import {
  createStage,
  getStage,
  updateStage,
  pauseStage,
  resumeStage,
} from '../../src/utils/stage';
import {
  StageDB,
  StageCreationPayload,
  UpdateStagePayload,
  GetStageParams,
} from '../../src/types/stage.types';
import { Project, ProjectTypes, LogStream } from '../../src/types';
import { commonHandlers, TEST_HOST } from '../common';

process.env.GALILEO_CONSOLE_URL = TEST_HOST; // Ensure apiClient init uses this
process.env.GALILEO_API_KEY = 'test-api-key'; // For apiClient init

const mockProjectId = 'project-uuid-123';
const mockStageId = 'stage-uuid-abc';

// Mock Project for init()
const MOCK_PROJECT: Project = {
  id: mockProjectId,
  name: 'Test Project From Stage Util',
  type: ProjectTypes.genAI,
};

const mockStageDbResponse: StageDB = {
  id: mockStageId,
  name: 'Test Stage',
  project_id: mockProjectId,
  created_by: 'user-xyz',
  type: 'local',
  paused: false,
  version: 1,
  description: 'A test stage',
};

// Mock LogStream for init()
const MOCK_LOG_STREAM: LogStream = {
  id: 'logstream-default-uuid',
  name: 'default',
  project_id: mockProjectId,
  created_at: new Date(),
  updated_at: new Date(),
  created_by: 'test-system',
};

const stageSpecificHandlers = [
  // Handler for LogStreams, needed by apiClient.init()
  // The getLogStreams method fetches all log streams for the project,
  // and getLogStreamByName filters client-side.
  http.get(`${TEST_HOST}/projects/${mockProjectId}/log_streams`, () => {
    return HttpResponse.json([MOCK_LOG_STREAM]);
  }),
  // Handler for GetProject, needed by apiClient.init({ projectId: ... })
  // Note: GalileoApiClient.init with projectId might not actually fetch the project by id if id is already known.
  // It primarily uses projectId to scope other service calls like LogStreamService.
  http.get(`${TEST_HOST}/projects/${mockProjectId}`, () => {
    return HttpResponse.json(MOCK_PROJECT);
  }),
  // Create Stage
  http.post(`${TEST_HOST}/projects/${mockProjectId}/stages`, async ({ request }) => {
    const body = await request.json() as StageCreationPayload;
    if (body.name === 'error-case') {
      return HttpResponse.json({ detail: 'Failed to create stage' }, { status: 500 });
    }
    // Construct a StageDB response, taking fields from body and falling back to mockStageDbResponse
    const responseData: StageDB = {
      ...mockStageDbResponse, // for id, project_id, created_by, default version etc.
      name: body.name,
      description: body.description ?? mockStageDbResponse.description,
      type: body.type ?? mockStageDbResponse.type,
      paused: body.paused ?? mockStageDbResponse.paused,
      // prioritized_rulesets from body are not part of StageDB response
    };
    return HttpResponse.json(responseData);
  }),

  // Get Stage
  http.get(`${TEST_HOST}/projects/${mockProjectId}/stages`, ({ request }) => {
    const url = new URL(request.url);
    const stageId = url.searchParams.get('stage_id');
    const stageName = url.searchParams.get('stage_name');

    if (stageId === 'nonexistent' || stageName === 'nonexistent') {
      return HttpResponse.json({ detail: 'Stage not found' }, { status: 404 });
    }
    if (stageId === mockStageId || stageName === mockStageDbResponse.name) {
      return HttpResponse.json(mockStageDbResponse);
    }
    return HttpResponse.json({ detail: 'Stage not found by default or invalid params for mock' }, { status: 404 });
  }),

  // Update Stage
  http.post(`${TEST_HOST}/projects/${mockProjectId}/stages/${mockStageId}`, async ({ request }) => {
    await request.json() as UpdateStagePayload;
    // Return a valid StageDB, e.g., with an updated description or version
    return HttpResponse.json({ ...mockStageDbResponse, description: 'Stage updated successfully', version: (mockStageDbResponse.version || 0) + 1 });
  }),

  // Pause/Resume Stage
  http.put(`${TEST_HOST}/projects/${mockProjectId}/stages/${mockStageId}`, ({ request }) => {
    const url = new URL(request.url);
    const pauseParam = url.searchParams.get('pause');
    if (pauseParam === 'true') {
      return HttpResponse.json({ ...mockStageDbResponse, paused: true });
    }
    if (pauseParam === 'false') {
      return HttpResponse.json({ ...mockStageDbResponse, paused: false });
    }
    return HttpResponse.json({ detail: 'Pause parameter missing or invalid' }, { status: 400 });
  }),
];

const server = setupServer(...commonHandlers, ...stageSpecificHandlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Stage Utility Functions', () => {
  describe('createStage', () => {
    it('should create a stage successfully', async () => {
      const payload: StageCreationPayload = { name: 'New Awesome Stage' };
      const result = await createStage(mockProjectId, payload);
      expect(result.name).toBe(payload.name);
      expect(result.id).toBe(mockStageId);
    });

    it('should handle API error on createStage', async () => {
      const payload: StageCreationPayload = { name: 'error-case' };
      await expect(createStage(mockProjectId, payload)).rejects.toThrow();
    });
  });

  describe('getStage', () => {
    it('should get a stage by ID successfully', async () => {
      const params: GetStageParams = { stageId: mockStageId };
      const result = await getStage(mockProjectId, params);
      expect(result.id).toBe(mockStageId);
    });

    it('should get a stage by name successfully', async () => {
      const params: GetStageParams = { stageName: mockStageDbResponse.name };
      const result = await getStage(mockProjectId, params);
      expect(result.name).toBe(mockStageDbResponse.name);
    });

    it('should handle API error when stage not found by ID', async () => {
      const params: GetStageParams = { stageId: 'nonexistent' };
      await expect(getStage(mockProjectId, params)).rejects.toThrow();
    });
    
    it('should throw error if neither stageId nor stageName is provided', async () => {
       const params: GetStageParams = {};
       // This error originates from StageService, propagated by GalileoApiClient
       await expect(getStage(mockProjectId, params)).rejects.toThrow('Either stageId or stageName must be provided to getStage.');
    });
  });

  describe('updateStage', () => {
    it('should update a stage successfully', async () => {
      const payload: UpdateStagePayload = { prioritized_rulesets: [{ rules: [{ metric: 'test', operator: 'gt', target_value: 1 }] }] };
      const result = await updateStage(mockProjectId, mockStageId, payload);
      expect(result.description).toBe('Stage updated successfully');
      expect(result.version).toBe((mockStageDbResponse.version || 0) + 1);
    });
  });

  describe('pauseStage', () => {
    it('should pause a stage successfully', async () => {
      const result = await pauseStage(mockProjectId, mockStageId);
      expect(result.paused).toBe(true);
    });
  });

  describe('resumeStage', () => {
    it('should resume a stage successfully', async () => {
      const result = await resumeStage(mockProjectId, mockStageId);
      expect(result.paused).toBe(false);
    });
  });
});