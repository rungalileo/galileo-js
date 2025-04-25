import { GalileoCallback, rootNodeContext } from '../../src/handlers/langchain';
import { GalileoLogger } from '../../src/utils/galileo-logger';
import { AgentFinish } from '@langchain/core/agents';
import { BaseMessage, AIMessage, HumanMessage } from '@langchain/core/messages';
import { LLMResult } from '@langchain/core/outputs';
import { Serialized } from '@langchain/core/load/serializable';
import { LlmSpan, NodeType, WorkflowSpan } from '../../src/types/log.types';

// Mock implementation functions
const mockInit = jest.fn().mockResolvedValue(undefined);
const mockGetProject = jest.fn();
const mockGetProjects = jest.fn();
const mockGetProjectByName = jest.fn();
const mockGetLogStreams = jest.fn();
const mockGetLogStreamByName = jest.fn();
const mockIngestTraces = jest.fn();

jest.mock('../../src/api-client', () => {
  return {
    GalileoApiClient: jest.fn().mockImplementation(() => {
      return {
        init: mockInit,
        getProject: mockGetProject,
        getProjects: mockGetProjects,
        getProjectByName: mockGetProjectByName,
        getLogStreams: mockGetLogStreams,
        getLogStreamByName: mockGetLogStreamByName,
        ingestTraces: mockIngestTraces
      };
    })
  };
});

// Utility for creating a unique string ID
const createId = () => {
  return Math.random().toString(36).substring(2, 15);
};

