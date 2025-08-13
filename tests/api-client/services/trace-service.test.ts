import { TraceService } from '../../../src/api-client/services/trace-service';
import { BaseClient, RequestMethod } from '../../../src/api-client/base-client';
import { Routes } from '../../../src/types/routes.types';
import {
  MetricSearchRequest,
  MetricSearchResponse,
  LogRecordsQueryRequest,
  LogRecordsQueryResponse
} from '../../../src/types';

const mockMakeRequest = jest
  .spyOn(BaseClient.prototype, 'makeRequest')
  .mockImplementation();

describe('TraceService', () => {
  let traceService: TraceService;
  const mockApiUrl = 'http://fake.api/v2';
  const mockToken = 'fake-api-token';
  const mockProjectId = 'project-uuid-for-trace';

  const MOCK_METRIC_SEARCH_REQUEST: MetricSearchRequest = {
    start_time: '2021-09-10T00:00:00Z',
    end_time: '2021-09-11T00:00:00Z'
  };

  const MOCK_METRIC_SEARCH_RESPONSE: MetricSearchResponse = {
    group_by_columns: [],
    aggregate_metrics: {},
    bucketed_metrics: {}
  };

  const MOCK_LOG_RECORDS_QUERY_REQUEST: LogRecordsQueryRequest = {};

  const MOCK_LOG_RECORDS_QUERY_RESPONSE: LogRecordsQueryResponse = {
    records: []
  };

  beforeEach(() => {
    jest.clearAllMocks();
    traceService = new TraceService(mockApiUrl, mockToken, mockProjectId);
  });

  describe('searchMetrics', () => {
    it('should call makeRequest with correct parameters and return its result', async () => {
      mockMakeRequest.mockResolvedValue(MOCK_METRIC_SEARCH_RESPONSE);

      const result = await traceService.searchMetrics(
        MOCK_METRIC_SEARCH_REQUEST
      );

      expect(mockMakeRequest).toHaveBeenCalledTimes(1);
      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.POST,
        Routes.metricsSearch,
        MOCK_METRIC_SEARCH_REQUEST,
        { project_id: mockProjectId }
      );
      expect(result).toEqual(MOCK_METRIC_SEARCH_RESPONSE);
    });

    it('should throw an error if project is not initialized', async () => {
      traceService = new TraceService(mockApiUrl, mockToken, '');
      await expect(
        traceService.searchMetrics(MOCK_METRIC_SEARCH_REQUEST)
      ).rejects.toThrow('Project not initialized');
    });

    it('should propagate errors from makeRequest', async () => {
      const apiError = new Error('Network Error');
      mockMakeRequest.mockRejectedValue(apiError);

      await expect(
        traceService.searchMetrics(MOCK_METRIC_SEARCH_REQUEST)
      ).rejects.toThrow(apiError);
      expect(mockMakeRequest).toHaveBeenCalledTimes(1);
    });
  });

  describe('searchTraces', () => {
    it('should call makeRequest with correct parameters and return its result', async () => {
      mockMakeRequest.mockResolvedValue(MOCK_LOG_RECORDS_QUERY_RESPONSE);

      const result = await traceService.searchTraces(
        MOCK_LOG_RECORDS_QUERY_REQUEST
      );

      expect(mockMakeRequest).toHaveBeenCalledTimes(1);
      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.POST,
        Routes.tracesSearch,
        MOCK_LOG_RECORDS_QUERY_REQUEST,
        { project_id: mockProjectId }
      );
      expect(result).toEqual(MOCK_LOG_RECORDS_QUERY_RESPONSE);
    });
  });

  describe('searchSpans', () => {
    it('should call makeRequest with correct parameters and return its result', async () => {
      mockMakeRequest.mockResolvedValue(MOCK_LOG_RECORDS_QUERY_RESPONSE);

      const result = await traceService.searchSpans(
        MOCK_LOG_RECORDS_QUERY_REQUEST
      );

      expect(mockMakeRequest).toHaveBeenCalledTimes(1);
      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.POST,
        Routes.spansSearch,
        MOCK_LOG_RECORDS_QUERY_REQUEST,
        { project_id: mockProjectId }
      );
      expect(result).toEqual(MOCK_LOG_RECORDS_QUERY_RESPONSE);
    });
  });

  describe('searchSessions', () => {
    it('should call makeRequest with correct parameters and return its result', async () => {
      mockMakeRequest.mockResolvedValue(MOCK_LOG_RECORDS_QUERY_RESPONSE);

      const result = await traceService.searchSessions(
        MOCK_LOG_RECORDS_QUERY_REQUEST
      );

      expect(mockMakeRequest).toHaveBeenCalledTimes(1);
      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.POST,
        Routes.sessionsSearch,
        MOCK_LOG_RECORDS_QUERY_REQUEST,
        { project_id: mockProjectId }
      );
      expect(result).toEqual(MOCK_LOG_RECORDS_QUERY_RESPONSE);
    });
  });
});
