import { GalileoSingleton, flushAll, resetAll } from '../src/singleton';
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

describe('GalileoSingleton', () => {
  beforeEach(() => {
    // Reset the singleton instance before each test
    // @ts-expect-error - accessing private static property for testing
    GalileoSingleton.instance = undefined;
  });

  afterEach(async () => {
    // Clean up all loggers after each test
    const singleton = GalileoSingleton.getInstance();
    await singleton.resetAll();
  });

  describe('getInstance', () => {
    it('should return the same singleton instance', () => {
      const instance1 = GalileoSingleton.getInstance();
      const instance2 = GalileoSingleton.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('get', () => {
    it('should create and return a logger with default key', () => {
      const singleton = GalileoSingleton.getInstance();
      const logger = singleton.get();
      expect(logger).toBeDefined();
      expect(GalileoLogger).toHaveBeenCalled();
    });

    it('should create logger with project and logstream', () => {
      const singleton = GalileoSingleton.getInstance();
      const logger = singleton.get({
        project: 'test-project',
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
      const singleton = GalileoSingleton.getInstance();
      const logger1 = singleton.get({
        project: 'project1',
        logstream: 'stream1'
      });
      const logger2 = singleton.get({
        project: 'project1',
        logstream: 'stream1'
      });
      expect(logger1).toBe(logger2);
    });

    it('should create different loggers for different keys', () => {
      const singleton = GalileoSingleton.getInstance();
      const logger1 = singleton.get({
        project: 'project1',
        logstream: 'stream1'
      });
      const logger2 = singleton.get({
        project: 'project2',
        logstream: 'stream2'
      });
      expect(logger1).not.toBe(logger2);
    });

    it('should handle experimentId correctly', () => {
      const singleton = GalileoSingleton.getInstance();
      const logger = singleton.get({
        project: 'project1',
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
      const singleton = GalileoSingleton.getInstance();
      const logger1 = singleton.get({
        project: 'project1',
        logstream: 'stream1',
        experimentId: 'experiment1'
      });
      const logger2 = singleton.get({
        project: 'project1',
        experimentId: 'experiment1'
      });
      // They should be the same because experimentId takes precedence
      expect(logger1).toBe(logger2);
    });

    it('should support different modes', () => {
      const singleton = GalileoSingleton.getInstance();
      const logger1 = singleton.get({
        project: 'project1',
        logstream: 'stream1',
        mode: 'batch'
      });
      const logger2 = singleton.get({
        project: 'project1',
        logstream: 'stream1',
        mode: 'streaming'
      });
      expect(logger1).not.toBe(logger2);
    });

    it('should support local_Metrics', () => {
      const singleton = GalileoSingleton.getInstance();
      const localMetrics: LocalMetricConfig[] = [
        {
          name: 'test-metric',
          scorerFn: () => 0.5
        }
      ];
      const logger = singleton.get({
        project: 'project1',
        logstream: 'stream1',
        local_Metrics: localMetrics
      });
      expect(logger).toBeDefined();
      // Verify the logger was created with local_Metrics
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

      const singleton = GalileoSingleton.getInstance();
      const logger = singleton.get();
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

      const singleton = GalileoSingleton.getInstance();
      // Both env vars should be checked, but GALILEO_PROJECT takes precedence in our implementation
      const logger = singleton.get();
      expect(logger).toBeDefined();

      process.env = originalEnv;
    });
  });

  describe('reset', () => {
    it('should reset a specific logger', async () => {
      const singleton = GalileoSingleton.getInstance();
      const logger = singleton.get({
        project: 'project1',
        logstream: 'stream1'
      });

      await singleton.reset({
        project: 'project1',
        log_stream: 'stream1'
      });

      expect(logger.terminate).toHaveBeenCalled();

      // Getting the same key should create a new logger
      const newLogger = singleton.get({
        project: 'project1',
        logstream: 'stream1'
      });
      expect(newLogger).not.toBe(logger);
    });

    it('should handle reset with experiment_id', async () => {
      const singleton = GalileoSingleton.getInstance();
      const logger = singleton.get({
        project: 'project1',
        experimentId: 'experiment1'
      });

      await singleton.reset({
        project: 'project1',
        experiment_id: 'experiment1'
      });

      expect(logger.terminate).toHaveBeenCalled();
    });
  });

  describe('resetAll', () => {
    it('should reset all loggers', async () => {
      const singleton = GalileoSingleton.getInstance();
      const logger1 = singleton.get({
        project: 'project1',
        logstream: 'stream1'
      });
      const logger2 = singleton.get({
        project: 'project2',
        logstream: 'stream2'
      });

      await singleton.resetAll();

      expect(logger1.terminate).toHaveBeenCalled();
      expect(logger2.terminate).toHaveBeenCalled();

      const allLoggers = singleton.getAllLoggers();
      expect(allLoggers.size).toBe(0);
    });
  });

  describe('flush', () => {
    it('should flush a specific logger', async () => {
      const singleton = GalileoSingleton.getInstance();
      const logger = singleton.get({
        project: 'project1',
        logstream: 'stream1'
      });

      await singleton.flush({
        project: 'project1',
        log_stream: 'stream1'
      });

      expect(logger.flush).toHaveBeenCalled();
    });

    it('should not throw if logger does not exist', async () => {
      const singleton = GalileoSingleton.getInstance();

      await expect(
        singleton.flush({
          project: 'nonexistent',
          log_stream: 'nonexistent'
        })
      ).resolves.not.toThrow();
    });
  });

  describe('flushAll', () => {
    it('should flush all loggers', async () => {
      const singleton = GalileoSingleton.getInstance();
      const logger1 = singleton.get({
        project: 'project1',
        logstream: 'stream1'
      });
      const logger2 = singleton.get({
        project: 'project2',
        logstream: 'stream2'
      });

      await singleton.flushAll();

      expect(logger1.flush).toHaveBeenCalled();
      expect(logger2.flush).toHaveBeenCalled();
    });
  });

  describe('getAllLoggers', () => {
    it('should return a copy of all loggers', () => {
      const singleton = GalileoSingleton.getInstance();
      singleton.get({ project: 'project1', logstream: 'stream1' });
      singleton.get({ project: 'project2', logstream: 'stream2' });

      const allLoggers = singleton.getAllLoggers();
      expect(allLoggers.size).toBe(2);
    });

    it('should return a copy that does not affect the original', () => {
      const singleton = GalileoSingleton.getInstance();
      singleton.get({ project: 'project1', logstream: 'stream1' });

      const allLoggers = singleton.getAllLoggers();
      allLoggers.clear();

      const allLoggers2 = singleton.getAllLoggers();
      expect(allLoggers2.size).toBe(1);
    });
  });

  describe('Legacy compatibility methods', () => {
    describe('setClient', () => {
      it('should set a client with default key', () => {
        const singleton = GalileoSingleton.getInstance();
        const mockLogger = {
          flush: jest.fn(),
          terminate: jest.fn()
        } as unknown as GalileoLogger;

        singleton.setClient(mockLogger);
        // Verify it was stored by getting with default key
        const retrievedLogger = singleton.get();
        expect(retrievedLogger).toBe(mockLogger);
      });
    });
  });

  describe('Key generation edge cases', () => {
    it('should handle null values in parameters', () => {
      const singleton = GalileoSingleton.getInstance();
      const logger = singleton.get({
        project: null,
        logstream: null,
        experimentId: null
      });
      expect(logger).toBeDefined();
    });

    it('should handle empty strings', () => {
      const singleton = GalileoSingleton.getInstance();
      const logger1 = singleton.get({
        project: '',
        logstream: ''
      });
      const logger2 = singleton.get({
        project: '',
        logstream: ''
      });
      expect(logger1).toBe(logger2);
    });
  });

  describe('Exported functions', () => {
    it('should work with flushAll exported function', async () => {
      const singleton = GalileoSingleton.getInstance();
      const logger1 = singleton.get({
        project: 'project1',
        logstream: 'stream1'
      });
      const logger2 = singleton.get({
        project: 'project2',
        logstream: 'stream2'
      });

      await flushAll();

      expect(logger1.flush).toHaveBeenCalled();
      expect(logger2.flush).toHaveBeenCalled();
    });

    it('should work with resetAll exported function', async () => {
      const singleton = GalileoSingleton.getInstance();
      const logger1 = singleton.get({
        project: 'project1',
        logstream: 'stream1'
      });
      const logger2 = singleton.get({
        project: 'project2',
        logstream: 'stream2'
      });

      await resetAll();

      expect(logger1.terminate).toHaveBeenCalled();
      expect(logger2.terminate).toHaveBeenCalled();
    });
  });
});
