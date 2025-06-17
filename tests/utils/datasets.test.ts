import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import {
  getDatasets,
  createDataset,
  getDatasetContent,
  deleteDataset
} from '../../src';
import { commonHandlers, TEST_HOST } from '../common';
import { Dataset, DatasetContent, DatasetRow } from '../../src/api-client';
import { DatasetType } from '../../src/utils/datasets';

const EXAMPLE_DATASET: Dataset = {
  id: 'c7b3d8e0-5e0b-4b0f-8b3a-3b9f4b3d3b3d',
  name: 'My Dataset',
  column_names: ['firstName', 'lastName'],
  project_count: 1,
  created_at: '2021-09-10T00:00:00Z',
  updated_at: '2021-09-10T00:00:00Z',
  num_rows: 1,
  created_by_user: null,
  current_version_index: 1,
  draft: false
};

const EXAMPLE_DATASET_ROW: DatasetRow = {
  index: 0,
  row_id: 'ae4dcadf-a0a2-475e-91e4-7bd03fdf5de8',
  values: ['John', 'Doe'],
  values_dict: { firstName: 'John', lastName: 'Doe' },
  metadata: null
};

const postDatasetsHandler = jest.fn().mockImplementation(() => {
  return HttpResponse.json(EXAMPLE_DATASET);
});

const getDatasetsHandler = jest.fn().mockImplementation(() => {
  return HttpResponse.json({ datasets: [EXAMPLE_DATASET] });
});

const getDatasetContentHandler = jest.fn().mockImplementation(() => {
  const response: DatasetContent = {
    rows: [EXAMPLE_DATASET_ROW]
  };
  return HttpResponse.json(response);
});

const deleteDatasetHandler = jest.fn().mockImplementation(() => {
  return HttpResponse.json({ success: true });
});

const getDatasetByNameHandler = jest.fn().mockImplementation(() => {
  return HttpResponse.json({ datasets: [EXAMPLE_DATASET] });
});

export const handlers = [
  ...commonHandlers,
  http.post(`${TEST_HOST}/datasets`, postDatasetsHandler),
  http.get(`${TEST_HOST}/datasets`, getDatasetsHandler),
  http.get(
    `${TEST_HOST}/datasets/${EXAMPLE_DATASET.id}/content`,
    getDatasetContentHandler
  ),
  http.delete(
    `${TEST_HOST}/datasets/${EXAMPLE_DATASET.id}`,
    deleteDatasetHandler
  ),
  http.post(`${TEST_HOST}/datasets/query`, getDatasetByNameHandler)
];

const server = setupServer(...handlers);

beforeAll(() => {
  process.env.GALILEO_CONSOLE_URL = TEST_HOST;
  process.env.GALILEO_API_KEY = 'placeholder';
  server.listen();
});

afterEach(() => server.resetHandlers());

afterAll(() => server.close());

const createDatasetCases: DatasetType[] = [
  { col1: ['val1', 'val2'] }, // column with strings
  { input: [{ col1: 'val1', col2: 'val2' }] }, // column with objects
  [{ col1: 'val1', col2: 'val2' }], // rows with strings
  [{ col1: { key1: 'val1' }, col2: { key2: 'val2' } }] // rows with objects
];

test.each(createDatasetCases)('create dataset with data: %j', async (data) => {
  const dataset = await createDataset(data, 'My Dataset');
  expect(dataset).toEqual(EXAMPLE_DATASET);
  expect(postDatasetsHandler).toHaveBeenCalled();
});

test('test get datasets', async () => {
  const datasets = await getDatasets();
  expect(datasets).toEqual([EXAMPLE_DATASET]);
  expect(getDatasetsHandler).toHaveBeenCalled();
});

test('test get dataset content', async () => {
  const rows = await getDatasetContent({ datasetId: EXAMPLE_DATASET.id });
  expect(rows).toEqual([EXAMPLE_DATASET_ROW]);
});

test('delete dataset by id', async () => {
  await deleteDataset({ id: EXAMPLE_DATASET.id });
  expect(deleteDatasetHandler).toHaveBeenCalled();
});

test('delete dataset by name', async () => {
  await deleteDataset({ name: EXAMPLE_DATASET.name });
  expect(getDatasetByNameHandler).toHaveBeenCalled();
  expect(deleteDatasetHandler).toHaveBeenCalled();
});
