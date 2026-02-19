import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import {
  addRowsToDataset,
  createDataset,
  createDatasetRecord,
  deleteDataset,
  deserializeInputFromString,
  extendDataset,
  getDatasetContent,
  getDatasets,
  getDatasetMetadata,
  getDataset,
  getDatasetVersionHistory,
  getDatasetVersion,
  listDatasetProjects,
  getRecordsForDataset,
  getDatasetRecordsFromArray,
  convertDatasetRowToRecord
} from '../../src';
import { commonHandlers, TEST_HOST } from '../common';
import {
  DatasetDBType,
  DatasetContent,
  DatasetRow,
  DatasetType
} from '../../src/types/dataset.types';
import { RunExperimentParams } from '../../src/utils/experiments';

const EXAMPLE_DATASET: DatasetDBType = {
  id: 'c7b3d8e0-5e0b-4b0f-8b3a-3b9f4b3d3b3d',
  name: 'My Dataset',
  columnNames: ['firstName', 'lastName'],
  projectCount: 1,
  createdAt: '2021-09-10T00:00:00Z',
  updatedAt: '2021-09-10T00:00:00Z',
  numRows: 1,
  createdByUser: { id: '', email: '' },
  currentVersionIndex: 1,
  draft: false
};

const EXAMPLE_DATASET_ROW: DatasetRow = {
  index: 0,
  rowId: 'ae4dcadf-a0a2-475e-91e4-7bd03fdf5de8',
  values: ['John', 'Doe'],
  valuesDict: { firstName: 'John', lastName: 'Doe' },
  metadata: null
};

const EXTENDED_DATASET_ID = 'a8b3d8e0-5e0b-4b0f-8b3a-3b9f4b3d3b3a';

const EXTENDED_DATASET_ROW: DatasetRow = {
  index: 0,
  rowId: 'be4dcadf-a0a2-475e-91e4-7bd03fdf5de8',
  values: ['Extended', 'Row'],
  valuesDict: { col1: 'Extended', col2: 'Row' },
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

const listDatasetProjectsHandler = jest.fn().mockImplementation(() => {
  return HttpResponse.json({
    projects: [{ id: 'proj-123', name: 'test-project' }]
  });
});

const addRowsToDatasetHandler = jest.fn().mockImplementation(() => {
  return new HttpResponse(null, { status: 204 });
});

const extendDatasetHandler = jest.fn().mockImplementation(() => {
  return HttpResponse.json({ dataset_id: EXTENDED_DATASET_ID });
});

const getExtendedDatasetContentHandler = jest.fn().mockImplementation(() => {
  const response: DatasetContent = {
    rows: [EXTENDED_DATASET_ROW]
  };

  return HttpResponse.json(response);
});

let extendStatusCallCount = 0;
const getExtendDatasetStatusHandler = jest.fn().mockImplementation(() => {
  extendStatusCallCount++;
  // First call: incomplete (0/2), subsequent calls: complete (2/2)
  const jobProgress = {
    steps_completed: extendStatusCallCount === 1 ? 0 : 2,
    steps_total: 2,
    progress_message: extendStatusCallCount === 1 ? 'Processing...' : 'Complete'
  };
  return HttpResponse.json(jobProgress);
});

const EXAMPLE_VERSION_HISTORY = {
  versions: [
    { versionIndex: 0, createdAt: '2021-09-10T00:00:00Z', numRows: 1 },
    { versionIndex: 1, createdAt: '2021-09-11T00:00:00Z', numRows: 2 }
  ]
};

const EXAMPLE_VERSION_CONTENT: DatasetContent = {
  rows: [EXAMPLE_DATASET_ROW]
};

const getDatasetVersionHistoryHandler = jest.fn().mockImplementation(() => {
  return HttpResponse.json(EXAMPLE_VERSION_HISTORY);
});

const getDatasetVersionContentHandler = jest.fn().mockImplementation(() => {
  return HttpResponse.json(EXAMPLE_VERSION_CONTENT);
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
  http.get(`${TEST_HOST}/datasets/${EXAMPLE_DATASET.id}`, getDatasetHandler),
  http.get(
    `${TEST_HOST}/datasets/${EXAMPLE_DATASET.id}/projects`,
    listDatasetProjectsHandler
  ),
  http.post(`${TEST_HOST}/datasets/extend`, extendDatasetHandler),
  http.get(
    `${TEST_HOST}/datasets/extend/${EXTENDED_DATASET_ID}`,
    getExtendDatasetStatusHandler
  ),
  http.get(
    `${TEST_HOST}/datasets/${EXTENDED_DATASET_ID}/content`,
    getExtendedDatasetContentHandler
  ),
  http.post(
    `${TEST_HOST}/datasets/${EXAMPLE_DATASET.id}/versions/query`,
    getDatasetVersionHistoryHandler
  ),
  http.get(
    `${TEST_HOST}/datasets/${EXAMPLE_DATASET.id}/versions/0/content`,
    getDatasetVersionContentHandler
  )
];

const server = setupServer(...handlers);

beforeAll(() => {
  process.env.GALILEO_CONSOLE_URL = TEST_HOST;
  process.env.GALILEO_API_KEY = 'placeholder';
  server.listen();
  jest.useFakeTimers();
});

afterEach(() => {
  server.resetHandlers();
  jest.clearAllTimers();
  extendStatusCallCount = 0;
});

afterAll(() => {
  server.close();
  jest.useRealTimers();
});

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

  describe('getDatasetMetadata', () => {
    const projectName = 'test-project';

    it('should load a dataset by object', async () => {
      const params = {
        dataset: EXAMPLE_DATASET
      } as RunExperimentParams<Record<string, unknown>>;
      const result = await getDatasetMetadata(params, projectName);
      expect(result).toEqual(EXAMPLE_DATASET);
    });

    it('should load a dataset by id', async () => {
      const params = {
        datasetId: EXAMPLE_DATASET.id
      } as RunExperimentParams<Record<string, unknown>>;
      await getDatasetMetadata(params, projectName);
      expect(getDatasetHandler).toHaveBeenCalled();
    });

    it('should load a dataset by name', async () => {
      const params = {
        datasetName: EXAMPLE_DATASET.name
      } as RunExperimentParams<Record<string, unknown>>;
      await getDatasetMetadata(params, projectName);
      expect(getDatasetByNameHandler).toHaveBeenCalled();
    });
  });
});

