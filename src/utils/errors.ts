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
