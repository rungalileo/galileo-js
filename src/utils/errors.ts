import { AxiosError } from 'axios';

/**
 * Standardized error information
 */
export interface ErrorInfo {
  statusCode: number;
  message: string;
}

/**
 * Manages error mapping and retry logic for various error types
 */
export class ErrorManager {
  /**
   * Map an error to standardized format
   * @param error The error to map
   * @returns Standardized error information
   */
  mapError(error: unknown): ErrorInfo {
    // Handle Axios errors (HTTP errors)
    if (error instanceof AxiosError) {
      return {
        statusCode: error.response?.status || 500,
        message: error.message
      };
    }

    // Handle standard Error objects
    if (error instanceof Error) {
      // Map common error patterns to appropriate status codes
      const message = error.message.toLowerCase();

      if (message.includes('timeout') || message.includes('timed out')) {
        return { statusCode: 408, message: error.message };
      }

      if (
        message.includes('network') ||
        message.includes('connection') ||
        message.includes('econnrefused') ||
        message.includes('enotfound')
      ) {
        return { statusCode: 503, message: error.message };
      }

      if (
        message.includes('unauthorized') ||
        message.includes('authentication')
      ) {
        return { statusCode: 401, message: error.message };
      }

      if (message.includes('forbidden')) {
        return { statusCode: 403, message: error.message };
      }

      if (message.includes('not found')) {
        return { statusCode: 404, message: error.message };
      }

      if (
        message.includes('rate limit') ||
        message.includes('too many requests')
      ) {
        return { statusCode: 429, message: error.message };
      }

      // Default to 500 for unknown errors
      return { statusCode: 500, message: error.message };
    }

    // Handle string errors
    if (typeof error === 'string') {
      return { statusCode: 500, message: error };
    }

    // Fallback for unknown error types
    return {
      statusCode: 500,
      message: String(error)
    };
  }

  /**
   * Check if an error is retryable based on status code
   * @param error The error to check
   * @returns True if the error is retryable
   */
  isRetryable(error: unknown): boolean {
    const errorInfo = this.mapError(error);
    const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
    return retryableStatusCodes.includes(errorInfo.statusCode);
  }
}

/**
 * Base exception class for all API errors.
 * Attempts to parse error messages from API responses, extracting the "detail" field
 * if the response is JSON, otherwise uses the message as-is.
 *
 */
export class APIException extends Error {
  public readonly message: string;
  public readonly originalMessage?: string;

  constructor(message: string | unknown) {
    const messageStr = typeof message === 'string' ? message : String(message);

    // Try to parse JSON and extract "detail" field
    let parsedMessage = messageStr;
    try {
      const parsed = JSON.parse(messageStr);
      if (parsed && typeof parsed === 'object' && 'detail' in parsed) {
        // Handle both string detail and array of validation errors
        if (typeof parsed.detail === 'string') {
          parsedMessage = parsed.detail;
        } else if (Array.isArray(parsed.detail)) {
          // Format validation errors as a readable string
          parsedMessage = parsed.detail
            .map((err: { loc?: string[]; msg?: string; type?: string }) => {
              const loc = err.loc ? err.loc.join('.') : 'unknown';
              const msg = err.msg || 'validation error';
              return `${loc}: ${msg}`;
            })
            .join('; ');
        } else {
          parsedMessage = JSON.stringify(parsed.detail);
        }
      }
    } catch {
      // Not JSON, use message as-is
    }

    super(parsedMessage);
    this.message = parsedMessage;
    this.originalMessage = messageStr;
    this.name = 'APIException';

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, APIException);
    }
  }
}

/**
 * Exception raised when experiment operations fail.
 */
export class ExperimentAPIException extends APIException {
  constructor(message: string | unknown) {
    super(message);
    this.name = 'ExperimentAPIException';
  }
}

/**
 * Exception raised when experiment tags operations fail.
 */
export class ExperimentTagsAPIException extends APIException {
  constructor(message: string | unknown) {
    super(message);
    this.name = 'ExperimentTagsAPIException';
  }
}

/**
 * Exception raised when dataset operations fail.
 */
export class DatasetAPIException extends APIException {
  constructor(message: string | unknown) {
    super(message);
    this.name = 'DatasetAPIException';
  }
}

/**
 * Exception raised when project operations fail.
 */
export class ProjectAPIException extends APIException {
  constructor(message: string | unknown) {
    super(message);
    this.name = 'ProjectAPIException';
  }
}
