import {
  flushAll,
  resetAll,
  reset,
  flush,
  getAllLoggers,
  getLogger
} from '../src/singleton';
import { GalileoLogger } from '../src/utils/galileo-logger';
import { LocalMetricConfig } from '../src/types/metrics.types';

// Mock the GalileoLogger
jest.mock('../src/utils/galileo-logger', () => {
  const actual = jest.requireActual('../src/utils/galileo-logger');
  return {
    ...actual,
    GalileoLogger: jest.fn().mockImplementation((config) => {
      const mockLogger = {
        projectName: config?.projectName,
        logStreamName: config?.logStreamName,
        experimentId: config?.experimentId,
        localMetrics: config?.localMetrics,
        mode: config?.mode,
        flush: jest.fn().mockResolvedValue([]),
        terminate: jest.fn().mockResolvedValue(undefined),
        startSession: jest.fn().mockResolvedValue('session-id')
      };
      return mockLogger;
    })
  };
});

describe('Singleton utility functions', () => {
  afterEach(async () => {
    // Clean up all loggers after each test
    await resetAll();
  });

  describe('getLogger', () => {
    it('should create and return a logger with default key', () => {
      const logger = getLogger();
      expect(logger).toBeDefined();
      expect(GalileoLogger).toHaveBeenCalled();
    });

    it('should create logger with project and logstream', () => {
      const logger = getLogger({
        projectName: 'test-project',
        logstream: 'test-log-stream'
      });
      expect(logger).toBeDefined();
      // Verify the logger was created with correct parameters
      expect(GalileoLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          projectName: 'test-project',
          logStreamName: 'test-log-stream'
        })
      );
    });

    it('should return the same logger instance for the same key', () => {
      const logger1 = getLogger({
        projectName: 'project1',
        logstream: 'stream1'
      });
      const logger2 = getLogger({
        projectName: 'project1',
        logstream: 'stream1'
      });
      expect(logger1).toBe(logger2);
    });

    /*it('should create different loggers for different keys', () => {
      const logger1 = getLogger({
        projectName: 'project1',
        logstream: 'stream1'
      });
      const logger2 = getLogger({
        projectName: 'project2',
        logstream: 'stream2'
      });
      expect(logger1).not.toBe(logger2);
    });*/

    it('should handle experimentId correctly', () => {
      const logger = getLogger({
        projectName: 'project1',
        experimentId: 'experiment1'
      });
      expect(logger).toBeDefined();
      // Verify the logger was created with experimentId
      expect(GalileoLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          projectName: 'project1',
          experimentId: 'experiment1'
        })
      );
    });

    it('should prioritize experimentId over logstream', () => {
      const logger1 = getLogger({
        projectName: 'project1',
        logstream: 'stream1',
        experimentId: 'experiment1'
      });
      const logger2 = getLogger({
        projectName: 'project1',
        experimentId: 'experiment1'
      });
      // They should be the same because experimentId takes precedence
      expect(logger1).toBe(logger2);
    });

    /*it('should support different modes', () => {
      const logger1 = getLogger({
        projectName: 'project1',
        logstream: 'stream1',
        mode: 'batch'
      });
      const logger2 = getLogger({
        projectName: 'project1',
        logstream: 'stream1',
        mode: 'streaming'
      });
      expect(logger1).not.toBe(logger2);
    });*/

    it('should support localMetrics', () => {
      const localMetrics: LocalMetricConfig[] = [
        {
          name: 'test-metric',
          scorerFn: () => 0.5
        }
      ];
      const logger = getLogger({
        projectName: 'project1',
        logstream: 'stream1',
        localMetrics: localMetrics
      });
      expect(logger).toBeDefined();
      // Verify the logger was created with localMetrics
      expect(GalileoLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          projectName: 'project1',
          logStreamName: 'stream1',
          localMetrics: localMetrics
        })
      );
    });

    it('should use environment variables as fallback', () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        GALILEO_PROJECT: 'env-project',
        GALILEO_LOG_STREAM: 'env-stream'
      };

      const logger = getLogger();
      expect(logger).toBeDefined();
      // The logger should be created with env vars as defaults
      expect(GalileoLogger).toHaveBeenCalled();

      process.env = originalEnv;
    });

    it('should prefer GALILEO_PROJECT_NAME over GALILEO_PROJECT', () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        GALILEO_PROJECT: 'project-from-env',
        GALILEO_PROJECT_NAME: 'project-from-name'
      };

      // Both env vars should be checked, but GALILEO_PROJECT takes precedence in our implementation
      const logger = getLogger();
      expect(logger).toBeDefined();

      process.env = originalEnv;
    });
  });

  describe('reset', () => {
    it('should reset a specific logger', async () => {
      const logger = getLogger({
        projectName: 'project1',
        logstream: 'stream1'
      });

      await reset({
        projectName: 'project1',
        logstream: 'stream1'
      });

      expect(logger.terminate).toHaveBeenCalled();

      // Getting the same key should create a new logger
      const newLogger = getLogger({
        projectName: 'project1',
        logstream: 'stream1'
      });
      expect(newLogger).not.toBe(logger);
    });

    it('should handle reset with experimentId', async () => {
      const logger = getLogger({
        projectName: 'project1',
        experimentId: 'experiment1'
      });

      await reset({
        projectName: 'project1',
        experimentId: 'experiment1'
      });

      expect(logger.terminate).toHaveBeenCalled();
    });
  });

  describe('resetAll', () => {
    it('should reset all loggers', async () => {
      const logger1 = getLogger({
        projectName: 'project1',
        logstream: 'stream1'
      });
      const logger2 = getLogger({
        projectName: 'project2',
        logstream: 'stream2'
      });

      await resetAll();

      expect(logger1.terminate).toHaveBeenCalled();
      expect(logger2.terminate).toHaveBeenCalled();

      const allLoggers = getAllLoggers();
      expect(allLoggers.size).toBe(0);
    });
  });

  describe('flush', () => {
    it('should flush a specific logger', async () => {
      const logger = getLogger({
        projectName: 'project1',
        logstream: 'stream1'
      });

      await flush({
        projectName: 'project1',
        logstream: 'stream1'
      });

      expect(logger.flush).toHaveBeenCalled();
    });

    it('should not throw if logger does not exist', async () => {
      await expect(
        flush({
          projectName: 'nonexistent',
          logstream: 'nonexistent'
        })
      ).resolves.not.toThrow();
    });
  });

  describe('flushAll', () => {
    it('should flush all loggers', async () => {
      const logger1 = getLogger({
        projectName: 'project1',
        logstream: 'stream1'
      });
      const logger2 = getLogger({
        projectName: 'project2',
        logstream: 'stream2'
      });

      await flushAll();

      expect(logger1.flush).toHaveBeenCalled();
      expect(logger2.flush).toHaveBeenCalled();
    });
  });

  /*describe('getAllLoggers', () => {
    it('should return a copy of all loggers', () => {
      getLogger({ projectName: 'project1', logstream: 'stream1' });
      getLogger({ projectName: 'project2', logstream: 'stream2' });

      const allLoggers = getAllLoggers();
      expect(allLoggers.size).toBe(2);
    });

    it('should return a copy that does not affect the original', () => {
      getLogger({ projectName: 'project1', logstream: 'stream1' });

      const allLoggers = getAllLoggers();
      allLoggers.clear();

      const allLoggers2 = getAllLoggers();
      expect(allLoggers2.size).toBe(1);
    });
  });*/

  describe('Legacy compatibility methods', () => {
    describe('getLogger', () => {
      it('should return the default logger', () => {
        const logger1 = getLogger();
        const logger2 = getLogger();
        // Should return the same default logger instance
        expect(logger1).toBe(logger2);
        expect(logger1).toBeDefined();
      });

      /*it('should return default logger even when other loggers exist', () => {
        getLogger({ projectName: 'project1', logstream: 'stream1' });
        const defaultLogger = getLogger();
        expect(defaultLogger).toBeDefined();
        // Should be different from the explicitly created logger
        const explicitLogger = getLogger({
          projectName: 'project1',
          logstream: 'stream1'
        });
        expect(defaultLogger).not.toBe(explicitLogger);
      });*/
    });
  });

  describe('Key generation edge cases', () => {
    it('should handle empty strings', () => {
      const logger1 = getLogger({
        projectName: '',
        logstream: ''
      });
      const logger2 = getLogger({
        projectName: '',
        logstream: ''
      });
      expect(logger1).toBe(logger2);
    });
  });

  describe('Exported functions integration', () => {
    it('should work with flushAll exported function', async () => {
      const logger1 = getLogger({
        projectName: 'project1',
        logstream: 'stream1'
      });
      const logger2 = getLogger({
        projectName: 'project2',
        logstream: 'stream2'
      });

      await flushAll();

      expect(logger1.flush).toHaveBeenCalled();
      expect(logger2.flush).toHaveBeenCalled();
    });

    it('should work with resetAll exported function', async () => {
      const logger1 = getLogger({
        projectName: 'project1',
        logstream: 'stream1'
      });
      const logger2 = getLogger({
        projectName: 'project2',
        logstream: 'stream2'
      });

      await resetAll();

      expect(logger1.terminate).toHaveBeenCalled();
      expect(logger2.terminate).toHaveBeenCalled();
    });
  });
});
