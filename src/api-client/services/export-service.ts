/* eslint-disable @typescript-eslint/no-explicit-any */
import { BaseClient, RequestMethod } from '../base-client';
import { Routes } from '../../types/routes.types';
import { LogRecordsExportRequest } from '../../types/export.types';
import { parse as csvParse } from 'csv-parse/sync';

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
    body: LogRecordsExportRequest
  ): Promise<Record<string, any>[]> {
    const { export_format = 'jsonl' } = body;

    const response = await this.makeRequestRaw<string>(
      RequestMethod.POST,
      Routes.exportRecords,
      body,
      { project_id: this.projectId }
    );

    const rawData = response.data;

    if (!rawData) {
      return [];
    }

    if (export_format === 'csv') {
      return csvParse(rawData, {
        columns: true,
        skip_empty_lines: true
      });
    }

    // Default to JSONL parsing
    return rawData
      .split('\n')
      .filter((line) => line.trim() !== '')
      .map((line) => JSON.parse(line));
  }
}
