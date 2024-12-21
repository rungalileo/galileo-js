import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { getDatasets, createDataset } from '../../src';
import { commonHandlers, TEST_HOST } from '../common';
import { Dataset, ListDatasetResponse } from '../../src/api-client';

const EXAMPLE_DATASET: Dataset = {
  id: 'c7b3d8e0-5e0b-4b0f-8b3a-3b9f4b3d3b3d',
  name: 'My Dataset',
  column_names: ['firstName', 'lastName'],
  project_count: 1,
  created_at: '2021-09-10T00:00:00Z',
  updated_at: '2021-09-10T00:00:00Z',
  num_rows: 1
};

const postDatasetHandler = jest.fn().mockImplementation(() => {
  return HttpResponse.json(EXAMPLE_DATASET);
});

const getDatasetHandler = jest.fn().mockImplementation(() => {
  const response: ListDatasetResponse = {
    datasets: [EXAMPLE_DATASET]
  };
  return HttpResponse.json(response);
});

export const handlers = [
  ...commonHandlers,
  http.post(`${TEST_HOST}/datasets`, postDatasetHandler),
  http.get(`${TEST_HOST}/datasets`, getDatasetHandler)
];

const server = setupServer(...handlers);

beforeAll(() => {
  process.env.GALILEO_CONSOLE_URL = TEST_HOST;
  process.env.GALILEO_API_KEY = 'placeholder';
  server.listen();
});

afterEach(() => server.resetHandlers());

afterAll(() => server.close());

test('create dataset', async () => {
  const dataset = await createDataset({ col1: ['val1', 'val2'] }, 'My Dataset');
  expect(dataset).toEqual(EXAMPLE_DATASET);
  expect(postDatasetHandler).toHaveBeenCalled();
});

test('test get datasets', async () => {
  const datasets = await getDatasets();
  expect(datasets).toEqual([EXAMPLE_DATASET]);
  expect(getDatasetHandler).toHaveBeenCalled();
});
