import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import {
  getMetrics,
  getTraces,
  getSpans,
  getSessions
} from '../../src';
import {
  MetricSearchResponse,
  LogRecordsQueryResponse
} from '../../src/types';
import { commonHandlers, TEST_HOST } from '../common';

const EXAMPLE_METRIC_SEARCH_RESPONSE: MetricSearchResponse = {
  group_by_columns: [],
  aggregate_metrics: {
    'metric1': 10,
    'metric2': 20
  },
  bucketed_metrics: {}
};

const EXAMPLE_LOG_RECORDS_QUERY_RESPONSE: LogRecordsQueryResponse = {
  records: []
};

const MOCK_ERROR_RESPONSE = {
  detail: 'An unexpected error occurred.'
};

const postMetricsSearchHandler = jest.fn().mockImplementation(() => {
  return HttpResponse.json(EXAMPLE_METRIC_SEARCH_RESPONSE);
});

const postTracesSearchHandler = jest.fn().mockImplementation(() => {
  return HttpResponse.json(EXAMPLE_LOG_RECORDS_QUERY_RESPONSE);
});

const postSpansSearchHandler = jest.fn().mockImplementation(() => {
  return HttpResponse.json(EXAMPLE_LOG_RECORDS_QUERY_RESPONSE);
});

const postSessionsSearchHandler = jest.fn().mockImplementation(() => {
  return HttpResponse.json(EXAMPLE_LOG_RECORDS_QUERY_RESPONSE);
});

const postSearchErrorHandler = jest.fn().mockImplementation(() => {
  return HttpResponse.json(MOCK_ERROR_RESPONSE, { status: 500 });
});

const getProjectByNameHandler = jest.fn().mockImplementation(() => {
  return HttpResponse.json([
    {
      id: 'test-project-id',
      name: 'test-project'
    }
  ]);
});

const getLogStreamByNameHandler = jest.fn().mockImplementation(() => {
  return HttpResponse.json([]);
});

const createLogStreamHandler = jest.fn().mockImplementation(() => {
  return HttpResponse.json({
    id: 'test-log-stream-id',
    name: 'default'
  });
});

export const handlers = [
  ...commonHandlers,
  http.post(
    `${TEST_HOST}/projects/test-project-id/metrics/search`,
    postMetricsSearchHandler
  ),
  http.post(
    `${TEST_HOST}/projects/test-project-id/traces/search`,
    postTracesSearchHandler
  ),
  http.post(
    `${TEST_HOST}/projects/test-project-id/spans/search`,
    postSpansSearchHandler
  ),
  http.post(
    `${TEST_HOST}/projects/test-project-id/sessions/search`,
    postSessionsSearchHandler
  ),
  http.get(`${TEST_HOST}/projects`, getProjectByNameHandler),
  http.get(
    `${TEST_HOST}/projects/test-project-id/log_streams`,
    getLogStreamByNameHandler
  ),
  http.post(
    `${TEST_HOST}/projects/test-project-id/log_streams`,
    createLogStreamHandler
  )
];

const server = setupServer(...handlers);

describe('utils.search', () => {
  beforeAll(() => {
    process.env.GALILEO_CONSOLE_URL = TEST_HOST;
    process.env.GALILEO_API_KEY = 'placeholder';
    server.listen();
  });

  afterEach(() => {
    server.resetHandlers();
    postMetricsSearchHandler.mockClear();
    postTracesSearchHandler.mockClear();
    postSpansSearchHandler.mockClear();
    postSessionsSearchHandler.mockClear();
    postSearchErrorHandler.mockClear();
    getProjectByNameHandler.mockClear();
    getLogStreamByNameHandler.mockClear();
    createLogStreamHandler.mockClear();
  });

  afterAll(() => {
    server.close();
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
      expect(postMetricsSearchHandler).toHaveBeenCalledTimes(1);
    });

    it('should handle API errors gracefully', async () => {
      server.use(
        http.post(
          `${TEST_HOST}/projects/test-project-id/metrics/search`,
          postSearchErrorHandler
        )
      );

      await expect(
        getMetrics(
          {
            start_time: '2021-09-10T00:00:00Z',
            end_time: '2021-09-11T00:00:00Z'
          },
          'test-project'
        )
      ).rejects.toThrow();
      expect(postSearchErrorHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('getTraces', () => {
    it('should call the traces/search endpoint and return the response', async () => {
      const response = await getTraces({}, 'test-project');
      expect(response).toEqual(EXAMPLE_LOG_RECORDS_QUERY_RESPONSE);
      expect(postTracesSearchHandler).toHaveBeenCalledTimes(1);
    });

    it('should handle API errors gracefully', async () => {
      server.use(
        http.post(
          `${TEST_HOST}/projects/test-project-id/traces/search`,
          postSearchErrorHandler
        )
      );

      await expect(getTraces({}, 'test-project')).rejects.toThrow();
      expect(postSearchErrorHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('getSpans', () => {
    it('should call the spans/search endpoint and return the response', async () => {
      const response = await getSpans({}, 'test-project');
      expect(response).toEqual(EXAMPLE_LOG_RECORDS_QUERY_RESPONSE);
      expect(postSpansSearchHandler).toHaveBeenCalledTimes(1);
    });

    it('should handle API errors gracefully', async () => {
      server.use(
        http.post(
          `${TEST_HOST}/projects/test-project-id/spans/search`,
          postSearchErrorHandler
        )
      );

      await expect(getSpans({}, 'test-project')).rejects.toThrow();
      expect(postSearchErrorHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('getSessions', () => {
    it('should call the sessions/search endpoint and return the response', async () => {
      const response = await getSessions({}, 'test-project');
      expect(response).toEqual(EXAMPLE_LOG_RECORDS_QUERY_RESPONSE);
      expect(postSessionsSearchHandler).toHaveBeenCalledTimes(1);
    });

    it('should handle API errors gracefully', async () => {
      server.use(
        http.post(
          `${TEST_HOST}/projects/test-project-id/sessions/search`,
          postSearchErrorHandler
        )
      );

      await expect(getSessions({}, 'test-project')).rejects.toThrow();
      expect(postSearchErrorHandler).toHaveBeenCalledTimes(1);
    });
  });
});