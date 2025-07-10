import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { getMetrics } from '../../src';
import { MetricSearchResponse } from '../../src/types';
import { commonHandlers, TEST_HOST } from '../common';

const EXAMPLE_METRIC_SEARCH_RESPONSE: MetricSearchResponse = {
  group_by_columns: [],
  aggregate_metrics: {
    'metric1': 10,
    'metric2': 20
  },
  bucketed_metrics: {}
};

const MOCK_ERROR_RESPONSE = {
  detail: 'An unexpected error occurred.'
};

const postMetricsSearchHandler = jest.fn().mockImplementation(() => {
  return HttpResponse.json(EXAMPLE_METRIC_SEARCH_RESPONSE);
});

const postMetricsSearchErrorHandler = jest.fn().mockImplementation(() => {
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

describe('utils.getMetrics', () => {
  beforeAll(() => {
    process.env.GALILEO_CONSOLE_URL = TEST_HOST;
    process.env.GALILEO_API_KEY = 'placeholder';
    server.listen();
  });

  afterEach(() => {
    server.resetHandlers();
    postMetricsSearchHandler.mockClear();
    postMetricsSearchErrorHandler.mockClear();
    getProjectByNameHandler.mockClear();
    getLogStreamByNameHandler.mockClear();
    createLogStreamHandler.mockClear();
  });

  afterAll(() => {
    server.close();
  });

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
        postMetricsSearchErrorHandler
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
    expect(postMetricsSearchErrorHandler).toHaveBeenCalledTimes(1);
  });
});