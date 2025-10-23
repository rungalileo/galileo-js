/* eslint-disable @typescript-eslint/no-explicit-any */
import { wrapOpenAI } from '../../src/openai';
import { GalileoSingleton } from '../../src/singleton';

// Mock dependencies
jest.mock('../../src/singleton');

/**
 * OpenAI Version Detection Test
 * 
 * SINGLE PURPOSE: Check if the latest imported OpenAI package is a known version.
 * If not, fail the test to alert developers to potential compatibility issues.
 */

describe('OpenAI Version Detection', () => {
  const mockLogger = {
    currentParent: jest.fn().mockReturnValue(undefined),
    startTrace: jest.fn(),
    addLlmSpan: jest.fn(),
    conclude: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    GalileoSingleton.getInstance = jest.fn().mockReturnValue({
      getClient: jest.fn().mockReturnValue(mockLogger)
    });
  });
  
  test('should fail if latest OpenAI package is not a known version', async () => {
    let actualOpenAI: any = null;
    
    try {
      // Try to import the actual OpenAI SDK dynamically using string to avoid TypeScript compilation issues
      const openaiModule = await import('openai');
      const OpenAI = openaiModule.default || openaiModule;
      if (OpenAI && typeof OpenAI === 'function') {
        actualOpenAI = new OpenAI({
          apiKey: 'test-key-for-analysis',
          baseURL: 'https://api.openai.com/v1'
        });
      }
    } catch (error) {
      // OpenAI not installed, skip this test
      console.log('⏭️  Skipping test: OpenAI SDK not available');
      return;
    }

    if (actualOpenAI) {
      const analysis = analyzeOpenAIStructure(actualOpenAI);
      
      expect(() => {
        const wrapped = wrapOpenAI(actualOpenAI, mockLogger as any);
        expect(wrapped).toBeDefined();
      }).not.toThrow();
            
      expect(analysis.isFutureVersion).toBe(false);
    }
  });
});

// Version map defining expected properties for each OpenAI SDK version
const OPENAI_VERSION_MAP = {
  v4: {
    topLevel: ['baseURL', 'maxRetries', 'timeout', 'httpAgent', 'fetch', 'completions', 'chat', 'embeddings', 'files', 'images', 'audio', 'moderations', 'models', 'fineTuning', 'graders', 'vectorStores', 'beta', 'batches', 'uploads', 'responses', 'evals', 'containers', '_options', 'apiKey', 'organization', 'project'],
    beta: ['_client', 'realtime', 'chat', 'assistants', 'threads'],
    description: 'OpenAI SDK v4.0+'
  },
  v4_20: {
    topLevel: ['baseURL', 'maxRetries', 'timeout', 'httpAgent', 'fetch', 'completions', 'chat', 'edits', 'embeddings', 'files', 'images', 'audio', 'moderations', 'models', 'fineTuning', 'fineTunes', 'beta', '_options', 'apiKey', 'organization'],
    beta: ['_client', 'chat', 'assistants', 'threads'],
    description: 'OpenAI SDK v4.20+'
  },
  v4_50: {
    topLevel: ['baseURL', 'maxRetries', 'timeout', 'httpAgent', 'fetch', 'completions', 'chat', 'embeddings', 'files', 'images', 'audio', 'moderations', 'models', 'fineTuning', 'beta', 'batches', '_options', 'apiKey', 'organization', 'project'],
    beta: ['_client', 'vectorStores', 'chat', 'assistants', 'threads'],
    description: 'OpenAI SDK v4.50+'
  },
  v5: {
    topLevel: ['completions', 'chat', 'embeddings', 'files', 'images', 'audio', 'moderations', 'models', 'fineTuning', 'graders', 'vectorStores', 'webhooks', 'beta', 'batches', 'uploads', 'responses', 'realtime', 'conversations', 'evals', 'containers', 'baseURL', 'timeout', 'logger', 'logLevel', 'fetchOptions', 'maxRetries', 'fetch', '_options', 'apiKey', 'organization', 'project', 'webhookSecret'],
    beta: ['_client', 'realtime', 'assistants', 'threads'],
    description: 'OpenAI SDK v5.x'
  },
  v6: {
    topLevel: ['completions', 'chat', 'embeddings', 'files', 'images', 'audio', 'moderations', 'models', 'fineTuning', 'graders', 'vectorStores', 'webhooks', 'beta', 'batches', 'uploads', 'responses', 'realtime', 'conversations', 'evals', 'containers', 'videos', 'baseURL', 'timeout', 'logger', 'logLevel', 'fetchOptions', 'maxRetries', 'fetch', '_options', 'apiKey', 'organization', 'project', 'webhookSecret'],
    beta: ['_client', 'realtime', 'chatkit', 'assistants', 'threads'],
    description: 'OpenAI SDK v6.x'
  }
};

// Helper function to analyze OpenAI SDK structure
function analyzeOpenAIStructure(openai: any) {
  const analysis = {
    topLevelProperties: Object.keys(openai),
    betaProperties: openai.beta ? Object.keys(openai.beta) : [],
    detectedVersion: 'unknown',
    isFutureVersion: false,
    unknownProperties: [] as string[]
  };

  // Check against each known version for complete matches only
  for (const [versionKey, versionSpec] of Object.entries(OPENAI_VERSION_MAP)) {
    const topLevelMatch = versionSpec.topLevel.every(prop => 
      analysis.topLevelProperties.includes(prop)
    );
    const betaMatch = versionSpec.beta.every(prop => 
      analysis.betaProperties.includes(prop)
    );
    
    // Check if this version matches exactly (complete match)
    if (topLevelMatch && betaMatch) {
      // Check for extra properties that would indicate a future version
      const extraTopLevel = analysis.topLevelProperties.filter(prop => 
        !versionSpec.topLevel.includes(prop)
      );
      const extraBeta = analysis.betaProperties.filter(prop => 
        !versionSpec.beta.includes(prop)
      );
      
      // Only consider it a complete match if there are no extra properties
      if (extraTopLevel.length === 0 && extraBeta.length === 0) {
        analysis.detectedVersion = versionKey;
        analysis.isFutureVersion = false;
        return analysis;
      }
    }
  }

  analysis.isFutureVersion = true;

  const allKnownProperties = new Set();
  Object.values(OPENAI_VERSION_MAP).forEach(version => {
    version.topLevel.forEach(prop => allKnownProperties.add(prop));
    version.beta.forEach(prop => allKnownProperties.add(prop));
  });
  
  analysis.unknownProperties = [
    ...analysis.topLevelProperties.filter(prop => !allKnownProperties.has(prop)),
    ...analysis.betaProperties.filter(prop => !allKnownProperties.has(prop))
  ];
  
  return analysis;
}