test('extend dataset', async () => {
  const extendPromise = extendDataset({
    promptSettings: {
      modelAlias: 'GPT-4o mini',
      responseFormat: { type: 'json_object' }
    },
    prompt:
      'Financial planning assistant that helps clients design an investment strategy.',
    instructions:
      'You are a financial planning assistant that helps clients design an investment strategy.',
    examples: ['I want to invest $1000 per month.'],
    dataTypes: ['Prompt Injection'],
    count: 3
  });

  // The loop runs twice before completing
  await jest.advanceTimersByTimeAsync(1000);
  await jest.advanceTimersByTimeAsync(1000);

  const result = await extendPromise;

  expect(result).toEqual([EXTENDED_DATASET_ROW]);
  expect(extendDatasetHandler).toHaveBeenCalled();
  expect(getExtendedDatasetContentHandler).toHaveBeenCalled();
});

// ============================================================================
// New Feature Tests
// ============================================================================

describe('getDataset', () => {
  it('should get a dataset by id', async () => {
    const dataset = await getDataset({ id: EXAMPLE_DATASET.id });
    expect(dataset).toEqual(EXAMPLE_DATASET);
    expect(getDatasetHandler).toHaveBeenCalled();
  });

  it('should get a dataset by name', async () => {
    const dataset = await getDataset({ name: EXAMPLE_DATASET.name });
    expect(dataset).toEqual(EXAMPLE_DATASET);
    expect(getDatasetByNameHandler).toHaveBeenCalled();
  });
});

describe('getDatasetVersionHistory', () => {
  it('should get version history by dataset id', async () => {
    const history = await getDatasetVersionHistory({
      datasetId: EXAMPLE_DATASET.id
    });
    expect(history).toEqual(EXAMPLE_VERSION_HISTORY);
    expect(getDatasetVersionHistoryHandler).toHaveBeenCalled();
  });

  it('should get version history by dataset name', async () => {
    const history = await getDatasetVersionHistory({
      datasetName: EXAMPLE_DATASET.name
    });
    expect(history).toEqual(EXAMPLE_VERSION_HISTORY);
    expect(getDatasetByNameHandler).toHaveBeenCalled();
    expect(getDatasetVersionHistoryHandler).toHaveBeenCalled();
  });
});

