import { exportRecords } from '../../src/utils/export';
import { GalileoApiClient } from '../../src/api-client';
import {
  LogRecordsExportRequest,
  LogRecordsSortClause,
  LogRecordsTextFilter,
  RootType
} from '../../src/types/export.types';

jest.mock('../../src/api-client');

const mockGalileoApiClient = GalileoApiClient as jest.MockedClass<
  typeof GalileoApiClient
>;

describe('exportRecords', () => {
  beforeEach(() => {
    // Clear all instances and calls to constructor and all methods:
    mockGalileoApiClient.mockClear();
  });

  it('should initialize the client and call exportRecords with the correct parameters', async () => {
    const mockExportRecords = jest.fn().mockResolvedValue([]);
    mockGalileoApiClient.prototype.init = jest.fn().mockResolvedValue(undefined);
    mockGalileoApiClient.prototype.exportRecords = mockExportRecords;

    const projectName = 'test-project';
    const body: LogRecordsExportRequest = {
      export_format: 'jsonl',
      root_type: 'trace'
    };

    await exportRecords(projectName, body);

    expect(mockGalileoApiClient.prototype.init).toHaveBeenCalledWith({
      projectName
    });
    expect(mockExportRecords).toHaveBeenCalledWith(body);
  });

  it('should correctly parse a JSONL response', async () => {
    mockGalileoApiClient.prototype.init = jest.fn().mockResolvedValue(undefined);
    mockGalileoApiClient.prototype.exportRecords = jest
      .fn()
      .mockResolvedValue([
        { a: 1, b: 2 },
        { a: 3, b: 4 },
        { a: 5, b: 6 }
      ]);

    const projectName = 'test-project';
    const body: LogRecordsExportRequest = {
      export_format: 'jsonl',
      root_type: 'trace'
    };

    const result = await exportRecords(projectName, body);

    expect(result).toEqual([
      { a: 1, b: 2 },
      { a: 3, b: 4 },
      { a: 5, b: 6 }
    ]);
  });

  it('should correctly parse a CSV response', async () => {
    mockGalileoApiClient.prototype.init = jest.fn().mockResolvedValue(undefined);
    mockGalileoApiClient.prototype.exportRecords = jest
      .fn()
      .mockResolvedValue([
        { a: '1', b: '2' },
        { a: '3', b: '4' },
        { a: '5', b: '6' }
      ]);

    const projectName = 'test-project';
    const body: LogRecordsExportRequest = {
      export_format: 'csv',
      root_type: 'trace'
    };

    const result = await exportRecords(projectName, body);

    expect(result).toEqual([
      { a: '1', b: '2' },
      { a: '3', b: '4' },
      { a: '5', b: '6' }
    ]);
  });

  it('should handle column_ids and sort', async () => {
    const mockExportRecords = jest.fn().mockResolvedValue([]);
    mockGalileoApiClient.prototype.init = jest.fn().mockResolvedValue(undefined);
    mockGalileoApiClient.prototype.exportRecords = mockExportRecords;

    const projectName = 'test-project';
    const column_ids = ['id', 'input', 'output'];
    const sort: LogRecordsSortClause = { column_id: 'created_at', ascending: true };
    const body: LogRecordsExportRequest = {
      root_type: 'trace',
      column_ids,
      sort
    };

    await exportRecords(projectName, body);

    expect(mockExportRecords).toHaveBeenCalledWith(
      expect.objectContaining({
        column_ids,
        sort
      })
    );
  });

  it('should handle log_stream_id', async () => {
    const mockExportRecords = jest.fn().mockResolvedValue([]);
    mockGalileoApiClient.prototype.init = jest.fn().mockResolvedValue(undefined);
    mockGalileoApiClient.prototype.exportRecords = mockExportRecords;

    const projectName = 'test-project';
    const log_stream_id = 'test-log-stream-id';
    const body: LogRecordsExportRequest = {
      root_type: 'trace',
      log_stream_id
    };

    await exportRecords(projectName, body);

    expect(mockExportRecords).toHaveBeenCalledWith(
      expect.objectContaining({
        log_stream_id
      })
    );
  });

  it('should handle filters', async () => {
    const mockExportRecords = jest.fn().mockResolvedValue([]);
    mockGalileoApiClient.prototype.init = jest.fn().mockResolvedValue(undefined);
    mockGalileoApiClient.prototype.exportRecords = mockExportRecords;

    const projectName = 'test-project';
    const filters: LogRecordsTextFilter[] = [
      { column_id: 'input', value: 'test', operator: 'eq', type: 'text' }
    ];
    const body: LogRecordsExportRequest = {
      root_type: 'trace',
      filters
    };

    await exportRecords(projectName, body);

    expect(mockExportRecords).toHaveBeenCalledWith(
      expect.objectContaining({
        filters
      })
    );
  });

  it('should throw an error on API failure', async () => {
    const errorMessage = 'Bad Request';
    mockGalileoApiClient.prototype.init = jest.fn().mockResolvedValue(undefined);
    mockGalileoApiClient.prototype.exportRecords = jest
      .fn()
      .mockRejectedValue(new Error(errorMessage));

    const projectName = 'test-project';
    const body: LogRecordsExportRequest = {
      root_type: 'trace'
    };

    await expect(exportRecords(projectName, body)).rejects.toThrow(errorMessage);
  });

  it.each([['trace'], ['span'], ['session']])(
    'should handle root_type %s',
    async (root_type) => {
      const mockExportRecords = jest.fn().mockResolvedValue([]);
      mockGalileoApiClient.prototype.init = jest
        .fn()
        .mockResolvedValue(undefined);
      mockGalileoApiClient.prototype.exportRecords = mockExportRecords;

      const projectName = 'test-project';
      const body: LogRecordsExportRequest = {
        root_type: root_type as RootType
      };

      await exportRecords(projectName, body);

      expect(mockExportRecords).toHaveBeenCalledWith(
        expect.objectContaining({
          root_type
        })
      );
    }
  );

  it('should handle an empty response', async () => {
    mockGalileoApiClient.prototype.init = jest.fn().mockResolvedValue(undefined);
    mockGalileoApiClient.prototype.exportRecords = jest.fn().mockResolvedValue([]);

    const projectName = 'test-project';
    const body: LogRecordsExportRequest = {
      root_type: 'trace'
    };

    const result = await exportRecords(projectName, body);

    expect(result).toEqual([]);
  });
});