import { GalileoApiClient } from '../api-client';
import { LogRecordsExportRequest } from '../types/export.types';

/**
 * Exports records from a Galileo project.
 *
 * Defaults to the first log stream available if `logStreamId` and `experimentId` are not provided.
 *
 * @param options - Export parameters
 * @param options.projectId - The unique identifier of the project
 * @param options.rootType - The type of records to export (default: 'trace')
 * @param options.filters - Filters to apply to the export
 * @param options.sort - Sort clause to order the exported records (default: { columnId: 'created_at', ascending: false })
 * @param options.exportFormat - The desired format for the exported data (default: 'jsonl')
 * @param options.logStreamId - Filter records by a specific log stream ID
 * @param options.experimentId - Filter records by a specific experiment ID
 * @param options.metricsTestingId - Metrics testing ID associated with the traces
 * @param options.columnIds - Column IDs to include in the export
 * @param options.redact - Redact sensitive data from the response (default: true)
 * @returns A Promise that resolves to an AsyncIterable that yields records based on the export format.
 *   - For JSONL format: Each record is a `string` containing a complete JSONL line (JSON object as string with trailing newline)
 *   - For JSON format: Each record is a `Record<string, unknown>` (parsed JSON object)
 *   - For CSV format: Each record is a `string` containing a complete CSV line (with trailing newline)
 */
export const exportRecords = async (
  options: LogRecordsExportRequest & { projectId: string }
): Promise<AsyncIterable<string | Record<string, unknown>>> => {
  const client = new GalileoApiClient();
  await client.init({ projectId: options.projectId, projectScoped: true });
  return await client.exportRecords(options);
};
