import pRetry from 'p-retry';
import { getSdkLogger } from 'galileo-generated';

/**
 * Maximum number of retries for streaming operations.
 */
export const STREAMING_MAX_RETRIES = 3;

/**
 * Extracts status code from an error object.
 * @param error - The error object to extract status code from.
 * @returns The status code if found, undefined otherwise.
 */
function getStatusCodeFromError(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null) {
    // Check for status code in various error formats
    if ('status' in error && typeof error.status === 'number') {
      return error.status;
    }
    if ('statusCode' in error && typeof error.statusCode === 'number') {
      return error.statusCode;
    }
    if (
      'response' in error &&
      typeof error.response === 'object' &&
      error.response !== null &&
      'status' in error.response &&
      typeof error.response.status === 'number'
    ) {
      return error.response.status;
    }
    // Check for status in error message (format: "status code 404")
    if ('message' in error && typeof error.message === 'string') {
      const match = error.message.match(/status code (\d+)/i);
      if (match) {
        return parseInt(match[1], 10);
      }
    }
  }
  return undefined;
}

/**
 * Checks if an error is retryable based on its status code.
 * Retryable status codes: 404, 408, 429, >= 500
 * @param error - The error to check.
 * @returns True if the error is retryable, false otherwise.
 */
function isRetryableError(error: unknown): boolean {
  const statusCode = getStatusCodeFromError(error);
  if (statusCode === undefined) {
    // If we can't determine status code, don't retry
    return false;
  }
  return (
    statusCode === 404 ||
    statusCode === 408 ||
    statusCode === 429 ||
    statusCode >= 500
  );
}

/**
 * Wraps an async function to handle Galileo HTTP exceptions for retry.
 * Re-throws retryable exceptions (404, 408, 429, >= 500) so they can be handled by retry logic.
 * Re-throws non-retryable exceptions (e.g., 400, 422) so tasks fail properly instead of silently succeeding.
 * @param fn - The async function to wrap.
 * @returns A wrapped function that handles HTTP exceptions.
 */
export function handleGalileoHttpExceptionsForRetry<
  T extends (...args: unknown[]) => Promise<unknown>
>(fn: T): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      const statusCode = getStatusCodeFromError(error);
      if (statusCode === 404) {
        getSdkLogger().info('Trace not found, retrying...');
      } else if (statusCode === 408) {
        getSdkLogger().info('Request timed out, retrying...');
      } else if (statusCode === 429) {
        getSdkLogger().info('Rate limited, retrying...');
      } else if (statusCode !== undefined && statusCode >= 500) {
        getSdkLogger().info('Server error, retrying...');
      } else {
        getSdkLogger().error(
          `Unrecoverable failure or unrecognized error: ${error}`
        );
      }

      throw error;
    }
  }) as T;
}

/**
 * Wraps an async function with exponential backoff retry logic.
 * Only retries errors that are determined to be retryable (404, 408, 429, >= 500).
 * Non-retryable errors (e.g., 400, 422) fail immediately without retries.
 * @param fn - The async function to wrap with retry logic.
 * @param taskId - Optional task ID for logging purposes.
 * @param maxRetries - Maximum number of retries. Defaults to STREAMING_MAX_RETRIES.
 * @param onRetry - Optional callback called on each retry attempt.
 * @returns A promise that resolves with the function result after retries.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  taskId?: string,
  maxRetries: number = STREAMING_MAX_RETRIES,
  onRetry?: (error: Error) => void
): Promise<T> {
  let attemptNumber = 0;
  return await pRetry(
    async () => {
      attemptNumber++;
      if (taskId) {
        getSdkLogger().info(`Retry #${attemptNumber} for task ${taskId}`);
      }
      return await fn();
    },
    {
      retries: maxRetries,
      onFailedAttempt: (error: Error) => {
        // Check if error is non-retryable - abort retries immediately
        if (!isRetryableError(error)) {
          // Throw AbortError to stop retries for non-retryable errors
          // Pass the original error to preserve it in error.originalError
          throw new pRetry.AbortError(error);
        }

        // Call onRetry callback if provided (only for retryable errors)
        if (onRetry && attemptNumber <= maxRetries) {
          onRetry(error);
        } else if (taskId) {
          getSdkLogger().error(
            `Task ${taskId} failed after ${maxRetries} attempts: ${error.message}`
          );
        }
      }
    }
  );
}
