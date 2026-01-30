/**
 * HTTP validation error response from the API.
 * Matches Python's HTTPValidationError structure.
 */
export interface HTTPValidationError {
  detail: string | Array<{ loc: string[]; msg: string; type: string }>;
}

/**
 * Galileo Standard error data structure from the API.
 * This represents the raw error data structure (snake_case from API).
 * Used internally for type checking during conversion.
 */
export interface GalileoAPIStandardErrorData {
  /** Numeric error code that uniquely identifies the error type */
  error_code: number;
  /** Human-readable error type identifier */
  error_type: string;
  /** Group/category the error belongs to (e.g., "dataset", "playground", "shared") */
  error_group: string;
  /** Severity level (e.g., "low", "medium", "high", "critical") */
  severity: string;
  /** Human-readable error message */
  message: string;
  /** Suggested action for the user to resolve the error */
  user_action?: string;
  /** Optional link to documentation about this error */
  documentation_link?: string | null;
  /** Whether the error is retriable (client can retry the request) */
  retriable: boolean;
  /** Whether the error is blocking (requires user intervention) */
  blocking: boolean;
  /** HTTP status code associated with this error */
  http_status_code?: number;
  /** Internal identifier of the service emitting the error (api, runners, ui) */
  source_service?: string | null;
  /** Optional context information (e.g., exception_type, exception_message) */
  context?: Record<string, unknown> | null;
}

/**
 * Type guard to validate if an object matches the GalileoAPIStandardErrorData interface.
 * @param value - The value to validate
 * @returns True if the value matches the interface shape, false otherwise
 */
export function isGalileoAPIStandardErrorData(
  value: unknown
): value is GalileoAPIStandardErrorData {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const obj = value as Record<string, unknown>;

  return (
    typeof obj.error_code === 'number' &&
    typeof obj.error_type === 'string' &&
    typeof obj.error_group === 'string' &&
    typeof obj.severity === 'string' &&
    typeof obj.message === 'string' &&
    typeof obj.retriable === 'boolean' &&
    typeof obj.blocking === 'boolean' &&
    (obj.user_action === undefined ||
      obj.user_action === null ||
      typeof obj.user_action === 'string') &&
    (obj.documentation_link === undefined ||
      obj.documentation_link === null ||
      typeof obj.documentation_link === 'string') &&
    (obj.http_status_code === undefined ||
      obj.http_status_code === null ||
      typeof obj.http_status_code === 'number') &&
    (obj.source_service === undefined ||
      obj.source_service === null ||
      typeof obj.source_service === 'string') &&
    (obj.context === undefined ||
      obj.context === null ||
      (typeof obj.context === 'object' &&
        obj.context !== null &&
        !Array.isArray(obj.context)))
  );
}

/**
 * Galileo API Error class for structured error handling.
 * Extends Error to provide proper stack traces and error handling while
 * preserving all structured error information from the API.
 *
 * As specified in https://github.com/rungalileo/orbit/blob/main/libs/python/error_management/docs/error_catalog.md
 */
export class GalileoAPIError extends Error {
  readonly errorCode: number;
  readonly errorType: string;
  readonly errorGroup: string;
  readonly severity: string;
  readonly userAction?: string;
  readonly documentationLink?: string | null;
  readonly retriable: boolean;
  readonly blocking: boolean;
  readonly httpStatusCode?: number;
  readonly sourceService?: string | null;
  readonly context?: Record<string, unknown> | null;

  constructor(data: GalileoAPIStandardErrorData) {
    super(data.message);
    this.name = 'GalileoAPIError';
    this.errorCode = data.error_code;
    this.errorType = data.error_type;
    this.errorGroup = data.error_group;
    this.severity = data.severity;
    this.userAction = data.user_action;
    this.documentationLink = data.documentation_link ?? null;
    this.retriable = data.retriable;
    this.blocking = data.blocking;
    this.httpStatusCode = data.http_status_code;
    this.sourceService = data.source_service ?? null;
    this.context = data.context ?? null;
  }

  /**
   * Serializes the error to JSON format for logging and debugging.
   * Includes all error properties including stack trace.
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      errorCode: this.errorCode,
      errorType: this.errorType,
      errorGroup: this.errorGroup,
      severity: this.severity,
      userAction: this.userAction,
      documentationLink: this.documentationLink,
      retriable: this.retriable,
      blocking: this.blocking,
      httpStatusCode: this.httpStatusCode,
      sourceService: this.sourceService,
      context: this.context,
      stack: this.stack
    };
  }
}
