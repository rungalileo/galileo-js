import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import {
  addRowsToDataset,
  createDataset,
  createDatasetRecord,
  deleteDataset,
  deserializeInputFromString,
  getDatasetContent,
  getDatasets,
  loadDataset
} from '../../src';
import { commonHandlers, TEST_HOST } from '../common';
import { Dataset, DatasetContent, DatasetRow } from '../../src/api-client';
import { DatasetType } from '../../src/utils/datasets';
import { RunExperimentParams } from '../../src/utils/experiments';

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

  return HttpResponse.json(response, {
    status: 200,
    headers: {
      etag: 'abc123'
    }
  });
});

const deleteDatasetHandler = jest.fn().mockImplementation(() => {
  return HttpResponse.json({ success: true });
});

const getDatasetByNameHandler = jest.fn().mockImplementation(() => {
  return HttpResponse.json({ datasets: [EXAMPLE_DATASET] });
});

const getDatasetHandler = jest.fn().mockImplementation(() => {
  return HttpResponse.json(EXAMPLE_DATASET);
});

const addRowsToDatasetHandler = jest.fn().mockImplementation(() => {
  return new HttpResponse(null, { status: 204 });
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
  http.post(`${TEST_HOST}/datasets/query`, getDatasetByNameHandler),
  http.patch(
    `${TEST_HOST}/datasets/${EXAMPLE_DATASET.id}/content`,
    addRowsToDatasetHandler
  ),
  http.get(`${TEST_HOST}/datasets/${EXAMPLE_DATASET.id}`, getDatasetHandler)
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

describe('datasets utils', () => {
  test.each(createDatasetCases)(
    'create dataset with data: %j',
    async (data) => {
      const dataset = await createDataset(data, 'My Dataset');
      expect(dataset).toEqual(EXAMPLE_DATASET);
      expect(postDatasetsHandler).toHaveBeenCalled();
    }
  );

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

  test('add rows to dataset', async () => {
    await addRowsToDataset({
      datasetId: EXAMPLE_DATASET.id,
      rows: [{ col1: 'val1', col2: 'val2' }]
    });
    expect(addRowsToDatasetHandler).toHaveBeenCalled();
  });

  describe('createDatasetRecord', () => {
    it('should create a record with string input/output', () => {
      const record = createDatasetRecord({
        id: '1',
        input: 'input text',
        output: 'output text'
      });
      expect(record).toEqual({
        id: '1',
        input: 'input text',
        output: 'output text',
        metadata: undefined
      });
    });

    it('should create a record with object input/output', () => {
      const record = createDatasetRecord({
        id: '1',
        input: { key: 'value' },
        output: { key: 'value' }
      });
      expect(record).toEqual({
        id: '1',
        input: '{"key":"value"}',
        output: '{"key":"value"}',
        metadata: undefined
      });
    });

    it('should handle undefined output', () => {
      const record = createDatasetRecord({
        id: '1',
        input: 'input text'
      });
      expect(record).toEqual({
        id: '1',
        input: 'input text',
        output: undefined,
        metadata: undefined
      });
    });

    it('should handle metadata as a JSON string', () => {
      const record = createDatasetRecord({
        id: '1',
        input: 'input',
        metadata: '{"meta_key":"meta_value"}'
      });
      expect(record).toEqual({
        id: '1',
        input: 'input',
        output: undefined,
        metadata: { meta_key: 'meta_value' }
      });
    });

    it('should handle metadata as an object', () => {
      const record = createDatasetRecord({
        id: '1',
        input: 'input',
        metadata: { meta_key: 'meta_value' }
      });
      expect(record).toEqual({
        id: '1',
        input: 'input',
        output: undefined,
        metadata: { meta_key: 'meta_value' }
      });
    });

    it('should handle metadata as a non-JSON string', () => {
      const record = createDatasetRecord({
        id: '1',
        input: 'input',
        metadata: 'plain string'
      });
      expect(record).toEqual({
        id: '1',
        input: 'input',
        output: undefined,
        metadata: { metadata: 'plain string' }
      });
    });

    it('should handle null metadata', () => {
      const record = createDatasetRecord({
        id: '1',
        input: 'input',
        metadata: null
      });
      expect(record).toEqual({
        id: '1',
        input: 'input',
        output: undefined,
        metadata: undefined
      });
    });

    it('should throw an error for metadata with non-string values', () => {
      expect(() => {
        createDatasetRecord({
          id: '1',
          input: 'input',
          metadata: { key: 123 }
        });
      }).toThrow('Dataset metadata values must be strings');
    });

    it('should throw an error for invalid metadata type', () => {
      expect(() => {
        createDatasetRecord({
          id: '1',
          input: 'input',
          metadata: 12345
        });
      }).toThrow('Dataset metadata must be a string or object');
    });
  });

  describe('deserializeInputFromString', () => {
    it('should deserialize a JSON string', () => {
      const result = deserializeInputFromString('{"key":"value"}');
      expect(result).toEqual({ key: 'value' });
    });

    it('should handle a non-JSON string', () => {
      const result = deserializeInputFromString('plain string');
      expect(result).toEqual({ value: 'plain string' });
    });
  });

  describe('loadDataset', () => {
    const projectName = 'test-project';

    it('should load a dataset by object', async () => {
      const params = {
        dataset: EXAMPLE_DATASET
      } as RunExperimentParams<Record<string, unknown>>;
      const result = await loadDataset(params, projectName);
      expect(result).toEqual(EXAMPLE_DATASET);
    });

    it('should load a dataset by id', async () => {
      const params = {
        datasetId: EXAMPLE_DATASET.id
      } as RunExperimentParams<Record<string, unknown>>;
      await loadDataset(params, projectName);
      expect(getDatasetHandler).toHaveBeenCalled();
    });

    it('should load a dataset by name', async () => {
      const params = {
        datasetName: EXAMPLE_DATASET.name
      } as RunExperimentParams<Record<string, unknown>>;
      await loadDataset(params, projectName);
      expect(getDatasetByNameHandler).toHaveBeenCalled();
    });
  });
});
