import { User } from './user.types';
import { components } from './api.types';

export interface Dataset {
  id: string;
  name: string;
  column_names: string[] | null;
  project_count: number;
  created_at: string;
  updated_at: string;
  num_rows: number | null;
  created_by_user: User | null;
  current_version_index: number;
  draft: boolean;
}

export type DatasetRow = components['schemas']['DatasetRow'];

export interface DatasetRecord {
  id?: string;
  input: string;
  output?: string;
  metadata?: Record<string, string>;
}

export interface DatasetRecordOptions {
  id?: string;
  input: unknown;
  output?: unknown;
  metadata?: unknown;
}

export const createDatasetRecord = ({
  id,
  input,
  output,
  metadata
}: DatasetRecordOptions): DatasetRecord => {
  let resultMetadata: Record<string, string> | undefined = undefined;
  if (metadata != null) {
    // checks null & undefined
    let record: Record<string, unknown> = {};
    if (typeof metadata === 'string') {
      try {
        record = JSON.parse(metadata);
      } catch (error) {
        if (
          error instanceof SyntaxError &&
          error.message.includes('JSON.parse')
        ) {
          record = { metadata: metadata };
        } else {
          throw error;
        }
      }
    } else if (typeof metadata === 'object') {
      record = metadata as Record<string, unknown>;
    } else {
      throw new Error('Dataset metadata must be a string or object');
    }
    for (const value of Object.values(record)) {
      if (typeof value !== 'string') {
        throw new Error('Dataset metadata values must be strings');
      }
    }
    resultMetadata = record as Record<string, string>;
  }

  return {
    id,
    input: serializeToString(input),
    output: output === undefined ? undefined : serializeToString(output),
    metadata: resultMetadata
  };
};

const serializeToString = (value: unknown): string => {
  return typeof value === 'string' ? value : JSON.stringify(value);
};

export const deserializeInputFromString = (
  value: string
): Record<string, unknown> => {
  try {
    return JSON.parse(value);
  } catch (error) {
    if (error instanceof SyntaxError && error.message.includes('JSON.parse')) {
      return { value: value };
    } else {
      throw error;
    }
  }
};
