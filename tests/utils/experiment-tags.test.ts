import { ExperimentTags } from '../../src/entities/experiment-tags';
import type { RunTagDB } from '../../src/types/experiment.types';
import { TagType } from '../../src/types/tag.types';

// Create mock implementation functions
const mockInit = jest.fn().mockResolvedValue(undefined);
const mockGetExperimentTags = jest.fn();
const mockUpsertExperimentTag = jest.fn();
const mockDeleteExperimentTag = jest.fn();

jest.mock('../../src/api-client', () => {
  return {
    GalileoApiClient: jest.fn().mockImplementation(() => {
      return {
        init: mockInit,
        getExperimentTags: mockGetExperimentTags,
        upsertExperimentTag: mockUpsertExperimentTag,
        deleteExperimentTag: mockDeleteExperimentTag
      };
    })
  };
});

const EXAMPLE_PROJECT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const EXAMPLE_EXPERIMENT_ID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
const EXAMPLE_TAG_ID = 'c3d4e5f6-a7b8-9012-cdef-123456789012';
const EXAMPLE_TAG_KEY = 'environment';
const EXAMPLE_TAG_VALUE = 'production';
const EXAMPLE_CREATED_BY = 'd4e5f6a7-b8c9-0123-def0-123456789013';

const EXAMPLE_EXPERIMENT_TAG: RunTagDB = {
  id: EXAMPLE_TAG_ID,
  key: EXAMPLE_TAG_KEY,
  value: EXAMPLE_TAG_VALUE,
  tagType: 'generic',
  projectId: EXAMPLE_PROJECT_ID,
  runId: EXAMPLE_EXPERIMENT_ID,
  createdBy: EXAMPLE_CREATED_BY,
  createdAt: '2023-01-01T00:00:00.000000Z',
  updatedAt: '2023-01-01T00:00:00.000000Z'
};

const EXAMPLE_EXPERIMENT_TAG_RAG: RunTagDB = {
  id: EXAMPLE_TAG_ID,
  key: EXAMPLE_TAG_KEY,
  value: EXAMPLE_TAG_VALUE,
  tagType: 'rag',
  projectId: EXAMPLE_PROJECT_ID,
  runId: EXAMPLE_EXPERIMENT_ID,
  createdBy: EXAMPLE_CREATED_BY,
  createdAt: '2023-01-01T00:00:00.000000Z',
  updatedAt: '2023-01-01T00:00:00.000000Z'
};

