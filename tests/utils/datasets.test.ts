import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { getDatasets } from '../../src';
import { commonHandlers, TEST_HOST } from '../common';
import { ListDatasetResponse } from '../../src/api-client';

const EXAMPLE_DATASET = {
  id: 'c7b3d8e0-5e0b-4b0f-8b3a-3b9f4b3d3b3d',
  name: 'My Dataset',
  column_names: ['firstName', 'lastName'],
  project_count: 1,
  created_at: '2021-09-10T00:00:00Z',
  updated_at: '2021-09-10T00:00:00Z',
  num_rows: 1
};

export const handlers = [
  ...commonHandlers,
  http.get(`${TEST_HOST}/datasets`, () => {
    const response: ListDatasetResponse = {
      datasets: [EXAMPLE_DATASET]
    };
    return HttpResponse.json(response);
  })
];

const server = setupServer(...handlers);

beforeAll(() => {
  process.env.GALILEO_CONSOLE_URL = TEST_HOST;
  process.env.GALILEO_API_KEY = 'placeholder';
  server.listen();
});

afterEach(() => server.resetHandlers());

afterAll(() => server.close());

test('test get datasets', async () => {
  const datasets = await getDatasets();
  expect(datasets).toEqual([EXAMPLE_DATASET]);
});
