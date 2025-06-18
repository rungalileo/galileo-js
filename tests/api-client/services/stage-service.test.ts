import { StageService } from '../../../src/api-client/services/stage-service';
import { RequestMethod } from '../../../src/api-client/base-client';
import { Routes } from '../../../src/types/routes.types';
import {
  StageCreationPayload,
  GetStageParams,
  UpdateStagePayload,
  StageDB
} from '../../../src/types/stage.types';

const mockMakeRequest = jest.fn();
jest.mock('../../../src/api-client/base-client', () => {
  return {
    BaseClient: jest.fn().mockImplementation(() => {
      return {
        makeRequest: mockMakeRequest,
        initializeClient: jest.fn(),
        apiUrl: 'mockApiUrl',
        token: 'mockToken'
      };
    }),
    RequestMethod: jest.requireActual('../../../src/api-client/base-client')
      .RequestMethod
  };
});

describe('StageService', () => {
  let stageService: StageService;
  const mockApiUrl = 'http://fake.api';
  const mockToken = 'fake-token';
  const mockProjectId = 'project-123';

  beforeEach(() => {
    mockMakeRequest.mockClear();
    stageService = new StageService(mockApiUrl, mockToken, mockProjectId);
  });

  const mockStageDB: StageDB = {
    id: 'stage-abc',
    name: 'Test Stage',
    project_id: mockProjectId,
    created_by: 'user-xyz',
    type: 'local',
    paused: false
  };

  describe('createStage', () => {
    it('should call makeRequest with correct parameters', async () => {
      const payload: StageCreationPayload = { name: 'New Stage' };
      mockMakeRequest.mockResolvedValueOnce(mockStageDB);

      await stageService.createStage(payload);

      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.POST,
        Routes.stages,
        payload,
        { project_id: mockProjectId }
      );
    });
  });

  describe('getStage', () => {
    it('should call makeRequest with stageId', async () => {
      const params: GetStageParams = { stageId: 'stage-abc' };
      mockMakeRequest.mockResolvedValueOnce(mockStageDB);

      await stageService.getStage(params);

      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.GET,
        Routes.stages,
        undefined,
        { project_id: mockProjectId, stage_id: params.stageId }
      );
    });

    it('should call makeRequest with stageName', async () => {
      const params: GetStageParams = { stageName: 'Test Stage' };
      mockMakeRequest.mockResolvedValueOnce(mockStageDB);

      await stageService.getStage(params);

      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.GET,
        Routes.stages,
        undefined,
        { project_id: mockProjectId, stage_name: params.stageName }
      );
    });

    it('should throw error if neither stageId nor stageName is provided', async () => {
      const params: GetStageParams = {};
      await expect(stageService.getStage(params)).rejects.toThrow(
        'Either stageId or stageName must be provided to getStage.'
      );
    });
  });

  describe('updateStage', () => {
    it('should call makeRequest with correct parameters', async () => {
      const stageId = 'stage-abc';
      const payload: UpdateStagePayload = { prioritized_rulesets: [] };
      mockMakeRequest.mockResolvedValueOnce(mockStageDB);

      await stageService.updateStage(stageId, payload);

      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.POST,
        Routes.stage,
        payload,
        { project_id: mockProjectId, stage_id: stageId }
      );
    });
  });

  describe('pauseStage', () => {
    it('should call makeRequest with correct parameters', async () => {
      const stageId = 'stage-abc';
      mockMakeRequest.mockResolvedValueOnce({ ...mockStageDB, paused: true });

      await stageService.pauseStage(stageId);

      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.PUT,
        Routes.stage,
        undefined,
        { project_id: mockProjectId, stage_id: stageId, pause: 'true' }
      );
    });
  });

  describe('resumeStage', () => {
    it('should call makeRequest with correct parameters', async () => {
      const stageId = 'stage-abc';
      mockMakeRequest.mockResolvedValueOnce({ ...mockStageDB, paused: false });

      await stageService.resumeStage(stageId);

      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.PUT,
        Routes.stage,
        undefined,
        { project_id: mockProjectId, stage_id: stageId, pause: 'false' }
      );
    });
  });
});
