/* eslint-disable @typescript-eslint/no-explicit-any */
import { GalileoApiClient } from '../api-client';
import { LogRecordsExportRequest } from '../types/export.types';

/**
 * Exports records from Galileo.
 *
 * This is a convenience function that handles client initialization.
 *
 * @param projectName The name of the project to export from.
 * @param body The parameters for the export operation.
 * @returns A promise that resolves to an array of records.
 */
export async function exportRecords(
  projectName: string,
  body: LogRecordsExportRequest
): Promise<Record<string, any>[]> {
  const client = new GalileoApiClient();
  await client.init({ projectName });
  return client.exportRecords(body);
}