import { MetricSearchResponse, LogRecordsQueryResponse } from '../../src/types';

const EXAMPLE_METRIC_SEARCH_RESPONSE: MetricSearchResponse = {
  group_by_columns: [],
  aggregate_metrics: {
    metric1: 10,
    metric2: 20
  },
  bucketed_metrics: {}
};

const EXAMPLE_LOG_RECORDS_QUERY_RESPONSE: LogRecordsQueryResponse = {
  records: []
};

// Create mock implementation functions
const mockInit = jest.fn().mockResolvedValue(undefined);
const mockSearchMetrics = jest.fn();
const mockSearchTraces = jest.fn();
const mockSearchSpans = jest.fn();
const mockSearchSessions = jest.fn();

jest.mock('../../src/api-client', () => {
  return {
    GalileoApiClient: jest.fn().mockImplementation(() => {
      return {
        init: mockInit,
        searchMetrics: mockSearchMetrics,
        searchTraces: mockSearchTraces,
        searchSpans: mockSearchSpans,
        searchSessions: mockSearchSessions
      };
    })
  };
});

// Import the functions after mocking
import { getMetrics, getTraces, getSpans, getSessions } from '../../src';

describe('utils.search', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set up default mock implementations
    mockSearchMetrics.mockResolvedValue(EXAMPLE_METRIC_SEARCH_RESPONSE);
    mockSearchTraces.mockResolvedValue(EXAMPLE_LOG_RECORDS_QUERY_RESPONSE);
    mockSearchSpans.mockResolvedValue(EXAMPLE_LOG_RECORDS_QUERY_RESPONSE);
    mockSearchSessions.mockResolvedValue(EXAMPLE_LOG_RECORDS_QUERY_RESPONSE);
  });

  describe('getMetrics', () => {
    it('should call the metrics/search endpoint and return the response', async () => {
      const response = await getMetrics(
        {
          start_time: '2021-09-10T00:00:00Z',
          end_time: '2021-09-11T00:00:00Z'
        },
        'test-project'
      );
      expect(response).toEqual(EXAMPLE_METRIC_SEARCH_RESPONSE);
      expect(mockSearchMetrics).toHaveBeenCalledTimes(1);
    });

    it('should handle API errors gracefully', async () => {
      mockSearchMetrics.mockRejectedValue(new Error('API Error'));

      await expect(
        getMetrics(
          {
            start_time: '2021-09-10T00:00:00Z',
            end_time: '2021-09-11T00:00:00Z'
          },
          'test-project'
        )
      ).rejects.toThrow();
      expect(mockSearchMetrics).toHaveBeenCalledTimes(1);
    });
  });

  describe('getTraces', () => {
    it('should call the traces/search endpoint and return the response', async () => {
      const response = await getTraces({}, 'test-project');
      expect(response).toEqual(EXAMPLE_LOG_RECORDS_QUERY_RESPONSE);
      expect(mockSearchTraces).toHaveBeenCalledTimes(1);
    });

    it('should handle API errors gracefully', async () => {
      mockSearchTraces.mockRejectedValue(new Error('API Error'));

      await expect(getTraces({}, 'test-project')).rejects.toThrow();
      expect(mockSearchTraces).toHaveBeenCalledTimes(1);
    });
  });

  describe('getSpans', () => {
    it('should call the spans/search endpoint and return the response', async () => {
      const response = await getSpans({}, 'test-project');
      expect(response).toEqual(EXAMPLE_LOG_RECORDS_QUERY_RESPONSE);
      expect(mockSearchSpans).toHaveBeenCalledTimes(1);
    });

    it('should handle API errors gracefully', async () => {
      mockSearchSpans.mockRejectedValue(new Error('API Error'));

      await expect(getSpans({}, 'test-project')).rejects.toThrow();
      expect(mockSearchSpans).toHaveBeenCalledTimes(1);
    });
  });

  describe('getSessions', () => {
    it('should call the sessions/search endpoint and return the response', async () => {
      const response = await getSessions({}, 'test-project');
      expect(response).toEqual(EXAMPLE_LOG_RECORDS_QUERY_RESPONSE);
      expect(mockSearchSessions).toHaveBeenCalledTimes(1);
    });

    it('should handle API errors gracefully', async () => {
      mockSearchSessions.mockRejectedValue(new Error('API Error'));

      await expect(getSessions({}, 'test-project')).rejects.toThrow();
      expect(mockSearchSessions).toHaveBeenCalledTimes(1);
    });
  });
});
