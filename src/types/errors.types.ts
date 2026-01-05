/**
 * HTTP validation error response from the API.
 * Matches Python's HTTPValidationError structure.
 */
export interface HTTPValidationError {
  detail: string | Array<{ loc: string[]; msg: string; type: string }>;
}
