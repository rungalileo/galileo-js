import {
  withRetry,
  handleGalileoHttpExceptionsForRetry,
  STREAMING_MAX_RETRIES
} from '../../src/utils/retry-utils';
import { enableLogging, disableLogging } from 'galileo-generated';

// Helper function to create error with status code
function createErrorWithStatus(
  statusCode: number,
  format: 'status' | 'statusCode' | 'response' | 'message' = 'status'
): Error & {
  status?: number;
  statusCode?: number;
  response?: { status: number };
  message: string;
} {
  const error = new Error(
    `Request failed with status code ${statusCode}`
  ) as Error & {
    status?: number;
    statusCode?: number;
    response?: { status: number };
    message: string;
  };

  switch (format) {
    case 'status':
      error.status = statusCode;
      break;
    case 'statusCode':
      error.statusCode = statusCode;
      break;
    case 'response':
      error.response = { status: statusCode };
      break;
    case 'message':
      error.message = `Request failed with status code ${statusCode}`;
      break;
  }

  return error;
}

describe('retry-utils', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    enableLogging('debug');
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    disableLogging();
  });

  describe('withRetry()', () => {
    it('should succeed on first attempt', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      const result = await withRetry(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on 404 error and eventually succeed', async () => {
      let attemptCount = 0;
      const fn = jest.fn().mockImplementation(async () => {
        attemptCount++;
        if (attemptCount < 2) {
          throw createErrorWithStatus(404);
        }
        return 'success';
      });

      const promise = withRetry(fn);
      // Advance timers to allow retry delay (1000ms for first retry)
      await jest.advanceTimersByTimeAsync(1000);
      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry on 408 error and eventually succeed', async () => {
      let attemptCount = 0;
      const fn = jest.fn().mockImplementation(async () => {
        attemptCount++;
        if (attemptCount < 2) {
          throw createErrorWithStatus(408);
        }
        return 'success';
      });

      const promise = withRetry(fn);
      // Advance timers to allow retry delay (1000ms for first retry)
      await jest.advanceTimersByTimeAsync(1000);
      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry on 429 error and eventually succeed', async () => {
      let attemptCount = 0;
      const fn = jest.fn().mockImplementation(async () => {
        attemptCount++;
        if (attemptCount < 2) {
          throw createErrorWithStatus(429);
        }
        return 'success';
      });

      const promise = withRetry(fn);
      // Advance timers to allow retry delay (1000ms for first retry)
      await jest.advanceTimersByTimeAsync(1000);
      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry on 500 error and eventually succeed', async () => {
      let attemptCount = 0;
      const fn = jest.fn().mockImplementation(async () => {
        attemptCount++;
        if (attemptCount < 2) {
          throw createErrorWithStatus(500);
        }
        return 'success';
      });

      const promise = withRetry(fn);
      // Advance timers to allow retry delay (1000ms for first retry)
      await jest.advanceTimersByTimeAsync(1000);
      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry on 502 error and eventually succeed', async () => {
      let attemptCount = 0;
      const fn = jest.fn().mockImplementation(async () => {
        attemptCount++;
        if (attemptCount < 2) {
          throw createErrorWithStatus(502);
        }
        return 'success';
      });

      const promise = withRetry(fn);
      // Advance timers to allow retry delay (1000ms for first retry)
      await jest.advanceTimersByTimeAsync(1000);
      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry on 503 error and eventually succeed', async () => {
      let attemptCount = 0;
      const fn = jest.fn().mockImplementation(async () => {
        attemptCount++;
        if (attemptCount < 2) {
          throw createErrorWithStatus(503);
        }
        return 'success';
      });

      const promise = withRetry(fn);
      // Advance timers to allow retry delay (1000ms for first retry)
      await jest.advanceTimersByTimeAsync(1000);
      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should not retry on 400 error (non-retryable)', async () => {
      const fn = jest.fn().mockRejectedValue(createErrorWithStatus(400));

      await expect(withRetry(fn)).rejects.toThrow(
        'Request failed with status code 400'
      );
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should not retry on 401 error (non-retryable)', async () => {
      const fn = jest.fn().mockRejectedValue(createErrorWithStatus(401));

      await expect(withRetry(fn)).rejects.toThrow(
        'Request failed with status code 401'
      );
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should not retry on 403 error (non-retryable)', async () => {
      const fn = jest.fn().mockRejectedValue(createErrorWithStatus(403));

      await expect(withRetry(fn)).rejects.toThrow(
        'Request failed with status code 403'
      );
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should not retry on 422 error (non-retryable)', async () => {
      const fn = jest.fn().mockRejectedValue(createErrorWithStatus(422));

      await expect(withRetry(fn)).rejects.toThrow(
        'Request failed with status code 422'
      );
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should fail after max retries exceeded', async () => {
      const fn = jest.fn().mockRejectedValue(createErrorWithStatus(500));

      const promise = expect(
        withRetry(fn, undefined, STREAMING_MAX_RETRIES)
      ).rejects.toThrow('Request failed with status code 500');
      // Advance timers for all retries: 1000ms (retry 1) + 2000ms (retry 2) + 4000ms (retry 3) = 7000ms
      await jest.advanceTimersByTimeAsync(7000);
      await promise;
      expect(fn).toHaveBeenCalledTimes(STREAMING_MAX_RETRIES + 1);
    });

    it('should succeed after multiple retries', async () => {
      let attemptCount = 0;
      const fn = jest.fn().mockImplementation(async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw createErrorWithStatus(500);
        }
        return 'success';
      });

      const promise = withRetry(fn, undefined, STREAMING_MAX_RETRIES);
      // Advance timers for 2 retries: 1000ms (retry 1) + 2000ms (retry 2) = 3000ms
      await jest.advanceTimersByTimeAsync(3000);
      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should call onRetry callback on each retry attempt', async () => {
      let attemptCount = 0;
      const onRetry = jest.fn();
      const fn = jest.fn().mockImplementation(async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw createErrorWithStatus(500);
        }
        return 'success';
      });

      const promise = withRetry(fn, undefined, STREAMING_MAX_RETRIES, onRetry);
      // Advance timers for 2 retries: 1000ms (retry 1) + 2000ms (retry 2) = 3000ms
      await jest.advanceTimersByTimeAsync(3000);
      await promise;

      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(onRetry.mock.calls[0][0]).toHaveProperty('status', 500);
      expect(onRetry.mock.calls[1][0]).toHaveProperty('status', 500);
    });

    it('should not call onRetry for non-retryable errors', async () => {
      const onRetry = jest.fn();
      const fn = jest.fn().mockRejectedValue(createErrorWithStatus(400));

      await expect(
        withRetry(fn, undefined, STREAMING_MAX_RETRIES, onRetry)
      ).rejects.toThrow();

      expect(onRetry).not.toHaveBeenCalled();
    });

    it('should include taskId in retry logging', async () => {
      const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
      let attemptCount = 0;
      const taskId = 'test-task-123';
      const fn = jest.fn().mockImplementation(async () => {
        attemptCount++;
        if (attemptCount < 2) {
          throw createErrorWithStatus(500);
        }
        return 'success';
      });

      const promise = withRetry(fn, taskId);
      // Advance timers to allow retry delay (1000ms for first retry)
      await jest.advanceTimersByTimeAsync(1000);
      await promise;

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Retry #${attemptCount} for task ${taskId}`)
      );

      consoleInfoSpy.mockRestore();
    });

    it('should use custom maxRetries', async () => {
      const customMaxRetries = 2;
      const fn = jest.fn().mockRejectedValue(createErrorWithStatus(500));

      const promise = expect(
        withRetry(fn, undefined, customMaxRetries)
      ).rejects.toThrow();
      // Advance timers for 2 retries: 1000ms (retry 1) + 2000ms (retry 2) = 3000ms
      await jest.advanceTimersByTimeAsync(3000);
      await promise;

      expect(fn).toHaveBeenCalledTimes(customMaxRetries + 1);
    });

    it('should handle error without status code (non-retryable)', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Generic error'));

      await expect(withRetry(fn)).rejects.toThrow('Generic error');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should preserve original error when max retries exceeded', async () => {
      const originalError = createErrorWithStatus(500);
      const fn = jest.fn().mockRejectedValue(originalError);

      const promise = expect(withRetry(fn, undefined, 1)).rejects.toBe(
        originalError
      );
      // Advance timers for 1 retry: 1000ms
      await jest.advanceTimersByTimeAsync(1000);
      await promise;
    });
  });

  describe('handleGalileoHttpExceptionsForRetry()', () => {
    it('should pass through successful results', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      const wrapped = handleGalileoHttpExceptionsForRetry(fn);

      const result = await wrapped();

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should re-throw 404 errors', async () => {
      const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
      const error = createErrorWithStatus(404);
      const fn = jest.fn().mockRejectedValue(error);
      const wrapped = handleGalileoHttpExceptionsForRetry(fn);

      await expect(wrapped()).rejects.toThrow(
        'Request failed with status code 404'
      );

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        'Trace not found, retrying...'
      );
      consoleInfoSpy.mockRestore();
    });

    it('should re-throw 408 errors', async () => {
      const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
      const error = createErrorWithStatus(408);
      const fn = jest.fn().mockRejectedValue(error);
      const wrapped = handleGalileoHttpExceptionsForRetry(fn);

      await expect(wrapped()).rejects.toThrow(
        'Request failed with status code 408'
      );

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        'Request timed out, retrying...'
      );
      consoleInfoSpy.mockRestore();
    });

    it('should re-throw 429 errors', async () => {
      const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
      const error = createErrorWithStatus(429);
      const fn = jest.fn().mockRejectedValue(error);
      const wrapped = handleGalileoHttpExceptionsForRetry(fn);

      await expect(wrapped()).rejects.toThrow(
        'Request failed with status code 429'
      );

      expect(consoleInfoSpy).toHaveBeenCalledWith('Rate limited, retrying...');
      consoleInfoSpy.mockRestore();
    });

    it('should re-throw 500+ errors', async () => {
      const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
      const error = createErrorWithStatus(500);
      const fn = jest.fn().mockRejectedValue(error);
      const wrapped = handleGalileoHttpExceptionsForRetry(fn);

      await expect(wrapped()).rejects.toThrow(
        'Request failed with status code 500'
      );

      expect(consoleInfoSpy).toHaveBeenCalledWith('Server error, retrying...');
      consoleInfoSpy.mockRestore();
    });

    it('should log error for non-retryable status codes', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = createErrorWithStatus(400);
      const fn = jest.fn().mockRejectedValue(error);
      const wrapped = handleGalileoHttpExceptionsForRetry(fn);

      await expect(wrapped()).rejects.toThrow(
        'Request failed with status code 400'
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unrecoverable failure or unrecognized error')
      );
      consoleErrorSpy.mockRestore();
    });

    it('should handle errors with statusCode property', async () => {
      const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
      const error = createErrorWithStatus(404, 'statusCode');
      const fn = jest.fn().mockRejectedValue(error);
      const wrapped = handleGalileoHttpExceptionsForRetry(fn);

      await expect(wrapped()).rejects.toThrow();

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        'Trace not found, retrying...'
      );
      consoleInfoSpy.mockRestore();
    });

    it('should handle errors with response.status property', async () => {
      const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
      const error = createErrorWithStatus(500, 'response');
      const fn = jest.fn().mockRejectedValue(error);
      const wrapped = handleGalileoHttpExceptionsForRetry(fn);

      await expect(wrapped()).rejects.toThrow();

      expect(consoleInfoSpy).toHaveBeenCalledWith('Server error, retrying...');
      consoleInfoSpy.mockRestore();
    });

    it('should handle errors with status code in message', async () => {
      const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
      const error = createErrorWithStatus(404, 'message');
      const fn = jest.fn().mockRejectedValue(error);
      const wrapped = handleGalileoHttpExceptionsForRetry(fn);

      await expect(wrapped()).rejects.toThrow();

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        'Trace not found, retrying...'
      );
      consoleInfoSpy.mockRestore();
    });

    it('should handle errors without status code', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = new Error('Generic error');
      const fn = jest.fn().mockRejectedValue(error);
      const wrapped = handleGalileoHttpExceptionsForRetry(fn);

      await expect(wrapped()).rejects.toThrow('Generic error');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unrecoverable failure or unrecognized error')
      );
      consoleErrorSpy.mockRestore();
    });

    it('should preserve function arguments', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      const wrapped = handleGalileoHttpExceptionsForRetry(fn);

      await wrapped('arg1', 'arg2', 'arg3');

      expect(fn).toHaveBeenCalledWith('arg1', 'arg2', 'arg3');
    });

    it('should preserve function return type', async () => {
      const fn = jest.fn().mockResolvedValue({ data: 'result' });
      const wrapped = handleGalileoHttpExceptionsForRetry(fn);

      const result = await wrapped();

      expect(result).toEqual({ data: 'result' });
    });
  });

  describe('getStatusCodeFromError() (indirectly)', () => {
    it('should extract status code from error.status property', async () => {
      const error = createErrorWithStatus(404, 'status');
      const fn = jest.fn().mockRejectedValue(error);
      const wrapped = handleGalileoHttpExceptionsForRetry(fn);

      const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
      await expect(wrapped()).rejects.toThrow();

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        'Trace not found, retrying...'
      );
      consoleInfoSpy.mockRestore();
    });

    it('should extract status code from error.statusCode property', async () => {
      const error = createErrorWithStatus(500, 'statusCode');
      const fn = jest.fn().mockRejectedValue(error);
      const wrapped = handleGalileoHttpExceptionsForRetry(fn);

      const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
      await expect(wrapped()).rejects.toThrow();

      expect(consoleInfoSpy).toHaveBeenCalledWith('Server error, retrying...');
      consoleInfoSpy.mockRestore();
    });

    it('should extract status code from error.response.status property', async () => {
      const error = createErrorWithStatus(429, 'response');
      const fn = jest.fn().mockRejectedValue(error);
      const wrapped = handleGalileoHttpExceptionsForRetry(fn);

      const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
      await expect(wrapped()).rejects.toThrow();

      expect(consoleInfoSpy).toHaveBeenCalledWith('Rate limited, retrying...');
      consoleInfoSpy.mockRestore();
    });

    it('should extract status code from error message string', async () => {
      const error = createErrorWithStatus(408, 'message');
      const fn = jest.fn().mockRejectedValue(error);
      const wrapped = handleGalileoHttpExceptionsForRetry(fn);

      const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
      await expect(wrapped()).rejects.toThrow();

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        'Request timed out, retrying...'
      );
      consoleInfoSpy.mockRestore();
    });

    it('should return undefined for errors without status code', async () => {
      const error = new Error('No status code');
      const fn = jest.fn().mockRejectedValue(error);
      const wrapped = handleGalileoHttpExceptionsForRetry(fn);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      await expect(wrapped()).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unrecoverable failure or unrecognized error')
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('isRetryableError() (indirectly)', () => {
    it('should retry 404 errors', async () => {
      const fn = jest.fn().mockRejectedValue(createErrorWithStatus(404));
      const promise = expect(withRetry(fn, undefined, 1)).rejects.toThrow();
      // Advance timers for 1 retry: 1000ms
      await jest.advanceTimersByTimeAsync(1000);
      await promise;
      expect(fn).toHaveBeenCalledTimes(2); // 1 initial + 1 retry
    });

    it('should retry 408 errors', async () => {
      const fn = jest.fn().mockRejectedValue(createErrorWithStatus(408));
      const promise = expect(withRetry(fn, undefined, 1)).rejects.toThrow();
      // Advance timers for 1 retry: 1000ms
      await jest.advanceTimersByTimeAsync(1000);
      await promise;
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry 429 errors', async () => {
      const fn = jest.fn().mockRejectedValue(createErrorWithStatus(429));
      const promise = expect(withRetry(fn, undefined, 1)).rejects.toThrow();
      // Advance timers for 1 retry: 1000ms
      await jest.advanceTimersByTimeAsync(1000);
      await promise;
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry 500 errors', async () => {
      const fn = jest.fn().mockRejectedValue(createErrorWithStatus(500));
      const promise = expect(withRetry(fn, undefined, 1)).rejects.toThrow();
      // Advance timers for 1 retry: 1000ms
      await jest.advanceTimersByTimeAsync(1000);
      await promise;
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry 502 errors', async () => {
      const fn = jest.fn().mockRejectedValue(createErrorWithStatus(502));
      const promise = expect(withRetry(fn, undefined, 1)).rejects.toThrow();
      // Advance timers for 1 retry: 1000ms
      await jest.advanceTimersByTimeAsync(1000);
      await promise;
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry 503 errors', async () => {
      const fn = jest.fn().mockRejectedValue(createErrorWithStatus(503));
      const promise = expect(withRetry(fn, undefined, 1)).rejects.toThrow();
      // Advance timers for 1 retry: 1000ms
      await jest.advanceTimersByTimeAsync(1000);
      await promise;
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should not retry 400 errors', async () => {
      const fn = jest.fn().mockRejectedValue(createErrorWithStatus(400));
      await expect(withRetry(fn)).rejects.toThrow();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should not retry 401 errors', async () => {
      const fn = jest.fn().mockRejectedValue(createErrorWithStatus(401));
      await expect(withRetry(fn)).rejects.toThrow();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should not retry 403 errors', async () => {
      const fn = jest.fn().mockRejectedValue(createErrorWithStatus(403));
      await expect(withRetry(fn)).rejects.toThrow();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should not retry 422 errors', async () => {
      const fn = jest.fn().mockRejectedValue(createErrorWithStatus(422));
      await expect(withRetry(fn)).rejects.toThrow();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should not retry errors without status code', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('No status'));
      await expect(withRetry(fn)).rejects.toThrow();
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });
});
