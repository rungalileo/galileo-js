import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import {
  createStage,
  getStage,
  updateStage,
  pauseStage,
  resumeStage
} from '../../src/utils/stage';
import {
  StageDB,
  StageCreationPayload,
  UpdateStagePayload
} from '../../src/types/stage.types';
import { Project, ProjectTypes, LogStream } from '../../src/types';
import { commonHandlers, TEST_HOST } from '../common';

process.env.GALILEO_CONSOLE_URL = TEST_HOST;
process.env.GALILEO_API_KEY = 'test-api-key';

const mockProjectId = 'project-uuid-123';
const mockStageId = 'stage-uuid-abc';

const MOCK_PROJECT: Project = {
  id: mockProjectId,
  name: 'Test Project',
  type: ProjectTypes.genAI
};

const mockStageDbResponse: StageDB = {
  id: mockStageId,
  name: 'Test Stage',
  project_id: mockProjectId,
  created_by: 'user-xyz',
  type: 'local',
  paused: false,
  version: 1,
  description: 'A test stage'
};

const MOCK_LOG_STREAM: LogStream = {
  id: 'logstream-default-uuid',
  name: 'default',
  project_id: mockProjectId,
  created_at: new Date(),
  updated_at: new Date(),
  created_by: 'test-system'
};

const stageSpecificHandlers = [
  // Handler for Project Name
  http.get(`${TEST_HOST}/projects`, ({ request }) => {
    const url = new URL(request.url);
    if (url.searchParams.get('project_name') === MOCK_PROJECT.name) {
      return HttpResponse.json([MOCK_PROJECT]);
    }
    return HttpResponse.json([], { status: 404 });
  }),

  // Handler for Log Streams
  http.get(`${TEST_HOST}/projects/${mockProjectId}/log_streams`, () => {
    return HttpResponse.json([MOCK_LOG_STREAM]);
  }),

  // Create Stage
  http.post(
    `${TEST_HOST}/projects/${mockProjectId}/stages`,
    async ({ request }) => {
      const body = (await request.json()) as StageCreationPayload;
      if (body.name === 'error-case') {
        return HttpResponse.json(
          { detail: 'Failed to create stage' },
          { status: 500 }
        );
      }

      const responseData: StageDB = {
        ...mockStageDbResponse,
        name: body.name,
        description: body.description ?? mockStageDbResponse.description,
        type: body.type ?? mockStageDbResponse.type,
        paused: body.paused ?? mockStageDbResponse.paused
      };
      return HttpResponse.json(responseData);
    }
  ),

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
    return HttpResponse.json(
      { detail: 'Stage not found by default or invalid params for mock' },
      { status: 404 }
    );
  }),

  // Update Stage
  http.post(
    `${TEST_HOST}/projects/${mockProjectId}/stages/${mockStageId}`,
    async ({ request }) => {
      (await request.json()) as UpdateStagePayload;
      return HttpResponse.json({
        ...mockStageDbResponse,
        description: 'Stage updated successfully',
        version: (mockStageDbResponse.version || 0) + 1
      });
    }
  ),

  // Pause/Resume Stage
  http.put(
    `${TEST_HOST}/projects/${mockProjectId}/stages/${mockStageId}`,
    ({ request }) => {
      const url = new URL(request.url);
      const pauseParam = url.searchParams.get('pause');

      if (pauseParam === 'true') {
        return HttpResponse.json({ ...mockStageDbResponse, paused: true });
      }
      if (pauseParam === 'false') {
        return HttpResponse.json({ ...mockStageDbResponse, paused: false });
      }
      return HttpResponse.json(
        { detail: 'Pause parameter missing or invalid' },
        { status: 400 }
      );
    }
  )
];

const server = setupServer(...commonHandlers, ...stageSpecificHandlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Stage Utility Functions', () => {
  describe('createStage', () => {
    it('should create a stage successfully', async () => {
      const payload: StageCreationPayload = { name: 'New Awesome Stage' };
      const result = await createStage(MOCK_PROJECT.name, payload);
      expect(result.name).toBe(payload.name);
      expect(result.id).toBe(mockStageId);
    });

    it('should handle API error on createStage', async () => {
      const payload: StageCreationPayload = { name: 'error-case' };
      await expect(createStage(MOCK_PROJECT.name, payload)).rejects.toThrow();
    });
  });

  describe('getStage', () => {
    it('should get a stage by ID successfully', async () => {
      const result = await getStage({
        projectName: MOCK_PROJECT.name,
        id: mockStageId
      });
      expect(result.id).toBe(mockStageId);
    });

    it('should get a stage by name successfully', async () => {
      const result = await getStage({
        projectName: MOCK_PROJECT.name,
        name: mockStageDbResponse.name
      });
      expect(result.name).toBe(mockStageDbResponse.name);
    });

    it('should handle API error when stage not found by ID', async () => {
      await expect(
        getStage({ projectName: MOCK_PROJECT.name, id: 'nonexistent' })
      ).rejects.toThrow();
    });

    it('should throw error if neither id nor name is provided', async () => {
      await expect(
        getStage({ projectName: MOCK_PROJECT.name })
      ).rejects.toThrow('Either id or name must be provided to getStage');
    });
  });

  describe('updateStage', () => {
    it('should update a stage by ID successfully', async () => {
      const payload: UpdateStagePayload = {
        prioritized_rulesets: [
          { rules: [{ metric: 'test', operator: 'gt', target_value: 1 }] }
        ]
      };
      const result = await updateStage({
        projectName: MOCK_PROJECT.name,
        stageId: mockStageId,
        payload
      });
      expect(result.description).toBe('Stage updated successfully');
      expect(result.version).toBe((mockStageDbResponse.version || 0) + 1);
    });

    it('should update a stage by name successfully', async () => {
      const payload: UpdateStagePayload = {
        prioritized_rulesets: [
          { rules: [{ metric: 'test', operator: 'gt', target_value: 1 }] }
        ]
      };
      const result = await updateStage({
        projectName: MOCK_PROJECT.name,
        stageName: mockStageDbResponse.name,
        payload
      });
      expect(result.description).toBe('Stage updated successfully');
      expect(result.version).toBe((mockStageDbResponse.version || 0) + 1);
    });
  });

  describe('pauseStage', () => {
    it('should pause a stage by ID successfully', async () => {
      const result = await pauseStage({
        projectName: MOCK_PROJECT.name,
        stageId: mockStageId
      });
      expect(result.paused).toBe(true);
    });
    it('should pause a stage by name successfully', async () => {
      const result = await pauseStage({
        projectName: MOCK_PROJECT.name,
        stageName: mockStageDbResponse.name
      });
      expect(result.paused).toBe(true);
    });
  });

  describe('resumeStage', () => {
    it('should resume a stage by ID successfully', async () => {
      const result = await resumeStage({
        projectName: MOCK_PROJECT.name,
        stageId: mockStageId
      });
      expect(result.paused).toBe(false);
    });
    it('should resume a stage by name successfully', async () => {
      const result = await resumeStage({
        projectName: MOCK_PROJECT.name,
        stageName: mockStageDbResponse.name
      });
      expect(result.paused).toBe(false);
    });
  });
});
