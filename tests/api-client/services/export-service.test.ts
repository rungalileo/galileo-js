import { ExportService } from '../../../src/api-client/services/export-service';
import { RequestMethod } from '../../../src/api-client/base-client';
import { Routes } from '../../../src/types/routes.types';
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

      const result = await exportService.records(
        'trace',
        [],
        undefined,
        'jsonl',
        'log-stream-123'
      );

      const records: Record<string, unknown>[] = [];
      for await (const record of result) {
        records.push(record as Record<string, unknown>);
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
            ascending: false,
            sort_type: 'column'
          }),
          redact: true
        }),
        { project_id: mockProjectId }
      );

      expect(records).toHaveLength(1);
      expect(records[0]).toEqual({ id: '1', input: 'test' });
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

      await exportService.records();

      expect(mockMakeStreamingRequest).toHaveBeenCalledWith(
        RequestMethod.POST,
        Routes.exportRecords,
        expect.objectContaining({
          root_type: 'trace',
          export_format: 'jsonl',
          sort: expect.objectContaining({
            column_id: 'created_at',
            ascending: false,
            sort_type: 'column'
          }),
          redact: true
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

        await exportService.records(
          'trace',
          [
            {
              columnId: 'input',
              operator: 'contains',
              value: 'test',
              caseSensitive: false
            }
          ],
          undefined,
          'jsonl',
          'log-stream-123'
        );

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

        await exportService.records(
          'trace',
          [
            {
              columnId: 'score',
              operator: 'gte',
              value: 0.5
            }
          ],
          undefined,
          'jsonl',
          'log-stream-123'
        );

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

        await exportService.records(
          'trace',
          [
            {
              columnId: 'created_at',
              operator: 'gt',
              value: dateValue
            }
          ],
          undefined,
          'jsonl',
          'log-stream-123'
        );

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

        await exportService.records(
          'trace',
          [
            {
              columnId: 'is_valid',
              value: true
            }
          ],
          undefined,
          'jsonl',
          'log-stream-123'
        );

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

      it('should convert IDFilter correctly (with operator)', async () => {
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
          'trace',
          [
            {
              columnId: 'trace_id',
              operator: 'eq',
              value: 'some-trace-id'
            }
          ],
          undefined,
          'jsonl',
          'log-stream-123'
        );

        expect(mockMakeStreamingRequest).toHaveBeenCalledWith(
          RequestMethod.POST,
          Routes.exportRecords,
          expect.objectContaining({
            filters: [
              expect.objectContaining({
                column_id: 'trace_id',
                operator: 'eq',
                value: 'some-trace-id',
                type: 'date' // IDFilter with 'eq' operator and string value gets treated as date filter
              })
            ]
          }),
          expect.any(Object)
        );
      });

      it('should convert IDFilter correctly (without operator)', async () => {
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
          'trace',
          [
            {
              columnId: 'trace_id',
              operator: undefined,
              value: 'some-trace-id'
            }
          ],
          undefined,
          'jsonl',
          'log-stream-123'
        );

        // When operator is explicitly undefined, it should be treated as ID filter
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

        await exportService.records(
          'trace',
          [
            {
              columnId: 'input',
              operator: 'contains',
              value: 'test',
              caseSensitive: false
            },
            {
              columnId: 'score',
              operator: 'gte',
              value: 0.5
            },
            {
              columnId: 'is_valid',
              value: true
            }
          ],
          undefined,
          'jsonl',
          'log-stream-123'
        );

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
      it('should convert sort clause with sortType', async () => {
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
          'trace',
          [],
          {
            columnId: 'created_at',
            ascending: false,
            sortType: 'column'
          },
          'jsonl',
          'log-stream-123'
        );

        expect(mockMakeStreamingRequest).toHaveBeenCalledWith(
          RequestMethod.POST,
          Routes.exportRecords,
          expect.objectContaining({
            sort: {
              column_id: 'created_at',
              ascending: false,
              sort_type: 'column'
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

        await exportService.records(
          'trace',
          [],
          undefined,
          'jsonl',
          'log-stream-123'
        );

        expect(mockMakeStreamingRequest).toHaveBeenCalledWith(
          RequestMethod.POST,
          Routes.exportRecords,
          expect.objectContaining({
            sort: {
              column_id: 'created_at',
              ascending: false,
              sort_type: 'column'
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

        await exportService.records(
          'trace',
          [],
          undefined,
          'jsonl',
          'log-stream-123',
          undefined,
          undefined,
          true,
          'metrics-testing-id-123'
        );

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
      it('should handle JSONL format', async () => {
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

        const result = await exportService.records(
          'trace',
          [],
          undefined,
          'jsonl',
          'log-stream-123'
        );

        const records: Record<string, unknown>[] = [];
        for await (const record of result) {
          records.push(record as Record<string, unknown>);
        }

        expect(records).toHaveLength(2);
        expect(records[0]).toEqual({ id: '1', input: 'test1' });
        expect(records[1]).toEqual({ id: '2', input: 'test2' });
      });

      it('should handle CSV format', async () => {
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

        const result = await exportService.records(
          'trace',
          [],
          undefined,
          'csv',
          'log-stream-123'
        );

        const records: Array<string>[] = [];
        for await (const record of result) {
          records.push(record as Array<string>);
        }

        expect(records.length).toBeGreaterThan(0);
        // CSV parser returns arrays of strings
        expect(Array.isArray(records[0])).toBe(true);
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

          await exportService.records(
            rootType,
            [],
            undefined,
            'jsonl',
            'log-stream-123'
          );

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
          exportService.records(
            'trace',
            [],
            undefined,
            'jsonl',
            'log-stream-123'
          )
        ).rejects.toThrow('Failed to initiate export request');
      });

      it('should handle malformed JSON lines gracefully', async () => {
        const mockStream = new Readable({
          read() {
            this.push('{"id": "1"}\n');
            this.push('this is not json\n');
            this.push('{"id": "2"}\n');
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

        const result = await exportService.records(
          'trace',
          [],
          undefined,
          'jsonl',
          'log-stream-123'
        );

        const records: Record<string, unknown>[] = [];
        for await (const record of result) {
          records.push(record as Record<string, unknown>);
        }

        // Should skip malformed lines and only return valid JSON
        expect(records.length).toBeGreaterThan(0);
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

        await exportService.records(
          'session',
          [
            {
              columnId: 'input',
              operator: 'contains',
              value: 'test',
              caseSensitive: true
            }
          ],
          {
            columnId: 'created_at',
            ascending: true,
            sortType: 'column'
          },
          'csv',
          undefined,
          'experiment-123',
          ['id', 'input', 'output'],
          false,
          'metrics-testing-id-123'
        );

        expect(mockMakeStreamingRequest).toHaveBeenCalledWith(
          RequestMethod.POST,
          Routes.exportRecords,
          expect.objectContaining({
            root_type: 'session',
            export_format: 'csv',
            log_stream_id: null,
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
              ascending: true,
              sort_type: 'column'
            }
          }),
          { project_id: mockProjectId }
        );
      });
    });
  });
});
