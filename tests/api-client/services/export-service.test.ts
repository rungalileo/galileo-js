import { ExportService } from '../../../src/api-client/services/export-service';
import { RequestMethod } from '../../../src/api-client/base-client';
import { Routes } from '../../../src/types/routes.types';
import { LogRecordsExportRequest } from '../../../src/types/export.types';
import { Readable } from 'stream';

// Create a mock type for the makeStreamingRequest method
type MockMakeStreamingRequest = jest.MockedFunction<
  (
    request_method: RequestMethod,
    endpoint: Routes,
    data?: string | Record<string, unknown> | null,
    params?: Record<string, unknown>,
    extraHeaders?: Record<string, string>
  ) => Promise<Readable>
>;

describe('ExportService', () => {
  let exportService: ExportService;
  const mockProjectId = 'test-project-id';

  beforeEach(() => {
    exportService = new ExportService(
      'https://api.galileo.ai',
      'test-token',
      mockProjectId
    );
  });

  describe('records', () => {
    it('should have records method', () => {
      expect(typeof exportService.records).toBe('function');
    });

    it('should export records with basic parameters', async () => {
      const mockStream = new Readable({
        read() {
          this.push('{"id": "1", "input": "test"}\n');
          this.push(null);
        }
      });

      const mockMakeStreamingRequest: MockMakeStreamingRequest = jest
        .fn()
        .mockResolvedValue(mockStream);

      (
        exportService as unknown as {
          makeStreamingRequest: MockMakeStreamingRequest;
        }
      ).makeStreamingRequest = mockMakeStreamingRequest;

      const result = await exportService.records({
        rootType: 'trace',
        filters: [],
        exportFormat: 'jsonl',
        logStreamId: 'log-stream-123'
      });

      const records: (string | Record<string, unknown>)[] = [];
      for await (const record of result) {
        records.push(record);
      }

      expect(mockMakeStreamingRequest).toHaveBeenCalledWith(
        RequestMethod.POST,
        Routes.exportRecords,
        expect.objectContaining({
          root_type: 'trace',
          log_stream_id: 'log-stream-123',
          export_format: 'jsonl',
          filters: [],
          sort: expect.objectContaining({
            column_id: 'created_at',
            ascending: false
          })
        }),
        { project_id: mockProjectId }
      );

      expect(records.length).toBe(1);
      // JSONL format should return strings
      expect(records[0]).toBe('{"id": "1", "input": "test"}\n');
      expect(typeof records[0]).toBe('string');
    });

    it('should use default values when parameters are not provided', async () => {
      const mockStream = new Readable({
        read() {
          this.push(null);
        }
      });

      const mockMakeStreamingRequest: MockMakeStreamingRequest = jest
        .fn()
        .mockResolvedValue(mockStream);

      (
        exportService as unknown as {
          makeStreamingRequest: MockMakeStreamingRequest;
        }
      ).makeStreamingRequest = mockMakeStreamingRequest;

      await exportService.records(
        {} as Partial<LogRecordsExportRequest> as LogRecordsExportRequest
      );

      expect(mockMakeStreamingRequest).toHaveBeenCalledWith(
        RequestMethod.POST,
        Routes.exportRecords,
        expect.objectContaining({
          root_type: 'trace',
          export_format: 'jsonl',
          sort: expect.objectContaining({
            column_id: 'created_at',
            ascending: false
          })
        }),
        { project_id: mockProjectId }
      );
    });

    describe('filter types', () => {
      it('should convert TextFilter correctly', async () => {
        const mockStream = new Readable({
          read() {
            this.push(null);
          }
        });

        const mockMakeStreamingRequest: MockMakeStreamingRequest = jest
          .fn()
          .mockResolvedValue(mockStream);

        (
          exportService as unknown as {
            makeStreamingRequest: MockMakeStreamingRequest;
          }
        ).makeStreamingRequest = mockMakeStreamingRequest;

        await exportService.records({
          rootType: 'trace',
          filters: [
            {
              columnId: 'input',
              operator: 'contains',
              value: 'test',
              caseSensitive: false,
              type: 'text'
            }
          ],
          exportFormat: 'jsonl',
          logStreamId: 'log-stream-123'
        });

        expect(mockMakeStreamingRequest).toHaveBeenCalledWith(
          RequestMethod.POST,
          Routes.exportRecords,
          expect.objectContaining({
            filters: [
              expect.objectContaining({
                column_id: 'input',
                operator: 'contains',
                value: 'test',
                case_sensitive: false,
                type: 'text'
              })
            ]
          }),
          expect.any(Object)
        );
      });

      it('should convert NumberFilter correctly', async () => {
        const mockStream = new Readable({
          read() {
            this.push(null);
          }
        });

        const mockMakeStreamingRequest: MockMakeStreamingRequest = jest
          .fn()
          .mockResolvedValue(mockStream);

        (
          exportService as unknown as {
            makeStreamingRequest: MockMakeStreamingRequest;
          }
        ).makeStreamingRequest = mockMakeStreamingRequest;

        await exportService.records({
          rootType: 'trace',
          filters: [
            {
              columnId: 'score',
              operator: 'gte',
              value: 0.5,
              type: 'number'
            }
          ],
          exportFormat: 'jsonl',
          logStreamId: 'log-stream-123'
        });

        expect(mockMakeStreamingRequest).toHaveBeenCalledWith(
          RequestMethod.POST,
          Routes.exportRecords,
          expect.objectContaining({
            filters: [
              expect.objectContaining({
                column_id: 'score',
                operator: 'gte',
                value: 0.5,
                type: 'number'
              })
            ]
          }),
          expect.any(Object)
        );
      });

      it('should convert DateFilter correctly', async () => {
        const mockStream = new Readable({
          read() {
            this.push(null);
          }
        });

        const mockMakeStreamingRequest: MockMakeStreamingRequest = jest
          .fn()
          .mockResolvedValue(mockStream);

        (
          exportService as unknown as {
            makeStreamingRequest: MockMakeStreamingRequest;
          }
        ).makeStreamingRequest = mockMakeStreamingRequest;

        const dateValue = new Date('2024-01-01').toISOString();

        await exportService.records({
          rootType: 'trace',
          filters: [
            {
              columnId: 'created_at',
              operator: 'gt',
              value: dateValue,
              type: 'date'
            }
          ],
          exportFormat: 'jsonl',
          logStreamId: 'log-stream-123'
        });

        expect(mockMakeStreamingRequest).toHaveBeenCalledWith(
          RequestMethod.POST,
          Routes.exportRecords,
          expect.objectContaining({
            filters: [
              expect.objectContaining({
                column_id: 'created_at',
                operator: 'gt',
                value: dateValue,
                type: 'date'
              })
            ]
          }),
          expect.any(Object)
        );
      });

      it('should convert BooleanFilter correctly', async () => {
        const mockStream = new Readable({
          read() {
            this.push(null);
          }
        });

        const mockMakeStreamingRequest: MockMakeStreamingRequest = jest
          .fn()
          .mockResolvedValue(mockStream);

        (
          exportService as unknown as {
            makeStreamingRequest: MockMakeStreamingRequest;
          }
        ).makeStreamingRequest = mockMakeStreamingRequest;

        await exportService.records({
          rootType: 'trace',
          filters: [
            {
              columnId: 'is_valid',
              value: true,
              type: 'boolean'
            }
          ],
          exportFormat: 'jsonl',
          logStreamId: 'log-stream-123'
        });

        expect(mockMakeStreamingRequest).toHaveBeenCalledWith(
          RequestMethod.POST,
          Routes.exportRecords,
          expect.objectContaining({
            filters: [
              expect.objectContaining({
                column_id: 'is_valid',
                value: true,
                type: 'boolean'
              })
            ]
          }),
          expect.any(Object)
        );
      });

      it('should convert IDFilter correctly', async () => {
        const mockStream = new Readable({
          read() {
            this.push(null);
          }
        });

        const mockMakeStreamingRequest: MockMakeStreamingRequest = jest
          .fn()
          .mockResolvedValue(mockStream);

        (
          exportService as unknown as {
            makeStreamingRequest: MockMakeStreamingRequest;
          }
        ).makeStreamingRequest = mockMakeStreamingRequest;

        await exportService.records({
          rootType: 'trace',
          filters: [
            {
              columnId: 'trace_id',
              operator: 'eq',
              value: 'some-trace-id',
              type: 'id'
            }
          ],
          exportFormat: 'jsonl',
          logStreamId: 'log-stream-123'
        });

        expect(mockMakeStreamingRequest).toHaveBeenCalledWith(
          RequestMethod.POST,
          Routes.exportRecords,
          expect.objectContaining({
            filters: [
              expect.objectContaining({
                column_id: 'trace_id',
                operator: 'eq',
                value: 'some-trace-id',
                type: 'id'
              })
            ]
          }),
          expect.any(Object)
        );
      });

      it('should handle multiple filters of different types', async () => {
        const mockStream = new Readable({
          read() {
            this.push(null);
          }
        });

        const mockMakeStreamingRequest: MockMakeStreamingRequest = jest
          .fn()
          .mockResolvedValue(mockStream);

        (
          exportService as unknown as {
            makeStreamingRequest: MockMakeStreamingRequest;
          }
        ).makeStreamingRequest = mockMakeStreamingRequest;

        await exportService.records({
          rootType: 'trace',
          filters: [
            {
              columnId: 'input',
              operator: 'contains',
              value: 'test',
              caseSensitive: false,
              type: 'text'
            },
            {
              columnId: 'score',
              operator: 'gte',
              value: 0.5,
              type: 'number'
            },
            {
              columnId: 'is_valid',
              value: true,
              type: 'boolean'
            }
          ],
          exportFormat: 'jsonl',
          logStreamId: 'log-stream-123'
        });

        expect(mockMakeStreamingRequest).toHaveBeenCalledWith(
          RequestMethod.POST,
          Routes.exportRecords,
          expect.objectContaining({
            filters: expect.arrayContaining([
              expect.objectContaining({ type: 'text' }),
              expect.objectContaining({ type: 'number' }),
              expect.objectContaining({ type: 'boolean' })
            ])
          }),
          expect.any(Object)
        );
      });
    });

    describe('sort clause', () => {
      it('should convert sort clause correctly', async () => {
        const mockStream = new Readable({
          read() {
            this.push(null);
          }
        });

        const mockMakeStreamingRequest: MockMakeStreamingRequest = jest
          .fn()
          .mockResolvedValue(mockStream);

        (
          exportService as unknown as {
            makeStreamingRequest: MockMakeStreamingRequest;
          }
        ).makeStreamingRequest = mockMakeStreamingRequest;

        await exportService.records({
          rootType: 'trace',
          sort: {
            columnId: 'created_at',
            ascending: false
          },
          exportFormat: 'jsonl',
          logStreamId: 'log-stream-123'
        });

        expect(mockMakeStreamingRequest).toHaveBeenCalledWith(
          RequestMethod.POST,
          Routes.exportRecords,
          expect.objectContaining({
            sort: {
              column_id: 'created_at',
              ascending: false
            }
          }),
          expect.any(Object)
        );
      });

      it('should use default sort when not provided', async () => {
        const mockStream = new Readable({
          read() {
            this.push(null);
          }
        });

        const mockMakeStreamingRequest: MockMakeStreamingRequest = jest
          .fn()
          .mockResolvedValue(mockStream);

        (
          exportService as unknown as {
            makeStreamingRequest: MockMakeStreamingRequest;
          }
        ).makeStreamingRequest = mockMakeStreamingRequest;

        await exportService.records({
          rootType: 'trace',
          exportFormat: 'jsonl',
          logStreamId: 'log-stream-123'
        });

        expect(mockMakeStreamingRequest).toHaveBeenCalledWith(
          RequestMethod.POST,
          Routes.exportRecords,
          expect.objectContaining({
            sort: {
              column_id: 'created_at',
              ascending: false
            }
          }),
          expect.any(Object)
        );
      });
    });

    describe('metricsTestingId', () => {
      it('should include metricsTestingId in request', async () => {
        const mockStream = new Readable({
          read() {
            this.push(null);
          }
        });

        const mockMakeStreamingRequest: MockMakeStreamingRequest = jest
          .fn()
          .mockResolvedValue(mockStream);

        (
          exportService as unknown as {
            makeStreamingRequest: MockMakeStreamingRequest;
          }
        ).makeStreamingRequest = mockMakeStreamingRequest;

        await exportService.records({
          rootType: 'trace',
          exportFormat: 'jsonl',
          logStreamId: 'log-stream-123',
          metricsTestingId: 'metrics-testing-id-123'
        });

        expect(mockMakeStreamingRequest).toHaveBeenCalledWith(
          RequestMethod.POST,
          Routes.exportRecords,
          expect.objectContaining({
            metrics_testing_id: 'metrics-testing-id-123'
          }),
          expect.any(Object)
        );
      });
    });

    describe('export formats', () => {
      it('should handle JSONL format and return strings', async () => {
        const mockStream = new Readable({
          read() {
            this.push('{"id": "1", "input": "test1"}\n');
            this.push('{"id": "2", "input": "test2"}\n');
            this.push(null);
          }
        });

        const mockMakeStreamingRequest: MockMakeStreamingRequest = jest
          .fn()
          .mockResolvedValue(mockStream);

        (
          exportService as unknown as {
            makeStreamingRequest: MockMakeStreamingRequest;
          }
        ).makeStreamingRequest = mockMakeStreamingRequest;

        const result = await exportService.records({
          rootType: 'trace',
          exportFormat: 'jsonl',
          logStreamId: 'log-stream-123'
        });

        const records: (string | Record<string, unknown>)[] = [];
        for await (const record of result) {
          records.push(record);
        }

        expect(records.length).toBe(2);
        // JSONL format should return strings
        expect(records[0]).toBe('{"id": "1", "input": "test1"}\n');
        expect(records[1]).toBe('{"id": "2", "input": "test2"}\n');
        expect(typeof records[0]).toBe('string');
        expect(typeof records[1]).toBe('string');
      });

      it('should handle JSON format and return parsed objects', async () => {
        const mockStream = new Readable({
          read() {
            this.push('{"id": "1", "input": "test1", "score": 0.95}\n');
            this.push('{"id": "2", "input": "test2", "score": 0.87}\n');
            this.push(null);
          }
        });

        const mockMakeStreamingRequest: MockMakeStreamingRequest = jest
          .fn()
          .mockResolvedValue(mockStream);

        (
          exportService as unknown as {
            makeStreamingRequest: MockMakeStreamingRequest;
          }
        ).makeStreamingRequest = mockMakeStreamingRequest;

        const result = await exportService.records({
          rootType: 'trace',
          exportFormat: 'json',
          logStreamId: 'log-stream-123'
        });

        const records: (string | Record<string, unknown>)[] = [];
        for await (const record of result) {
          records.push(record);
        }

        expect(records.length).toBe(2);
        // JSON format should return parsed objects
        expect(typeof records[0]).toBe('object');
        expect(typeof records[1]).toBe('object');
        expect(records[0]).toEqual({ id: '1', input: 'test1', score: 0.95 });
        expect(records[1]).toEqual({ id: '2', input: 'test2', score: 0.87 });
        expect(records[0]).not.toBeInstanceOf(String);
        expect(records[1]).not.toBeInstanceOf(String);
      });

      it('should handle CSV format and return strings', async () => {
        const mockStream = new Readable({
          read() {
            this.push('id,input,output\n');
            this.push('1,test1,out1\n');
            this.push('2,test2,out2\n');
            this.push(null);
          }
        });

        const mockMakeStreamingRequest: MockMakeStreamingRequest = jest
          .fn()
          .mockResolvedValue(mockStream);

        (
          exportService as unknown as {
            makeStreamingRequest: MockMakeStreamingRequest;
          }
        ).makeStreamingRequest = mockMakeStreamingRequest;

        const result = await exportService.records({
          rootType: 'trace',
          exportFormat: 'csv',
          logStreamId: 'log-stream-123'
        });

        const records: (string | Record<string, unknown>)[] = [];
        for await (const record of result) {
          records.push(record);
        }

        expect(records.length).toBe(3);
        // CSV format should return strings
        expect(records[0]).toBe('id,input,output\n');
        expect(records[1]).toBe('1,test1,out1\n');
        expect(records[2]).toBe('2,test2,out2\n');
        expect(typeof records[0]).toBe('string');
        expect(typeof records[1]).toBe('string');
        expect(typeof records[2]).toBe('string');
      });
    });

    describe('root types', () => {
      it.each(['trace', 'span', 'session'] as const)(
        'should handle root type: %s',
        async (rootType) => {
          const mockStream = new Readable({
            read() {
              this.push(null);
            }
          });

          const mockMakeStreamingRequest: MockMakeStreamingRequest = jest
            .fn()
            .mockResolvedValue(mockStream);

          (
            exportService as unknown as {
              makeStreamingRequest: MockMakeStreamingRequest;
            }
          ).makeStreamingRequest = mockMakeStreamingRequest;

          await exportService.records({
            rootType,
            exportFormat: 'jsonl',
            logStreamId: 'log-stream-123'
          });

          expect(mockMakeStreamingRequest).toHaveBeenCalledWith(
            RequestMethod.POST,
            Routes.exportRecords,
            expect.objectContaining({
              root_type: rootType
            }),
            expect.any(Object)
          );
        }
      );
    });

    describe('error handling', () => {
      it('should throw error when streaming request fails', async () => {
        const mockMakeStreamingRequest: MockMakeStreamingRequest = jest
          .fn()
          .mockRejectedValue(new Error('Network error'));

        (
          exportService as unknown as {
            makeStreamingRequest: MockMakeStreamingRequest;
          }
        ).makeStreamingRequest = mockMakeStreamingRequest;

        await expect(
          exportService.records({
            rootType: 'trace',
            exportFormat: 'jsonl',
            logStreamId: 'log-stream-123'
          })
        ).rejects.toThrow('Failed to initiate export request');
      });

      it('should handle JSONL stream chunks correctly and buffer until complete lines', async () => {
        const mockStream = new Readable({
          read() {
            this.push('{"id": "1"');
            this.push(', "input": "test"}\n');
            this.push('{"id": "2", "input": "test2"}\n');
            this.push(null);
          }
        });

        const mockMakeStreamingRequest: MockMakeStreamingRequest = jest
          .fn()
          .mockResolvedValue(mockStream);

        (
          exportService as unknown as {
            makeStreamingRequest: MockMakeStreamingRequest;
          }
        ).makeStreamingRequest = mockMakeStreamingRequest;

        const result = await exportService.records({
          rootType: 'trace',
          exportFormat: 'jsonl',
          logStreamId: 'log-stream-123'
        });

        const records: (string | Record<string, unknown>)[] = [];
        for await (const record of result) {
          records.push(record);
        }

        // Should receive complete lines as strings, not raw chunks
        expect(records.length).toBe(2);
        expect(records[0]).toBe('{"id": "1", "input": "test"}\n');
        expect(records[1]).toBe('{"id": "2", "input": "test2"}\n');
        expect(records.every((record) => typeof record === 'string')).toBe(
          true
        );
        expect((records as string[]).every((line) => line.endsWith('\n'))).toBe(
          true
        );
      });

      it('should handle JSON stream chunks correctly and buffer until complete lines', async () => {
        const mockStream = new Readable({
          read() {
            this.push('{"id": "1"');
            this.push(', "input": "test", "score": 0.95}\n');
            this.push('{"id": "2", "input": "test2", "score": 0.87}\n');
            this.push(null);
          }
        });

        const mockMakeStreamingRequest: MockMakeStreamingRequest = jest
          .fn()
          .mockResolvedValue(mockStream);

        (
          exportService as unknown as {
            makeStreamingRequest: MockMakeStreamingRequest;
          }
        ).makeStreamingRequest = mockMakeStreamingRequest;

        const result = await exportService.records({
          rootType: 'trace',
          exportFormat: 'json',
          logStreamId: 'log-stream-123'
        });

        const records: (string | Record<string, unknown>)[] = [];
        for await (const record of result) {
          records.push(record);
        }

        // Should receive parsed objects, not raw chunks or strings
        expect(records.length).toBe(2);
        expect(typeof records[0]).toBe('object');
        expect(typeof records[1]).toBe('object');
        expect(records[0]).toEqual({ id: '1', input: 'test', score: 0.95 });
        expect(records[1]).toEqual({ id: '2', input: 'test2', score: 0.87 });
        expect(
          records.every(
            (record) => typeof record === 'object' && !Array.isArray(record)
          )
        ).toBe(true);
      });

      it('should handle CSV line buffering correctly', async () => {
        const mockStream = new Readable({
          read() {
            this.push('id,input,');
            this.push('output\n');
            this.push('1,test1,out1\n');
            this.push('2,test2,out2\n');
            this.push(null);
          }
        });

        const mockMakeStreamingRequest: MockMakeStreamingRequest = jest
          .fn()
          .mockResolvedValue(mockStream);

        (
          exportService as unknown as {
            makeStreamingRequest: MockMakeStreamingRequest;
          }
        ).makeStreamingRequest = mockMakeStreamingRequest;

        const result = await exportService.records({
          rootType: 'trace',
          exportFormat: 'csv',
          logStreamId: 'log-stream-123'
        });

        const records: (string | Record<string, unknown>)[] = [];
        for await (const record of result) {
          records.push(record);
        }

        // Should receive complete lines as strings, not raw chunks
        expect(records.length).toBe(3);
        expect(records[0]).toBe('id,input,output\n');
        expect(records[1]).toBe('1,test1,out1\n');
        expect(records[2]).toBe('2,test2,out2\n');
        expect(records.every((record) => typeof record === 'string')).toBe(
          true
        );
        expect((records as string[]).every((line) => line.endsWith('\n'))).toBe(
          true
        );
      });

      it('should throw error when JSONL stream throws during processing', async () => {
        const streamError = new Error('Stream processing failed');
        let chunkCount = 0;
        const mockStream = new Readable({
          read() {
            if (chunkCount === 0) {
              this.push('{"id": "1"}\n');
              chunkCount++;
            } else {
              // Throw error on second read to simulate stream error during processing
              this.destroy(streamError);
            }
          }
        });

        const mockMakeStreamingRequest: MockMakeStreamingRequest = jest
          .fn()
          .mockResolvedValue(mockStream);

        (
          exportService as unknown as {
            makeStreamingRequest: MockMakeStreamingRequest;
          }
        ).makeStreamingRequest = mockMakeStreamingRequest;

        const result = await exportService.records({
          rootType: 'trace',
          exportFormat: 'jsonl',
          logStreamId: 'log-stream-123'
        });

        // The error should be thrown when iterating over the stream
        await expect(async () => {
          for await (const chunk of result) {
            void chunk;
          }
        }).rejects.toThrow('Error processing JSONL stream');
      });

      it('should throw error when JSON stream throws during processing', async () => {
        const streamError = new Error('Stream processing failed');
        let chunkCount = 0;
        const mockStream = new Readable({
          read() {
            if (chunkCount === 0) {
              this.push('{"id": "1"}\n');
              chunkCount++;
            } else {
              // Throw error on second read to simulate stream error during processing
              this.destroy(streamError);
            }
          }
        });

        const mockMakeStreamingRequest: MockMakeStreamingRequest = jest
          .fn()
          .mockResolvedValue(mockStream);

        (
          exportService as unknown as {
            makeStreamingRequest: MockMakeStreamingRequest;
          }
        ).makeStreamingRequest = mockMakeStreamingRequest;

        const result = await exportService.records({
          rootType: 'trace',
          exportFormat: 'json',
          logStreamId: 'log-stream-123'
        });

        // The error should be thrown when iterating over the stream
        await expect(async () => {
          for await (const chunk of result) {
            void chunk;
          }
        }).rejects.toThrow('Error processing JSONL stream');
      });

      it('should throw error when JSON stream contains invalid JSON', async () => {
        const mockStream = new Readable({
          read() {
            this.push('{"id": "1"}\n');
            this.push('{"invalid": json}\n'); // Invalid JSON
            this.push(null);
          }
        });

        const mockMakeStreamingRequest: MockMakeStreamingRequest = jest
          .fn()
          .mockResolvedValue(mockStream);

        (
          exportService as unknown as {
            makeStreamingRequest: MockMakeStreamingRequest;
          }
        ).makeStreamingRequest = mockMakeStreamingRequest;

        const result = await exportService.records({
          rootType: 'trace',
          exportFormat: 'json',
          logStreamId: 'log-stream-123'
        });

        // The error should be thrown when parsing invalid JSON
        await expect(async () => {
          for await (const chunk of result) {
            void chunk;
          }
        }).rejects.toThrow();
      });
    });

    describe('parameter combinations', () => {
      it('should handle all parameters together', async () => {
        const mockStream = new Readable({
          read() {
            this.push(null);
          }
        });

        const mockMakeStreamingRequest: MockMakeStreamingRequest = jest
          .fn()
          .mockResolvedValue(mockStream);

        (
          exportService as unknown as {
            makeStreamingRequest: MockMakeStreamingRequest;
          }
        ).makeStreamingRequest = mockMakeStreamingRequest;

        await exportService.records({
          rootType: 'session',
          filters: [
            {
              columnId: 'input',
              operator: 'contains',
              value: 'test',
              caseSensitive: true,
              type: 'text'
            }
          ],
          sort: {
            columnId: 'created_at',
            ascending: true
          },
          exportFormat: 'csv',
          experimentId: 'experiment-123',
          columnIds: ['id', 'input', 'output'],
          redact: false,
          metricsTestingId: 'metrics-testing-id-123'
        });

        expect(mockMakeStreamingRequest).toHaveBeenCalledWith(
          RequestMethod.POST,
          Routes.exportRecords,
          expect.objectContaining({
            root_type: 'session',
            export_format: 'csv',
            experiment_id: 'experiment-123',
            column_ids: ['id', 'input', 'output'],
            redact: false,
            metrics_testing_id: 'metrics-testing-id-123',
            filters: expect.arrayContaining([
              expect.objectContaining({
                type: 'text'
              })
            ]),
            sort: {
              column_id: 'created_at',
              ascending: true
            }
          }),
          { project_id: mockProjectId }
        );
      });
    });
  });
});
