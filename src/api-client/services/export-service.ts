import { BaseClient, RequestMethod } from '../base-client';
import { Routes } from '../../types/routes.types';
import {
  LogRecordsExportRequestOpenAPI,
  LogRecordsExportRequest
} from '../../types/export.types';
import { Readable } from 'stream';

export class ExportService extends BaseClient {
  private projectId: string;

  constructor(apiUrl: string, token: string, projectId: string) {
    super();
    this.apiUrl = apiUrl;
    this.token = token;
    this.projectId = projectId;
    this.initializeClient();
  }

  public async records(
    options: LogRecordsExportRequest
  ): Promise<AsyncIterable<string | Record<string, unknown>>> {
    const enrichedOptions = this.fillOptionsWithDefaults(options);
    const request = this.convertToSnakeCase<
      LogRecordsExportRequest,
      LogRecordsExportRequestOpenAPI
    >(enrichedOptions);

    try {
      const stream: Readable = await this.makeStreamingRequest(
        RequestMethod.POST,
        Routes.exportRecords,
        request,
        { project_id: this.projectId }
      );

      if (
        enrichedOptions.exportFormat === 'jsonl' ||
        enrichedOptions.exportFormat === 'json'
      ) {
        return this.parseJsonStream(stream, enrichedOptions.exportFormat);
      } else {
        return this.parseCSVStream(stream);
      }
    } catch (error) {
      throw new Error(
        `Failed to initiate export request: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
          `Project ID: ${this.projectId}, Root Type: ${enrichedOptions.rootType}, Format: ${enrichedOptions.exportFormat}`
      );
    }
  }

  private fillOptionsWithDefaults(
    options: LogRecordsExportRequest
  ): LogRecordsExportRequest {
    return {
      ...options,
      rootType: options.rootType || 'trace',
      exportFormat: options.exportFormat || 'jsonl',
      sort: options.sort || {
        columnId: 'created_at',
        ascending: false
      }
    };
  }

  /**
   * Parses a CSV stream with proper line buffering to ensure complete lines.
   * Buffers chunks until complete lines (ending with \n) are available, then yields
   * each line with a newline.
   *
   * @param stream - The readable stream containing CSV data
   * @returns An async iterable that yields complete CSV lines
   * @throws Error if stream processing fails
   */
  private async *parseCSVStream(
    stream: Readable
  ): AsyncIterable<string | Record<string, unknown>> {
    stream.setEncoding('utf-8');
    let buffer = '';

    try {
      for await (const chunk of stream) {
        if (chunk) {
          buffer += chunk;

          // Split on newlines
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            // Preserve the line as-is (CSV may have meaningful empty lines)
            yield line + '\n';
          }
        }
      }

      // Handle remaining buffer (last line without trailing newline)
      if (buffer) {
        yield buffer + '\n';
      }
    } catch (error) {
      throw new Error(
        `Error processing CSV stream: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Parses a JSON/JSONL stream with proper line buffering to ensure complete lines.
   * Buffers chunks until complete lines (ending with \n) are available, then yields
   * records based on the export format.
   *
   * @param stream - The readable stream containing JSON/JSONL data
   * @param exportFormat - The export format ('jsonl' or 'json')
   * @returns An async iterable that yields:
   *   - For JSONL format: Complete lines as strings (each ending with `\n`)
   *   - For JSON format: Parsed JSON objects as `Record<string, unknown>`
   * @throws Error if stream processing fails
   */
  private async *parseJsonStream(
    stream: Readable,
    exportFormat: 'jsonl' | 'json'
  ): AsyncIterable<string | Record<string, unknown>> {
    stream.setEncoding('utf-8');
    let buffer = '';

    try {
      for await (const chunk of stream) {
        if (chunk) {
          buffer += chunk;

          // Split on newlines
          const lines = buffer.split('\n');
          // Keeping last element in buffer, in case it's incomplete
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine) {
              if (exportFormat === 'jsonl') {
                yield trimmedLine + '\n';
              } else {
                yield JSON.parse(trimmedLine);
              }
            }
          }
        }
      }

      // Handle remaining buffer (last line without trailing newline)
      const trimmedBuffer = buffer.trim();
      if (trimmedBuffer) {
        if (exportFormat === 'jsonl') {
          yield trimmedBuffer + '\n';
        } else {
          yield JSON.parse(trimmedBuffer);
        }
      }
    } catch (error) {
      throw new Error(
        `Error processing JSONL stream: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
