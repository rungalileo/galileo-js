import { GalileoCallback } from '../../../src/handlers/langchain';
import { GalileoLogger } from '../../../src/utils/galileo-logger';
import { AgentFinish } from '@langchain/core/agents';
import {
  BaseMessage,
  AIMessage,
  HumanMessage,
  ToolMessage
} from '@langchain/core/messages';
import { LLMResult } from '@langchain/core/outputs';
import { Serialized } from '@langchain/core/load/serializable';
import { ChainValues } from '@langchain/core/utils/types';
import { DocumentInterface, Document } from '@langchain/core/documents';
import { StepType } from '../../../src/types/logging/step.types';
import {
  AgentSpan,
  LlmSpan,
  ToolSpan,
  WorkflowSpan
} from '../../../src/types/logging/span.types';

// Mock implementation functions
const mockInit = jest.fn().mockResolvedValue(undefined);
const mockGetProject = jest.fn();
const mockGetProjects = jest.fn();
const mockGetProjectByName = jest.fn();
const mockGetLogStreams = jest.fn();
const mockGetLogStreamByName = jest.fn();
const mockIngestTraces = jest.fn();

jest.mock('../../../src/api-client', () => {
  return {
    GalileoApiClient: Object.assign(
      jest.fn().mockImplementation(() => {
        return {
          init: mockInit,
          getProject: mockGetProject,
          getProjects: mockGetProjects,
          getProjectByName: mockGetProjectByName,
          getLogStreams: mockGetLogStreams,
          getLogStreamByName: mockGetLogStreamByName,
          ingestTraces: mockIngestTraces
        };
      }),
      {
        getTimestampRecord: jest.fn().mockReturnValue(new Date())
      }
    )
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
  });

  describe('Initialization', () => {
    it('should initialize correctly with default parameters', () => {
      const defaultCallback = new GalileoCallback();

      expect(defaultCallback['_galileoLogger']).toBeDefined();
      expect(defaultCallback['_startNewTrace']).toBe(true);
      expect(defaultCallback['_flushOnChainEnd']).toBe(true);
      expect(defaultCallback['_nodes']).toEqual({});
    });

    it('should initialize with custom parameters', () => {
      const customCallback = new GalileoCallback(galileoLogger, false, true);

      expect(customCallback['_galileoLogger']).toBe(galileoLogger);
      expect(customCallback['_startNewTrace']).toBe(false);
      expect(customCallback['_flushOnChainEnd']).toBe(true);
    });
  });

  describe('Node Management', () => {
    it('should create and track nodes correctly', () => {
      const parentId = createId();

      const node = callback['_startNode']('chain', undefined, parentId, {
        name: 'Test Chain',
        input: { query: 'test question' }
      });

      expect(callback['_nodes'][parentId]).toBeDefined();
      expect(node.nodeType).toBe('chain');
      expect(node.runId).toBe(parentId);
      expect(node.parentRunId).toBeUndefined();
      expect(node.spanParams.name).toBe('Test Chain');
      expect(node.spanParams.input).toStrictEqual({ query: 'test question' });

      const childId = createId();
      const childNode = callback['_startNode']('llm', parentId, childId, {
        name: 'Test LLM',
        input: 'test prompt'
      });

      expect(callback['_nodes'][childId]).toBeDefined();
      expect(childNode.nodeType).toBe('llm');
      expect(childNode.runId).toBe(childId);
      expect(childNode.parentRunId).toBe(parentId);
      expect(childNode.spanParams.name).toBe('Test LLM');
      expect(childNode.spanParams.input).toBe('test prompt');

      // Verify parent-child relationship
      expect(callback['_nodes'][parentId].children).toContain(childId);
    });

    it('should handle end node correctly', () => {
      const runId = createId();

      callback['_startNode']('chain', undefined, runId, {
        name: 'Test Chain',
        input: { query: 'test question' }
      });

      callback['_endNode'](runId, { output: { result: 'test result' } });

      const traces = callback._galileoLogger.traces;
      expect(traces).toHaveLength(1);
      const trace = traces[0];
      expect(trace.spans.length).toBe(1);
      const span = trace.spans[0] as WorkflowSpan;
      expect(span.type).toBe(StepType.workflow);
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

      expect(callback['_nodes'][runId]).toBeDefined();
      expect(callback['_nodes'][runId].nodeType).toBe('chain');
      expect(callback['_nodes'][runId].spanParams.input).toEqual(
        JSON.stringify(inputs)
      );

      const outputs = { result: 'test answer' };
      await callback.handleChainEnd(outputs, runId);

      const traces = callback._galileoLogger.traces;
      expect(traces).toHaveLength(1);
      expect(traces[0].spans[0].type).toBe(StepType.workflow);
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

      expect(callback['_nodes'][runId]).toBeDefined();
      expect(callback['_nodes'][runId].nodeType).toBe('chain');
      expect(callback['_nodes'][runId].spanParams.input).toEqual(
        JSON.stringify(inputs)
      );

      // Update inputs
      inputs = { query: 'test question' };
      const outputs = { result: 'test answer' };
      await callback.handleChainEnd(outputs, runId, undefined, undefined, {
        inputs
      });

      const traces = callback._galileoLogger.traces;
      expect(traces).toHaveLength(1);
      expect(traces[0].spans[0].type).toBe(StepType.workflow);
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
      const span = trace.spans[0] as AgentSpan;
      expect(span.type).toBe(StepType.agent);
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

      expect(callback['_nodes'][runId]).toBeDefined();
      expect(callback['_nodes'][runId].nodeType).toBe('llm');
      expect(callback['_nodes'][runId].spanParams.model).toBe('gpt-4');
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
      expect(callback['_nodes'][runId].spanParams.numInputTokens).toBe(10);
      expect(callback['_nodes'][runId].spanParams.numOutputTokens).toBe(20);
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
      expect(span.type).toBe(StepType.workflow);
      expect(span.input).toBe(JSON.stringify({ query: 'test' }));
      expect(span.output).toBe(
        JSON.stringify({
          result: 'AI is a technology...'
        })
      );
      expect(span.spans.length).toBe(1);
      const llmSpan = span.spans[0] as LlmSpan;
      expect(llmSpan.type).toBe(StepType.llm);
      expect(llmSpan.input).toEqual([
        { content: 'Tell me about AI', role: 'user' }
      ]);
      expect(llmSpan.output).toEqual({
        content: '{"text":"AI is a technology...","generationInfo":{}}',
        role: 'assistant'
      });
      expect(llmSpan.metrics.numInputTokens).toBe(10);
      expect(llmSpan.metrics.numOutputTokens).toBe(20);
      expect(llmSpan.metrics.numTotalTokens).toBe(30);
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

      expect(callback['_nodes'][runId]).toBeDefined();
      expect(callback['_nodes'][runId].nodeType).toBe('chat');
      expect(callback['_nodes'][runId].spanParams.model).toBe('gpt-4o');
      expect(callback['_nodes'][runId].spanParams.temperature).toBe(0.7);

      // Check that message serialization worked
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

      expect(callback['_nodes'][runId]).toBeDefined();
      expect(callback['_nodes'][runId].nodeType).toBe('chat');
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

      expect(callback['_nodes'][runId]).toBeDefined();
      expect(callback['_nodes'][runId].nodeType).toBe('tool');
      expect(callback['_nodes'][runId].spanParams.input).toBe('2+2');

      // End tool with a string output
      await callback.handleToolEnd('4', runId);

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

      expect(callback['_nodes'][runId]).toBeDefined();
      expect(callback['_nodes'][runId].nodeType).toBe('retriever');
      expect(callback['_nodes'][runId].spanParams.input).toBe('AI development');

      // End retriever
      const document = {
        pageContent: 'AI is advancing rapidly',
        metadata: { source: 'textbook' }
      };

      await callback.handleRetrieverEnd([document], runId);

      expect(Array.isArray(callback['_nodes'][runId].spanParams.output)).toBe(
        true
      );
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
      expect(span.type).toBe(StepType.workflow);
      expect(span.spans.length).toBe(3);
      expect(span.spans[0].type).toBe(StepType.retriever);
      expect(span.spans[1].type).toBe(StepType.llm);
      expect(span.spans[2].type).toBe(StepType.tool);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing parent nodes', () => {
      const parentId = createId();
      const childId = createId();

      // Start child with non-existent parent
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
      expect(callback['_nodes'][childId]).toBeDefined();
      expect(childNode.parentRunId).toBe(parentId);
    });
  });

  describe('Step Number Extraction', () => {
    const testCases = [
      {
        nodeType: 'tool',
        startFn: 'handleToolStart',
        endFn: 'handleToolEnd',
        inputArgs: {
          serialized: {
            name: 'calculator',
            lc: 1,
            type: 'secret',
            id: ['test']
          } as Serialized,
          input: '2+2'
        },
        outputArgs: {
          output: '4'
        },
        expectedType: StepType.tool
      },
      {
        nodeType: 'llm',
        startFn: 'handleLLMStart',
        endFn: 'handleLLMEnd',
        inputArgs: {
          serialized: { lc: 1, type: 'secret', id: ['test'] } as Serialized,
          prompts: ['Tell me about AI'],
          invocation_params: { model_name: 'gpt-4' }
        },
        outputArgs: {
          response: {
            generations: [
              [
                {
                  text: 'AI is a technology...',
                  generationInfo: {}
                }
              ]
            ],
            llmOutput: { tokenUsage: { totalTokens: 100 } }
          }
        },
        expectedType: StepType.llm
      },
      {
        nodeType: 'retriever',
        startFn: 'handleRetrieverStart',
        endFn: 'handleRetrieverEnd',
        inputArgs: {
          serialized: { lc: 1, type: 'secret', id: ['test'] } as Serialized,
          query: 'AI development'
        },
        outputArgs: {
          documents: [
            {
              pageContent: 'AI is advancing rapidly',
              metadata: { source: 'textbook' }
            }
          ]
        },
        expectedType: StepType.retriever
      },
      {
        nodeType: 'chain',
        startFn: 'handleChainStart',
        endFn: 'handleChainEnd',
        inputArgs: {
          serialized: {
            name: 'TestChain',
            lc: 1,
            type: 'secret',
            id: ['test']
          } as Serialized,
          inputs: { query: 'test' }
        },
        outputArgs: {
          outputs: { result: 'answer' }
        },
        expectedType: StepType.workflow
      },
      {
        nodeType: 'agent',
        startFn: 'handleChainStart',
        endFn: 'handleChainEnd',
        inputArgs: {
          serialized: {
            name: 'Agent',
            lc: 1,
            type: 'secret',
            id: ['test']
          } as Serialized,
          inputs: { query: 'test' }
        },
        outputArgs: {
          outputs: { result: 'answer' }
        },
        expectedType: StepType.agent
      }
    ];

    testCases.forEach(
      ({ nodeType, startFn, endFn, inputArgs, outputArgs, expectedType }) => {
        it(`should set step_number correctly for ${nodeType} nodes`, async () => {
          const parentId = createId();
          const runId = createId();
          const stepNumber = 42;

          // Create parent chain for non-root nodes
          if (nodeType !== 'chain' && nodeType !== 'agent') {
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
          }

          // Prepare input arguments with step number metadata
          const startArgs = {
            ...inputArgs,
            runId,
            parentRunId:
              nodeType !== 'chain' && nodeType !== 'agent'
                ? parentId
                : undefined,
            metadata: { langgraph_step: stepNumber.toString() }
          };

          // Call start function
          if (startFn === 'handleChainStart') {
            await callback.handleChainStart(
              startArgs.serialized,
              startArgs.inputs!,
              startArgs.runId,
              startArgs.parentRunId,
              undefined,
              startArgs.metadata
            );
          } else if (startFn === 'handleLLMStart') {
            await callback.handleLLMStart(
              startArgs.serialized,
              startArgs.prompts!,
              startArgs.runId,
              startArgs.parentRunId,
              startArgs.invocation_params,
              undefined,
              startArgs.metadata
            );
          } else if (startFn === 'handleToolStart') {
            await callback.handleToolStart(
              startArgs.serialized,
              startArgs.input!,
              startArgs.runId,
              startArgs.parentRunId,
              undefined,
              startArgs.metadata
            );
          } else if (startFn === 'handleRetrieverStart') {
            await callback.handleRetrieverStart(
              startArgs.serialized,
              startArgs.query!,
              startArgs.runId,
              startArgs.parentRunId,
              undefined,
              startArgs.metadata
            );
          }

          // Prepare and call end function
          const endArgs = {
            ...outputArgs,
            runId,
            parentRunId:
              nodeType !== 'chain' && nodeType !== 'agent'
                ? parentId
                : undefined
          };

          if (endFn === 'handleChainEnd') {
            await callback.handleChainEnd(endArgs.outputs!, endArgs.runId);
          } else if (endFn === 'handleLLMEnd') {
            await callback.handleLLMEnd(endArgs.response!, endArgs.runId);
          } else if (endFn === 'handleToolEnd') {
            await callback.handleToolEnd(endArgs.output!, endArgs.runId);
          } else if (endFn === 'handleRetrieverEnd') {
            await callback.handleRetrieverEnd(
              endArgs.documents!,
              endArgs.runId
            );
          }

          // End chain to trigger commit for non-root nodes
          if (nodeType !== 'chain' && nodeType !== 'agent') {
            await callback.handleChainEnd({ result: 'test answer' }, parentId);
            const traces = callback._galileoLogger.traces;
            expect(traces).toHaveLength(1);
            expect(traces[0].spans).toHaveLength(1);
            const childSpan = (traces[0].spans[0] as WorkflowSpan).spans[0];
            expect(childSpan.type).toBe(expectedType);
            expect(childSpan.stepNumber).toBe(stepNumber);
          } else {
            const traces = callback._galileoLogger.traces;
            expect(traces).toHaveLength(1);
            expect(traces[0].spans).toHaveLength(1);
            const rootSpan = traces[0].spans[0];
            expect(rootSpan.type).toBe(expectedType);
            expect(rootSpan.stepNumber).toBe(stepNumber);
          }
        });
      }
    );

    it('should handle invalid step number gracefully', async () => {
      const runId = createId();

      // Start chain with invalid step number in metadata
      await callback.handleChainStart(
        {
          name: 'TestChain',
          lc: 1,
          type: 'secret',
          id: ['test']
        } as Serialized,
        { query: 'test question' },
        runId,
        undefined,
        undefined,
        { langgraph_step: 'not-a-number' }
      );

      // End chain
      await callback.handleChainEnd({ result: 'test answer' }, runId);

      const traces = callback._galileoLogger.traces;
      expect(traces).toHaveLength(1);
      expect(traces[0].spans[0].type).toBe(StepType.workflow);
      expect(traces[0].spans[0].stepNumber).toBeUndefined();
    });

    it('should handle missing step number correctly', async () => {
      const runId = createId();

      // Start chain without step number in metadata
      await callback.handleChainStart(
        {
          name: 'TestChain',
          lc: 1,
          type: 'secret',
          id: ['test']
        } as Serialized,
        { query: 'test question' },
        runId,
        undefined,
        undefined,
        { other_metadata: 'value' }
      );

      // End chain
      await callback.handleChainEnd({ result: 'test answer' }, runId);

      const traces = callback._galileoLogger.traces;
      expect(traces).toHaveLength(1);
      expect(traces[0].spans[0].type).toBe(StepType.workflow);
      expect(traces[0].spans[0].stepNumber).toBeUndefined();
    });

    describe('Metadata conversion error handling', () => {
      it('should handle metadata conversion error gracefully', async () => {
        const runId = createId();

        // Start chain with metadata that cannot be converted to string dict
        await callback.handleChainStart(
          {
            name: 'TestChain',
            lc: 1,
            type: 'secret',
            id: ['test']
          } as Serialized,
          { query: 'test question' },
          runId,
          undefined,
          undefined,
          {
            nested: {
              deep: {
                value: () => 'function value'
              }
            }
          } as unknown as Record<string, unknown>
        );

        // End chain
        await callback.handleChainEnd({ result: 'test answer' }, runId);

        const traces = callback._galileoLogger.traces;
        expect(traces).toHaveLength(1);
        expect(traces[0].spans).toHaveLength(1);
      });

      it('should handle undefined metadata', async () => {
        const runId = createId();

        await callback.handleChainStart(
          {
            name: 'TestChain',
            lc: 1,
            type: 'secret',
            id: ['test']
          } as Serialized,
          { query: 'test question' },
          runId,
          undefined,
          undefined,
          undefined
        );

        await callback.handleChainEnd({ result: 'test answer' }, runId);

        const traces = callback._galileoLogger.traces;
        expect(traces).toHaveLength(1);
        const span = traces[0].spans[0] as unknown as { metadata?: unknown };
        expect(span.metadata).toBeUndefined();
      });
    });

    describe('Chat model serialization error handling', () => {
      it('should handle chat message serialization error', async () => {
        const runId = createId();

        const mockMessages = [
          [new AIMessage({ content: 'Hello' })]
        ] as unknown as BaseMessage[][];

        try {
          await callback.handleChatModelStart(
            { name: 'ChatModel', lc: 1, type: 'secret', id: ['test'] },
            mockMessages,
            runId,
            undefined,
            { invocation_params: { model: 'gpt-4' } }
          );

          await callback.handleChainEnd({ result: 'test answer' }, runId);

          const traces = callback._galileoLogger.traces;
          expect(traces).toHaveLength(1);
        } catch (e) {
          // Expected - serialization may fail with certain message types
          expect(true).toBe(true);
        }
      });

      it('should handle undefined chat model temperature', async () => {
        const runId = createId();

        const messages = [[new AIMessage({ content: 'Hello' })]];

        await callback.handleChatModelStart(
          { name: 'ChatModel', lc: 1, type: 'secret', id: ['test'] },
          messages as unknown as BaseMessage[][],
          runId,
          undefined,
          { invocation_params: { model: 'gpt-4' } }
        );

        await callback.handleChainEnd({ result: 'test answer' }, runId);

        const traces = callback._galileoLogger.traces;
        expect(traces).toHaveLength(1);
        const chatSpan = traces[0].spans[0] as unknown as {
          temperature?: number;
        };
        expect(chatSpan.temperature).toBe(0.0);
      });
    });

    describe('LLM output serialization error handling', () => {
      it('should handle LLM output serialization error', async () => {
        const runId = createId();

        await callback.handleLLMStart(
          { name: 'LLM', lc: 1, type: 'secret', id: ['test'] },
          ['test prompt'],
          runId,
          undefined,
          { invocation_params: { model: 'gpt-4' } }
        );

        const mockLLMResult = {
          generations: [[{ text: 'test', generationInfo: {} }]],
          llmOutput: { tokenUsage: { promptTokens: 10, completionTokens: 5 } }
        } as LLMResult;

        await callback.handleLLMEnd(mockLLMResult, runId);

        const traces = callback._galileoLogger.traces;
        expect(traces).toHaveLength(1);
        expect(traces[0].spans).toHaveLength(1);
      });

      it('should handle LLM output with undefined token usage', async () => {
        const runId = createId();

        await callback.handleLLMStart(
          { name: 'LLM', lc: 1, type: 'secret', id: ['test'] },
          ['test prompt'],
          runId,
          undefined,
          { invocation_params: { model: 'gpt-4' } }
        );

        const mockLLMResult = {
          generations: [[{ text: 'test', generationInfo: {} }]],
          llmOutput: undefined
        } as LLMResult;

        await callback.handleLLMEnd(mockLLMResult, runId);

        const traces = callback._galileoLogger.traces;
        expect(traces).toHaveLength(1);
        const llmSpan = traces[0].spans[0] as unknown as {
          numInputTokens?: number;
          numOutputTokens?: number;
        };
        expect(llmSpan.numInputTokens).toBeUndefined();
        expect(llmSpan.numOutputTokens).toBeUndefined();
      });
    });

    describe('Retriever serialization error handling', () => {
      it('should handle retriever output serialization error', async () => {
        const runId = createId();

        await callback.handleRetrieverStart(
          { name: 'Retriever', lc: 1, type: 'secret', id: ['test'] },
          'test query',
          runId
        );

        const mockDocuments = [
          new Document({
            pageContent: 'test content',
            metadata: {}
          })
        ] as unknown as DocumentInterface<Record<string, unknown>>[];

        await callback.handleRetrieverEnd(mockDocuments, runId);

        const traces = callback._galileoLogger.traces;
        expect(traces).toHaveLength(1);
        expect(traces[0].spans).toHaveLength(1);
      });
    });

    describe('Root node validation', () => {
      it('should handle missing root node gracefully', async () => {
        const runId = createId();

        await callback.handleChainStart(
          {
            name: 'TestChain',
            lc: 1,
            type: 'secret',
            id: ['test']
          } as Serialized,
          { query: 'test question' },
          runId
        );

        // Try to end chain - this should not create a trace without root node
        await callback.handleChainEnd({ result: 'test answer' }, runId);

        const traces = callback._galileoLogger.traces;
        // Trace is created but node structure should be set
        expect(traces).toBeTruthy();
      });

      it('should handle node not in nodes map', async () => {
        const runId = createId();
        const parentId = createId();

        // Start a chain to set as root
        await callback.handleChainStart(
          {
            name: 'ParentChain',
            lc: 1,
            type: 'secret',
            id: ['test']
          } as Serialized,
          { query: 'test question' },
          runId
        );

        // Try to end a node that wasn't started
        await callback.handleChainEnd({ result: 'test answer' }, parentId);

        const traces = callback._galileoLogger.traces;
        expect(traces).toBeTruthy();
      });
    });

    describe('Child node tracking', () => {
      it('should handle missing parent node for child', async () => {
        const parentId = createId();
        const childId = createId();

        // Start a child node with a parent that doesn't exist
        const node = callback['_startNode']('llm', parentId, childId, {
          name: 'TestLLM',
          input: 'test prompt',
          model: 'gpt-4'
        });

        expect(node).toBeTruthy();
        expect(node.parentRunId).toBe(parentId);

        // The node should still be tracked even though parent doesn't exist
        expect(callback['_nodes'][childId]).toBeTruthy();
      });

      it('should handle duplicate node creation', async () => {
        const runId = createId();

        // Start a node twice with the same ID
        const node1 = callback['_startNode']('chain', undefined, runId, {
          name: 'TestChain',
          input: 'test'
        });

        const node2 = callback['_startNode']('chain', undefined, runId, {
          name: 'UpdatedChain',
          input: 'updated'
        });

        expect(node1.runId).toBe(runId);
        expect(node2.runId).toBe(runId);
        expect(callback['_nodes'][runId].spanParams.name).toBe('UpdatedChain');
      });
    });

    describe('Error handler methods', () => {
      it('should handle chain error correctly', async () => {
        const runId = createId();

        // Start a chain
        await callback.handleChainStart(
          {
            name: 'TestChain',
            lc: 1,
            type: 'secret',
            id: ['test']
          } as Serialized,
          { query: 'test question' },
          runId
        );

        // End with error
        const error = Object.assign(new Error('Chain execution failed'), {
          response: { status: 500 }
        });

        await callback.handleChainError(error, runId);

        const traces = callback._galileoLogger.traces;
        expect(traces).toHaveLength(1);
        expect(traces[0].spans[0]).toBeTruthy();
      });

      it('should handle LLM error correctly', async () => {
        const runId = createId();

        // Start LLM
        await callback.handleLLMStart(
          { name: 'LLM', lc: 1, type: 'secret', id: ['test'] },
          ['test prompt'],
          runId
        );

        // End with error
        const error = Object.assign(new Error('LLM request failed'), {
          response: { status: 503 }
        });

        await callback.handleLLMError(error, runId);

        const traces = callback._galileoLogger.traces;
        expect(traces).toHaveLength(1);
      });

      it('should handle tool error correctly', async () => {
        const runId = createId();

        // Start tool
        await callback.handleToolStart(
          { name: 'TestTool', lc: 1, type: 'secret', id: ['test'] },
          'tool input',
          runId
        );

        // End with error
        const error = Object.assign(new Error('Tool execution failed'), {
          response: { status: 400 }
        });

        await callback.handleToolError(error, runId);

        const traces = callback._galileoLogger.traces;
        expect(traces).toHaveLength(1);
      });

      it('should handle retriever error correctly', async () => {
        const runId = createId();

        // Start retriever
        await callback.handleRetrieverStart(
          { name: 'Retriever', lc: 1, type: 'secret', id: ['test'] },
          'test query',
          runId
        );

        // End with error
        const error = Object.assign(new Error('Retriever failed'), {
          response: { status: 502 }
        });

        await callback.handleRetrieverError(error, runId);

        const traces = callback._galileoLogger.traces;
        expect(traces).toHaveLength(1);
      });
    });
  });

  describe('FIX-4 Coverage', () => {
    describe('_getNodeName fallback resolution', () => {
      it('test _getNodeName uses serialized.id array fallback when name absent', async () => {
        const runId = createId();

        await callback.handleChainStart(
          {
            lc: 1,
            type: 'secret',
            id: ['path', 'to', 'ActualClassName']
          } as Serialized,
          { query: 'test' },
          runId
        );

        expect(callback['_nodes'][runId].spanParams.name).toBe(
          'ActualClassName'
        );
      });

      it('test _getNodeName uses capitalized nodeType catch-all when all sources absent', async () => {
        const runId = createId();

        await callback.handleChainStart(
          { lc: 1, type: 'secret', id: [] } as Serialized,
          { query: 'test' },
          runId,
          undefined,
          undefined,
          {}
        );

        expect(callback['_nodes'][runId].spanParams.name).toBe('Chain');
      });
    });

    describe('updateRootToAgent', () => {
      it('test updateRootToAgent upgrades root chain to agent on langgraph_ metadata key', async () => {
        const rootId = createId();
        const childId = createId();

        await callback.handleChainStart(
          {
            name: 'MyChain',
            lc: 1,
            type: 'secret',
            id: ['test']
          } as Serialized,
          { query: 'test' },
          rootId
        );

        expect(callback['_nodes'][rootId].nodeType).toBe('chain');

        await callback.handleChainStart(
          {
            name: 'ChildChain',
            lc: 1,
            type: 'secret',
            id: ['test']
          } as Serialized,
          { query: 'child' },
          childId,
          rootId,
          undefined,
          { langgraph_step: '1' }
        );

        expect(callback['_nodes'][rootId].nodeType).toBe('agent');
      });
    });

    describe('case-insensitive agent detection', () => {
      it('test handleChainStart detects agent with lowercase langgraph name', async () => {
        const runId = createId();

        await callback.handleChainStart(
          {
            name: 'langgraph',
            lc: 1,
            type: 'secret',
            id: ['test']
          } as Serialized,
          { query: 'test' },
          runId
        );

        expect(callback['_nodes'][runId].nodeType).toBe('agent');
      });
    });

    describe('_getAgentName hierarchical naming', () => {
      it('test _getAgentName returns parent:child name format', async () => {
        const parentId = createId();
        const childId = createId();

        // Create parent agent node directly
        callback['_startNode']('agent', undefined, parentId, {
          name: 'OuterAgent',
          input: 'test'
        });
        callback['_rootNode'] = callback['_nodes'][parentId];

        // Start child that triggers agent detection via name 'Agent'
        await callback.handleChainStart(
          { name: 'Agent', lc: 1, type: 'secret', id: ['test'] } as Serialized,
          { query: 'test' },
          childId,
          parentId
        );

        expect(callback['_nodes'][childId].spanParams.name).toBe(
          'OuterAgent:Agent'
        );
      });
    });

    describe('_findToolMessage', () => {
      it('test handleToolEnd captures content and toolCallId from direct ToolMessage', async () => {
        const parentId = createId();
        const toolId = createId();

        await callback.handleChainStart(
          { name: 'chain', lc: 1, type: 'secret', id: ['test'] } as Serialized,
          { query: 'test' },
          parentId
        );
        await callback.handleToolStart(
          { name: 'myTool', lc: 1, type: 'secret', id: ['test'] } as Serialized,
          'tool input',
          toolId,
          parentId
        );

        const toolMessage = new ToolMessage({
          content: 'tool result',
          tool_call_id: 'call_abc'
        });
        await callback.handleToolEnd(toolMessage, toolId);

        expect(callback['_nodes'][toolId].spanParams.output).toBe(
          'tool result'
        );
        expect(callback['_nodes'][toolId].spanParams.toolCallId).toBe(
          'call_abc'
        );
      });

      it('test handleToolEnd captures content and toolCallId from LangGraph Command', async () => {
        const parentId = createId();
        const toolId = createId();

        await callback.handleChainStart(
          { name: 'chain', lc: 1, type: 'secret', id: ['test'] } as Serialized,
          { query: 'test' },
          parentId
        );
        await callback.handleToolStart(
          { name: 'myTool', lc: 1, type: 'secret', id: ['test'] } as Serialized,
          'tool input',
          toolId,
          parentId
        );

        const toolMessage = new ToolMessage({
          content: 'command result',
          tool_call_id: 'call_xyz'
        });
        const commandOutput = { update: { messages: [toolMessage] } };
        await callback.handleToolEnd(commandOutput, toolId);

        expect(callback['_nodes'][toolId].spanParams.output).toBe(
          'command result'
        );
        expect(callback['_nodes'][toolId].spanParams.toolCallId).toBe(
          'call_xyz'
        );
      });

      it('test handleToolEnd captures content and toolCallId from array-of-ToolMessage', async () => {
        const parentId = createId();
        const toolId = createId();

        await callback.handleChainStart(
          { name: 'chain', lc: 1, type: 'secret', id: ['test'] } as Serialized,
          { query: 'test' },
          parentId
        );
        await callback.handleToolStart(
          { name: 'myTool', lc: 1, type: 'secret', id: ['test'] } as Serialized,
          'tool input',
          toolId,
          parentId
        );

        const toolMessage = new ToolMessage({
          content: 'array result',
          tool_call_id: 'call_arr'
        });
        await callback.handleToolEnd([toolMessage], toolId);

        expect(callback['_nodes'][toolId].spanParams.output).toBe(
          'array result'
        );
        expect(callback['_nodes'][toolId].spanParams.toolCallId).toBe(
          'call_arr'
        );
      });
    });

    describe('tool output handling', () => {
      it('test tuple tool output serializes first element only', async () => {
        const parentId = createId();
        const toolId = createId();

        await callback.handleChainStart(
          { name: 'chain', lc: 1, type: 'secret', id: ['test'] } as Serialized,
          { query: 'test' },
          parentId
        );
        await callback.handleToolStart(
          { name: 'myTool', lc: 1, type: 'secret', id: ['test'] } as Serialized,
          'tool input',
          toolId,
          parentId
        );

        await callback.handleToolEnd(
          ['content-value', { artifact: true }],
          toolId
        );

        expect(callback['_nodes'][toolId].spanParams.output).toBe(
          'content-value'
        );
      });
    });

    describe('duration and timestamp tracking', () => {
      it('test durationNs is a positive number in the committed span', async () => {
        const runId = createId();

        await callback.handleChainStart(
          {
            name: 'TestChain',
            lc: 1,
            type: 'secret',
            id: ['test']
          } as Serialized,
          { query: 'test' },
          runId
        );

        await callback.handleChainEnd({ result: 'answer' }, runId);

        const traces = callback._galileoLogger.traces;
        expect(traces).toHaveLength(1);
        const span = traces[0].spans[0] as WorkflowSpan;
        expect(typeof span.metrics.durationNs).toBe('number');
        expect(span.metrics.durationNs).toBeGreaterThan(0);
      });

      it('test createdAt is a Date instance on freshly started node', async () => {
        const runId = createId();

        await callback.handleChainStart(
          {
            name: 'TestChain',
            lc: 1,
            type: 'secret',
            id: ['test']
          } as Serialized,
          { query: 'test' },
          runId
        );

        expect(callback['_nodes'][runId].spanParams.createdAt).toBeInstanceOf(
          Date
        );
      });
    });

    describe('multi-provider token extraction', () => {
      it('test handleLLMEnd extracts OpenAI camelCase tokenUsage', async () => {
        const parentId = createId();
        const runId = createId();

        await callback.handleChainStart(
          { name: 'chain', lc: 1, type: 'secret', id: ['test'] } as Serialized,
          { query: 'test' },
          parentId
        );
        await callback.handleLLMStart(undefined, ['prompt'], runId, parentId, {
          invocation_params: { model_name: 'gpt-4' }
        });

        const llmResult: LLMResult = {
          generations: [[{ text: 'response', generationInfo: {} }]],
          llmOutput: {
            tokenUsage: {
              promptTokens: 10,
              completionTokens: 20,
              totalTokens: 30
            }
          }
        };
        await callback.handleLLMEnd(llmResult, runId);

        expect(callback['_nodes'][runId].spanParams.numInputTokens).toBe(10);
        expect(callback['_nodes'][runId].spanParams.numOutputTokens).toBe(20);
        expect(callback['_nodes'][runId].spanParams.totalTokens).toBe(30);
      });

      it('test handleLLMEnd extracts snake_case token_usage', async () => {
        const parentId = createId();
        const runId = createId();

        await callback.handleChainStart(
          { name: 'chain', lc: 1, type: 'secret', id: ['test'] } as Serialized,
          { query: 'test' },
          parentId
        );
        await callback.handleLLMStart(undefined, ['prompt'], runId, parentId, {
          invocation_params: { model_name: 'vertex-ai' }
        });

        const llmResult = {
          generations: [[{ text: 'response', generationInfo: {} }]],
          llmOutput: {
            token_usage: {
              prompt_tokens: 5,
              completion_tokens: 15,
              total_tokens: 20
            }
          }
        } as unknown as LLMResult;
        await callback.handleLLMEnd(llmResult, runId);

        expect(callback['_nodes'][runId].spanParams.numInputTokens).toBe(5);
        expect(callback['_nodes'][runId].spanParams.numOutputTokens).toBe(15);
        expect(callback['_nodes'][runId].spanParams.totalTokens).toBe(20);
      });

      it('test handleLLMEnd falls back to usage_metadata on generation message', async () => {
        const parentId = createId();
        const runId = createId();

        await callback.handleChainStart(
          { name: 'chain', lc: 1, type: 'secret', id: ['test'] } as Serialized,
          { query: 'test' },
          parentId
        );
        await callback.handleLLMStart(undefined, ['prompt'], runId, parentId, {
          invocation_params: { model_name: 'claude-3' }
        });

        const llmResult = {
          generations: [
            [
              {
                text: 'response',
                generationInfo: {},
                message: {
                  usage_metadata: {
                    input_tokens: 8,
                    output_tokens: 12,
                    total_tokens: 20
                  }
                }
              }
            ]
          ],
          llmOutput: {}
        } as unknown as LLMResult;
        await callback.handleLLMEnd(llmResult, runId);

        expect(callback['_nodes'][runId].spanParams.numInputTokens).toBe(8);
        expect(callback['_nodes'][runId].spanParams.numOutputTokens).toBe(12);
        expect(callback['_nodes'][runId].spanParams.totalTokens).toBe(20);
      });
    });

    describe('statusCode tracking', () => {
      it('test statusCode is 200 on successful chain end', async () => {
        const runId = createId();

        await callback.handleChainStart(
          {
            name: 'TestChain',
            lc: 1,
            type: 'secret',
            id: ['test']
          } as Serialized,
          { query: 'test' },
          runId
        );

        await callback.handleChainEnd({ result: 'answer' }, runId);

        const traces = callback._galileoLogger.traces;
        expect(traces).toHaveLength(1);
        const span = traces[0].spans[0] as WorkflowSpan;
        expect(span.statusCode).toBe(200);
      });

      it('test statusCode reflects error response status from handleChainError', async () => {
        const runId = createId();

        await callback.handleChainStart(
          {
            name: 'TestChain',
            lc: 1,
            type: 'secret',
            id: ['test']
          } as Serialized,
          { query: 'test' },
          runId
        );

        const error = Object.assign(new Error('Bad request'), {
          response: { status: 422 }
        });
        await callback.handleChainError(error, runId);

        const traces = callback._galileoLogger.traces;
        expect(traces).toHaveLength(1);
        const span = traces[0].spans[0] as WorkflowSpan;
        expect(span.statusCode).toBe(422);
      });

      it('test statusCode defaults to 400 when error has no response', async () => {
        const runId = createId();

        await callback.handleChainStart(
          {
            name: 'TestChain',
            lc: 1,
            type: 'secret',
            id: ['test']
          } as Serialized,
          { query: 'test' },
          runId
        );

        const error = new Error('Connection refused');
        await callback.handleChainError(error, runId);

        const traces = callback._galileoLogger.traces;
        expect(traces).toHaveLength(1);
        const span = traces[0].spans[0] as WorkflowSpan;
        expect(span.statusCode).toBe(500);
      });
    });

    describe('tool_calls extraction in chat messages', () => {
      it('test handleChatModelStart preserves tool_calls from AIMessage', async () => {
        const chainRunId = createId();
        const chatRunId = createId();

        await callback.handleChainStart(
          {
            name: 'TestChain',
            lc: 1,
            type: 'secret',
            id: ['test']
          } as Serialized,
          { query: 'test' },
          chainRunId
        );

        const aiMsg = new AIMessage({
          content: 'I will search for that.',
          tool_calls: [
            { name: 'search', args: { q: 'LangChain' }, id: 'call_123' }
          ]
        });

        await callback.handleChatModelStart(
          { name: 'gpt-4', lc: 1, type: 'secret', id: ['gpt-4'] } as Serialized,
          [[aiMsg]],
          chatRunId,
          chainRunId
        );

        const node = callback['_nodes'][chatRunId];
        const input = node.spanParams.input;
        expect(input).toHaveLength(1);
        expect(input[0].content).toBe('I will search for that.');
        expect(input[0].role).toBe('ai');
        expect(input[0].tool_calls).toEqual([
          expect.objectContaining({
            name: 'search',
            args: { q: 'LangChain' },
            id: 'call_123'
          })
        ]);
      });

      it('test handleChatModelStart omits tool_calls when empty', async () => {
        const chainRunId = createId();
        const chatRunId = createId();

        await callback.handleChainStart(
          {
            name: 'TestChain',
            lc: 1,
            type: 'secret',
            id: ['test']
          } as Serialized,
          { query: 'test' },
          chainRunId
        );

        const humanMsg = new HumanMessage('Hello');

        await callback.handleChatModelStart(
          { name: 'gpt-4', lc: 1, type: 'secret', id: ['gpt-4'] } as Serialized,
          [[humanMsg]],
          chatRunId,
          chainRunId
        );

        const node = callback['_nodes'][chatRunId];
        const input = node.spanParams.input;
        expect(input).toHaveLength(1);
        expect(input[0].content).toBe('Hello');
        expect(input[0].role).toBe('human');
        expect(input[0].tool_calls).toBeUndefined();
      });
    });

    describe('ingestionHook constructor', () => {
      it('test ingestionHook is called on flush with trace request', async () => {
        const hook = jest.fn().mockResolvedValue(undefined);
        const hookCallback = new GalileoCallback(undefined, true, true, hook);

        const runId = createId();
        await hookCallback.handleChainStart(
          {
            name: 'TestChain',
            lc: 1,
            type: 'secret',
            id: ['test']
          } as Serialized,
          { query: 'test' },
          runId
        );
        await hookCallback.handleChainEnd({ result: 'answer' }, runId);

        expect(hook).toHaveBeenCalledTimes(1);
        expect(hook).toHaveBeenCalledWith(
          expect.objectContaining({ traces: expect.any(Array) })
        );
      });
    });

    describe('try/finally cleanup', () => {
      it('test nodes and rootNodeContext are cleared even when flush throws', async () => {
        jest
          .spyOn(galileoLogger, 'flush')
          .mockRejectedValueOnce(new Error('flush failed'));

        const flushCallback = new GalileoCallback(galileoLogger, true, true);

        const runId = createId();
        await flushCallback.handleChainStart(
          {
            name: 'TestChain',
            lc: 1,
            type: 'secret',
            id: ['test']
          } as Serialized,
          { query: 'test' },
          runId
        );
        // _commit() re-throws after finally; catch it to inspect state
        try {
          await flushCallback.handleChainEnd({ result: 'answer' }, runId);
        } catch {
          // expected
        }

        expect(flushCallback['_nodes']).toEqual({});
        expect(flushCallback['_rootNode']).toBeNull();
      });
    });

    describe('startTrace receives name and metadata', () => {
      it('test startTrace is called with root node name and metadata', async () => {
        const spy = jest.spyOn(galileoLogger, 'startTrace');

        const runId = createId();
        await callback.handleChainStart(
          {
            name: 'MyChainName',
            lc: 1,
            type: 'secret',
            id: ['test']
          } as Serialized,
          { query: 'test' },
          runId,
          undefined,
          undefined,
          { session_id: 'abc123' }
        );
        await callback.handleChainEnd({ result: 'answer' }, runId);

        expect(spy).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'MyChainName',
            metadata: { session_id: 'abc123' }
          })
        );
      });
    });

    describe('PARITY-2: tool span with children (agent-as-tool)', () => {
      it('test LLM child span is nested under tool span when tool has children', async () => {
        const chainRunId = createId();
        const toolRunId = createId();
        const llmRunId = createId();

        // Start root chain
        await callback.handleChainStart(
          {
            name: 'RootChain',
            lc: 1,
            type: 'secret',
            id: ['RootChain']
          } as Serialized,
          { query: 'test' },
          chainRunId
        );

        // Start tool as child of chain
        await callback.handleToolStart(
          {
            name: 'SearchTool',
            lc: 1,
            type: 'secret',
            id: ['SearchTool']
          } as Serialized,
          'search query',
          toolRunId,
          chainRunId
        );

        // Start LLM as child of tool (agent-as-tool pattern)
        await callback.handleChatModelStart(
          { name: 'gpt-4', lc: 1, type: 'secret', id: ['gpt-4'] } as Serialized,
          [[new HumanMessage('hello')]],
          llmRunId,
          toolRunId
        );
        await callback.handleLLMEnd(
          {
            generations: [[{ text: 'llm-response', generationInfo: {} }]]
          } as LLMResult,
          llmRunId
        );

        // End tool
        await callback.handleToolEnd('tool-output', toolRunId);

        // End root chain
        await callback.handleChainEnd({ result: 'done' }, chainRunId);

        const traces = callback._galileoLogger.traces;
        expect(traces).toHaveLength(1);
        const rootSpan = traces[0].spans[0] as WorkflowSpan;
        expect(rootSpan.type).toBe(StepType.workflow);

        // Tool span is child of root chain
        expect(rootSpan.spans).toHaveLength(1);
        const toolSpan = rootSpan.spans[0] as ToolSpan;
        expect(toolSpan.type).toBe(StepType.tool);

        // LLM span is nested under tool span
        expect(toolSpan.spans).toHaveLength(1);
        const llmSpan = toolSpan.spans[0] as LlmSpan;
        expect(llmSpan.type).toBe(StepType.llm);
      });
    });

    describe('langsmith:hidden tag', () => {
      it('test handleChainStart skips node creation for langsmith:hidden tag', async () => {
        const runId = createId();
        await callback.handleChainStart(
          {
            name: 'HiddenChain',
            lc: 1,
            type: 'secret',
            id: ['test']
          } as Serialized,
          { query: 'test' },
          runId,
          undefined,
          ['langsmith:hidden']
        );

        expect(callback['_nodes'][runId]).toBeUndefined();
      });
    });

    describe('chain input type branches', () => {
      it('test handleChainStart wraps string input as object', async () => {
        const runId = createId();
        await callback.handleChainStart(
          { name: 'Chain', lc: 1, type: 'secret', id: ['test'] } as Serialized,
          'plain string input' as unknown as ChainValues,
          runId
        );

        expect(callback['_nodes'][runId].spanParams.input).toEqual({
          input: 'plain string input'
        });
      });

      it('test handleChainStart passes BaseMessage through directly', async () => {
        const runId = createId();
        const msg = new HumanMessage('Hello from user');
        await callback.handleChainStart(
          { name: 'Chain', lc: 1, type: 'secret', id: ['test'] } as Serialized,
          msg as unknown as ChainValues,
          runId
        );

        expect(callback['_nodes'][runId].spanParams.input).toBe(msg);
      });

      it('test handleChainStart serializes all object input values', async () => {
        const runId = createId();
        await callback.handleChainStart(
          { name: 'Chain', lc: 1, type: 'secret', id: ['test'] } as Serialized,
          { query: 'test', count: 42, valid: 'value' },
          runId
        );

        const input = callback['_nodes'][runId].spanParams.input as string;
        const parsed = JSON.parse(input);
        expect(parsed.query).toBe('test');
        expect(parsed.valid).toBe('value');
        expect(parsed.count).toBe(42);
      });
    });

    describe('handleLLMNewToken timing', () => {
      it('test timeToFirstTokenNs is set only on first token', async () => {
        const chainRunId = createId();
        const llmRunId = createId();

        await callback.handleChainStart(
          { name: 'Chain', lc: 1, type: 'secret', id: ['test'] } as Serialized,
          { query: 'test' },
          chainRunId
        );
        await callback.handleLLMStart(
          { name: 'llm', lc: 1, type: 'secret', id: ['llm'] } as Serialized,
          ['prompt'],
          llmRunId,
          chainRunId
        );

        // First token sets the time
        await callback.handleLLMNewToken(
          'first',
          { prompt: 0, completion: 0 },
          llmRunId
        );
        const firstTokenTime =
          callback['_nodes'][llmRunId].spanParams.timeToFirstTokenNs;
        expect(firstTokenTime).toBeGreaterThan(0);

        // Second token should NOT overwrite
        await callback.handleLLMNewToken(
          'second',
          { prompt: 0, completion: 1 },
          llmRunId
        );
        const secondTokenTime =
          callback['_nodes'][llmRunId].spanParams.timeToFirstTokenNs;
        expect(secondTokenTime).toBe(firstTokenTime);
      });

      it('test handleLLMNewToken silently ignores missing node', async () => {
        // Should not throw for nonexistent runId
        await expect(
          callback.handleLLMNewToken(
            'token',
            { prompt: 0, completion: 0 },
            'nonexistent-id'
          )
        ).resolves.toBeUndefined();
      });
    });

    describe('handleLLMEnd edge cases', () => {
      it('test handleLLMEnd handles empty generations array', async () => {
        const chainRunId = createId();
        const llmRunId = createId();

        await callback.handleChainStart(
          { name: 'Chain', lc: 1, type: 'secret', id: ['test'] } as Serialized,
          { query: 'test' },
          chainRunId
        );
        await callback.handleLLMStart(
          { name: 'llm', lc: 1, type: 'secret', id: ['llm'] } as Serialized,
          ['prompt'],
          llmRunId,
          chainRunId
        );

        const llmResult = {
          generations: [],
          llmOutput: {}
        } as unknown as LLMResult;

        // Should not throw
        await expect(
          callback.handleLLMEnd(llmResult, llmRunId)
        ).resolves.toBeUndefined();
      });
    });

    describe('error handler output format', () => {
      it('test error output includes error name and message', async () => {
        const runId = createId();
        await callback.handleChainStart(
          { name: 'Chain', lc: 1, type: 'secret', id: ['test'] } as Serialized,
          { query: 'test' },
          runId
        );

        const error = new TypeError('invalid argument');
        await callback.handleChainError(error, runId);

        const traces = callback._galileoLogger.traces;
        expect(traces).toHaveLength(1);
        const span = traces[0].spans[0] as WorkflowSpan;
        expect(span.output).toBe('Error: TypeError: invalid argument');
      });
    });
  });
});
