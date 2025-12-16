import {
  getLogStreams,
  createLogStream,
  getLogStream,
  enableMetrics
} from '../../src/utils/log-streams';
import { LogStream } from '../../src/entities/log-streams';
import {
  GalileoMetrics,
  LocalMetricConfig,
  Metric
} from '../../src/types/metrics.types';
import { mockLogStream } from '../common';

// Create mock implementation functions
const mockList = jest.fn();
const mockGet = jest.fn();
const mockCreate = jest.fn();
const mockEnableMetrics = jest.fn();

jest.mock('../../src/entities/log-streams', () => {
  return {
    LogStreams: jest.fn().mockImplementation(() => {
      return {
        list: mockList,
        get: mockGet,
        create: mockCreate,
        enableMetrics: mockEnableMetrics
      };
    }),
    LogStream: jest.fn().mockImplementation((data) => {
      // Return a simple object that mimics LogStream
      return {
        id: data.id,
        name: data.name,
        projectId: data.projectId,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        createdBy: data.createdBy,
        hasUserCreatedSessions: data.hasUserCreatedSessions
      };
    })
  };
});

describe('log-streams utils', () => {
  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    originalEnv = { ...process.env };
    jest.clearAllMocks();
    // Clear log stream related envs by default
    delete process.env.GALILEO_PROJECT_ID;
    delete process.env.GALILEO_PROJECT;
    delete process.env.GALILEO_LOG_STREAM;
    delete process.env.GALILEO_LOG_STREAM_NAME;
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('getLogStreams', () => {
    describe('string overload', () => {
      it('should delegate to LogStreams.list with projectName', async () => {
        const mockLogStreams = [new LogStream(mockLogStream)];
        mockList.mockResolvedValue(mockLogStreams);

        const result = await getLogStreams('test-project');

        expect(mockList).toHaveBeenCalledWith({ projectName: 'test-project' });
        expect(result).toEqual(mockLogStreams);
      });

      it('should return LogStream array', async () => {
        const mockLogStreams = [new LogStream(mockLogStream)];
        mockList.mockResolvedValue(mockLogStreams);

        const result = await getLogStreams('test-project');

        expect(Array.isArray(result)).toBe(true);
        expect(result).toHaveLength(1);
      });

      it('should propagate errors from LogStreams.list', async () => {
        const error = new Error('Project not found');
        mockList.mockRejectedValue(error);

        await expect(getLogStreams('test-project')).rejects.toThrow(
          'Project not found'
        );
      });
    });

    describe('options object overload', () => {
      it('should delegate to LogStreams.list with options', async () => {
        const mockLogStreams = [new LogStream(mockLogStream)];
        mockList.mockResolvedValue(mockLogStreams);

        const result = await getLogStreams({ projectName: 'test-project' });

        expect(mockList).toHaveBeenCalledWith({ projectName: 'test-project' });
        expect(result).toEqual(mockLogStreams);
      });

      it('should handle projectId option', async () => {
        const mockLogStreams = [new LogStream(mockLogStream)];
        mockList.mockResolvedValue(mockLogStreams);

        await getLogStreams({ projectId: 'proj-123' });

        expect(mockList).toHaveBeenCalledWith({ projectId: 'proj-123' });
      });

      it('should handle projectName option', async () => {
        const mockLogStreams = [new LogStream(mockLogStream)];
        mockList.mockResolvedValue(mockLogStreams);

        await getLogStreams({ projectName: 'test-project' });

        expect(mockList).toHaveBeenCalledWith({ projectName: 'test-project' });
      });

      it('should propagate errors from LogStreams.list', async () => {
        const error = new Error('Invalid project');
        mockList.mockRejectedValue(error);

        await expect(getLogStreams({ projectId: 'proj-123' })).rejects.toThrow(
          'Invalid project'
        );
      });
    });
  });

  describe('createLogStream', () => {
    describe('name + projectName string overload', () => {
      it('should delegate to LogStreams.create with name and projectName', async () => {
        const mockCreatedLogStream = new LogStream(mockLogStream);
        mockCreate.mockResolvedValue(mockCreatedLogStream);

        const result = await createLogStream('new-stream', 'test-project');

        expect(mockCreate).toHaveBeenCalledWith('new-stream', {
          projectName: 'test-project'
        });
        expect(result).toEqual(mockCreatedLogStream);
      });

      it('should return LogStream instance', async () => {
        const mockCreatedLogStream = new LogStream(mockLogStream);
        mockCreate.mockResolvedValue(mockCreatedLogStream);

        const result = await createLogStream('new-stream', 'test-project');

        expect(result).toBeDefined();
        expect(result.id).toBe(mockLogStream.id);
      });

      it('should propagate errors from LogStreams.create', async () => {
        const error = new Error('Project not found');
        mockCreate.mockRejectedValue(error);

        await expect(
          createLogStream('new-stream', 'test-project')
        ).rejects.toThrow('Project not found');
      });
    });

    describe('name + options object overload', () => {
      it('should delegate to LogStreams.create with name and options', async () => {
        const mockCreatedLogStream = new LogStream(mockLogStream);
        mockCreate.mockResolvedValue(mockCreatedLogStream);

        const result = await createLogStream('new-stream', {
          projectName: 'test-project'
        });

        expect(mockCreate).toHaveBeenCalledWith('new-stream', {
          projectName: 'test-project'
        });
        expect(result).toEqual(mockCreatedLogStream);
      });

      it('should handle projectId option', async () => {
        const mockCreatedLogStream = new LogStream(mockLogStream);
        mockCreate.mockResolvedValue(mockCreatedLogStream);

        await createLogStream('new-stream', { projectId: 'proj-123' });

        expect(mockCreate).toHaveBeenCalledWith('new-stream', {
          projectId: 'proj-123'
        });
      });

      it('should handle projectName option', async () => {
        const mockCreatedLogStream = new LogStream(mockLogStream);
        mockCreate.mockResolvedValue(mockCreatedLogStream);

        await createLogStream('new-stream', { projectName: 'test-project' });

        expect(mockCreate).toHaveBeenCalledWith('new-stream', {
          projectName: 'test-project'
        });
      });

      it('should handle undefined options', async () => {
        const mockCreatedLogStream = new LogStream(mockLogStream);
        mockCreate.mockResolvedValue(mockCreatedLogStream);

        await createLogStream('new-stream', undefined);

        expect(mockCreate).toHaveBeenCalledWith('new-stream', undefined);
      });

      it('should propagate errors from LogStreams.create', async () => {
        const error = new Error('Invalid project');
        mockCreate.mockRejectedValue(error);

        await expect(
          createLogStream('new-stream', { projectId: 'proj-123' })
        ).rejects.toThrow('Invalid project');
      });
    });
  });

  describe('getLogStream', () => {
    describe('required projectName overload', () => {
      it('should delegate to LogStreams.get with options', async () => {
        const mockFoundLogStream = new LogStream(mockLogStream);
        mockGet.mockResolvedValue(mockFoundLogStream);

        const result = await getLogStream({
          id: 'ls-123',
          projectName: 'test-project'
        });

        expect(mockGet).toHaveBeenCalledWith({
          id: 'ls-123',
          projectName: 'test-project'
        });
        expect(result).toEqual(mockFoundLogStream);
      });

      it('should throw error when log stream not found (wrapper behavior)', async () => {
        mockGet.mockResolvedValue(undefined);

        await expect(
          getLogStream({ id: 'nonexistent', projectName: 'test-project' })
        ).rejects.toThrow("Log stream 'nonexistent' not found");
      });

      it('should return LogStream when found', async () => {
        const mockFoundLogStream = new LogStream(mockLogStream);
        mockGet.mockResolvedValue(mockFoundLogStream);

        const result = await getLogStream({
          id: 'ls-123',
          projectName: 'test-project'
        });

        expect(result).toBeDefined();
        expect(result.id).toBe(mockLogStream.id);
      });

      it('should propagate validation errors from LogStreams.get', async () => {
        // The utility function validates before delegating, so it throws its own error
        await expect(
          getLogStream({ projectName: 'test-project' })
        ).rejects.toThrow(
          'To fetch a log stream with `getLogStream`, either id or name must be provided'
        );
      });
    });

    describe('optional projectId/projectName overload', () => {
      it('should delegate to LogStreams.get with options', async () => {
        const mockFoundLogStream = new LogStream(mockLogStream);
        mockGet.mockResolvedValue(mockFoundLogStream);

        const result = await getLogStream({
          id: 'ls-123',
          projectId: 'proj-123'
        });

        expect(mockGet).toHaveBeenCalledWith({
          id: 'ls-123',
          projectId: 'proj-123'
        });
        expect(result).toEqual(mockFoundLogStream);
      });

      it('should throw error when log stream not found (wrapper behavior)', async () => {
        mockGet.mockResolvedValue(undefined);

        await expect(
          getLogStream({ name: 'nonexistent', projectId: 'proj-123' })
        ).rejects.toThrow("Log stream 'nonexistent' not found");
      });

      it('should handle projectId option', async () => {
        const mockFoundLogStream = new LogStream(mockLogStream);
        mockGet.mockResolvedValue(mockFoundLogStream);

        await getLogStream({ id: 'ls-123', projectId: 'proj-123' });

        expect(mockGet).toHaveBeenCalledWith({
          id: 'ls-123',
          projectId: 'proj-123'
        });
      });

      it('should handle projectName option', async () => {
        const mockFoundLogStream = new LogStream(mockLogStream);
        mockGet.mockResolvedValue(mockFoundLogStream);

        await getLogStream({ name: 'default', projectName: 'test-project' });

        expect(mockGet).toHaveBeenCalledWith({
          name: 'default',
          projectName: 'test-project'
        });
      });

      it('should propagate validation errors from LogStreams.get', async () => {
        const error = new Error(
          'Either projectId or projectName must be provided'
        );
        mockGet.mockRejectedValue(error);

        await expect(getLogStream({ id: 'ls-123' })).rejects.toThrow(
          'Either projectId or projectName must be provided'
        );
      });
    });

    describe('error handling', () => {
      it('should throw when neither id nor name provided', async () => {
        await expect(
          getLogStream({ projectName: 'test-project' })
        ).rejects.toThrow(
          'To fetch a log stream with `getLogStream`, either id or name must be provided'
        );
      });

      it('should throw when log stream not found (different from class method which returns undefined)', async () => {
        mockGet.mockResolvedValue(undefined);

        await expect(
          getLogStream({ id: 'nonexistent', projectName: 'test-project' })
        ).rejects.toThrow("Log stream 'nonexistent' not found");
      });

      it('should throw with name identifier when id not provided', async () => {
        mockGet.mockResolvedValue(undefined);

        await expect(
          getLogStream({
            name: 'nonexistent-name',
            projectName: 'test-project'
          })
        ).rejects.toThrow("Log stream 'nonexistent-name' not found");
      });
    });
  });

  describe('enableMetrics', () => {
    describe('success cases', () => {
      it('should delegate to LogStreams.enableMetrics', async () => {
        const localMetrics: LocalMetricConfig[] = [
          {
            name: 'custom_metric',
            scorerFn: () => 1.0
          }
        ];
        mockEnableMetrics.mockResolvedValue(localMetrics);

        const result = await enableMetrics({
          projectName: 'test-project',
          logStreamName: 'default',
          metrics: [GalileoMetrics.correctness]
        });

        expect(mockEnableMetrics).toHaveBeenCalledWith({
          projectName: 'test-project',
          logStreamName: 'default',
          metrics: [GalileoMetrics.correctness]
        });
        expect(result).toEqual(localMetrics);
      });

      it('should return local metrics array', async () => {
        const localMetrics: LocalMetricConfig[] = [
          {
            name: 'custom_metric',
            scorerFn: () => 1.0
          }
        ];
        mockEnableMetrics.mockResolvedValue(localMetrics);

        const result = await enableMetrics({
          projectName: 'test-project',
          logStreamName: 'default',
          metrics: [GalileoMetrics.correctness]
        });

        expect(Array.isArray(result)).toBe(true);
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('custom_metric');
      });

      it('should propagate all options correctly', async () => {
        const localMetrics: LocalMetricConfig[] = [];
        mockEnableMetrics.mockResolvedValue(localMetrics);

        const metrics = [
          GalileoMetrics.correctness,
          'toxicity',
          { name: 'custom_metric', version: 2 } as Metric
        ];

        await enableMetrics({
          projectName: 'test-project',
          logStreamName: 'default',
          metrics
        });

        expect(mockEnableMetrics).toHaveBeenCalledWith({
          projectName: 'test-project',
          logStreamName: 'default',
          metrics
        });
      });
    });

    describe('error cases', () => {
      it('should propagate errors from LogStreams.enableMetrics', async () => {
        const error = new Error('Project not found');
        mockEnableMetrics.mockRejectedValue(error);

        await expect(
          enableMetrics({
            projectName: 'nonexistent-project',
            logStreamName: 'default',
            metrics: [GalileoMetrics.correctness]
          })
        ).rejects.toThrow('Project not found');
      });

      it('should propagate validation errors', async () => {
        const error = new Error('At least one metric must be provided');
        mockEnableMetrics.mockRejectedValue(error);

        await expect(
          enableMetrics({
            projectName: 'test-project',
            logStreamName: 'default',
            metrics: []
          })
        ).rejects.toThrow('At least one metric must be provided');
      });

      it('should propagate log stream not found errors', async () => {
        const error = new Error(
          "Log stream 'nonexistent' not found in project 'test-project'"
        );
        mockEnableMetrics.mockRejectedValue(error);

        await expect(
          enableMetrics({
            projectName: 'test-project',
            logStreamName: 'nonexistent',
            metrics: [GalileoMetrics.correctness]
          })
        ).rejects.toThrow(
          "Log stream 'nonexistent' not found in project 'test-project'"
        );
      });
    });
  });
});
