import { GalileoLogger } from '../../../src/utils/galileo-logger';
import { Node } from '../../../src/handlers/langchain/node';
import { logNodeTree } from '../../../src/handlers/langchain/tree-logger';
import { StepType } from '../../../src/types/logging/step.types';
import {
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

describe('logNodeTree', () => {
  let logger: GalileoLogger;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GALILEO_PROJECT = 'test-project';
    process.env.GALILEO_LOG_STREAM = 'test-log-stream';
    logger = new GalileoLogger();
    logger.startTrace({ input: 'test' });
  });

  it('test log agent node as agent span', () => {
    const node = new Node(
      'agent',
      {
        input: 'hello',
        output: 'world',
        name: 'TestAgent',
        tags: ['tag1']
      },
      'run-1'
    );
    const nodes: Record<string, Node> = { 'run-1': node };

    logNodeTree(node, nodes, logger);

    logger.conclude({ output: 'done' });
    const trace = logger.traces[0];
    expect(trace.spans.length).toBe(1);
    expect(trace.spans[0].type).toBe(StepType.agent);
  });

  it('test log chain node as workflow span', () => {
    const node = new Node(
      'chain',
      {
        input: 'hello',
        output: 'world',
        name: 'TestChain'
      },
      'run-1'
    );
    const nodes: Record<string, Node> = { 'run-1': node };

    logNodeTree(node, nodes, logger);

    logger.conclude({ output: 'done' });
    const trace = logger.traces[0];
    expect(trace.spans.length).toBe(1);
    expect(trace.spans[0].type).toBe(StepType.workflow);
  });

  it('test log llm node as llm span with tokens', () => {
    const node = new Node(
      'llm',
      {
        input: [{ content: 'prompt', role: 'user' }],
        output: { text: 'response' },
        name: 'GPT',
        model: 'gpt-4',
        temperature: 0.7,
        numInputTokens: 10,
        numOutputTokens: 20,
        totalTokens: 30
      },
      'run-1'
    );
    const nodes: Record<string, Node> = { 'run-1': node };

    logNodeTree(node, nodes, logger);

    logger.conclude({ output: 'done' });
    const trace = logger.traces[0];
    expect(trace.spans.length).toBe(1);
    const span = trace.spans[0] as LlmSpan;
    expect(span.type).toBe(StepType.llm);
    expect(span.metrics.numInputTokens).toBe(10);
    expect(span.metrics.numOutputTokens).toBe(20);
    expect(span.metrics.numTotalTokens).toBe(30);
  });

  it('test log tool node as tool span', () => {
    const node = new Node(
      'tool',
      {
        input: 'query',
        output: 'result',
        name: 'Search',
        toolCallId: 'tc-1'
      },
      'run-1'
    );
    const nodes: Record<string, Node> = { 'run-1': node };

    logNodeTree(node, nodes, logger);

    logger.conclude({ output: 'done' });
    const trace = logger.traces[0];
    expect(trace.spans.length).toBe(1);
    expect(trace.spans[0].type).toBe(StepType.tool);
  });

  it('test log retriever node as retriever span', () => {
    const node = new Node(
      'retriever',
      {
        input: 'search query',
        output: [{ pageContent: 'doc' }],
        name: 'VectorDB'
      },
      'run-1'
    );
    const nodes: Record<string, Node> = { 'run-1': node };

    logNodeTree(node, nodes, logger);

    logger.conclude({ output: 'done' });
    const trace = logger.traces[0];
    expect(trace.spans.length).toBe(1);
    expect(trace.spans[0].type).toBe(StepType.retriever);
  });

  it('test recurse into child nodes', () => {
    const parent = new Node(
      'chain',
      {
        input: 'hello',
        output: 'world',
        name: 'Parent'
      },
      'parent-1'
    );
    parent.children = ['child-1', 'child-2'];

    const child1 = new Node(
      'llm',
      {
        input: 'prompt',
        output: 'response',
        name: 'LLM'
      },
      'child-1',
      'parent-1'
    );

    const child2 = new Node(
      'tool',
      {
        input: 'query',
        output: 'result',
        name: 'Tool'
      },
      'child-2',
      'parent-1'
    );

    const nodes: Record<string, Node> = {
      'parent-1': parent,
      'child-1': child1,
      'child-2': child2
    };

    logNodeTree(parent, nodes, logger);

    logger.conclude({ output: 'done' });
    const trace = logger.traces[0];
    expect(trace.spans.length).toBe(1);
    const workflow = trace.spans[0] as WorkflowSpan;
    expect(workflow.type).toBe(StepType.workflow);
    expect(workflow.spans.length).toBe(2);
    expect(workflow.spans[0].type).toBe(StepType.llm);
    expect(workflow.spans[1].type).toBe(StepType.tool);
  });

  it('test extract step number from langgraph_step metadata', () => {
    const node = new Node(
      'chain',
      {
        input: 'hello',
        output: 'world',
        name: 'Step',
        metadata: { langgraph_step: '3' }
      },
      'run-1'
    );
    const nodes: Record<string, Node> = { 'run-1': node };

    logNodeTree(node, nodes, logger);

    logger.conclude({ output: 'done' });
    const trace = logger.traces[0];
    const span = trace.spans[0] as WorkflowSpan;
    expect(span.stepNumber).toBe(3);
  });

  it('test handle invalid step number gracefully', () => {
    const node = new Node(
      'chain',
      {
        input: 'hello',
        output: 'world',
        name: 'Step',
        metadata: { langgraph_step: 'not-a-number' }
      },
      'run-1'
    );
    const nodes: Record<string, Node> = { 'run-1': node };

    logNodeTree(node, nodes, logger);

    logger.conclude({ output: 'done' });
    const trace = logger.traces[0];
    const span = trace.spans[0] as WorkflowSpan;
    expect(span.stepNumber).toBeUndefined();
  });

  it('test tool span with children pushes parent for nesting', () => {
    const toolNode = new Node(
      'tool',
      {
        input: 'query',
        output: 'result',
        name: 'AgentTool'
      },
      'tool-1'
    );
    toolNode.children = ['llm-1'];

    const llmNode = new Node(
      'llm',
      {
        input: 'prompt',
        output: 'response',
        name: 'NestedLLM'
      },
      'llm-1',
      'tool-1'
    );

    const nodes: Record<string, Node> = {
      'tool-1': toolNode,
      'llm-1': llmNode
    };

    logNodeTree(toolNode, nodes, logger);

    logger.conclude({ output: 'done' });
    const trace = logger.traces[0];
    const toolSpan = trace.spans[0] as ToolSpan;
    expect(toolSpan.type).toBe(StepType.tool);
    // The LLM span should be nested under the tool span
    expect((toolSpan as unknown as WorkflowSpan).spans?.length).toBe(1);
  });

  it('test metadata conversion error is handled gracefully', () => {
    const circularRef: Record<string, unknown> = {};
    circularRef.self = circularRef;

    const node = new Node(
      'chain',
      {
        input: 'hello',
        output: 'world',
        name: 'Test',
        metadata: circularRef
      },
      'run-1'
    );
    const nodes: Record<string, Node> = { 'run-1': node };

    // Should not throw
    expect(() => logNodeTree(node, nodes, logger)).not.toThrow();
  });
});
