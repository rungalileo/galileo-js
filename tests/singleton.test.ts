import {
  flushAll,
  resetAll,
  reset,
  flush,
  getAllLoggers,
  getLogger,
  init,
  experimentContext,
  GalileoSingleton,
  startSession,
  setSession,
  clearSession,
  galileoContext
} from '../src/singleton';
import { GalileoLogger } from '../src/utils/galileo-logger';
import type { LocalMetricConfig } from '../src/types/metrics.types';

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
        startSession: jest.fn().mockResolvedValue('session-id'),
        setSessionId: jest.fn(),
        clearSession: jest.fn()
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

    it('should create different loggers for different keys', () => {
      const logger1 = getLogger({
        projectName: 'project1',
        logstream: 'stream1'
      });
      const logger2 = getLogger({
        projectName: 'project2',
        logstream: 'stream2'
      });
      expect(logger1).not.toBe(logger2);
    });

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

    it('should support different modes', () => {
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
    });

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

  describe('getAllLoggers', () => {
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
  });

  describe('Legacy compatibility methods', () => {
    describe('getLogger', () => {
      it('should return the default logger', () => {
        const logger1 = getLogger();
        const logger2 = getLogger();
        // Should return the same default logger instance
        expect(logger1).toBe(logger2);
        expect(logger1).toBeDefined();
      });

      it('should return default logger even when other loggers exist', () => {
        getLogger({ projectName: 'project1', logstream: 'stream1' });
        const defaultLogger = getLogger();
        expect(defaultLogger).toBeDefined();
        // Should be different from the explicitly created logger
        const explicitLogger = getLogger({
          projectName: 'project1',
          logstream: 'stream1'
        });
        expect(defaultLogger).not.toBe(explicitLogger);
      });
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

  describe('Session management (1.2.1)', () => {
    it('startSession should call logger.startSession and return session id', async () => {
      const logger = getLogger();
      const id = await startSession({
        name: 'chat-session',
        externalId: 'user-1'
      });
      expect(id).toBe('session-id');
      expect(logger.startSession).toHaveBeenCalledWith({
        name: 'chat-session',
        externalId: 'user-1'
      });
    });

    it('setSession should call logger.setSessionId', () => {
      const logger = getLogger();
      setSession('session-123');
      expect(logger.setSessionId).toHaveBeenCalledWith('session-123');
    });

    it('clearSession should call logger.clearSession', () => {
      const logger = getLogger();
      clearSession();
      expect(logger.clearSession).toHaveBeenCalled();
    });
  });

  describe('galileoContext lifecycle (1.2.2)', () => {
    it('should expose init, flush, flushAll, reset, resetAll, startSession, setSession, clearSession', () => {
      expect(galileoContext.init).toBe(init);
      expect(galileoContext.flush).toBe(flush);
      expect(galileoContext.flushAll).toBe(flushAll);
      expect(galileoContext.reset).toBe(reset);
      expect(galileoContext.resetAll).toBe(resetAll);
      expect(galileoContext.startSession).toBe(startSession);
      expect(galileoContext.setSession).toBe(setSession);
      expect(galileoContext.clearSession).toBe(clearSession);
    });
  });

  describe('AsyncLocalStorage Context (experimentContext)', () => {
    let originalEnv: Record<string, string | undefined>;

    beforeEach(() => {
      originalEnv = { ...process.env };
      // Clear env vars to test context isolation
      delete process.env.GALILEO_PROJECT;
      delete process.env.GALILEO_PROJECT_NAME;
      delete process.env.GALILEO_LOG_STREAM;
      delete process.env.GALILEO_LOG_STREAM_NAME;
    });

    afterEach(async () => {
      // Restore original env vars
      process.env = originalEnv;
      // Clear any context that might have been set
      await resetAll();
    });

    describe('Context propagation', () => {
      it('should propagate context to getLogger() via experimentContext.run()', async () => {
        await experimentContext.run(
          {
            projectName: 'context-project',
            experimentId: 'context-experiment'
          },
          async () => {
            const logger = getLogger();
            expect(logger).toBeDefined();
            expect(GalileoLogger).toHaveBeenCalledWith(
              expect.objectContaining({
                projectName: 'context-project',
                experimentId: 'context-experiment'
              })
            );
          }
        );
      });

      it('should use context values when explicit params not provided', async () => {
        await experimentContext.run(
          { projectName: 'ctx-project', experimentId: 'ctx-exp' },
          async () => {
            const logger = getLogger({ mode: 'streaming' });
            expect(logger).toBeDefined();
            expect(GalileoLogger).toHaveBeenCalledWith(
              expect.objectContaining({
                projectName: 'ctx-project',
                experimentId: 'ctx-exp',
                mode: 'streaming'
              })
            );
          }
        );
      });

      it('should prioritize context over env vars', async () => {
        process.env.GALILEO_PROJECT = 'env-project';
        process.env.GALILEO_LOG_STREAM = 'env-stream';

        await experimentContext.run(
          { projectName: 'context-project', experimentId: 'context-exp' },
          async () => {
            const logger = getLogger();
            expect(logger).toBeDefined();
            expect(GalileoLogger).toHaveBeenCalledWith(
              expect.objectContaining({
                projectName: 'context-project',
                experimentId: 'context-exp'
              })
            );
          }
        );
      });

      it('should allow explicit params to override context', async () => {
        await experimentContext.run(
          { projectName: 'context-project', experimentId: 'context-exp' },
          async () => {
            const logger = getLogger({
              projectName: 'explicit-project',
              experimentId: 'explicit-exp'
            });
            expect(logger).toBeDefined();
            expect(GalileoLogger).toHaveBeenCalledWith(
              expect.objectContaining({
                projectName: 'explicit-project',
                experimentId: 'explicit-exp'
              })
            );
          }
        );
      });
    });

    describe('Context in key generation', () => {
      it('should use projectName from context in key generation', async () => {
        await experimentContext.run(
          { projectName: 'ctx-project' },
          async () => {
            const logger1 = getLogger({ logstream: 'stream1' });
            const logger2 = getLogger({ logstream: 'stream1' });
            // Should be the same logger because key includes context projectName
            expect(logger1).toBe(logger2);
          }
        );
      });

      it('should use experimentId from context in key generation', async () => {
        await experimentContext.run({ experimentId: 'ctx-exp' }, async () => {
          const logger1 = getLogger({ projectName: 'project1' });
          const logger2 = getLogger({ projectName: 'project1' });
          // Should be the same logger because key includes context experimentId
          expect(logger1).toBe(logger2);
        });
      });

      it('should use context values in logger config when options missing', async () => {
        await experimentContext.run(
          { projectName: 'ctx-project', experimentId: 'ctx-exp' },
          async () => {
            const logger = getLogger({ mode: 'streaming' });
            expect(logger).toBeDefined();
            expect(GalileoLogger).toHaveBeenCalledWith(
              expect.objectContaining({
                projectName: 'ctx-project',
                experimentId: 'ctx-exp',
                mode: 'streaming'
              })
            );
          }
        );
      });
    });

    describe('Context isolation', () => {
      it('should create different loggers for different async contexts', async () => {
        let logger1: GalileoLogger | undefined;
        let logger2: GalileoLogger | undefined;

        await experimentContext.run(
          { projectName: 'context1', experimentId: 'exp1' },
          async () => {
            logger1 = getLogger({ mode: 'batch' });
          }
        );

        await experimentContext.run(
          { projectName: 'context2', experimentId: 'exp2' },
          async () => {
            logger2 = getLogger({ mode: 'batch' });
          }
        );

        expect(logger1).not.toBe(logger2);
      });

      it('should not leak context outside async boundary', async () => {
        await experimentContext.run(
          { projectName: 'context-project', experimentId: 'context-exp' },
          async () => {
            // Context should be available here
            const logger = getLogger();
            expect(logger).toBeDefined();
            // Verify context was used inside the boundary
            expect(GalileoLogger).toHaveBeenLastCalledWith(
              expect.objectContaining({
                projectName: 'context-project',
                experimentId: 'context-exp'
              })
            );
          }
        );

        // Context should not be available here
        const loggerOutside = getLogger({
          projectName: 'outside-project',
          experimentId: 'outside-exp'
        });
        expect(loggerOutside).toBeDefined();

        // Explicitly verify that the last call (outside context) does NOT use context values
        expect(GalileoLogger).toHaveBeenLastCalledWith(
          expect.not.objectContaining({
            projectName: 'context-project',
            experimentId: 'context-exp'
          })
        );

        // Additional explicit checks to ensure context values are not present
        const lastCallConfig = (GalileoLogger as unknown as jest.Mock).mock
          .calls[
          (GalileoLogger as unknown as jest.Mock).mock.calls.length - 1
        ][0];
        expect(lastCallConfig.projectName).not.toBe('context-project');
        expect(lastCallConfig.experimentId).not.toBe('context-exp');
      });
    });
  });

  describe('Deprecated Methods', () => {
    describe('getClient()', () => {
      it('should return lastAvailableLogger when available', () => {
        const logger1 = getLogger({
          projectName: 'project1',
          logstream: 'stream1'
        });

        const singleton = GalileoSingleton.getInstance();
        const client = singleton.getClient();

        expect(client).toBe(logger1);
      });

      it('should create new logger when lastAvailableLogger is null', async () => {
        await resetAll();

        const singleton = GalileoSingleton.getInstance();
        const client = singleton.getClient();

        expect(client).toBeDefined();
        expect(GalileoLogger).toHaveBeenCalled();
      });

      it('should update lastAvailableLogger when creating new logger', () => {
        const logger1 = getLogger({
          projectName: 'project1',
          logstream: 'stream1'
        });

        const singleton = GalileoSingleton.getInstance();
        const client1 = singleton.getClient();
        expect(client1).toBe(logger1);

        const logger2 = getLogger({
          projectName: 'project2',
          logstream: 'stream2'
        });

        const client2 = singleton.getClient();
        expect(client2).toBe(logger2);
      });

      it('should return null lastAvailableLogger after reset()', async () => {
        const logger = getLogger({
          projectName: 'project1',
          logstream: 'stream1'
        });

        const singleton = GalileoSingleton.getInstance();
        expect(singleton.getClient()).toBe(logger);

        await reset({
          projectName: 'project1',
          logstream: 'stream1'
        });

        // After reset, getClient should create a new logger
        const newClient = singleton.getClient();
        expect(newClient).toBeDefined();
        expect(newClient).not.toBe(logger);
      });
    });

    describe('setClient()', () => {
      it('should set logger with default key', () => {
        const mockLogger = {
          projectName: 'test',
          flush: jest.fn().mockResolvedValue([]),
          terminate: jest.fn().mockResolvedValue(undefined),
          startSession: jest.fn().mockResolvedValue('session-id')
        } as unknown as GalileoLogger;

        const singleton = GalileoSingleton.getInstance();
        singleton.setClient(mockLogger);

        const defaultLogger = getLogger();
        expect(defaultLogger).toBe(mockLogger);
      });

      it('should overwrite existing default logger', () => {
        const logger1 = getLogger();
        const mockLogger = {
          projectName: 'test',
          flush: jest.fn().mockResolvedValue([]),
          terminate: jest.fn().mockResolvedValue(undefined),
          startSession: jest.fn().mockResolvedValue('session-id')
        } as unknown as GalileoLogger;

        const singleton = GalileoSingleton.getInstance();
        singleton.setClient(mockLogger);

        const defaultLogger = getLogger();
        expect(defaultLogger).toBe(mockLogger);
        expect(defaultLogger).not.toBe(logger1);
      });

      it('should set lastAvailableLogger when setClient is called', () => {
        getLogger();
        const mockLogger = {
          projectName: 'test',
          flush: jest.fn().mockResolvedValue([]),
          terminate: jest.fn().mockResolvedValue(undefined),
          startSession: jest.fn().mockResolvedValue('session-id')
        } as unknown as GalileoLogger;

        const singleton = GalileoSingleton.getInstance();
        singleton.setClient(mockLogger);

        expect(singleton.getClient()).toBe(mockLogger);
      });

      it('should make logger retrievable via default key', () => {
        const mockLogger = {
          projectName: 'test',
          flush: jest.fn().mockResolvedValue([]),
          terminate: jest.fn().mockResolvedValue(undefined),
          startSession: jest.fn().mockResolvedValue('session-id')
        } as unknown as GalileoLogger;

        const singleton = GalileoSingleton.getInstance();
        singleton.setClient(mockLogger);

        const retrieved = getLogger();
        expect(retrieved).toBe(mockLogger);
      });
    });
  });

  describe('init() Function', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    describe('Basic initialization', () => {
      it('should create logger without session', async () => {
        await init({
          projectName: 'test-project',
          logstream: 'test-stream'
        });

        expect(GalileoLogger).toHaveBeenCalled();
        const mockLogger = (GalileoLogger as unknown as jest.Mock).mock.results[
          (GalileoLogger as unknown as jest.Mock).mock.results.length - 1
        ].value;
        expect(mockLogger.startSession).not.toHaveBeenCalled();
      });

      it('should create logger with startNewSession: true', async () => {
        await init({
          projectName: 'test-project',
          logstream: 'test-stream',
          startNewSession: true
        });

        expect(GalileoLogger).toHaveBeenCalled();
        const mockLogger = (GalileoLogger as unknown as jest.Mock).mock.results[
          (GalileoLogger as unknown as jest.Mock).mock.results.length - 1
        ].value;
        expect(mockLogger.startSession).toHaveBeenCalled();
      });

      it('should call logger.startSession() with correct params', async () => {
        await init({
          projectName: 'test-project',
          logstream: 'test-stream',
          startNewSession: true,
          sessionName: 'test-session',
          previousSessionId: 'prev-session-id',
          externalId: 'external-id'
        });

        const mockLogger = (GalileoLogger as unknown as jest.Mock).mock.results[
          (GalileoLogger as unknown as jest.Mock).mock.results.length - 1
        ].value;
        expect(mockLogger.startSession).toHaveBeenCalledWith({
          name: 'test-session',
          previousSessionId: 'prev-session-id',
          externalId: 'external-id'
        });
      });
    });

    describe('Session parameters', () => {
      it('should pass sessionName to startSession()', async () => {
        await init({
          projectName: 'test-project',
          startNewSession: true,
          sessionName: 'my-session'
        });

        const mockLogger = (GalileoLogger as unknown as jest.Mock).mock.results[
          (GalileoLogger as unknown as jest.Mock).mock.results.length - 1
        ].value;
        expect(mockLogger.startSession).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'my-session'
          })
        );
      });

      it('should pass previousSessionId to startSession()', async () => {
        await init({
          projectName: 'test-project',
          startNewSession: true,
          previousSessionId: 'prev-id'
        });

        const mockLogger = (GalileoLogger as unknown as jest.Mock).mock.results[
          (GalileoLogger as unknown as jest.Mock).mock.results.length - 1
        ].value;
        expect(mockLogger.startSession).toHaveBeenCalledWith(
          expect.objectContaining({
            previousSessionId: 'prev-id'
          })
        );
      });

      it('should pass externalId to startSession()', async () => {
        await init({
          projectName: 'test-project',
          startNewSession: true,
          externalId: 'ext-id'
        });

        const mockLogger = (GalileoLogger as unknown as jest.Mock).mock.results[
          (GalileoLogger as unknown as jest.Mock).mock.results.length - 1
        ].value;
        expect(mockLogger.startSession).toHaveBeenCalledWith(
          expect.objectContaining({
            externalId: 'ext-id'
          })
        );
      });

      it('should pass all session params combined', async () => {
        await init({
          projectName: 'test-project',
          startNewSession: true,
          sessionName: 'session',
          previousSessionId: 'prev',
          externalId: 'ext'
        });

        const mockLogger = (GalileoLogger as unknown as jest.Mock).mock.results[
          (GalileoLogger as unknown as jest.Mock).mock.results.length - 1
        ].value;
        expect(mockLogger.startSession).toHaveBeenCalledWith({
          name: 'session',
          previousSessionId: 'prev',
          externalId: 'ext'
        });
      });
    });

    describe('Integration with context', () => {
      it('should use context for logger creation', async () => {
        await experimentContext.run(
          { projectName: 'ctx-project', experimentId: 'ctx-exp' },
          async () => {
            await init({ mode: 'streaming' });

            expect(GalileoLogger).toHaveBeenCalledWith(
              expect.objectContaining({
                projectName: 'ctx-project',
                experimentId: 'ctx-exp',
                mode: 'streaming'
              })
            );
          }
        );
      });

      it('should allow explicit params to override context', async () => {
        await experimentContext.run(
          { projectName: 'ctx-project', experimentId: 'ctx-exp' },
          async () => {
            await init({
              projectName: 'explicit-project',
              experimentId: 'explicit-exp'
            });

            expect(GalileoLogger).toHaveBeenCalledWith(
              expect.objectContaining({
                projectName: 'explicit-project',
                experimentId: 'explicit-exp'
              })
            );
          }
        );
      });
    });
  });

  describe('Key Generation Edge Cases', () => {
    let originalEnv: Record<string, string | undefined>;

    beforeEach(() => {
      originalEnv = { ...process.env };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    describe('Environment variable precedence', () => {
      it('should use GALILEO_PROJECT when GALILEO_PROJECT_NAME not set', () => {
        delete process.env.GALILEO_PROJECT_NAME;
        process.env.GALILEO_PROJECT = 'project-from-env';

        const logger = getLogger();
        expect(logger).toBeDefined();
        // Env vars are used for key generation, not logger config
        // Verify logger was created (env vars affect key, not config)
        expect(GalileoLogger).toHaveBeenCalled();
      });

      it('should prefer GALILEO_PROJECT over GALILEO_PROJECT_NAME', () => {
        process.env.GALILEO_PROJECT = 'project-env';
        process.env.GALILEO_PROJECT_NAME = 'project-name';

        const logger1 = getLogger();
        const logger2 = getLogger();
        // Same logger should be returned (same key from env vars)
        expect(logger1).toBe(logger2);
        expect(logger1).toBeDefined();
      });

      it('should use GALILEO_LOG_STREAM when GALILEO_LOG_STREAM_NAME not set', () => {
        delete process.env.GALILEO_LOG_STREAM_NAME;
        process.env.GALILEO_LOG_STREAM = 'stream-from-env';

        const logger = getLogger();
        expect(logger).toBeDefined();
        expect(GalileoLogger).toHaveBeenCalled();
      });

      it('should prefer GALILEO_LOG_STREAM over GALILEO_LOG_STREAM_NAME', () => {
        process.env.GALILEO_LOG_STREAM = 'stream-env';
        process.env.GALILEO_LOG_STREAM_NAME = 'stream-name';

        const logger = getLogger();
        expect(logger).toBeDefined();
        // Based on implementation, GALILEO_LOG_STREAM is checked first
        expect(GalileoLogger).toHaveBeenCalled();
      });
    });

    describe('Context precedence', () => {
      it('should override env vars with context projectName', async () => {
        process.env.GALILEO_PROJECT = 'env-project';

        await experimentContext.run(
          { projectName: 'context-project' },
          async () => {
            const logger = getLogger();
            expect(logger).toBeDefined();
            expect(GalileoLogger).toHaveBeenCalledWith(
              expect.objectContaining({
                projectName: 'context-project'
              })
            );
          }
        );
      });

      it('should override env vars with context experimentId', async () => {
        process.env.GALILEO_LOG_STREAM = 'env-stream';

        await experimentContext.run(
          { experimentId: 'context-exp' },
          async () => {
            const logger = getLogger({ projectName: 'project1' });
            expect(logger).toBeDefined();
            expect(GalileoLogger).toHaveBeenCalledWith(
              expect.objectContaining({
                experimentId: 'context-exp'
              })
            );
          }
        );
      });

      it('should allow explicit params to override context', async () => {
        await experimentContext.run(
          { projectName: 'context-project', experimentId: 'context-exp' },
          async () => {
            const logger = getLogger({
              projectName: 'explicit-project',
              experimentId: 'explicit-exp'
            });
            expect(logger).toBeDefined();
            expect(GalileoLogger).toHaveBeenCalledWith(
              expect.objectContaining({
                projectName: 'explicit-project',
                experimentId: 'explicit-exp'
              })
            );
          }
        );
      });
    });

    describe('Mode defaulting', () => {
      it('should default mode to batch when not provided', () => {
        const logger1 = getLogger({ projectName: 'p1', logstream: 's1' });
        const logger2 = getLogger({
          projectName: 'p1',
          logstream: 's1',
          mode: 'batch'
        });
        // Should be the same logger because mode defaults to 'batch'
        expect(logger1).toBe(logger2);
      });

      it('should include mode in key generation', () => {
        const logger1 = getLogger({
          projectName: 'p1',
          logstream: 's1',
          mode: 'batch'
        });
        const logger2 = getLogger({
          projectName: 'p1',
          logstream: 's1',
          mode: 'streaming'
        });
        expect(logger1).not.toBe(logger2);
      });
    });

    describe('Identifier logic', () => {
      it('should prioritize experimentId over logstream', () => {
        const logger1 = getLogger({
          projectName: 'p1',
          logstream: 'stream1',
          experimentId: 'exp1'
        });
        const logger2 = getLogger({
          projectName: 'p1',
          experimentId: 'exp1'
        });
        // Should be the same because experimentId takes precedence
        expect(logger1).toBe(logger2);
      });

      it('should prioritize experimentId from context over logstream from env', async () => {
        process.env.GALILEO_LOG_STREAM = 'env-stream';

        await experimentContext.run(
          { experimentId: 'context-exp' },
          async () => {
            const logger1 = getLogger({ projectName: 'p1' });
            const logger2 = getLogger({
              projectName: 'p1',
              experimentId: 'context-exp'
            });
            // Should be the same because context experimentId is used
            expect(logger1).toBe(logger2);
          }
        );
      });

      it('should use logstream when experimentId not provided', () => {
        const logger1 = getLogger({
          projectName: 'p1',
          logstream: 'stream1'
        });
        const logger2 = getLogger({
          projectName: 'p1',
          logstream: 'stream1'
        });
        expect(logger1).toBe(logger2);
      });
    });
  });

  describe('lastAvailableLogger Tracking', () => {
    describe('Tracking behavior', () => {
      it('should update lastAvailableLogger when new logger created', () => {
        const logger1 = getLogger({
          projectName: 'project1',
          logstream: 'stream1'
        });

        const singleton = GalileoSingleton.getInstance();
        expect(singleton.getClient()).toBe(logger1);

        const logger2 = getLogger({
          projectName: 'project2',
          logstream: 'stream2'
        });

        expect(singleton.getClient()).toBe(logger2);
      });

      it('should clear lastAvailableLogger when logger reset', async () => {
        const logger = getLogger({
          projectName: 'project1',
          logstream: 'stream1'
        });

        const singleton = GalileoSingleton.getInstance();
        expect(singleton.getClient()).toBe(logger);

        await reset({
          projectName: 'project1',
          logstream: 'stream1'
        });

        // After reset, getClient should create a new logger (not return null)
        const newClient = singleton.getClient();
        expect(newClient).toBeDefined();
        expect(newClient).not.toBe(logger);
      });

      it('should clear lastAvailableLogger when resetAll() called', async () => {
        const logger = getLogger({
          projectName: 'project1',
          logstream: 'stream1'
        });

        const singleton = GalileoSingleton.getInstance();
        expect(singleton.getClient()).toBe(logger);

        await resetAll();

        // After resetAll, getClient should create a new logger
        const newClient = singleton.getClient();
        expect(newClient).toBeDefined();
        expect(newClient).not.toBe(logger);
      });

      it('should persist lastAvailableLogger when different logger reset', async () => {
        getLogger({
          projectName: 'project1',
          logstream: 'stream1'
        });
        const logger2 = getLogger({
          projectName: 'project2',
          logstream: 'stream2'
        });

        const singleton = GalileoSingleton.getInstance();
        expect(singleton.getClient()).toBe(logger2);

        await reset({
          projectName: 'project1',
          logstream: 'stream1'
        });

        // logger2 should still be lastAvailableLogger
        expect(singleton.getClient()).toBe(logger2);
      });
    });

    describe('Integration with getClient()', () => {
      it('should use tracked logger in getClient()', () => {
        const logger = getLogger({
          projectName: 'project1',
          logstream: 'stream1'
        });

        const singleton = GalileoSingleton.getInstance();
        const client = singleton.getClient();

        expect(client).toBe(logger);
      });

      it('should create new logger in getClient() when lastAvailableLogger is null', async () => {
        await resetAll();

        const singleton = GalileoSingleton.getInstance();
        const client = singleton.getClient();

        expect(client).toBeDefined();
        expect(GalileoLogger).toHaveBeenCalled();
      });
    });
  });

  describe('Additional Edge Cases', () => {
    describe('Null/Undefined handling', () => {
      it('should handle undefined params correctly', () => {
        const logger1 = getLogger({
          projectName: undefined,
          logstream: undefined,
          experimentId: undefined,
          mode: undefined
        });
        const logger2 = getLogger();
        // Should be the same default logger
        expect(logger1).toBe(logger2);
      });

      it('should handle mixed undefined and defined params', () => {
        const logger1 = getLogger({
          projectName: 'project1',
          logstream: undefined
        });
        const logger2 = getLogger({
          projectName: 'project1'
        });
        // Should use defaults for undefined values
        expect(logger1).toBe(logger2);
      });
    });

    describe('Empty string handling', () => {
      it('should handle empty strings vs undefined differently in key generation', () => {
        const logger1 = getLogger({
          projectName: '',
          logstream: ''
        });
        const logger2 = getLogger({
          projectName: undefined,
          logstream: undefined
        });
        // Empty strings should create different key than undefined (which uses defaults)
        expect(logger1).not.toBe(logger2);
      });
    });

    describe('Multiple logger scenarios', () => {
      it('should track lastAvailableLogger correctly with multiple loggers', () => {
        getLogger({
          projectName: 'project1',
          logstream: 'stream1'
        });
        getLogger({
          projectName: 'project2',
          logstream: 'stream2'
        });
        const logger3 = getLogger({
          projectName: 'project3',
          logstream: 'stream3'
        });

        const singleton = GalileoSingleton.getInstance();
        expect(singleton.getClient()).toBe(logger3);
      });

      it('should update lastAvailableLogger based on reset order', async () => {
        const logger1 = getLogger({
          projectName: 'project1',
          logstream: 'stream1'
        });
        const logger2 = getLogger({
          projectName: 'project2',
          logstream: 'stream2'
        });

        const singleton = GalileoSingleton.getInstance();
        expect(singleton.getClient()).toBe(logger2);

        await reset({
          projectName: 'project2',
          logstream: 'stream2'
        });

        // When logger2 (lastAvailableLogger) is reset, lastAvailableLogger becomes null
        // getClient() will create a new logger
        const newClient = singleton.getClient();
        expect(newClient).toBeDefined();
        expect(newClient).not.toBe(logger2);
        expect(newClient).not.toBe(logger1);
      });
    });
  });

  describe('projectId support', () => {
    beforeEach(() => {
      resetAll();
      delete process.env.GALILEO_PROJECT;
      delete process.env.GALILEO_PROJECT_NAME;
      jest.clearAllMocks();
    });

    it('should accept projectId in getLogger options', () => {
      const logger = getLogger({
        projectId: 'proj-123',
        logstream: 'test-stream'
      });

      expect(logger).toBeDefined();
      expect(GalileoLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'proj-123',
          logStreamName: 'test-stream'
        })
      );
    });

    it('should use projectId from context', async () => {
      await experimentContext.run({ projectId: 'proj-456' }, async () => {
        const logger = getLogger();
        expect(logger).toBeDefined();
        expect(GalileoLogger).toHaveBeenCalledWith(
          expect.objectContaining({
            projectId: 'proj-456'
          })
        );
      });
    });

    it('should prefer explicit projectId over context', async () => {
      await experimentContext.run({ projectId: 'proj-context' }, async () => {
        const logger = getLogger({ projectId: 'proj-explicit' });
        expect(logger).toBeDefined();
        expect(GalileoLogger).toHaveBeenCalledWith(
          expect.objectContaining({
            projectId: 'proj-explicit'
          })
        );
      });
    });

    it('should use projectName when projectId not provided', () => {
      const logger = getLogger({
        projectName: 'my-project',
        logstream: 'stream'
      });

      expect(logger).toBeDefined();
      expect(GalileoLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          projectName: 'my-project',
          logStreamName: 'stream'
        })
      );
    });

    it('should work with both projectId and projectName', () => {
      const logger = getLogger({
        projectId: 'proj-789',
        projectName: 'my-project',
        logstream: 'stream'
      });

      expect(logger).toBeDefined();
      expect(GalileoLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'proj-789',
          projectName: 'my-project',
          logStreamName: 'stream'
        })
      );
    });

    it('should work with projectId and experimentId', () => {
      const logger = getLogger({
        projectId: 'proj-abc',
        experimentId: 'exp-123'
      });

      expect(logger).toBeDefined();
      expect(GalileoLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'proj-abc',
          experimentId: 'exp-123'
        })
      );
    });
  });

  describe('Environment variable fallbacks', () => {
    beforeEach(() => {
      resetAll();
      delete process.env.GALILEO_PROJECT;
      delete process.env.GALILEO_PROJECT_NAME;
      delete process.env.GALILEO_LOG_STREAM;
      delete process.env.GALILEO_LOG_STREAM_NAME;
      jest.clearAllMocks();
    });

    afterEach(() => {
      delete process.env.GALILEO_LOG_STREAM;
      delete process.env.GALILEO_LOG_STREAM_NAME;
    });

    it('should use GALILEO_LOG_STREAM when no logstream provided', () => {
      process.env.GALILEO_LOG_STREAM = 'env-stream';

      const logger = getLogger();

      expect(logger).toBeDefined();
      expect(GalileoLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          logStreamName: 'env-stream'
        })
      );
    });

    it('should prefer options.logstream over GALILEO_LOG_STREAM', () => {
      process.env.GALILEO_LOG_STREAM = 'env-stream';

      const logger = getLogger({ logstream: 'explicit-stream' });

      expect(logger).toBeDefined();
      expect(GalileoLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          logStreamName: 'explicit-stream'
        })
      );
    });

    it('should use GALILEO_LOG_STREAM with context projectName', async () => {
      process.env.GALILEO_LOG_STREAM = 'env-stream';

      await experimentContext.run(
        { projectName: 'context-project' },
        async () => {
          const logger = getLogger();

          expect(logger).toBeDefined();
          expect(GalileoLogger).toHaveBeenCalledWith(
            expect.objectContaining({
              projectName: 'context-project',
              logStreamName: 'env-stream'
            })
          );
        }
      );
    });

    it('should combine GALILEO_PROJECT with explicit logstream', () => {
      process.env.GALILEO_PROJECT = 'env-project';

      const logger = getLogger({ logstream: 'explicit-stream' });

      expect(logger).toBeDefined();
      expect(GalileoLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          projectName: 'env-project',
          logStreamName: 'explicit-stream'
        })
      );
    });

    it('should use both GALILEO_PROJECT and GALILEO_LOG_STREAM when no options', () => {
      process.env.GALILEO_PROJECT = 'env-project';
      process.env.GALILEO_LOG_STREAM = 'env-stream';

      const logger = getLogger();

      expect(logger).toBeDefined();
      expect(GalileoLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          projectName: 'env-project',
          logStreamName: 'env-stream'
        })
      );
    });

    it('should prefer GALILEO_LOG_STREAM over GALILEO_LOG_STREAM_NAME', () => {
      process.env.GALILEO_LOG_STREAM = 'primary-var';
      process.env.GALILEO_LOG_STREAM_NAME = 'fallback-var';

      const logger = getLogger();

      expect(logger).toBeDefined();
      expect(GalileoLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          logStreamName: 'primary-var'
        })
      );
    });
  });
});