describe('ExperimentTags entity', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Reset mock implementations to default
    mockInit.mockResolvedValue(undefined);
    mockGetExperimentTags.mockResolvedValue([EXAMPLE_EXPERIMENT_TAG]);
    mockUpsertExperimentTag.mockResolvedValue(EXAMPLE_EXPERIMENT_TAG);
    mockDeleteExperimentTag.mockResolvedValue(undefined);
  });

  describe('getExperimentTags', () => {
    test('test get experiment tags', async () => {
      const experimentTags = new ExperimentTags();
      const result = await experimentTags.getExperimentTags({
        projectId: EXAMPLE_PROJECT_ID,
        experimentId: EXAMPLE_EXPERIMENT_ID
      });

      expect(result).toEqual([EXAMPLE_EXPERIMENT_TAG]);
      expect(mockInit).toHaveBeenCalledTimes(2); // Once in ensureClient, once with projectId
      expect(mockInit).toHaveBeenCalledWith({ projectId: EXAMPLE_PROJECT_ID });
      expect(mockGetExperimentTags).toHaveBeenCalledWith(EXAMPLE_EXPERIMENT_ID);
    });

    test('test get experiment tags client cached', async () => {
      const experimentTags = new ExperimentTags();

      // First call
      await experimentTags.getExperimentTags({
        projectId: EXAMPLE_PROJECT_ID,
        experimentId: EXAMPLE_EXPERIMENT_ID
      });

      // Second call - client should be cached
      await experimentTags.getExperimentTags({
        projectId: EXAMPLE_PROJECT_ID,
        experimentId: EXAMPLE_EXPERIMENT_ID
      });

      // First call: ensureClient() creates client and calls init() (1), then method calls init({ projectId }) (1) = 2
      // Second call: ensureClient() returns cached client (no init), then method calls init({ projectId }) (1) = 1
      // Total: 3 calls
      expect(mockInit).toHaveBeenCalledTimes(3);
      expect(mockGetExperimentTags).toHaveBeenCalledTimes(2);
    });
  });

  describe('upsertExperimentTag', () => {
    test('test upsert experiment tag with default tagType', async () => {
      const experimentTags = new ExperimentTags();
      const result = await experimentTags.upsertExperimentTag({
        projectId: EXAMPLE_PROJECT_ID,
        experimentId: EXAMPLE_EXPERIMENT_ID,
        key: EXAMPLE_TAG_KEY,
        value: EXAMPLE_TAG_VALUE
      });

      expect(result).toEqual(EXAMPLE_EXPERIMENT_TAG);
      expect(mockInit).toHaveBeenCalledTimes(2); // Once in ensureClient, once with projectId
      expect(mockInit).toHaveBeenCalledWith({ projectId: EXAMPLE_PROJECT_ID });
      expect(mockUpsertExperimentTag).toHaveBeenCalledWith(
        EXAMPLE_EXPERIMENT_ID,
        EXAMPLE_TAG_KEY,
        EXAMPLE_TAG_VALUE,
        'generic'
      );
    });

    test('test upsert experiment tag with generic tagType', async () => {
      const experimentTags = new ExperimentTags();
      const result = await experimentTags.upsertExperimentTag({
        projectId: EXAMPLE_PROJECT_ID,
        experimentId: EXAMPLE_EXPERIMENT_ID,
        key: EXAMPLE_TAG_KEY,
        value: EXAMPLE_TAG_VALUE,
        tagType: TagType.GENERIC
      });

      expect(result).toEqual(EXAMPLE_EXPERIMENT_TAG);
      expect(mockUpsertExperimentTag).toHaveBeenCalledWith(
        EXAMPLE_EXPERIMENT_ID,
        EXAMPLE_TAG_KEY,
        EXAMPLE_TAG_VALUE,
        'generic'
      );
    });

    test('test upsert experiment tag with rag tagType', async () => {
      mockUpsertExperimentTag.mockResolvedValue(EXAMPLE_EXPERIMENT_TAG_RAG);

      const experimentTags = new ExperimentTags();
      const result = await experimentTags.upsertExperimentTag({
        projectId: EXAMPLE_PROJECT_ID,
        experimentId: EXAMPLE_EXPERIMENT_ID,
        key: EXAMPLE_TAG_KEY,
        value: EXAMPLE_TAG_VALUE,
        tagType: TagType.RAG
      });

      expect(result).toEqual(EXAMPLE_EXPERIMENT_TAG_RAG);
      expect(mockUpsertExperimentTag).toHaveBeenCalledWith(
        EXAMPLE_EXPERIMENT_ID,
        EXAMPLE_TAG_KEY,
        EXAMPLE_TAG_VALUE,
        'rag'
      );
    });

    test('test upsert experiment tag with string tagType', async () => {
      const experimentTags = new ExperimentTags();
      const result = await experimentTags.upsertExperimentTag({
        projectId: EXAMPLE_PROJECT_ID,
        experimentId: EXAMPLE_EXPERIMENT_ID,
        key: EXAMPLE_TAG_KEY,
        value: EXAMPLE_TAG_VALUE,
        tagType: 'custom-type'
      });

      expect(result).toEqual(EXAMPLE_EXPERIMENT_TAG);
      expect(mockUpsertExperimentTag).toHaveBeenCalledWith(
        EXAMPLE_EXPERIMENT_ID,
        EXAMPLE_TAG_KEY,
        EXAMPLE_TAG_VALUE,
        'custom-type'
      );
    });
  });

  describe('deleteExperimentTag', () => {
    test('test delete experiment tag', async () => {
      const experimentTags = new ExperimentTags();
      await experimentTags.deleteExperimentTag({
        projectId: EXAMPLE_PROJECT_ID,
        experimentId: EXAMPLE_EXPERIMENT_ID,
        tagId: EXAMPLE_TAG_ID
      });

      expect(mockInit).toHaveBeenCalledTimes(2); // Once in ensureClient, once with projectId
      expect(mockInit).toHaveBeenCalledWith({ projectId: EXAMPLE_PROJECT_ID });
      expect(mockDeleteExperimentTag).toHaveBeenCalledWith(
        EXAMPLE_EXPERIMENT_ID,
        EXAMPLE_TAG_ID
      );
    });

    test('test delete experiment tag resolves successfully', async () => {
      const experimentTags = new ExperimentTags();

      await expect(
        experimentTags.deleteExperimentTag({
          projectId: EXAMPLE_PROJECT_ID,
          experimentId: EXAMPLE_EXPERIMENT_ID,
          tagId: EXAMPLE_TAG_ID
        })
      ).resolves.toBeUndefined();
    });
  });
});
