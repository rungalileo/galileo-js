import { ProtectService } from '../../../src/api-client/services/protect-service';
import { RequestMethod } from '../../../src/api-client/base-client';
import { Routes } from '../../../src/types/routes.types';
import {
  Request as ApiRequest,
  Response as ApiResponse,
} from '../../../src/types';

const mockMakeRequest = jest.fn();

jest.mock('../../../src/api-client/base-client', () => {
  const originalModule = jest.requireActual('../../../src/api-client/base-client');
  return {
    ...originalModule,
    BaseClient: jest.fn().mockImplementation(() => ({
      initializeClient: jest.fn(),
      makeRequest: mockMakeRequest,
      apiUrl: 'mockApiUrl',
      token: 'mockToken',
    })),
  };
});

describe('ProtectService', () => {
  let protectService: ProtectService;
  const mockApiUrl = 'http://fake.api/v2';
  const mockToken = 'fake-api-token';
  const mockProjectId = 'project-uuid-for-protect';

  const MOCK_API_REQUEST: ApiRequest = {
    payload: {
      input: 'Service test input.',
    },
  };

  const MOCK_API_RESPONSE: ApiResponse = {
    text: 'Service processed: Service test input.',
    trace_metadata: {
      id: 'service-mock-trace-id',
      received_at: 9876543210,
      response_at: 9876543220,
      execution_time: 10,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    protectService = new ProtectService(mockApiUrl, mockToken, mockProjectId);
  });

  describe('invoke', () => {
    it('should call makeRequest with correct parameters and return its result', async () => {
      mockMakeRequest.mockResolvedValue(MOCK_API_RESPONSE);

      const result = await protectService.invoke(MOCK_API_REQUEST);

      expect(mockMakeRequest).toHaveBeenCalledTimes(1);
      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.POST,
        Routes.protectInvoke,
        MOCK_API_REQUEST
      );
      expect(result).toEqual(MOCK_API_RESPONSE);
    });

    it('should propagate errors from makeRequest', async () => {
      const apiError = new Error('Network Error');
      mockMakeRequest.mockRejectedValue(apiError);

      await expect(protectService.invoke(MOCK_API_REQUEST)).rejects.toThrow(apiError);
      expect(mockMakeRequest).toHaveBeenCalledTimes(1);
    });
  });
});