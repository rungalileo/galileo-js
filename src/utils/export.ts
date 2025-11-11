import { GalileoApiClient } from '../api-client';
import { TSRecordsParams } from '../types/export.types';

/**
 * Exports records from a Galileo project.
 *
 * Defaults to the first log stream available if `logStreamId` and `experimentId` are not provided.
 *
 * @param params - Export parameters
 * @param params.projectId - The unique identifier of the project
 * @param params.rootType - The type of records to export (default: 'trace')
 * @param params.filters - Filters to apply to the export
 * @param params.sort - Sort clause to order the exported records (default: { columnId: 'created_at', ascending: false })
 * @param params.exportFormat - The desired format for the exported data (default: 'jsonl')
 * @param params.logStreamId - Filter records by a specific log stream ID
 * @param params.experimentId - Filter records by a specific experiment ID
 * @param params.columnIds - Column IDs to include in the export
 * @param params.redact - Redact sensitive data from the response (default: true)
 * @returns A Promise that resolves to an AsyncIterable that yields records as they are streamed.
 *   - For JSONL format: Each record is a `Record<string, unknown>` (dictionary/object)
 *   - For CSV format: Each record is an `Array<string>` (array of string values)
 */
export const exportRecords = async (
  params: TSRecordsParams
): Promise<AsyncIterable<Record<string, unknown> | Array<string>>> => {
  const client = new GalileoApiClient();
  await client.init({ projectId: params.projectId, projectScoped: true });
  return await client.exportRecords(params);
};