describe('getDatasetVersion', () => {
  it('should get a specific version by dataset id', async () => {
    const content = await getDatasetVersion({
      versionIndex: 0,
      datasetId: EXAMPLE_DATASET.id
    });
    expect(content).toEqual(EXAMPLE_VERSION_CONTENT);
    expect(getDatasetVersionContentHandler).toHaveBeenCalled();
  });

  it('should get a specific version by dataset name', async () => {
    const content = await getDatasetVersion({
      versionIndex: 0,
      datasetName: EXAMPLE_DATASET.name
    });
    expect(content).toEqual(EXAMPLE_VERSION_CONTENT);
    expect(getDatasetByNameHandler).toHaveBeenCalled();
    expect(getDatasetVersionContentHandler).toHaveBeenCalled();
  });
});

describe('listDatasetProjects', () => {
  it('should list projects by dataset id', async () => {
    const projects = await listDatasetProjects({
      datasetId: EXAMPLE_DATASET.id
    });
    expect(projects).toEqual([{ id: 'proj-123', name: 'test-project' }]);
    expect(listDatasetProjectsHandler).toHaveBeenCalled();
  });

  it('should list projects by dataset name', async () => {
    const projects = await listDatasetProjects({
      datasetName: EXAMPLE_DATASET.name
    });
    expect(projects).toEqual([{ id: 'proj-123', name: 'test-project' }]);
    expect(getDatasetByNameHandler).toHaveBeenCalled();
    expect(listDatasetProjectsHandler).toHaveBeenCalled();
  });
});

describe('convertDatasetRowToRecord', () => {
  it('should convert a dataset row to a record', () => {
    const row: DatasetRow = {
      index: 0,
      rowId: 'row-123',
      values: ['input-value', 'output-value'],
      valuesDict: {
        input: 'input-value',
        output: 'output-value',
        metadata: '{"key":"value"}'
      },
      metadata: null
    };
    const record = convertDatasetRowToRecord(row);
    expect(record).toEqual({
      id: 'row-123',
      input: 'input-value',
      output: 'output-value',
      metadata: { key: 'value' }
    });
  });

  it('should throw error if row has no input field', () => {
    const row: DatasetRow = {
      index: 0,
      rowId: 'row-123',
      values: ['value'],
      valuesDict: { output: 'value' },
      metadata: null
    };
    expect(() => convertDatasetRowToRecord(row)).toThrow(
      'DatasetRow must have an input field'
    );
  });

  it('should handle row with only input field', () => {
    const row: DatasetRow = {
      index: 0,
      rowId: 'row-456',
      values: ['only-input'],
      valuesDict: { input: 'only-input' },
      metadata: null
    };
    const record = convertDatasetRowToRecord(row);
    expect(record).toEqual({
      id: 'row-456',
      input: 'only-input',
      output: undefined,
      metadata: undefined
    });
  });
});

describe('getRecordsForDataset', () => {
  it('should get records by dataset id', async () => {
    // Need a dataset row with input field for this to work
    const inputRow: DatasetRow = {
      index: 0,
      rowId: 'ae4dcadf-a0a2-475e-91e4-7bd03fdf5de8',
      values: ['test-input'],
      valuesDict: { input: 'test-input' },
      metadata: null
    };

    // Override the handler for this test
    server.use(
      http.get(`${TEST_HOST}/datasets/${EXAMPLE_DATASET.id}/content`, () =>
        HttpResponse.json({ rows: [inputRow] })
      )
    );

    const records = await getRecordsForDataset({
      datasetId: EXAMPLE_DATASET.id
    });
    expect(records).toEqual([
      {
        id: 'ae4dcadf-a0a2-475e-91e4-7bd03fdf5de8',
        input: 'test-input',
        output: undefined,
        metadata: undefined
      }
    ]);
  });
});

describe('getDatasetRecordsFromArray', () => {
  it('should convert an array of raw records to dataset records', () => {
    const rawRecords = [
      { input: 'input1', output: 'output1' },
      { input: 'input2', output: 'output2', metadata: { key: 'value' } }
    ];
    const records = getDatasetRecordsFromArray(rawRecords);
    expect(records).toEqual([
      {
        id: undefined,
        input: 'input1',
        output: 'output1',
        metadata: undefined
      },
      {
        id: undefined,
        input: 'input2',
        output: 'output2',
        metadata: { key: 'value' }
      }
    ]);
  });

  it('should handle empty array', () => {
    const records = getDatasetRecordsFromArray([]);
    expect(records).toEqual([]);
  });

  it('should handle records with object input/output', () => {
    const rawRecords = [
      { input: { nested: 'value' }, output: { result: 'data' } }
    ];
    const records = getDatasetRecordsFromArray(rawRecords);
    expect(records).toEqual([
      {
        id: undefined,
        input: '{"nested":"value"}',
        output: '{"result":"data"}',
        metadata: undefined
      }
    ]);
  });
});
