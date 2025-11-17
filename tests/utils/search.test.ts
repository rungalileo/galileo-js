import {
  Search,
  RecordType,
  getTraces,
  getSpans,
  getSessions,
  getMetrics
} from '../../src/utils/search';
import {
  LogRecordsQueryFilter,
  LogRecordsQueryRequest,
  LogRecordsQueryResponse,
  LogRecordsMetricsQueryRequest,
  LogRecordsMetricsResponse,
  LogRecordsSortClause
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
    startingToken: 0,
    nextStartingToken: null,
    lastRowId: null,
    paginated: false
  };

  const mockMetricResponse: LogRecordsMetricsResponse = {
    groupByColumns: [],
    aggregateMetrics: {},
    bucketedMetrics: {}
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
      const result = await search.query(projectId, RecordType.TRACE, {});

      expect(mockInit).toHaveBeenCalledWith({
        projectId,
        projectScoped: true
      });
      expect(mockSearchTraces).toHaveBeenCalledWith({});
      expect(result).toEqual(mockQueryResponse);
    });

    it('should query spans with all options', async () => {
      const filters = [
        {
          columnId: 'status',
          operator: 'eq' as const,
          value: 'completed',
          type: 'text' as const
        }
      ] as unknown as LogRecordsQueryFilter[];

      const sort: LogRecordsSortClause = {
        columnId: 'created_at',
        ascending: false,
        sortType: 'column'
      };

      const search = new Search();
      const result = await search.query(projectId, RecordType.SPAN, {
        limit: 50,
        startingToken: 10,
        filters,
        sort,
        experimentId: 'exp-123',
        logStreamId: 'log-stream-123'
      } as LogRecordsQueryRequest);

      expect(mockSearchSpans).toHaveBeenCalledWith({
        experimentId: 'exp-123',
        logStreamId: 'log-stream-123',
        filters: [
          {
            columnId: 'status',
            operator: 'eq',
            value: 'completed',
            type: 'text'
          }
        ],
        sort: {
          columnId: 'created_at',
          ascending: false,
          sortType: 'column'
        },
        limit: 50,
        startingToken: 10
      });
      expect(result).toEqual(mockQueryResponse);
    });

    it('should query sessions with filters', async () => {
      const filters = [
        {
          columnId: 'external_id',
          operator: 'eq' as const,
          value: 'ext-123',
          type: 'id' as const
        }
      ] as unknown as LogRecordsQueryFilter[];

      const search = new Search();
      await search.query(projectId, RecordType.SESSION, {
        filters
      } as LogRecordsQueryRequest);

      expect(mockSearchSessions).toHaveBeenCalledWith({
        filters: [
          {
            columnId: 'external_id',
            operator: 'eq',
            value: 'ext-123',
            type: 'id'
          }
        ]
      });
    });

    it('should handle all filter types correctly', async () => {
      const filters = [
        {
          columnId: 'id',
          operator: 'eq' as const,
          value: 'test-id',
          type: 'id' as const
        },
        {
          columnId: 'name',
          operator: 'contains' as const,
          value: 'test',
          caseSensitive: false,
          type: 'text' as const
        },
        {
          columnId: 'count',
          operator: 'gt' as const,
          value: 10,
          type: 'number' as const
        },
        {
          columnId: 'created_at',
          operator: 'gte' as const,
          value: '2024-01-01T00:00:00Z',
          type: 'date' as const
        },
        {
          columnId: 'active',
          value: true,
          type: 'boolean' as const
        }
      ] as unknown as LogRecordsQueryFilter[];

      const search = new Search();
      await search.query(projectId, RecordType.TRACE, {
        filters
      } as LogRecordsQueryRequest);

      expect(mockSearchTraces).toHaveBeenCalledWith({
        filters: [
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
        ]
      });
    });

    it('should handle empty filters array', async () => {
      const search = new Search();
      await search.query(projectId, RecordType.TRACE, {
        filters: []
      } as LogRecordsQueryRequest);

      expect(mockSearchTraces).toHaveBeenCalledWith({
        filters: []
      });
    });

    it('should handle undefined filters', async () => {
      const search = new Search();
      await search.query(projectId, RecordType.TRACE, {
        filters: undefined
      } as LogRecordsQueryRequest);

      expect(mockSearchTraces).toHaveBeenCalledWith({
        filters: undefined
      });
    });

    it('should handle sort clause with all fields', async () => {
      const sort: LogRecordsSortClause = {
        columnId: 'updated_at',
        ascending: true,
        sortType: 'column'
      };

      const search = new Search();
      await search.query(projectId, RecordType.TRACE, {
        sort
      } as LogRecordsQueryRequest);

      expect(mockSearchTraces).toHaveBeenCalledWith({
        sort: {
          columnId: 'updated_at',
          ascending: true,
          sortType: 'column'
        }
      });
    });

    it('should handle sort clause with minimal fields', async () => {
      const sort: LogRecordsSortClause = {
        columnId: 'created_at'
      };

      const search = new Search();
      await search.query(projectId, RecordType.TRACE, {
        sort
      } as LogRecordsQueryRequest);

      expect(mockSearchTraces).toHaveBeenCalledWith({
        sort: {
          columnId: 'created_at'
        }
      });
    });

    it('should use default limit and startingToken when not provided', async () => {
      const search = new Search();
      await search.query(projectId, RecordType.TRACE, {});

      expect(mockSearchTraces).toHaveBeenCalledWith({});
    });

    it('should use custom limit and startingToken when provided', async () => {
      const search = new Search();
      await search.query(projectId, RecordType.TRACE, {
        limit: 25,
        startingToken: 5
      } as LogRecordsQueryRequest);

      expect(mockSearchTraces).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 25,
          startingToken: 5
        })
      );
    });
  });

  describe('Search.queryMetrics', () => {
    it('should query metrics with minimal options', async () => {
      const search = new Search();
      const result = await search.queryMetrics(projectId, {
        startTime: '2024-01-01T00:00:00Z',
        endTime: '2024-01-02T00:00:00Z'
      } as LogRecordsMetricsQueryRequest);

      expect(mockInit).toHaveBeenCalledWith({
        projectId,
        projectScoped: true
      });
      expect(mockSearchMetrics).toHaveBeenCalledWith({
        startTime: '2024-01-01T00:00:00Z',
        endTime: '2024-01-02T00:00:00Z'
      });
      expect(result).toEqual(mockMetricResponse);
    });

    it('should query metrics with all options', async () => {
      const filters = [
        {
          columnId: 'status',
          operator: 'eq' as const,
          value: 'success',
          type: 'text' as const
        }
      ] as unknown as LogRecordsQueryFilter[];

      const search = new Search();
      const result = await search.queryMetrics(projectId, {
        startTime: '2024-01-01T00:00:00Z',
        endTime: '2024-01-02T00:00:00Z',
        logStreamId: 'log-stream-123',
        experimentId: 'exp-123',
        metricsTestingId: 'test-123',
        interval: 10,
        groupBy: 'status',
        filters
      } as LogRecordsMetricsQueryRequest);

      expect(mockSearchMetrics).toHaveBeenCalledWith({
        filters: [
          {
            columnId: 'status',
            operator: 'eq',
            value: 'success',
            type: 'text'
          }
        ],
        logStreamId: 'log-stream-123',
        experimentId: 'exp-123',
        metricsTestingId: 'test-123',
        interval: 10,
        groupBy: 'status',
        startTime: '2024-01-01T00:00:00Z',
        endTime: '2024-01-02T00:00:00Z'
      });
      expect(result).toEqual(mockMetricResponse);
    });

    it('should handle empty filters array for metrics', async () => {
      const search = new Search();
      await search.queryMetrics(projectId, {
        startTime: '2024-01-01T00:00:00Z',
        endTime: '2024-01-02T00:00:00Z',
        filters: []
      } as LogRecordsMetricsQueryRequest);

      expect(mockSearchMetrics).toHaveBeenCalledWith({
        startTime: '2024-01-01T00:00:00Z',
        endTime: '2024-01-02T00:00:00Z',
        filters: []
      });
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
        const filters = [
          {
            columnId: 'name',
            operator: 'contains' as const,
            value: 'test',
            type: 'text' as const
          }
        ] as unknown as LogRecordsQueryFilter[];

        const sort: LogRecordsSortClause = {
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
        } as LogRecordsQueryRequest & { projectId: string });

        expect(mockSearchTraces).toHaveBeenCalledWith({
          experimentId: 'exp-123',
          logStreamId: 'log-123',
          filters: [
            {
              columnId: 'name',
              operator: 'contains',
              value: 'test',
              type: 'text'
            }
          ],
          sort: {
            columnId: 'created_at',
            ascending: false
          },
          limit: 50,
          startingToken: 5,
          projectId: 'test-project-id'
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
        const filters = [
          {
            columnId: 'type',
            operator: 'eq' as const,
            value: 'llm',
            type: 'text' as const
          }
        ] as unknown as LogRecordsQueryFilter[];
        await getSpans({
          projectId,
          logStreamId: 'log-123',
          experimentId: 'exp-123',
          filters,
          limit: 25
        } as LogRecordsQueryRequest & { projectId: string });

        expect(mockSearchSpans).toHaveBeenCalledWith({
          experimentId: 'exp-123',
          logStreamId: 'log-123',
          filters: [
            {
              columnId: 'type',
              operator: 'eq',
              value: 'llm',
              type: 'text'
            }
          ],
          limit: 25,
          projectId: 'test-project-id'
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
        const filters = [
          {
            columnId: 'external_id',
            operator: 'eq' as const,
            value: 'ext-123',
            type: 'id' as const
          }
        ] as unknown as LogRecordsQueryFilter[];
        await getSessions({
          projectId,
          experimentId: 'exp-123',
          filters,
          sort: {
            columnId: 'created_at',
            ascending: false
          }
        } as LogRecordsQueryRequest & { projectId: string });

        expect(mockSearchSessions).toHaveBeenCalledWith({
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
          },
          projectId: 'test-project-id'
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
        const filters = [
          {
            columnId: 'metric_name',
            operator: 'eq' as const,
            value: 'latency',
            type: 'text' as const
          }
        ] as unknown as LogRecordsQueryFilter[];

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
        } as LogRecordsMetricsQueryRequest & { projectId: string });

        expect(mockSearchMetrics).toHaveBeenCalledWith({
          filters: [
            {
              columnId: 'metric_name',
              operator: 'eq',
              value: 'latency',
              type: 'text'
            }
          ],
          logStreamId: 'log-123',
          experimentId: 'exp-123',
          metricsTestingId: 'test-123',
          interval: 5,
          groupBy: 'status',
          startTime: '2024-01-01T00:00:00Z',
          endTime: '2024-01-02T00:00:00Z',
          projectId: 'test-project-id'
        });
      });
    });
  });

  describe('Filter type conversions', () => {
    it('should convert ID filter correctly', async () => {
      const search = new Search();
      const filters = [
        {
          columnId: 'id',
          operator: 'eq' as const,
          value: 'test-id',
          type: 'id' as const
        }
      ] as unknown as LogRecordsQueryFilter[];
      await search.query(projectId, RecordType.TRACE, {
        filters
      } as LogRecordsQueryRequest);

      expect(mockSearchTraces).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: [
            {
              columnId: 'id',
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
      const filters = [
        {
          columnId: 'name',
          operator: 'contains' as const,
          value: 'test',
          caseSensitive: true,
          type: 'text' as const
        }
      ] as unknown as LogRecordsQueryFilter[];
      await search.query(projectId, RecordType.TRACE, {
        filters
      } as LogRecordsQueryRequest);

      expect(mockSearchTraces).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: [
            {
              columnId: 'name',
              operator: 'contains',
              value: 'test',
              caseSensitive: true,
              type: 'text'
            }
          ]
        })
      );
    });

    it('should convert number filter with array value', async () => {
      const search = new Search();
      const filters = [
        {
          columnId: 'count',
          operator: 'between' as const,
          value: [10, 20],
          type: 'number' as const
        }
      ] as unknown as LogRecordsQueryFilter[];
      await search.query(projectId, RecordType.TRACE, {
        filters
      } as LogRecordsQueryRequest);

      expect(mockSearchTraces).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: [
            {
              columnId: 'count',
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
      const filters = [
        {
          columnId: 'created_at',
          operator: 'gte' as const,
          value: '2024-01-01T00:00:00Z',
          type: 'date' as const
        }
      ] as unknown as LogRecordsQueryFilter[];
      await search.query(projectId, RecordType.TRACE, {
        filters
      } as LogRecordsQueryRequest);

      expect(mockSearchTraces).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: [
            {
              columnId: 'created_at',
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
      const filters = [
        {
          columnId: 'active',
          value: false,
          type: 'boolean' as const
        }
      ] as unknown as LogRecordsQueryFilter[];
      await search.query(projectId, RecordType.TRACE, {
        filters
      } as LogRecordsQueryRequest);

      expect(mockSearchTraces).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: [
            {
              columnId: 'active',
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
        search.query(projectId, RecordType.TRACE, {})
      ).rejects.toThrow('API Error');
    });

    it('should propagate errors from metrics API client', async () => {
      const error = new Error('Metrics API Error');
      mockSearchMetrics.mockRejectedValue(error);

      const search = new Search();
      await expect(
        search.queryMetrics(projectId, {
          startTime: '2024-01-01T00:00:00Z',
          endTime: '2024-01-02T00:00:00Z'
        } as LogRecordsMetricsQueryRequest)
      ).rejects.toThrow('Metrics API Error');
    });
  });
});
