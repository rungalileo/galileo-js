import { BaseClient, RequestMethod } from '../base-client';
import { Routes } from '../../types/routes.types';
import {
  LLMExportFormat,
  LogRecordsExportRequest,
  LogRecordsTextFilter,
  LogRecordsNumberFilter,
  LogRecordsDateFilter,
  LogRecordsBooleanFilter,
  LogRecordsIDFilter,
  RootType,
  TSRootType,
  TSFormat,
  TSSortClause,
  TSFilter,
  TSTextFilter,
  TSNumberFilter,
  TSDateFilter,
  TSBooleanFilter,
  TSIDFilter
} from '../../types/export.types';
import { Readable } from 'stream';
import { parse } from 'csv-parse';

export class ExportService extends BaseClient {
  private projectId: string;

  constructor(apiUrl: string, token: string, projectId: string) {
    super();
    this.apiUrl = apiUrl;
    this.token = token;
    this.projectId = projectId;
    this.initializeClient();
  }

  private convertFilterToOpenApi(
    filter: TSFilter
  ):
    | LogRecordsTextFilter
    | LogRecordsNumberFilter
    | LogRecordsDateFilter
    | LogRecordsBooleanFilter
    | LogRecordsIDFilter {
    // 1. Boolean filter: value is boolean (no operator)
    if (
      'value' in filter &&
      typeof filter.value === 'boolean' &&
      !('operator' in filter)
    ) {
      const boolFilter = filter as TSBooleanFilter;
      return {
        column_id: boolFilter.columnId,
        value: boolFilter.value,
        type: 'boolean' as const
      };
    }

    // 2. Number filter: value is number or number[]
    if (
      'value' in filter &&
      (typeof filter.value === 'number' ||
        (Array.isArray(filter.value) &&
          filter.value.length > 0 &&
          typeof filter.value[0] === 'number'))
    ) {
      const numFilter = filter as TSNumberFilter;
      return {
        column_id: numFilter.columnId,
        operator: numFilter.operator,
        value: numFilter.value,
        type: 'number' as const
      };
    }

    // 3. Date filter: operator is date-specific (eq, ne, gt, gte, lt, lte) and value is string
    // Date filters don't support 'contains', 'one_of', or 'not_in'
    // Only check for date if operator is clearly date-specific (not text operators)
    if ('operator' in filter && typeof filter.value === 'string') {
      const dateOperators: TSDateFilter['operator'][] = [
        'eq',
        'ne',
        'gt',
        'gte',
        'lt',
        'lte'
      ];
      const textOperators: TSTextFilter['operator'][] = [
        'contains',
        'one_of',
        'not_in'
      ];
      // If operator is date-specific AND not a text operator, treat as date
      if (
        dateOperators.includes(filter.operator as TSDateFilter['operator']) &&
        !textOperators.includes(filter.operator as TSTextFilter['operator'])
      ) {
        const dateFilter = filter as TSDateFilter;
        return {
          column_id: dateFilter.columnId,
          operator: dateFilter.operator,
          value: dateFilter.value, // ISO date-time string
          type: 'date' as const
        };
      }
    }

    // 4. ID filter: operator is optional (if undefined, it's definitely ID)
    // ID filters support: eq (default), ne, contains, not_in, one_of
    if ('operator' in filter && filter.operator === undefined) {
      const idFilter = filter as TSIDFilter;
      return {
        column_id: idFilter.columnId,
        operator: 'eq',
        value: idFilter.value,
        type: 'id' as const
      };
    }

    // 5. Text filter: default case for string values with text operators
    // Text filters support: eq, ne, contains, one_of, not_in
    const textFilter = filter as TSTextFilter;
    return {
      column_id: textFilter.columnId,
      operator: textFilter.operator,
      value: textFilter.value,
      case_sensitive:
        textFilter.caseSensitive !== undefined
          ? textFilter.caseSensitive
          : true,
      type: 'text' as const
    };
  }

  private convertToOpenApiRequest(params: {
    rootType?: TSRootType;
    filters?: TSFilter[];
    sort?: TSSortClause;
    exportFormat?: TSFormat;
    logStreamId?: string;
    experimentId?: string;
    columnIds?: string[];
    redact?: boolean;
    metricsTestingId?: string;
  }): LogRecordsExportRequest {
    const request: LogRecordsExportRequest = {
      root_type: (params.rootType || 'trace') as RootType,
      export_format: (params.exportFormat || 'jsonl') as LLMExportFormat,
      log_stream_id: params.logStreamId || null,
      experiment_id: params.experimentId || null,
      metrics_testing_id: params.metricsTestingId || null,
      column_ids: params.columnIds || null,
      redact: params.redact !== undefined ? params.redact : true,
      sort: params.sort
        ? {
            column_id: params.sort.columnId,
            ascending:
              params.sort.ascending !== undefined
                ? params.sort.ascending
                : false,
            sort_type: (params.sort.sortType || 'column') as 'column'
          }
        : {
            column_id: 'created_at',
            ascending: false,
            sort_type: 'column' as const
          },
      filters: params.filters
        ? (params.filters.map((filter) =>
            this.convertFilterToOpenApi(filter)
          ) as LogRecordsExportRequest['filters']) // Type assertion needed due to union type complexity
        : undefined
    };

    return request;
  }

  public async records(
    rootType: TSRootType = 'trace',
    filters?: TSFilter[],
    sort?: TSSortClause,
    exportFormat: TSFormat = 'jsonl',
    logStreamId?: string,
    experimentId?: string,
    columnIds?: string[],
    redact: boolean = true,
    metricsTestingId?: string
  ): Promise<AsyncIterable<Record<string, unknown> | Array<string>>> {
    const request = this.convertToOpenApiRequest({
      rootType,
      filters,
      sort,
      exportFormat,
      logStreamId,
      experimentId,
      columnIds,
      redact,
      metricsTestingId
    });

    let stream: Readable;
    try {
      stream = await this.makeStreamingRequest(
        RequestMethod.POST,
        Routes.exportRecords,
        request,
        { project_id: this.projectId }
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unknown error occurred during export request';
      throw new Error(
        `Failed to initiate export request: ${errorMessage}. ` +
          `Project ID: ${this.projectId}, Root Type: ${rootType}, Format: ${exportFormat}`
      );
    }

    if (exportFormat === 'csv') {
      return this.parseCsvStream(stream);
    } else {
      return this.parseJsonlStream(stream);
    }
  }

  private async *parseJsonlStream(
    stream: Readable
  ): AsyncIterable<Record<string, unknown>> {
    let buffer = '';

    for await (const chunk of stream) {
      buffer += chunk.toString('utf-8');
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) {
          try {
            yield JSON.parse(trimmed);
          } catch (error) {
            // Skip malformed JSON lines
            // eslint-disable-next-line no-console
            console.warn(
              `Skipping malformed JSON line: ${trimmed.substring(0, 100)}`
            );
          }
        }
      }
    }

    // Process remaining buffer
    if (buffer.trim()) {
      try {
        yield JSON.parse(buffer.trim());
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn(`Skipping malformed JSON line in final buffer`);
      }
    }
  }

  private async *parseCsvStream(
    stream: Readable
  ): AsyncIterable<Array<string>> {
    const parser = parse({
      encoding: 'utf-8',
      delimiter: ','
    });

    stream.pipe(parser);

    for await (const record of parser) {
      yield record;
    }
  }
}
