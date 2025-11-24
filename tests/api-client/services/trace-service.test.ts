import { TraceService } from '../../../src/api-client/services/trace-service';
import { RequestMethod } from '../../../src/api-client/base-client';
import { Trace } from '../../../src/types/logging/trace.types';
import { Routes } from '../../../src/types/routes.types';
import { LogRecordsQueryFilter } from '../../../src/types/search.types';
import { LogRecordsQueryRequest } from '../../../src/types/shared.types';

// Create a mock type for the makeRequest method
type MockMakeRequest = jest.MockedFunction<
  (
    request_method: RequestMethod,
    endpoint: Routes,
    data?: string | Record<string, unknown> | null,
    params?: Record<string, unknown>,
    extraHeaders?: Record<string, string>
  ) => Promise<unknown>
>;

describe('TraceService', () => {
  let traceService: TraceService;

  beforeEach(() => {
    traceService = new TraceService(
      'https://api.galileo.ai',
      'test-token',
      'test-project-id',
      'test-log-stream-id',
      'test-experiment-id',
      'test-session-id'
    );
  });

  describe('createSession', () => {
    it('should have createSession method', () => {
      expect(typeof traceService.createSession).toBe('function');
    });

    it('should accept session parameters', async () => {
      // Mock the makeRequest method
      const mockMakeRequest: MockMakeRequest = jest.fn().mockResolvedValue({
        id: 'session-123',
        name: 'test-session',
        project_id: 'test-project-id',
        project_name: 'test-project',
        external_id: 'test-external-id'
      });

      (
        traceService as unknown as { makeRequest: MockMakeRequest }
      ).makeRequest = mockMakeRequest;

      const result = await traceService.createSession({
        name: 'test-session',
        previousSessionId: 'prev-session-id',
        externalId: 'test-external-id'
      });

      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.POST,
        'projects/{project_id}/sessions',
        {
          log_stream_id: 'test-log-stream-id',
          name: 'test-session',
          previous_session_id: 'prev-session-id',
          external_id: 'test-external-id'
        },
        { project_id: 'test-project-id' }
      );

      expect(result.id).toBe('session-123');
    });
  });

  describe('searchSessions', () => {
    it('should have searchSessions method', () => {
      expect(typeof traceService.searchSessions).toBe('function');
    });

    it('should search sessions with filters and auto-inject experiment_id', async () => {
      const mockMakeRequest: MockMakeRequest = jest.fn().mockResolvedValue({
        records: [
          {
            id: 'session-123',
            external_id: 'test-external-id',
            name: 'test-session'
          }
        ],
        num_records: 1,
        starting_token: 0,
        limit: 100
      });

      (
        traceService as unknown as { makeRequest: MockMakeRequest }
      ).makeRequest = mockMakeRequest;

      const filters = [
        {
          columnId: 'external_id',
          operator: 'eq' as const,
          value: 'test-external-id',
          type: 'text' as const
        }
      ] as unknown as LogRecordsQueryFilter[];
      const result = await traceService.searchSessions({
        filters,
        limit: 1
      } as LogRecordsQueryRequest);

      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.POST,
        'projects/{project_id}/sessions/search',
        {
          filters: [
            {
              column_id: 'external_id',
              operator: 'eq',
              value: 'test-external-id',
              type: 'text'
            }
          ],
          limit: 1,
          experiment_id: 'test-experiment-id'
        },
        { project_id: 'test-project-id' }
      );

      expect(result.records).toHaveLength(1);
      expect(result.records?.[0].id).toBe('session-123');
    });

    it('should handle empty search results', async () => {
      const mockMakeRequest: MockMakeRequest = jest.fn().mockResolvedValue({
        records: [],
        starting_token: 0,
        limit: 100
      });

      (
        traceService as unknown as { makeRequest: MockMakeRequest }
      ).makeRequest = mockMakeRequest;

      const filters = [
        {
          columnId: 'external_id',
          operator: 'eq' as const,
          value: 'non-existent-id',
          type: 'text' as const
        }
      ] as unknown as LogRecordsQueryFilter[];
      const result = await traceService.searchSessions({
        filters
      } as LogRecordsQueryRequest);

      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.POST,
        'projects/{project_id}/sessions/search',
        {
          filters: [
            {
              column_id: 'external_id',
              operator: 'eq',
              value: 'non-existent-id',
              type: 'text'
            }
          ],
          experiment_id: 'test-experiment-id'
        },
        { project_id: 'test-project-id' }
      );

      expect(result.records).toEqual([]);
    });

    it('should auto-inject experiment_id when not provided in request', async () => {
      const mockMakeRequest: MockMakeRequest = jest.fn().mockResolvedValue({
        records: [],
        starting_token: 0,
        limit: 100
      });

      (
        traceService as unknown as { makeRequest: MockMakeRequest }
      ).makeRequest = mockMakeRequest;

      await traceService.searchSessions({});

      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.POST,
        'projects/{project_id}/sessions/search',
        {
          experiment_id: 'test-experiment-id'
        },
        { project_id: 'test-project-id' }
      );
    });

    it('should auto-inject log_stream_id when experiment_id is not available', async () => {
      const traceServiceWithLogStream = new TraceService(
        'https://api.galileo.ai',
        'test-token',
        'test-project-id',
        'test-log-stream-id'
      );

      const mockMakeRequest: MockMakeRequest = jest.fn().mockResolvedValue({
        records: [],
        starting_token: 0,
        limit: 100
      });

      (
        traceServiceWithLogStream as unknown as { makeRequest: MockMakeRequest }
      ).makeRequest = mockMakeRequest;

      await traceServiceWithLogStream.searchSessions({});

      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.POST,
        'projects/{project_id}/sessions/search',
        {
          log_stream_id: 'test-log-stream-id'
        },
        { project_id: 'test-project-id' }
      );
    });

    it('should not override explicit experiment_id in request', async () => {
      const mockMakeRequest: MockMakeRequest = jest.fn().mockResolvedValue({
        records: [],
        starting_token: 0,
        limit: 100
      });

      (
        traceService as unknown as { makeRequest: MockMakeRequest }
      ).makeRequest = mockMakeRequest;

      await traceService.searchSessions({
        experimentId: 'explicit-experiment-id'
      });

      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.POST,
        'projects/{project_id}/sessions/search',
        {
          experiment_id: 'explicit-experiment-id'
        },
        { project_id: 'test-project-id' }
      );
    });

    it('should not override explicit log_stream_id in request', async () => {
      const mockMakeRequest: MockMakeRequest = jest.fn().mockResolvedValue({
        records: [],
        starting_token: 0,
        limit: 100
      });

      (
        traceService as unknown as { makeRequest: MockMakeRequest }
      ).makeRequest = mockMakeRequest;

      await traceService.searchSessions({
        logStreamId: 'explicit-log-stream-id'
      });

      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.POST,
        'projects/{project_id}/sessions/search',
        {
          log_stream_id: 'explicit-log-stream-id'
        },
        { project_id: 'test-project-id' }
      );
    });
  });

  describe('ingestTracesLegacy', () => {
    it('should have ingestTracesLegacy method', () => {
      expect(typeof traceService.ingestTracesLegacy).toBe('function');
    });

    it('should ingest traces with session ID', async () => {
      const mockMakeRequest: MockMakeRequest = jest
        .fn()
        .mockResolvedValue(undefined);
      (
        traceService as unknown as { makeRequest: MockMakeRequest }
      ).makeRequest = mockMakeRequest;

      const mockTraces = [
        new Trace({
          input: 'test input',
          output: 'test output'
        })
      ];

      await traceService.ingestTracesLegacy(mockTraces);

      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.POST,
        'projects/{project_id}/traces',
        {
          traces: mockTraces,
          experiment_id: 'test-experiment-id',
          session_id: 'test-session-id'
        },
        { project_id: 'test-project-id' }
      );
    });

    it('should use log_stream_id when experiment_id is not provided', async () => {
      const traceServiceWithoutExperiment = new TraceService(
        'https://api.galileo.ai',
        'test-token',
        'test-project-id',
        'test-log-stream-id'
      );

      const mockMakeRequest: MockMakeRequest = jest
        .fn()
        .mockResolvedValue(undefined);
      (
        traceServiceWithoutExperiment as unknown as {
          makeRequest: MockMakeRequest;
        }
      ).makeRequest = mockMakeRequest;

      const mockTraces = [new Trace({ input: 'test input' })];
      await traceServiceWithoutExperiment.ingestTracesLegacy(mockTraces);

      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.POST,
        'projects/{project_id}/traces',
        {
          traces: mockTraces,
          log_stream_id: 'test-log-stream-id',
          session_id: undefined
        },
        { project_id: 'test-project-id' }
      );
    });
  });

  describe('searchTraces', () => {
    it('should have searchTraces method', () => {
      expect(typeof traceService.searchTraces).toBe('function');
    });

    it('should search traces with filters and auto-inject experiment_id', async () => {
      const mockMakeRequest: MockMakeRequest = jest.fn().mockResolvedValue({
        records: [
          {
            id: 'trace-123',
            name: 'test-trace'
          }
        ],
        starting_token: 0,
        limit: 100
      });

      (
        traceService as unknown as { makeRequest: MockMakeRequest }
      ).makeRequest = mockMakeRequest;

      const filters = [
        {
          columnId: 'name',
          operator: 'eq' as const,
          value: 'test-trace',
          type: 'text' as const
        }
      ] as unknown as LogRecordsQueryFilter[];
      const result = await traceService.searchTraces({
        filters
      } as LogRecordsQueryRequest);

      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.POST,
        'projects/{project_id}/traces/search',
        {
          filters: [
            {
              column_id: 'name',
              operator: 'eq',
              value: 'test-trace',
              type: 'text'
            }
          ],
          experiment_id: 'test-experiment-id'
        },
        { project_id: 'test-project-id' }
      );

      expect(result.records).toHaveLength(1);
      expect(result.records?.[0].id).toBe('trace-123');
    });

    it('should auto-inject log_stream_id when experiment_id is not available', async () => {
      const traceServiceWithLogStream = new TraceService(
        'https://api.galileo.ai',
        'test-token',
        'test-project-id',
        'test-log-stream-id'
      );

      const mockMakeRequest: MockMakeRequest = jest.fn().mockResolvedValue({
        records: [],
        starting_token: 0,
        limit: 100
      });

      (
        traceServiceWithLogStream as unknown as { makeRequest: MockMakeRequest }
      ).makeRequest = mockMakeRequest;

      await traceServiceWithLogStream.searchTraces({});

      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.POST,
        'projects/{project_id}/traces/search',
        {
          log_stream_id: 'test-log-stream-id'
        },
        { project_id: 'test-project-id' }
      );
    });

    it('should not override explicit experiment_id in request', async () => {
      const mockMakeRequest: MockMakeRequest = jest.fn().mockResolvedValue({
        records: [],
        starting_token: 0,
        limit: 100
      });

      (
        traceService as unknown as { makeRequest: MockMakeRequest }
      ).makeRequest = mockMakeRequest;

      await traceService.searchTraces({
        experimentId: 'explicit-experiment-id'
      });

      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.POST,
        'projects/{project_id}/traces/search',
        {
          experiment_id: 'explicit-experiment-id'
        },
        { project_id: 'test-project-id' }
      );
    });
  });

  describe('searchSpans', () => {
    it('should have searchSpans method', () => {
      expect(typeof traceService.searchSpans).toBe('function');
    });

    it('should search spans with filters and auto-inject experiment_id', async () => {
      const mockMakeRequest: MockMakeRequest = jest.fn().mockResolvedValue({
        records: [
          {
            id: 'span-123',
            name: 'test-span'
          }
        ],
        starting_token: 0,
        limit: 100
      });

      (
        traceService as unknown as { makeRequest: MockMakeRequest }
      ).makeRequest = mockMakeRequest;

      const filters = [
        {
          columnId: 'name',
          operator: 'eq' as const,
          value: 'test-span',
          type: 'text' as const
        }
      ] as unknown as LogRecordsQueryFilter[];
      const result = await traceService.searchSpans({
        filters
      } as LogRecordsQueryRequest);

      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.POST,
        'projects/{project_id}/spans/search',
        {
          filters: [
            {
              column_id: 'name',
              operator: 'eq',
              value: 'test-span',
              type: 'text'
            }
          ],
          experiment_id: 'test-experiment-id'
        },
        { project_id: 'test-project-id' }
      );

      expect(result.records).toHaveLength(1);
      expect(result.records?.[0].id).toBe('span-123');
    });

    it('should auto-inject log_stream_id when experiment_id is not available', async () => {
      const traceServiceWithLogStream = new TraceService(
        'https://api.galileo.ai',
        'test-token',
        'test-project-id',
        'test-log-stream-id'
      );

      const mockMakeRequest: MockMakeRequest = jest.fn().mockResolvedValue({
        records: [],
        starting_token: 0,
        limit: 100
      });

      (
        traceServiceWithLogStream as unknown as { makeRequest: MockMakeRequest }
      ).makeRequest = mockMakeRequest;

      await traceServiceWithLogStream.searchSpans({});

      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.POST,
        'projects/{project_id}/spans/search',
        {
          log_stream_id: 'test-log-stream-id'
        },
        { project_id: 'test-project-id' }
      );
    });

    it('should not override explicit log_stream_id in request', async () => {
      const mockMakeRequest: MockMakeRequest = jest.fn().mockResolvedValue({
        records: [],
        starting_token: 0,
        limit: 100
      });

      (
        traceService as unknown as { makeRequest: MockMakeRequest }
      ).makeRequest = mockMakeRequest;

      await traceService.searchSpans({
        logStreamId: 'explicit-log-stream-id'
      });

      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.POST,
        'projects/{project_id}/spans/search',
        {
          log_stream_id: 'explicit-log-stream-id'
        },
        { project_id: 'test-project-id' }
      );
    });
  });

  describe('getSession', () => {
    it('should have getSession method', () => {
      expect(typeof traceService.getSession).toBe('function');
    });

    it('should get session by id', async () => {
      const mockMakeRequest: MockMakeRequest = jest.fn().mockResolvedValue({
        id: 'session-123',
        name: 'test-session',
        type: 'session',
        created_at: '2024-01-01T00:00:00Z'
      });

      (
        traceService as unknown as { makeRequest: MockMakeRequest }
      ).makeRequest = mockMakeRequest;

      const result = await traceService.getSession('session-123');

      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.GET,
        'projects/{project_id}/sessions/{session_id}',
        undefined,
        { project_id: 'test-project-id', session_id: 'session-123' }
      );

      expect(result.id).toBe('session-123');
    });
  });

  describe('getTrace', () => {
    it('should have getTrace method', () => {
      expect(typeof traceService.getTrace).toBe('function');
    });

    it('should get trace by id', async () => {
      const mockMakeRequest: MockMakeRequest = jest.fn().mockResolvedValue({
        id: 'trace-123',
        type: 'trace',
        input: 'test input',
        created_at: '2024-01-01T00:00:00Z'
      });

      (
        traceService as unknown as { makeRequest: MockMakeRequest }
      ).makeRequest = mockMakeRequest;

      const result = await traceService.getTrace('trace-123');

      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.GET,
        'projects/{project_id}/traces/{trace_id}',
        undefined,
        { project_id: 'test-project-id', trace_id: 'trace-123' }
      );

      expect(result.id).toBe('trace-123');
    });
  });

  describe('updateTrace', () => {
    it('should have updateTrace method', () => {
      expect(typeof traceService.updateTrace).toBe('function');
    });

    it('should update trace', async () => {
      const mockMakeRequest: MockMakeRequest = jest.fn().mockResolvedValue({
        project_id: 'test-project-id',
        project_name: 'test-project',
        log_stream_id: 'test-log-stream-id'
      });

      (
        traceService as unknown as { makeRequest: MockMakeRequest }
      ).makeRequest = mockMakeRequest;

      const result = await traceService.updateTrace({
        traceId: 'trace-123',
        input: 'updated input',
        logStreamId: 'test-log-stream-id'
      });

      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.PATCH,
        'projects/{project_id}/traces/{trace_id}',
        expect.objectContaining({
          trace_id: 'trace-123',
          input: 'updated input',
          log_stream_id: 'test-log-stream-id'
        }),
        { project_id: 'test-project-id', trace_id: 'trace-123' }
      );

      expect(result.projectId).toBe('test-project-id');
    });
  });

  describe('deleteTraces', () => {
    it('should have deleteTraces method', () => {
      expect(typeof traceService.deleteTraces).toBe('function');
    });

    it('should delete traces', async () => {
      const mockMakeRequest: MockMakeRequest = jest.fn().mockResolvedValue({
        message: 'Traces deleted successfully'
      });

      (
        traceService as unknown as { makeRequest: MockMakeRequest }
      ).makeRequest = mockMakeRequest;

      const result = await traceService.deleteTraces({
        logStreamId: 'test-log-stream-id',
        filters: []
      });

      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.POST,
        'projects/{project_id}/traces/delete',
        expect.objectContaining({
          log_stream_id: 'test-log-stream-id',
          filters: []
        }),
        { project_id: 'test-project-id' }
      );

      expect(result.message).toBe('Traces deleted successfully');
    });
  });

  describe('deleteSessions', () => {
    it('should have deleteSessions method', () => {
      expect(typeof traceService.deleteSessions).toBe('function');
    });

    it('should delete sessions', async () => {
      const mockMakeRequest: MockMakeRequest = jest.fn().mockResolvedValue({
        message: 'Sessions deleted successfully'
      });

      (
        traceService as unknown as { makeRequest: MockMakeRequest }
      ).makeRequest = mockMakeRequest;

      const result = await traceService.deleteSessions({
        logStreamId: 'test-log-stream-id',
        filters: []
      });

      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.POST,
        'projects/{project_id}/sessions/delete',
        expect.objectContaining({
          log_stream_id: 'test-log-stream-id',
          filters: []
        }),
        { project_id: 'test-project-id' }
      );

      expect(result.message).toBe('Sessions deleted successfully');
    });
  });

  describe('ingestSpans', () => {
    it('should have ingestSpans method', () => {
      expect(typeof traceService.ingestSpans).toBe('function');
    });

    it('should ingest spans', async () => {
      const mockMakeRequest: MockMakeRequest = jest.fn().mockResolvedValue({
        records_count: 2,
        project_id: 'test-project-id',
        project_name: 'test-project',
        session_id: 'test-session-id',
        trace_id: 'test-trace-id',
        log_stream_id: 'test-log-stream-id'
      });

      (
        traceService as unknown as { makeRequest: MockMakeRequest }
      ).makeRequest = mockMakeRequest;

      const result = await traceService.ingestSpans({
        spans: [],
        traceId: 'test-trace-id',
        parentId: 'test-parent-id',
        logStreamId: 'test-log-stream-id'
      });

      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.POST,
        'projects/{project_id}/spans',
        expect.objectContaining({
          log_stream_id: 'test-log-stream-id',
          spans: [],
          trace_id: 'test-trace-id',
          parent_id: 'test-parent-id'
        }),
        { project_id: 'test-project-id' }
      );

      expect(result.recordsCount).toBe(2);
    });
  });

  describe('getSpan', () => {
    it('should have getSpan method', () => {
      expect(typeof traceService.getSpan).toBe('function');
    });

    it('should get span by id', async () => {
      const mockMakeRequest: MockMakeRequest = jest.fn().mockResolvedValue({
        id: 'span-123',
        type: 'llm',
        input: 'test input',
        created_at: '2024-01-01T00:00:00Z'
      });

      (
        traceService as unknown as { makeRequest: MockMakeRequest }
      ).makeRequest = mockMakeRequest;

      const result = await traceService.getSpan('span-123');

      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.GET,
        'projects/{project_id}/spans/{span_id}',
        undefined,
        { project_id: 'test-project-id', span_id: 'span-123' }
      );

      expect(result.id).toBe('span-123');
    });
  });

  describe('updateSpan', () => {
    it('should have updateSpan method', () => {
      expect(typeof traceService.updateSpan).toBe('function');
    });

    it('should update span', async () => {
      const mockMakeRequest: MockMakeRequest = jest.fn().mockResolvedValue({
        project_id: 'test-project-id',
        project_name: 'test-project',
        log_stream_id: 'test-log-stream-id'
      });

      (
        traceService as unknown as { makeRequest: MockMakeRequest }
      ).makeRequest = mockMakeRequest;

      const result = await traceService.updateSpan({
        spanId: 'span-123',
        input: 'updated input',
        logStreamId: 'test-log-stream-id'
      });

      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.PATCH,
        'projects/{project_id}/spans/{span_id}',
        expect.objectContaining({
          span_id: 'span-123',
          input: 'updated input',
          log_stream_id: 'test-log-stream-id'
        }),
        { project_id: 'test-project-id', span_id: 'span-123' }
      );

      expect(result.projectId).toBe('test-project-id');
    });
  });

  describe('deleteSpans', () => {
    it('should have deleteSpans method', () => {
      expect(typeof traceService.deleteSpans).toBe('function');
    });

    it('should delete spans', async () => {
      const mockMakeRequest: MockMakeRequest = jest.fn().mockResolvedValue({
        message: 'Spans deleted successfully'
      });

      (
        traceService as unknown as { makeRequest: MockMakeRequest }
      ).makeRequest = mockMakeRequest;

      const result = await traceService.deleteSpans({
        logStreamId: 'test-log-stream-id',
        filters: []
      });

      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.POST,
        'projects/{project_id}/spans/delete',
        expect.objectContaining({
          log_stream_id: 'test-log-stream-id',
          filters: []
        }),
        { project_id: 'test-project-id' }
      );

      expect(result.message).toBe('Spans deleted successfully');
    });
  });

  describe('countTraces', () => {
    it('should have countTraces method', () => {
      expect(typeof traceService.countTraces).toBe('function');
    });

    it('should count traces', async () => {
      const mockMakeRequest: MockMakeRequest = jest.fn().mockResolvedValue({
        total_count: 42
      });

      (
        traceService as unknown as { makeRequest: MockMakeRequest }
      ).makeRequest = mockMakeRequest;

      const result = await traceService.countTraces({
        logStreamId: 'test-log-stream-id',
        filters: []
      });

      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.POST,
        'projects/{project_id}/traces/count',
        expect.objectContaining({
          log_stream_id: 'test-log-stream-id',
          filters: []
        }),
        { project_id: 'test-project-id' }
      );

      expect(result.totalCount).toBe(42);
    });
  });

  describe('countSessions', () => {
    it('should have countSessions method', () => {
      expect(typeof traceService.countSessions).toBe('function');
    });

    it('should count sessions', async () => {
      const mockMakeRequest: MockMakeRequest = jest.fn().mockResolvedValue({
        total_count: 15
      });

      (
        traceService as unknown as { makeRequest: MockMakeRequest }
      ).makeRequest = mockMakeRequest;

      const result = await traceService.countSessions({
        logStreamId: 'test-log-stream-id',
        filters: []
      });

      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.POST,
        'projects/{project_id}/sessions/count',
        expect.objectContaining({
          log_stream_id: 'test-log-stream-id',
          filters: []
        }),
        { project_id: 'test-project-id' }
      );

      expect(result.totalCount).toBe(15);
    });
  });

  describe('countSpans', () => {
    it('should have countSpans method', () => {
      expect(typeof traceService.countSpans).toBe('function');
    });

    it('should count spans', async () => {
      const mockMakeRequest: MockMakeRequest = jest.fn().mockResolvedValue({
        total_count: 100
      });

      (
        traceService as unknown as { makeRequest: MockMakeRequest }
      ).makeRequest = mockMakeRequest;

      const result = await traceService.countSpans({
        logStreamId: 'test-log-stream-id',
        filters: []
      });

      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.POST,
        'projects/{project_id}/spans/count',
        expect.objectContaining({
          log_stream_id: 'test-log-stream-id',
          filters: []
        }),
        { project_id: 'test-project-id' }
      );

      expect(result.totalCount).toBe(100);
    });
  });

  describe('getTracesAvailableColumns', () => {
    it('should have getTracesAvailableColumns method', () => {
      expect(typeof traceService.getTracesAvailableColumns).toBe('function');
    });

    it('should get available columns for traces', async () => {
      const mockMakeRequest: MockMakeRequest = jest.fn().mockResolvedValue({
        columns: [
          { id: 'input', name: 'Input', type: 'text' },
          { id: 'output', name: 'Output', type: 'text' }
        ]
      });

      (
        traceService as unknown as { makeRequest: MockMakeRequest }
      ).makeRequest = mockMakeRequest;

      const result = await traceService.getTracesAvailableColumns({
        logStreamId: 'test-log-stream-id'
      });

      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.POST,
        'projects/{project_id}/traces/available_columns',
        expect.objectContaining({
          log_stream_id: 'test-log-stream-id'
        }),
        { project_id: 'test-project-id' }
      );

      expect(result.columns).toHaveLength(2);
    });
  });

  describe('getSessionsAvailableColumns', () => {
    it('should have getSessionsAvailableColumns method', () => {
      expect(typeof traceService.getSessionsAvailableColumns).toBe('function');
    });

    it('should get available columns for sessions', async () => {
      const mockMakeRequest: MockMakeRequest = jest.fn().mockResolvedValue({
        columns: [
          { id: 'name', name: 'Name', type: 'text' },
          { id: 'created_at', name: 'Created At', type: 'date' }
        ]
      });

      (
        traceService as unknown as { makeRequest: MockMakeRequest }
      ).makeRequest = mockMakeRequest;

      const result = await traceService.getSessionsAvailableColumns({
        logStreamId: 'test-log-stream-id'
      });

      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.POST,
        'projects/{project_id}/sessions/available_columns',
        expect.objectContaining({
          log_stream_id: 'test-log-stream-id'
        }),
        { project_id: 'test-project-id' }
      );

      expect(result.columns).toHaveLength(2);
    });
  });

  describe('getSpansAvailableColumns', () => {
    it('should have getSpansAvailableColumns method', () => {
      expect(typeof traceService.getSpansAvailableColumns).toBe('function');
    });

    it('should get available columns for spans', async () => {
      const mockMakeRequest: MockMakeRequest = jest.fn().mockResolvedValue({
        columns: [
          { id: 'type', name: 'Type', type: 'text' },
          { id: 'duration_ns', name: 'Duration', type: 'number' }
        ]
      });

      (
        traceService as unknown as { makeRequest: MockMakeRequest }
      ).makeRequest = mockMakeRequest;

      const result = await traceService.getSpansAvailableColumns({
        logStreamId: 'test-log-stream-id'
      });

      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.POST,
        'projects/{project_id}/spans/available_columns',
        expect.objectContaining({
          log_stream_id: 'test-log-stream-id'
        }),
        { project_id: 'test-project-id' }
      );

      expect(result.columns).toHaveLength(2);
    });
  });

  describe('recomputeMetrics', () => {
    it('should have recomputeMetrics method', () => {
      expect(typeof traceService.recomputeMetrics).toBe('function');
    });

    it('should recompute metrics', async () => {
      const mockMakeRequest: MockMakeRequest = jest.fn().mockResolvedValue({
        status: 'success'
      });

      (
        traceService as unknown as { makeRequest: MockMakeRequest }
      ).makeRequest = mockMakeRequest;

      const result = await traceService.recomputeMetrics({
        logStreamId: 'test-log-stream-id',
        scorerIds: ['scorer-1', 'scorer-2']
      });

      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.POST,
        'projects/{project_id}/recompute_metrics',
        expect.objectContaining({
          log_stream_id: 'test-log-stream-id',
          scorer_ids: ['scorer-1', 'scorer-2']
        }),
        { project_id: 'test-project-id' }
      );

      expect(result).toBeDefined();
    });
  });

  describe('getAggregatedTraceView', () => {
    it('should have getAggregatedTraceView method', () => {
      expect(typeof traceService.getAggregatedTraceView).toBe('function');
    });

    it('should get aggregated trace view', async () => {
      const mockMakeRequest: MockMakeRequest = jest.fn().mockResolvedValue({
        graph: {
          nodes: [
            { id: 'node-1', name: 'Node 1' },
            { id: 'node-2', name: 'Node 2' }
          ],
          edges: [{ source: 'node-1', target: 'node-2', weight: 1 }]
        }
      });

      (
        traceService as unknown as { makeRequest: MockMakeRequest }
      ).makeRequest = mockMakeRequest;

      const result = await traceService.getAggregatedTraceView({
        logStreamId: 'test-log-stream-id',
        filters: []
      });

      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.POST,
        'projects/{project_id}/traces/aggregated',
        expect.objectContaining({
          log_stream_id: 'test-log-stream-id',
          filters: []
        }),
        { project_id: 'test-project-id' }
      );

      expect(result.graph).toBeDefined();
      expect(result.graph.nodes).toHaveLength(2);
    });
  });
});
