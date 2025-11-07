import {
  Search,
  RecordType,
  getTraces,
  getSpans,
  getSessions,
  getMetrics
} from '../../src/utils/search';
import {
  LogRecordsQueryFilterTS,
  LogRecordsSortClauseTS,
  MetricFilterTS,
  LogRecordsQueryResponse,
  MetricSearchResponse
} from '../../src/types/search.types';

// Create mock implementation functions
const mockInit = jest.fn().mockResolvedValue(undefined);
const mockSearchTraces = jest.fn();
const mockSearchSpans = jest.fn();
const mockSearchSessions = jest.fn();
const mockSearchMetrics = jest.fn();

jest.mock('../../src/api-client', () => {
  return {
    GalileoApiClient: jest.fn().mockImplementation(() => {
      return {
        init: mockInit,
        searchTraces: mockSearchTraces,
        searchSpans: mockSearchSpans,
        searchSessions: mockSearchSessions,
        searchMetrics: mockSearchMetrics
      };
    })
  };
});

describe('Search', () => {
  const projectId = 'test-project-id';
  const mockQueryResponse: LogRecordsQueryResponse = {
    records: [],
    limit: 100,
    starting_token: 0,
    next_starting_token: null,
    last_row_id: null,
    paginated: false
  };

  const mockMetricResponse: MetricSearchResponse = {
    group_by_columns: [],
    aggregate_metrics: {},
    bucketed_metrics: {}
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchTraces.mockResolvedValue(mockQueryResponse);
    mockSearchSpans.mockResolvedValue(mockQueryResponse);
    mockSearchSessions.mockResolvedValue(mockQueryResponse);
    mockSearchMetrics.mockResolvedValue(mockMetricResponse);
  });

  describe('RecordType enum', () => {
    it('should have correct enum values', () => {
      expect(RecordType.SPAN).toBe('spans');
      expect(RecordType.TRACE).toBe('traces');
      expect(RecordType.SESSION).toBe('sessions');
    });
  });

  describe('Search.query', () => {
    it('should query traces with minimal options', async () => {
      const search = new Search();
      const result = await search.query(
        {
          projectId
        },
        RecordType.TRACE
      );

      expect(mockInit).toHaveBeenCalledWith({
        projectId,
        projectScoped: true
      });
      expect(mockSearchTraces).toHaveBeenCalledWith({
        experiment_id: undefined,
        log_stream_id: undefined,
        filters: undefined,
        sort: {
          column_id: 'created_at',
          ascending: false,
          sort_type: 'column'
        },
        limit: 100,
        starting_token: 0
      });
      expect(result).toEqual(mockQueryResponse);
    });

    it('should query spans with all options', async () => {
      const filters: LogRecordsQueryFilterTS[] = [
        {
          columnId: 'status',
          operator: 'eq',
          value: 'completed',
          type: 'text'
        }
      ];

      const sort: LogRecordsSortClauseTS = {
        columnId: 'created_at',
        ascending: false,
        sortType: 'column'
      };

      const search = new Search();
      const result = await search.query(
        {
          projectId,
          limit: 50,
          startingToken: 10,
          filters,
          sort,
          experimentId: 'exp-123',
          logStreamId: 'log-stream-123'
        },
        RecordType.SPAN
      );

      expect(mockSearchSpans).toHaveBeenCalledWith({
        experiment_id: 'exp-123',
        log_stream_id: 'log-stream-123',
        filters: [
          {
            column_id: 'status',
            operator: 'eq',
            value: 'completed',
            case_sensitive: undefined,
            type: 'text'
          }
        ],
        sort: {
          column_id: 'created_at',
          ascending: false,
          sort_type: 'column'
        },
        limit: 50,
        starting_token: 10
      });
      expect(result).toEqual(mockQueryResponse);
    });

    it('should query sessions with filters', async () => {
      const filters: LogRecordsQueryFilterTS[] = [
        {
          columnId: 'external_id',
          operator: 'eq',
          value: 'ext-123',
          type: 'id'
        }
      ];

      const search = new Search();
      await search.query(
        {
          projectId,
          filters
        },
        RecordType.SESSION
      );

      expect(mockSearchSessions).toHaveBeenCalledWith({
        experiment_id: undefined,
        log_stream_id: undefined,
        filters: [
          {
            column_id: 'external_id',
            operator: 'eq',
            value: 'ext-123',
            type: 'id'
          }
        ],
        sort: {
          column_id: 'created_at',
          ascending: false,
          sort_type: 'column'
        },
        limit: 100,
        starting_token: 0
      });
    });

    it('should handle all filter types correctly', async () => {
      const filters: LogRecordsQueryFilterTS[] = [
        {
          columnId: 'id',
          operator: 'eq',
          value: 'test-id',
          type: 'id'
        },
        {
          columnId: 'name',
          operator: 'contains',
          value: 'test',
          caseSensitive: false,
          type: 'text'
        },
        {
          columnId: 'count',
          operator: 'gt',
          value: 10,
          type: 'number'
        },
        {
          columnId: 'created_at',
          operator: 'gte',
          value: '2024-01-01T00:00:00Z',
          type: 'date'
        },
        {
          columnId: 'active',
          value: true,
          type: 'boolean'
        }
      ];

      const search = new Search();
      await search.query(
        {
          projectId,
          filters
        },
        RecordType.TRACE
      );

      expect(mockSearchTraces).toHaveBeenCalledWith({
        experiment_id: undefined,
        log_stream_id: undefined,
        filters: [
          {
            column_id: 'id',
            operator: 'eq',
            value: 'test-id',
            type: 'id'
          },
          {
            column_id: 'name',
            operator: 'contains',
            value: 'test',
            case_sensitive: false,
            type: 'text'
          },
          {
            column_id: 'count',
            operator: 'gt',
            value: 10,
            type: 'number'
          },
          {
            column_id: 'created_at',
            operator: 'gte',
            value: '2024-01-01T00:00:00Z',
            type: 'date'
          },
          {
            column_id: 'active',
            value: true,
            type: 'boolean'
          }
        ],
        sort: {
          column_id: 'created_at',
          ascending: false,
          sort_type: 'column'
        },
        limit: 100,
        starting_token: 0
      });
    });

    it('should handle empty filters array', async () => {
      const search = new Search();
      await search.query(
        {
          projectId,
          filters: []
        },
        RecordType.TRACE
      );

      expect(mockSearchTraces).toHaveBeenCalledWith({
        experiment_id: undefined,
        log_stream_id: undefined,
        filters: undefined,
        sort: {
          column_id: 'created_at',
          ascending: false,
          sort_type: 'column'
        },
        limit: 100,
        starting_token: 0
      });
    });

    it('should handle undefined filters', async () => {
      const search = new Search();
      await search.query(
        {
          projectId,
          filters: undefined
        },
        RecordType.TRACE
      );

      expect(mockSearchTraces).toHaveBeenCalledWith({
        experiment_id: undefined,
        log_stream_id: undefined,
        filters: undefined,
        sort: {
          column_id: 'created_at',
          ascending: false,
          sort_type: 'column'
        },
        limit: 100,
        starting_token: 0
      });
    });

    it('should handle sort clause with all fields', async () => {
      const sort: LogRecordsSortClauseTS = {
        columnId: 'updated_at',
        ascending: true,
        sortType: 'column'
      };

      const search = new Search();
      await search.query(
        {
          projectId,
          sort
        },
        RecordType.TRACE
      );

      expect(mockSearchTraces).toHaveBeenCalledWith({
        experiment_id: undefined,
        log_stream_id: undefined,
        filters: undefined,
        sort: {
          column_id: 'updated_at',
          ascending: true,
          sort_type: 'column'
        },
        limit: 100,
        starting_token: 0
      });
    });

    it('should handle sort clause with minimal fields', async () => {
      const sort: LogRecordsSortClauseTS = {
        columnId: 'created_at'
      };

      const search = new Search();
      await search.query(
        {
          projectId,
          sort
        },
        RecordType.TRACE
      );

      expect(mockSearchTraces).toHaveBeenCalledWith({
        experiment_id: undefined,
        log_stream_id: undefined,
        filters: undefined,
        sort: {
          column_id: 'created_at',
          ascending: undefined,
          sort_type: undefined
        },
        limit: 100,
        starting_token: 0
      });
    });

    it('should use default limit and startingToken when not provided', async () => {
      const search = new Search();
      await search.query(
        {
          projectId
        },
        RecordType.TRACE
      );

      expect(mockSearchTraces).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 100,
          starting_token: 0
        })
      );
    });

    it('should use custom limit and startingToken when provided', async () => {
      const search = new Search();
      await search.query(
        {
          projectId,
          limit: 25,
          startingToken: 5
        },
        RecordType.TRACE
      );

      expect(mockSearchTraces).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 25,
          starting_token: 5
        })
      );
    });
  });

  describe('Search.queryMetrics', () => {
    it('should query metrics with minimal options', async () => {
      const search = new Search();
      const result = await search.queryMetrics({
        projectId,
        startTime: '2024-01-01T00:00:00Z',
        endTime: '2024-01-02T00:00:00Z'
      });

      expect(mockInit).toHaveBeenCalledWith({
        projectId,
        projectScoped: true
      });
      expect(mockSearchMetrics).toHaveBeenCalledWith({
        filters: undefined,
        log_stream_id: undefined,
        experiment_id: undefined,
        metrics_testing_id: undefined,
        interval: undefined,
        group_by: undefined,
        start_time: '2024-01-01T00:00:00Z',
        end_time: '2024-01-02T00:00:00Z'
      });
      expect(result).toEqual(mockMetricResponse);
    });

    it('should query metrics with all options', async () => {
      const filters: MetricFilterTS[] = [
        {
          columnId: 'status',
          operator: 'eq',
          value: 'success',
          type: 'text'
        }
      ];

      const search = new Search();
      const result = await search.queryMetrics({
        projectId,
        startTime: '2024-01-01T00:00:00Z',
        endTime: '2024-01-02T00:00:00Z',
        logStreamId: 'log-stream-123',
        experimentId: 'exp-123',
        metricsTestingId: 'test-123',
        interval: 10,
        groupBy: 'status',
        filters
      });

      expect(mockSearchMetrics).toHaveBeenCalledWith({
        filters: [
          {
            column_id: 'status',
            operator: 'eq',
            value: 'success',
            case_sensitive: undefined,
            type: 'text'
          }
        ],
        log_stream_id: 'log-stream-123',
        experiment_id: 'exp-123',
        metrics_testing_id: 'test-123',
        interval: 10,
        group_by: 'status',
        start_time: '2024-01-01T00:00:00Z',
        end_time: '2024-01-02T00:00:00Z'
      });
      expect(result).toEqual(mockMetricResponse);
    });

    it('should handle empty filters array for metrics', async () => {
      const search = new Search();
      await search.queryMetrics({
        projectId,
        startTime: '2024-01-01T00:00:00Z',
        endTime: '2024-01-02T00:00:00Z',
        filters: []
      });

      expect(mockSearchMetrics).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: undefined
        })
      );
    });
  });

  describe('Helper functions', () => {
    describe('getTraces', () => {
      it('should call Search.query with TRACE record type', async () => {
        const result = await getTraces({
          projectId
        });

        expect(mockInit).toHaveBeenCalledWith({
          projectId,
          projectScoped: true
        });
        expect(mockSearchTraces).toHaveBeenCalled();
        expect(result).toEqual(mockQueryResponse);
      });

      it('should pass all options to Search.query', async () => {
        const filters: LogRecordsQueryFilterTS[] = [
          {
            columnId: 'name',
            operator: 'contains',
            value: 'test',
            type: 'text'
          }
        ];

        const sort: LogRecordsSortClauseTS = {
          columnId: 'created_at',
          ascending: false
        };

        await getTraces({
          projectId,
          logStreamId: 'log-123',
          experimentId: 'exp-123',
          filters,
          sort,
          limit: 50,
          startingToken: 5
        });

        expect(mockSearchTraces).toHaveBeenCalledWith({
          experiment_id: 'exp-123',
          log_stream_id: 'log-123',
          filters: [
            {
              column_id: 'name',
              operator: 'contains',
              value: 'test',
              case_sensitive: undefined,
              type: 'text'
            }
          ],
          sort: {
            column_id: 'created_at',
            ascending: false,
            sort_type: undefined
          },
          limit: 50,
          starting_token: 5
        });
      });
    });

    describe('getSpans', () => {
      it('should call Search.query with SPAN record type', async () => {
        const result = await getSpans({
          projectId
        });

        expect(mockSearchSpans).toHaveBeenCalled();
        expect(result).toEqual(mockQueryResponse);
      });

      it('should pass all options to Search.query', async () => {
        await getSpans({
          projectId,
          logStreamId: 'log-123',
          experimentId: 'exp-123',
          filters: [
            {
              columnId: 'type',
              operator: 'eq',
              value: 'llm',
              type: 'text'
            }
          ],
          limit: 25
        });

        expect(mockSearchSpans).toHaveBeenCalledWith({
          experiment_id: 'exp-123',
          log_stream_id: 'log-123',
          filters: [
            {
              column_id: 'type',
              operator: 'eq',
              value: 'llm',
              case_sensitive: undefined,
              type: 'text'
            }
          ],
          sort: {
            column_id: 'created_at',
            ascending: false,
            sort_type: 'column'
          },
          limit: 25,
          starting_token: 0
        });
      });
    });

    describe('getSessions', () => {
      it('should call Search.query with SESSION record type', async () => {
        const result = await getSessions({
          projectId
        });

        expect(mockSearchSessions).toHaveBeenCalled();
        expect(result).toEqual(mockQueryResponse);
      });

      it('should pass all options to Search.query', async () => {
        await getSessions({
          projectId,
          experimentId: 'exp-123',
          filters: [
            {
              columnId: 'external_id',
              operator: 'eq',
              value: 'ext-123',
              type: 'id'
            }
          ],
          sort: {
            columnId: 'created_at',
            ascending: false
          }
        });

        expect(mockSearchSessions).toHaveBeenCalledWith({
          experiment_id: 'exp-123',
          log_stream_id: undefined,
          filters: [
            {
              column_id: 'external_id',
              operator: 'eq',
              value: 'ext-123',
              type: 'id'
            }
          ],
          sort: {
            column_id: 'created_at',
            ascending: false,
            sort_type: undefined
          },
          limit: 100,
          starting_token: 0
        });
      });
    });

    describe('getMetrics', () => {
      it('should call Search.queryMetrics', async () => {
        const result = await getMetrics({
          projectId,
          startTime: '2024-01-01T00:00:00Z',
          endTime: '2024-01-02T00:00:00Z'
        });

        expect(mockSearchMetrics).toHaveBeenCalled();
        expect(result).toEqual(mockMetricResponse);
      });

      it('should pass all options to Search.queryMetrics', async () => {
        const filters: MetricFilterTS[] = [
          {
            columnId: 'metric_name',
            operator: 'eq',
            value: 'latency',
            type: 'text'
          }
        ];

        await getMetrics({
          projectId,
          startTime: '2024-01-01T00:00:00Z',
          endTime: '2024-01-02T00:00:00Z',
          logStreamId: 'log-123',
          experimentId: 'exp-123',
          metricsTestingId: 'test-123',
          interval: 5,
          groupBy: 'status',
          filters
        });

        expect(mockSearchMetrics).toHaveBeenCalledWith({
          filters: [
            {
              column_id: 'metric_name',
              operator: 'eq',
              value: 'latency',
              case_sensitive: undefined,
              type: 'text'
            }
          ],
          log_stream_id: 'log-123',
          experiment_id: 'exp-123',
          metrics_testing_id: 'test-123',
          interval: 5,
          group_by: 'status',
          start_time: '2024-01-01T00:00:00Z',
          end_time: '2024-01-02T00:00:00Z'
        });
      });
    });
  });

  describe('Filter type conversions', () => {
    it('should convert ID filter correctly', async () => {
      const search = new Search();
      await search.query(
        {
          projectId,
          filters: [
            {
              columnId: 'id',
              operator: 'eq',
              value: 'test-id',
              type: 'id'
            }
          ]
        },
        RecordType.TRACE
      );

      expect(mockSearchTraces).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: [
            {
              column_id: 'id',
              operator: 'eq',
              value: 'test-id',
              type: 'id'
            }
          ]
        })
      );
    });

    it('should convert text filter with caseSensitive', async () => {
      const search = new Search();
      await search.query(
        {
          projectId,
          filters: [
            {
              columnId: 'name',
              operator: 'contains',
              value: 'test',
              caseSensitive: true,
              type: 'text'
            }
          ]
        },
        RecordType.TRACE
      );

      expect(mockSearchTraces).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: [
            {
              column_id: 'name',
              operator: 'contains',
              value: 'test',
              case_sensitive: true,
              type: 'text'
            }
          ]
        })
      );
    });

    it('should convert number filter with array value', async () => {
      const search = new Search();
      await search.query(
        {
          projectId,
          filters: [
            {
              columnId: 'count',
              operator: 'between',
              value: [10, 20],
              type: 'number'
            }
          ]
        },
        RecordType.TRACE
      );

      expect(mockSearchTraces).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: [
            {
              column_id: 'count',
              operator: 'between',
              value: [10, 20],
              type: 'number'
            }
          ]
        })
      );
    });

    it('should convert date filter correctly', async () => {
      const search = new Search();
      await search.query(
        {
          projectId,
          filters: [
            {
              columnId: 'created_at',
              operator: 'gte',
              value: '2024-01-01T00:00:00Z',
              type: 'date'
            }
          ]
        },
        RecordType.TRACE
      );

      expect(mockSearchTraces).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: [
            {
              column_id: 'created_at',
              operator: 'gte',
              value: '2024-01-01T00:00:00Z',
              type: 'date'
            }
          ]
        })
      );
    });

    it('should convert boolean filter correctly', async () => {
      const search = new Search();
      await search.query(
        {
          projectId,
          filters: [
            {
              columnId: 'active',
              value: false,
              type: 'boolean'
            }
          ]
        },
        RecordType.TRACE
      );

      expect(mockSearchTraces).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: [
            {
              column_id: 'active',
              value: false,
              type: 'boolean'
            }
          ]
        })
      );
    });
  });

  describe('Error handling', () => {
    it('should propagate errors from API client', async () => {
      const error = new Error('API Error');
      mockSearchTraces.mockRejectedValue(error);

      const search = new Search();
      await expect(
        search.query({ projectId }, RecordType.TRACE)
      ).rejects.toThrow('API Error');
    });

    it('should propagate errors from metrics API client', async () => {
      const error = new Error('Metrics API Error');
      mockSearchMetrics.mockRejectedValue(error);

      const search = new Search();
      await expect(
        search.queryMetrics({
          projectId,
          startTime: '2024-01-01T00:00:00Z',
          endTime: '2024-01-02T00:00:00Z'
        })
      ).rejects.toThrow('Metrics API Error');
    });
  });
});