describe('GalileoCallback', () => {
  let galileoLogger: GalileoLogger;
  let callback: GalileoCallback;

  beforeEach(() => {
    jest.clearAllMocks();

    // Set required env variables
    process.env.GALILEO_PROJECT = 'test-project';
    process.env.GALILEO_LOG_STREAM = 'test-log-stream';

    galileoLogger = new GalileoLogger();
    callback = new GalileoCallback(galileoLogger, true, false);

    rootNodeContext.set(null);
  });

  describe('Initialization', () => {
    it('should initialize correctly with default parameters', () => {
      const defaultCallback = new GalileoCallback();

      // @ts-ignore - Accessing private property
      expect(defaultCallback['_galileoLogger']).toBeDefined();
      // @ts-ignore - Accessing private property
      expect(defaultCallback['_startNewTrace']).toBe(true);
      // @ts-ignore - Accessing private property
      expect(defaultCallback['_flushOnChainEnd']).toBe(true);
      // @ts-ignore - Accessing private property
      expect(defaultCallback['_nodes']).toEqual({});
    });

    it('should initialize with custom parameters', () => {
      const customCallback = new GalileoCallback(galileoLogger, false, true);

      // @ts-ignore - Accessing private property
      expect(customCallback['_galileoLogger']).toBe(galileoLogger);
      // @ts-ignore - Accessing private property
      expect(customCallback['_startNewTrace']).toBe(false);
      // @ts-ignore - Accessing private property
      expect(customCallback['_flushOnChainEnd']).toBe(true);
    });
  });

  describe('Node Management', () => {
    it('should create and track nodes correctly', () => {
      const parentId = createId();

      // @ts-ignore - Calling private method
      const node = callback['_startNode']('chain', undefined, parentId, {
        name: 'Test Chain',
        input: { query: 'test question' }
      });

      // @ts-ignore - Accessing private property
      expect(callback['_nodes'][parentId]).toBeDefined();
      expect(node.nodeType).toBe('chain');
      expect(node.runId).toBe(parentId);
      expect(node.parentRunId).toBeUndefined();
      expect(node.spanParams.name).toBe('Test Chain');
      expect(node.spanParams.input).toStrictEqual({ query: 'test question' });

      const childId = createId();
      // @ts-ignore - Calling private method
      const childNode = callback['_startNode']('llm', parentId, childId, {
        name: 'Test LLM',
        input: 'test prompt'
      });

      // @ts-ignore - Accessing private property
      expect(callback['_nodes'][childId]).toBeDefined();
      expect(childNode.nodeType).toBe('llm');
      expect(childNode.runId).toBe(childId);
      expect(childNode.parentRunId).toBe(parentId);
      expect(childNode.spanParams.name).toBe('Test LLM');
      expect(childNode.spanParams.input).toBe('test prompt');

      // Verify parent-child relationship
      // @ts-ignore - Accessing private property
      expect(callback['_nodes'][parentId].children).toContain(childId);
    });

    it('should handle end node correctly', () => {
      const runId = createId();

      // @ts-ignore - Calling private method
      callback['_startNode']('chain', undefined, runId, {
        name: 'Test Chain',
        input: { query: 'test question' }
      });

      // @ts-ignore - Calling private method
      callback['_endNode'](runId, { output: { result: 'test result' } });

      const traces = callback._galileoLogger.traces;
      expect(traces).toHaveLength(1);
      const trace = traces[0];
      expect(trace.spans.length).toBe(1);
      const span = trace.spans[0] as WorkflowSpan;
      expect(span.type).toBe(NodeType.workflow);
      expect(span.input).toStrictEqual(
        JSON.stringify({ query: 'test question' })
      );
      expect(span.output).toStrictEqual(
        JSON.stringify({ result: 'test result' })
      );
    });
  });

  describe('Chain Callbacks', () => {
    it('should handle chain start and end correctly', async () => {
      const runId = createId();
      const inputs = { query: 'test question' };

      await callback.handleChainStart(
        {
          name: 'TestChain',
          lc: 1,
          type: 'secret',
          id: ['test']
        } as Serialized,
        inputs,
        runId
      );

      // @ts-ignore - Accessing private property
      expect(callback['_nodes'][runId]).toBeDefined();
      // @ts-ignore - Accessing private property
      expect(callback['_nodes'][runId].nodeType).toBe('chain');
      // @ts-ignore - Accessing private property
      expect(callback['_nodes'][runId].spanParams.input).toEqual(inputs);

      const outputs = { result: 'test answer' };
      await callback.handleChainEnd(outputs, runId);

      const traces = callback._galileoLogger.traces;
      expect(traces).toHaveLength(1);
      expect(traces[0].spans[0].type).toBe(NodeType.workflow);
      expect(traces[0].spans[0].input).toStrictEqual(JSON.stringify(inputs));
      expect(traces[0].spans[0].output).toStrictEqual(JSON.stringify(outputs));
    });

    it('should handle input sent on chain end correctly', async () => {
      const runId = createId();
      let inputs = { query: '' };

      await callback.handleChainStart(
        {
          name: 'TestChain',
          lc: 1,
          type: 'secret',
          id: ['test']
        } as Serialized,
        inputs,
        runId
      );

      // @ts-ignore - Accessing private property
      expect(callback['_nodes'][runId]).toBeDefined();
      // @ts-ignore - Accessing private property
      expect(callback['_nodes'][runId].nodeType).toBe('chain');
      // @ts-ignore - Accessing private property
      expect(callback['_nodes'][runId].spanParams.input).toEqual(inputs);

      // Update inputs
      inputs = { query: 'test question' };
      const outputs = { result: 'test answer' };
      await callback.handleChainEnd(outputs, runId, undefined, undefined, {
        inputs
      });

      const traces = callback._galileoLogger.traces;
      expect(traces).toHaveLength(1);
      expect(traces[0].spans[0].type).toBe(NodeType.workflow);
      expect(traces[0].spans[0].input).toStrictEqual(JSON.stringify(inputs));
      expect(traces[0].spans[0].output).toStrictEqual(JSON.stringify(outputs));
    });

    it('should handle agent chain correctly', async () => {
      const runId = createId();

      await callback.handleChainStart(
        {
          name: 'agent',
          lc: 1,
          type: 'secret',
          id: ['test']
        } as Serialized,
        { input: 'test input' },
        runId,
        undefined,
        undefined
      );

      // @ts-ignore - Accessing private property
      expect(callback['_nodes'][runId].nodeType).toBe('agent');

      // End with agent finish
      const finish: AgentFinish = {
        returnValues: { output: 'test result' },
        log: 'log message'
      };

      await callback.handleAgentEnd(finish, runId);

      const traces = callback._galileoLogger.traces;
      expect(traces).toHaveLength(1);
      const trace = traces[0];
      expect(trace.input).toBe(JSON.stringify({ input: 'test input' }));
      expect(trace.output).toBe(
        JSON.stringify({
          returnValues: { output: 'test result' },
          log: 'log message'
        })
      );
      expect(trace.spans.length).toBe(1);
      const span = trace.spans[0] as WorkflowSpan;
      expect(span.type).toBe(NodeType.workflow);
      expect(span.input).toBe(JSON.stringify({ input: 'test input' }));
      expect(span.output).toBe(
        JSON.stringify({
          returnValues: { output: 'test result' },
          log: 'log message'
        })
      );
    });
  });

  describe('LLM Callbacks', () => {
    it('should handle LLM start and end correctly', async () => {
      const parentId = createId();
      const runId = createId();

      // Create parent chain
      await callback.handleChainStart(
        {
          name: 'TestChain',
          lc: 1,
          type: 'secret',
          id: ['test']
        } as Serialized,
        { query: 'test' },
        parentId
      );

      // Start LLM
      await callback.handleLLMStart(
        undefined,
        ['Tell me about AI'],
        runId,
        parentId,
        {
          invocation_params: { model_name: 'gpt-4', temperature: 0.7 }
        }
      );

      // @ts-ignore - Accessing private property
      expect(callback['_nodes'][runId]).toBeDefined();
      // @ts-ignore - Accessing private property
      expect(callback['_nodes'][runId].nodeType).toBe('llm');
      // @ts-ignore - Accessing private property
      expect(callback['_nodes'][runId].spanParams.model).toBe('gpt-4');
      // @ts-ignore - Accessing private property
      expect(callback['_nodes'][runId].spanParams.temperature).toBe(0.7);

      // Add a token to test token timing
      await callback.handleLLMNewToken(
        'AI',
        { prompt: 0, completion: 0 },
        runId
      );

      // End LLM
      const llmResult: LLMResult = {
        generations: [
          [
            {
              text: 'AI is a technology...',
              generationInfo: {}
            }
          ]
        ],
        llmOutput: {
          tokenUsage: {
            promptTokens: 10,
            completionTokens: 20,
            totalTokens: 30
          }
        }
      };

      await callback.handleLLMEnd(llmResult, runId);

      // Verify token counts were set
      // @ts-ignore - Accessing private property
      expect(callback['_nodes'][runId].spanParams.numInputTokens).toBe(10);
      // @ts-ignore - Accessing private property
      expect(callback['_nodes'][runId].spanParams.numOutputTokens).toBe(20);
      // @ts-ignore - Accessing private property
      expect(callback['_nodes'][runId].spanParams.totalTokens).toBe(30);

      const outputs = { result: 'AI is a technology...' };
      await callback.handleChainEnd(outputs, parentId);

      const traces = callback._galileoLogger.traces;
      expect(traces).toHaveLength(1);
      const trace = traces[0];
      expect(trace.input).toBe(JSON.stringify({ query: 'test' }));
      expect(trace.output).toBe(
        JSON.stringify({
          result: 'AI is a technology...'
        })
      );
      expect(trace.spans.length).toBe(1);
      const span = trace.spans[0] as WorkflowSpan;
      expect(span.type).toBe(NodeType.workflow);
      expect(span.input).toBe(JSON.stringify({ query: 'test' }));
      expect(span.output).toBe(
        JSON.stringify({
          result: 'AI is a technology...'
        })
      );
      expect(span.spans.length).toBe(1);
      const llmSpan = span.spans[0] as LlmSpan;
      expect(llmSpan.type).toBe(NodeType.llm);
      expect(llmSpan.input).toEqual([
        { content: 'Tell me about AI', role: 'user' }
      ]);
      expect(llmSpan.output).toEqual({
        content: '{"text":"AI is a technology...","generationInfo":{}}',
        role: 'assistant'
      });
      expect(llmSpan.inputTokens).toBe(10);
      expect(llmSpan.outputTokens).toBe(20);
      expect(llmSpan.totalTokens).toBe(30);
    });

    it('should handle chat model start correctly', async () => {
      const parentId = createId();
      const runId = createId();

      // Create parent chain
      await callback.handleChainStart(
        {
          name: 'TestChain',
          lc: 1,
          type: 'secret',
          id: ['test']
        } as Serialized,
        { query: 'test' },
        parentId
      );

      // Start chat model
      const humanMessage = new HumanMessage('Tell me about AI');
      const aiMessage = new AIMessage('AI is a technology...');
      const messages: BaseMessage[][] = [[humanMessage, aiMessage]];

      await callback.handleChatModelStart(
        undefined,
        messages,
        runId,
        parentId,
        {
          invocation_params: { model: 'gpt-4o', temperature: 0.7 }
        }
      );

      // @ts-ignore - Accessing private property
      expect(callback['_nodes'][runId]).toBeDefined();
      // @ts-ignore - Accessing private property
      expect(callback['_nodes'][runId].nodeType).toBe('chat');
      // @ts-ignore - Accessing private property
      expect(callback['_nodes'][runId].spanParams.model).toBe('gpt-4o');
      // @ts-ignore - Accessing private property
      expect(callback['_nodes'][runId].spanParams.temperature).toBe(0.7);

      // Check that message serialization worked
      // @ts-ignore - Accessing private property
      const inputData = callback['_nodes'][runId].spanParams.input;
      expect(Array.isArray(inputData)).toBe(true);
      expect(inputData.length).toBe(2); // Two messages
      expect(inputData[0].content).toBe('Tell me about AI');
      expect(inputData[1].content).toBe('AI is a technology...');
    });

    it('should handle chat model with tools correctly', async () => {
      const chainId = createId();
      const runId = createId();

      // Create parent chain
      await callback.handleChainStart(
        {
          name: 'TestChain',
          lc: 1,
          type: 'secret',
          id: ['test']
        } as Serialized,
        { query: 'test' },
        chainId
      );

      // Start chat model
      const humanMessage = new HumanMessage('What is the sine of 90 degrees?');
      const messages: BaseMessage[][] = [[humanMessage]];

      await callback.handleChatModelStart(undefined, messages, runId, chainId, {
        invocation_params: {
          model: 'gpt-4o',
          temperature: 0.7,
          tools: [
            {
              type: 'function',
              function: {
                name: 'sin',
                description: 'Calculate the sine of a number.',
                parameters: {
                  properties: { x: { type: 'number' } },
                  required: ['x'],
                  type: 'object'
                }
              }
            }
          ]
        }
      });

      // @ts-ignore - Accessing private property
      expect(callback['_nodes'][runId]).toBeDefined();
      // @ts-ignore - Accessing private property
      expect(callback['_nodes'][runId].nodeType).toBe('chat');
      // @ts-ignore - Accessing private property
      expect(callback['_nodes'][runId].spanParams.tools).toEqual([
        {
          type: 'function',
          function: {
            name: 'sin',
            description: 'Calculate the sine of a number.',
            parameters: {
              properties: { x: { type: 'number' } },
              required: ['x'],
              type: 'object'
            }
          }
        }
      ]);

      // End chat model
      const llmResult: LLMResult = {
        generations: [
          [
            {
              text: 'The sine of 90 degrees is 1.0',
              generationInfo: {}
            }
          ]
        ],
        llmOutput: { tokenUsage: { totalTokens: 100 } }
      };

      await callback.handleLLMEnd(llmResult, runId);

      expect(callback['_nodes'][runId].spanParams.output).toStrictEqual({
        text: 'The sine of 90 degrees is 1.0',
        generationInfo: {}
      });
    });
  });

  describe('Tool Callbacks', () => {
    it('should handle tool start and end with string output', async () => {
      const parentId = createId();
      const runId = createId();

      // Create parent chain
      await callback.handleChainStart(
        {
          name: 'chain',
          lc: 1,
          type: 'secret',
          id: ['test']
        } as Serialized,
        { query: 'test' },
        parentId
      );

      // Start tool
      await callback.handleToolStart(
        {
          name: 'calculator',
          lc: 1,
          type: 'secret',
          id: ['test']
        } as Serialized,
        '2+2',
        runId,
        parentId
      );

      // @ts-ignore - Accessing private property
      expect(callback['_nodes'][runId]).toBeDefined();
      // @ts-ignore - Accessing private property
      expect(callback['_nodes'][runId].nodeType).toBe('tool');
      // @ts-ignore - Accessing private property
      expect(callback['_nodes'][runId].spanParams.input).toBe('2+2');

      // End tool with a string output
      await callback.handleToolEnd('4', runId);

      // @ts-ignore - Accessing private property
      expect(callback['_nodes'][runId].spanParams.output).toBe('4');
    });

    it('should handle tool start and end with object output containing content field', async () => {
      const parentId = createId();
      const runId = createId();

      // Create parent chain
      await callback.handleChainStart(
        {
          name: 'chain',
          lc: 1,
          type: 'secret',
          id: ['test']
        } as Serialized,
        { query: 'test' },
        parentId
      );

      // Start tool
      await callback.handleToolStart(
        {
          name: 'calculator',
          lc: 1,
          type: 'secret',
          id: ['test']
        } as Serialized,
        '2+2',
        runId,
        parentId
      );

      // End tool with an object output with a content field
      await callback.handleToolEnd(
        {
          content: 'tool response',
          tool_call_id: '1',
          status: 'success',
          role: 'tool'
        },
        runId
      );

      // @ts-ignore - Accessing private property
      expect(callback['_nodes'][runId].spanParams.output).toBe('tool response');
    });

    it('should handle tool start and end with object output without content field', async () => {
      const parentId = createId();
      const runId = createId();

      // Create parent chain
      await callback.handleChainStart(
        {
          name: 'chain',
          lc: 1,
          type: 'secret',
          id: ['test']
        } as Serialized,
        { query: 'test' },
        parentId
      );

      // Start tool
      await callback.handleToolStart(
        {
          name: 'calculator',
          lc: 1,
          type: 'secret',
          id: ['test']
        } as Serialized,
        '2+2',
        runId,
        parentId
      );

      // End tool with an object output without a content field
      await callback.handleToolEnd(
        {
          tool_call_id: '1',
          status: 'success',
          role: 'tool'
        },
        runId
      );

      // @ts-ignore - Accessing private property
      expect(callback['_nodes'][runId].spanParams.output).toBe(
        '{"tool_call_id":"1","status":"success","role":"tool"}'
      );
    });
  });

  describe('Retriever Callbacks', () => {
    it('should handle retriever start and end', async () => {
      const parentId = createId();
      const runId = createId();

      // Create parent chain
      await callback.handleChainStart(
        {
          name: 'chain',
          lc: 1,
          type: 'secret',
          id: ['test']
        } as Serialized,
        { query: 'test' },
        parentId
      );

      // Start retriever
      await callback.handleRetrieverStart(
        undefined,
        'AI development',
        runId,
        parentId
      );

      // @ts-ignore - Accessing private property
      expect(callback['_nodes'][runId]).toBeDefined();
      // @ts-ignore - Accessing private property
      expect(callback['_nodes'][runId].nodeType).toBe('retriever');
      // @ts-ignore - Accessing private property
      expect(callback['_nodes'][runId].spanParams.input).toBe('AI development');

      // End retriever
      const document = {
        pageContent: 'AI is advancing rapidly',
        metadata: { source: 'textbook' }
      };

      await callback.handleRetrieverEnd([document], runId);

      // @ts-ignore - Accessing private property
      expect(Array.isArray(callback['_nodes'][runId].spanParams.output)).toBe(
        true
      );
      // @ts-ignore - Accessing private property
      expect(callback['_nodes'][runId].spanParams.output.length).toBe(1);
    });
  });

  describe('Complex Execution Flow', () => {
    it('should handle complex execution flow with multiple component types', async () => {
      // Create IDs for different components
      const chainId = createId();
      const llmId = createId();
      const toolId = createId();
      const retrieverId = createId();

      // Start main chain
      await callback.handleChainStart(
        {
          name: 'chain',
          lc: 1,
          type: 'secret',
          id: ['test']
        } as Serialized,
        { query: 'What can you tell me about the latest AI research?' },
        chainId
      );

      // Start retriever
      await callback.handleRetrieverStart(
        undefined,
        'latest AI research',
        retrieverId,
        chainId
      );

      // End retriever
      const document = {
        pageContent: 'Recent advances in large language models...',
        metadata: { source: 'paper' }
      };

      await callback.handleRetrieverEnd([document], retrieverId);

      // Start LLM
      await callback.handleLLMStart(
        undefined,
        [
          'Summarize this research: Recent advances in large language models...'
        ],
        llmId,
        chainId,
        { invocation_params: { model_name: 'gpt-4' } },
        undefined,
        { extras: { source: 'paper' } }
      );

      // End LLM
      const llmResult: LLMResult = {
        generations: [
          [
            {
              text: 'LLMs have seen significant progress...',
              generationInfo: {}
            }
          ]
        ],
        llmOutput: { tokenUsage: { totalTokens: 100 } }
      };

      await callback.handleLLMEnd(llmResult, llmId);

      // Start tool
      await callback.handleToolStart(
        {
          name: 'verify',
          lc: 1,
          type: 'secret',
          id: ['test']
        } as Serialized,
        'verify(LLMs have seen significant progress)',
        toolId,
        chainId,
        undefined,
        { key: 'value', extras: { tools: 'tool1' } }
      );

      // End tool
      await callback.handleToolEnd(
        'Verification complete: accurate statement',
        toolId
      );

      // End chain
      await callback.handleChainEnd(
        {
          result:
            'Recent AI research has focused on LLMs which have seen significant progress...'
        },
        chainId
      );

      const trace = callback._galileoLogger.traces[0];
      expect(trace.spans.length).toBe(1);
      const span = trace.spans[0] as WorkflowSpan;
      expect(span.type).toBe(NodeType.workflow);
      expect(span.spans.length).toBe(3);
      expect(span.spans[0].type).toBe(NodeType.retriever);
      expect(span.spans[1].type).toBe(NodeType.llm);
      expect(span.spans[2].type).toBe(NodeType.tool);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing parent nodes', () => {
      const parentId = createId();
      const childId = createId();

      // Start child with non-existent parent
      // @ts-ignore - Calling private method
      const childNode = callback['_startNode'](
        'llm',
        parentId, // This parent doesn't exist
        childId,
        {
          name: 'Test LLM',
          input: 'test prompt'
        }
      );

      // Child should still be created
      // @ts-ignore - Accessing private property
      expect(callback['_nodes'][childId]).toBeDefined();
      expect(childNode.parentRunId).toBe(parentId);
    });
  });
});
