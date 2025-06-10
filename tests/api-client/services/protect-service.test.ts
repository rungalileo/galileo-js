import { ProtectService } from '../../../src/api-client/services/protect-service';
import { RequestMethod } from '../../../src/api-client/base-client';
import { Routes } from '../../../src/types/routes.types';
import {
  Request as ApiRequest,
  Response as ApiResponse,
  // Import Payload if needed for constructing ApiRequest mock,
  // or define a minimal valid ApiRequest structure directly.
} from '../../../src/types'; // Adjust if types are re-exported differently

// Mock the BaseClient's makeRequest method
const mockMakeRequest = jest.fn();

// Mock the BaseClient module
jest.mock('../../../src/api-client/base-client', () => {
  const originalModule = jest.requireActual('../../../src/api-client/base-client');
  return {
    ...originalModule, // Preserve other exports like RequestMethod
    BaseClient: jest.fn().mockImplementation(() => ({
      // Mock methods/properties of BaseClient that ProtectService's constructor or methods might use
      initializeClient: jest.fn(), // Called by ProtectService constructor
      makeRequest: mockMakeRequest,
      // Provide mock values for properties if ProtectService constructor reads them from `this`
      apiUrl: 'mockApiUrl',
      token: 'mockToken',
      // projectId is passed to ProtectService constructor, not from BaseClient instance here
    })),
  };
});

describe('ProtectService', () => {
  let protectService: ProtectService;
  const mockApiUrl = 'http://fake.api/v2'; // Example, use actual or consistent mock
  const mockToken = 'fake-api-token';
  const mockProjectId = 'project-uuid-for-protect';

  // Define mock data based on actual API schemas
  const MOCK_API_REQUEST: ApiRequest = {
    payload: {
      input: 'Service test input.',
    },
  };

  // This is components['schemas']['Response']
  const MOCK_API_RESPONSE: ApiResponse = {
    text: 'Service processed: Service test input.',
    trace_metadata: {
      id: 'service-mock-trace-id',
      received_at: 9876543210,
      response_at: 9876543220,
      execution_time: 10,
    },
    // status: 'not_triggered', // Optional
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Instantiate ProtectService. Since BaseClient is mocked,
    // ProtectService will extend the mocked BaseClient.
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