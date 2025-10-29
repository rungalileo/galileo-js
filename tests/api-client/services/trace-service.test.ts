import { TraceService } from '../../../src/api-client/services/trace-service';
import { RequestMethod } from '../../../src/api-client/base-client';
import { Trace } from '../../../src/types/logging/trace.types';
import { Routes } from '../../../src/types/routes.types';

// Create a mock type for the makeRequest method
type MockMakeRequest = jest.MockedFunction<(
  request_method: RequestMethod,
  endpoint: Routes,
  data?: string | Record<string, unknown> | null,
  params?: Record<string, unknown>,
  extraHeaders?: Record<string, string>
) => Promise<unknown>>;

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

      (traceService as unknown as { makeRequest: MockMakeRequest }).makeRequest = mockMakeRequest;

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

    it('should search sessions with filters', async () => {
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

      (traceService as unknown as { makeRequest: MockMakeRequest }).makeRequest = mockMakeRequest;

      const result = await traceService.searchSessions({
        filters: [
          {
            column_id: 'external_id',
            operator: 'eq',
            value: 'test-external-id'
          }
        ],
        limit: 1
      });

      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.POST,
        'projects/{project_id}/sessions/search',
        {
          log_stream_id: 'test-log-stream-id',
          experiment_id: 'test-experiment-id',
          filters: [
            {
              column_id: 'external_id',
              operator: 'eq',
              value: 'test-external-id',
              type: 'text'
            }
          ],
          limit: 1,
          starting_token: 0
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

      (traceService as unknown as { makeRequest: MockMakeRequest }).makeRequest = mockMakeRequest;

      const result = await traceService.searchSessions({
        filters: [
          {
            column_id: 'external_id',
            operator: 'eq',
            value: 'non-existent-id'
          }
        ]
      });

      expect(result.records).toEqual([]);
    });

    it('should use default parameters when not provided', async () => {
      const mockMakeRequest: MockMakeRequest = jest.fn().mockResolvedValue({
        records: [],
        starting_token: 0,
        limit: 100
      });

      (traceService as unknown as { makeRequest: MockMakeRequest }).makeRequest = mockMakeRequest;

      await traceService.searchSessions({});

      expect(mockMakeRequest).toHaveBeenCalledWith(
        RequestMethod.POST,
        'projects/{project_id}/sessions/search',
        {
          log_stream_id: 'test-log-stream-id',
          experiment_id: 'test-experiment-id',
          limit: 100,
          starting_token: 0
        },
        { project_id: 'test-project-id' }
      );
    });
  });

  describe('ingestTraces', () => {
    it('should have ingestTraces method', () => {
      expect(typeof traceService.ingestTraces).toBe('function');
    });

    it('should ingest traces with session ID', async () => {
      const mockMakeRequest: MockMakeRequest = jest.fn().mockResolvedValue(undefined);
      (traceService as unknown as { makeRequest: MockMakeRequest }).makeRequest = mockMakeRequest;

      const mockTraces = [
        new Trace({
          input: 'test input',
          output: 'test output'
        })
      ];

      await traceService.ingestTraces(mockTraces);

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

      const mockMakeRequest: MockMakeRequest = jest.fn().mockResolvedValue(undefined);
      (traceServiceWithoutExperiment as unknown as { makeRequest: MockMakeRequest }).makeRequest = mockMakeRequest;

      const mockTraces = [new Trace({ input: 'test input' })];
      await traceServiceWithoutExperiment.ingestTraces(mockTraces);

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
});