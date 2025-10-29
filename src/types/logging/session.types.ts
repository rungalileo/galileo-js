import type { components } from '../api.types';

export type SessionCreateResponse =
  components['schemas']['SessionCreateResponse'];

export type SessionSearchResponse =
  components['schemas']['LogRecordsQueryResponse'];

// Interface for session search request parameters (simplified client interface)
export interface SessionSearchRequest {
  filters?: Array<{
    column_id: string;
    operator: 'eq' | 'ne' | 'contains' | 'one_of' | 'not_in';
    value: string | string[];
    case_sensitive?: boolean;
  }>;
  limit?: number;
  starting_token?: number;
}

// Proper type for session search request body based on LogRecordsQueryRequest schema
export type SessionSearchRequestBody =
  components['schemas']['LogRecordsQueryRequest'];
