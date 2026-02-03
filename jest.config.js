module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json', 'node'],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'json', 'html'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    // Exclude large generated OpenAPI type files (no runtime logic)
    '!src/types/api.types.ts',
    '!src/types/openapi.types.ts',
    '!src/types/new-api.types.ts',
    // Exclude pure type definition files (no runtime logic)
    '!src/types/auth.types.ts',
    '!src/types/base.types.ts',
    '!src/types/dataset.types.ts',
    '!src/types/export.types.ts',
    '!src/types/index.ts',
    '!src/types/log-stream.types.ts',
    '!src/types/node.types.ts',
    '!src/types/prompt-template.types.ts',
    '!src/types/runs.types.ts',
    '!src/types/search.types.ts',
    '!src/types/shared.types.ts',
    '!src/types/streaming-adapter.types.ts',
    '!src/types/tag.types.ts',
    '!src/types/transaction.types.ts',
    '!src/types/logging/logger.types.ts',
    '!src/types/logging/session.types.ts',
    '!src/types/logging/trace.types.ts'
    // Keep runtime logic files for coverage:
    // - src/types/routes.types.ts (Routes enum)
    // - src/types/project.types.ts (ProjectTypes const)
    // - src/types/models.types.ts (Models enum)
    // - src/types/errors.types.ts (GalileoAPIError class, isGalileoAPIStandardErrorData function)
    // - src/types/metrics.types.ts (GalileoMetrics const)
    // - src/types/message.types.ts (MessageRole const)
    // - src/types/experiment.types.ts (DEFAULT_PROMPT_RUN_SETTINGS const)
    // - src/types/job.types.ts (enums and Scorers const)
    // - src/types/scorer.types.ts (enums)
    // - src/types/document.types.ts (Document class)
    // - src/types/legacy-step.types.ts (classes and enums)
    // - src/types/logging/step.types.ts (StepType const, Metrics class, BaseStep class)
    // - src/types/logging/span.types.ts (enums and classes)
  ],
  coveragePathIgnorePatterns: ['/node_modules/', '/dist/', '/tests/']
};
