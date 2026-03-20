import {
  extractLlmData,
  extractToolData,
  extractWorkflowData,
  extractGalileoCustomData,
  parseUsage
} from '../../../src/handlers/openai-agents/data-extraction';

describe('parseUsage', () => {
  test('test parse usage null returns zeros', () => {
    const result = parseUsage(null);
    expect(result).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: null,
      reasoningTokens: 0,
      cachedTokens: 0,
      rejectedPredictionTokens: 0
    });
  });

  test('test parse usage undefined returns zeros', () => {
    const result = parseUsage(undefined);
    expect(result).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: null,
      reasoningTokens: 0,
      cachedTokens: 0,
      rejectedPredictionTokens: 0
    });
  });

  test('test parse usage with input_tokens and output_tokens', () => {
    const result = parseUsage({
      input_tokens: 10,
      output_tokens: 20,
      total_tokens: 30
    });
    expect(result.inputTokens).toBe(10);
    expect(result.outputTokens).toBe(20);
    expect(result.totalTokens).toBe(30);
  });

  test('test parse usage with legacy prompt_tokens and completion_tokens', () => {
    const result = parseUsage({ prompt_tokens: 5, completion_tokens: 15 });
    expect(result.inputTokens).toBe(5);
    expect(result.outputTokens).toBe(15);
  });

  test('test parse usage extracts reasoning_tokens from output_tokens_details', () => {
    const result = parseUsage({
      input_tokens: 10,
      output_tokens: 5,
      output_tokens_details: { reasoning_tokens: 3 },
      input_tokens_details: { cached_tokens: 2 }
    });
    expect(result.reasoningTokens).toBe(3);
    expect(result.cachedTokens).toBe(2);
  });

  test('test parse usage extracts reasoning_tokens from details (legacy shape)', () => {
    const result = parseUsage({
      input_tokens: 10,
      output_tokens: 5,
      details: { reasoning_tokens: 3, cached_tokens: 2 }
    });
    expect(result.reasoningTokens).toBe(3);
    expect(result.cachedTokens).toBe(2);
  });

  test('test parse usage extracts reasoning_tokens at top level', () => {
    const result = parseUsage({
      input_tokens: 10,
      output_tokens: 5,
      reasoning_tokens: 4
    });
    expect(result.reasoningTokens).toBe(4);
  });
});

describe('extractLlmData generation', () => {
  test('test extract generation span data', () => {
    const spanData = {
      type: 'generation',
      input: [{ role: 'user', content: 'Hello' }],
      output: [{ role: 'assistant', content: 'Hi' }],
      model: 'gpt-4o',
      model_config: { temperature: 0.7, max_tokens: 100 },
      usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 }
    };
    const result = extractLlmData(spanData);
    expect(result.model).toBe('gpt-4o');
    expect(result.temperature).toBe(0.7);
    expect(result.numInputTokens).toBe(10);
    expect(result.numOutputTokens).toBe(5);
    expect(result.totalTokens).toBe(15);
    expect(result.input).toBe(JSON.stringify(spanData.input));
    expect(result.output).toBe(JSON.stringify(spanData.output));
  });

  test('test extract generation span with null usage', () => {
    const spanData = { type: 'generation', model: 'gpt-4o' };
    const result = extractLlmData(spanData);
    expect(result.numInputTokens).toBe(0);
    expect(result.numOutputTokens).toBe(0);
    expect(result.totalTokens).toBeUndefined();
  });

  test('test extract generation metadata includes gen_ai_system openai', () => {
    const spanData = { type: 'generation' };
    const result = extractLlmData(spanData);
    const meta = result.metadata as Record<string, unknown>;
    expect(meta.gen_ai_system).toBe('openai');
  });

  test('test extract generation metadata model_config is raw dict', () => {
    const spanData = {
      type: 'generation',
      model_config: { temperature: 0.5, max_tokens: 200 }
    };
    const result = extractLlmData(spanData);
    const meta = result.metadata as Record<string, unknown>;
    expect(meta.model_config).toEqual({ temperature: 0.5, max_tokens: 200 });
  });

  test('test extract generation metadata includes token detail objects', () => {
    const spanData = {
      type: 'generation',
      usage: {
        input_tokens: 10,
        output_tokens: 5,
        input_tokens_details: { cached_tokens: 3 },
        output_tokens_details: { reasoning_tokens: 2 }
      }
    };
    const result = extractLlmData(spanData);
    const meta = result.metadata as Record<string, unknown>;
    expect(meta.input_tokens_details).toEqual({ cached_tokens: 3 });
    expect(meta.output_tokens_details).toEqual({ reasoning_tokens: 2 });
  });

  test('test extract generation metadata omits absent token details', () => {
    const spanData = {
      type: 'generation',
      usage: { input_tokens: 10, output_tokens: 5 }
    };
    const result = extractLlmData(spanData);
    const meta = result.metadata as Record<string, unknown>;
    expect(meta).not.toHaveProperty('input_tokens_details');
    expect(meta).not.toHaveProperty('output_tokens_details');
  });

  test('test extract generation span with string input and output not double encoded', () => {
    const spanData = {
      type: 'generation',
      input: 'What is the weather?',
      output: 'It is sunny.'
    };
    const result = extractLlmData(spanData);
    expect(result.input).toBe('What is the weather?');
    expect(result.output).toBe('It is sunny.');
  });
});

describe('extractLlmData response', () => {
  test('test extract response span data with _input and _response', () => {
    const spanData = {
      type: 'response',
      _input: [{ role: 'user', content: 'Hello' }],
      _response: {
        model: 'gpt-4o',
        usage: { input_tokens: 8, output_tokens: 4 },
        temperature: 0.5,
        output: [{ type: 'message', content: 'Hi' }]
      }
    };
    const result = extractLlmData(spanData);
    expect(result.model).toBe('gpt-4o');
    expect(result.temperature).toBe(0.5);
    expect(result.numInputTokens).toBe(8);
    expect(result.numOutputTokens).toBe(4);
  });

  test('test extract response span data with fallback input/response keys', () => {
    const spanData = {
      type: 'response',
      input: 'some input',
      response: {
        model: 'gpt-3.5-turbo',
        usage: { input_tokens: 2, output_tokens: 1 }
      }
    };
    const result = extractLlmData(spanData);
    expect(result.model).toBe('gpt-3.5-turbo');
    expect(result.numInputTokens).toBe(2);
  });

  test('test extract response span with null response returns unknown model', () => {
    const spanData = { type: 'response' };
    const result = extractLlmData(spanData);
    expect(result.model).toBe('unknown');
    expect(result.numInputTokens).toBe(0);
  });

  test('test extract response tools returned as raw array not JSON string', () => {
    const toolsArray = [{ type: 'function', name: 'search' }];
    const spanData = {
      type: 'response',
      _response: {
        model: 'gpt-4o',
        usage: {},
        tools: toolsArray,
        output: []
      }
    };
    const result = extractLlmData(spanData);
    expect(result.tools).toEqual(toolsArray);
    expect(typeof result.tools).not.toBe('string');
  });

  test('test extract response model_parameters from whitelist', () => {
    const spanData = {
      type: 'response',
      _response: {
        model: 'gpt-4o',
        usage: {},
        temperature: 0.7,
        max_output_tokens: 512,
        top_p: 1,
        tool_choice: 'auto',
        seed: 42,
        irrelevant_field: 'ignored',
        output: []
      }
    };
    const result = extractLlmData(spanData);
    const mp = result.modelParameters as Record<string, unknown>;
    expect(mp.temperature).toBe(0.7);
    expect(mp.max_output_tokens).toBe(512);
    expect(mp.top_p).toBe(1);
    expect(mp.tool_choice).toBe('auto');
    expect(mp.seed).toBe(42);
    expect(mp).not.toHaveProperty('irrelevant_field');
  });

  test('test extract response metadata includes response_metadata', () => {
    const spanData = {
      type: 'response',
      _response: {
        model: 'gpt-4o',
        usage: {},
        temperature: 0.5,
        object: 'response',
        output: []
      }
    };
    const result = extractLlmData(spanData);
    const meta = result.metadata as Record<string, unknown>;
    expect(meta.gen_ai_system).toBe('openai');
    const rm = meta.response_metadata as Record<string, unknown>;
    expect(rm.model).toBe('gpt-4o');
    expect(rm.temperature).toBe(0.5);
    expect(rm).not.toHaveProperty('usage');
    expect(rm).not.toHaveProperty('output');
  });

  test('test extract response metadata includes instructions when present', () => {
    const spanData = {
      type: 'response',
      _response: {
        model: 'gpt-4o',
        usage: {},
        instructions: 'You are a helpful assistant.',
        output: []
      }
    };
    const result = extractLlmData(spanData);
    const meta = result.metadata as Record<string, unknown>;
    expect(meta.instructions).toBe('You are a helpful assistant.');
  });

  test('test extract response metadata omits instructions when absent', () => {
    const spanData = {
      type: 'response',
      _response: { model: 'gpt-4o', usage: {}, output: [] }
    };
    const result = extractLlmData(spanData);
    const meta = result.metadata as Record<string, unknown>;
    expect(meta).not.toHaveProperty('instructions');
  });

  test('test extract response span with string input not double encoded', () => {
    const spanData = {
      type: 'response',
      _input: 'Hello',
      _response: { model: 'gpt-4o', usage: {}, output: [] }
    };
    const result = extractLlmData(spanData);
    expect(result.input).toBe('Hello');
  });

  test('test extractLlmData response span with response.error sets statusCode and error_details', () => {
    const error = { status_code: 429, message: 'Rate limit' };
    const spanData = {
      type: 'response',
      _input: 'hello',
      _response: {
        model: 'gpt-4o',
        usage: {},
        output: [],
        error
      }
    };
    const result = extractLlmData(spanData);
    expect(result.statusCode).toBe(429);
    const meta = result.metadata as Record<string, unknown>;
    expect(meta.error_details).toEqual(error);
  });

  test('test extractLlmData response span with response.error missing status_code falls back to 500', () => {
    const spanData = {
      type: 'response',
      _input: 'hello',
      _response: {
        model: 'gpt-4o',
        usage: {},
        output: [],
        error: { message: 'Unknown error' }
      }
    };
    const result = extractLlmData(spanData);
    expect(result.statusCode).toBe(500);
  });

  test('test extractLlmData response span with no response.error has no statusCode', () => {
    const spanData = {
      type: 'response',
      _input: 'hello',
      _response: {
        model: 'gpt-4o',
        usage: {},
        output: []
      }
    };
    const result = extractLlmData(spanData);
    expect(result.statusCode).toBeUndefined();
  });
});

describe('extractLlmData unknown type', () => {
  test('test extract returns empty record for unknown type', () => {
    const result = extractLlmData({ type: 'unknown' });
    expect(Object.keys(result).length).toBe(0);
  });
});

describe('extractToolData', () => {
  test('test extract function span data string input/output', () => {
    const spanData = {
      type: 'function',
      input: '{"query":"hello"}',
      output: 'result text'
    };
    const result = extractToolData(spanData);
    expect(result.input).toBe('{"query":"hello"}');
    expect(result.output).toBe('result text');
  });

  test('test extract function span data object input serialised', () => {
    const spanData = {
      type: 'function',
      input: { query: 'hello' },
      output: { answer: 'world' }
    };
    const result = extractToolData(spanData);
    expect(result.input).toBe(JSON.stringify({ query: 'hello' }));
    expect(result.output).toBe(JSON.stringify({ answer: 'world' }));
  });

  test('test extract function span data missing output', () => {
    const spanData = { type: 'function', input: 'test' };
    const result = extractToolData(spanData);
    expect(result.output).toBeUndefined();
  });

  test('test extract function span with mcp_data in metadata', () => {
    const spanData = {
      type: 'function',
      input: 'test',
      mcp_data: { server: 'my-server', tool: 'my-tool' }
    };
    const result = extractToolData(spanData);
    const meta = result.metadata as Record<string, string>;
    expect(meta.mcp_data).toBe(
      JSON.stringify({ server: 'my-server', tool: 'my-tool' })
    );
  });

  test('test extract guardrail span triggered', () => {
    const spanData = { type: 'guardrail', triggered: true, name: 'PII Filter' };
    const result = extractToolData(spanData);
    expect(result.input).toBe('');
    expect(result.output).toBe('{"triggered":true}');
    const meta = result.metadata as Record<string, unknown>;
    expect(meta.triggered).toBe(true);
    expect(meta.status).toBe('warning');
    expect(meta).not.toHaveProperty('guardrail_name');
  });

  test('test extract guardrail span not triggered', () => {
    const spanData = { type: 'guardrail', triggered: false, name: 'Safety' };
    const result = extractToolData(spanData);
    expect(result.output).toBe('{"triggered":false}');
    const meta = result.metadata as Record<string, unknown>;
    expect(meta.triggered).toBe(false);
    expect(meta).not.toHaveProperty('status');
    expect(meta).not.toHaveProperty('guardrail_name');
  });

  test('test extract tool data for transcription returns empty', () => {
    const result = extractToolData({ type: 'transcription' });
    expect(result.input).toBe('');
    expect(result.output).toBeUndefined();
  });

  test('test extract tool data for mcp_tools returns empty', () => {
    const result = extractToolData({ type: 'mcp_tools' });
    expect(result.input).toBe('');
  });
});

describe('extractWorkflowData', () => {
  test('test extract agent span data with tools and handoffs', () => {
    const spanData = {
      type: 'agent',
      name: 'PlannerAgent',
      tools: ['search', 'calculator'],
      handoffs: ['ReviewAgent'],
      output_type: 'string'
    };
    const result = extractWorkflowData(spanData);
    expect(result.input).toBe('');
    const meta = result.metadata as Record<string, unknown>;
    expect(meta.tools).toEqual(['search', 'calculator']);
    expect(meta.handoffs).toEqual(['ReviewAgent']);
    expect(meta.output_type).toBe('string');
  });

  test('test extract agent span data without optional fields', () => {
    const result = extractWorkflowData({ type: 'agent' });
    expect(result.input).toBe('');
    expect(result.output).toBeUndefined();
    const meta = result.metadata as Record<string, string>;
    expect(Object.keys(meta).length).toBe(0);
  });

  test('test extract handoff span data', () => {
    const spanData = {
      type: 'handoff',
      from_agent: 'AgentA',
      to_agent: 'AgentB'
    };
    const result = extractWorkflowData(spanData);
    expect(result.input).toBe('{"from_agent":"AgentA"}');
    expect(result.output).toBe('{"to_agent":"AgentB"}');
    const meta = result.metadata as Record<string, string>;
    expect(meta.from_agent).toBe('AgentA');
    expect(meta.to_agent).toBe('AgentB');
  });

  test('test extract handoff span data with missing agents', () => {
    const result = extractWorkflowData({ type: 'handoff' });
    expect(result.input).toBe('');
    expect(result.output).toBeUndefined();
  });

  test('test extract custom span data with input and output', () => {
    const spanData = {
      type: 'custom',
      data: {
        input: 'custom input',
        output: 'custom output',
        extra_key: 'extra value'
      }
    };
    const result = extractWorkflowData(spanData);
    expect(result.input).toBe('custom input');
    expect(result.output).toBe('custom output');
    const meta = result.metadata as Record<string, unknown>;
    expect(meta.extra_key).toBe('extra value');
    expect(meta.input).toBeUndefined();
    expect(meta.output).toBeUndefined();
  });

  test('test extract custom span data with object metadata value kept as-is', () => {
    const spanData = {
      type: 'custom',
      data: {
        input: 'in',
        output: 'out',
        config: { retries: 3, timeout: 5000 }
      }
    };
    const result = extractWorkflowData(spanData);
    const meta = result.metadata as Record<string, unknown>;
    expect(meta.config).toEqual({ retries: 3, timeout: 5000 });
  });

  test('test extract custom span data with object input serialised', () => {
    const spanData = {
      type: 'custom',
      data: { input: { query: 'hello' }, output: { answer: 'world' } }
    };
    const result = extractWorkflowData(spanData);
    expect(result.input).toBe(JSON.stringify({ query: 'hello' }));
    expect(result.output).toBe(JSON.stringify({ answer: 'world' }));
  });

  test('test extract custom span data with no data field', () => {
    const result = extractWorkflowData({ type: 'custom' });
    expect(result.input).toBe('');
    expect(result.output).toBeUndefined();
  });

  test('test extract unknown span type returns empty', () => {
    const result = extractWorkflowData({ type: 'future_type' });
    expect(result.input).toBe('');
    expect(result.output).toBeUndefined();
  });
});

describe('extractGalileoCustomData', () => {
  test('test extracts tool type from galileoSpan', () => {
    const spanData = {
      type: 'custom',
      __galileoCustom: true,
      _galileoSpan: {
        type: 'tool',
        input: 'tool input',
        output: 'tool output',
        metadata: { key: 'val' },
        tags: ['tag1'],
        statusCode: 201
      }
    };
    const result = extractGalileoCustomData(spanData);
    expect(result.nodeType).toBe('tool');
    expect(result.params.input).toBe('tool input');
    expect(result.params.output).toBe('tool output');
    expect(result.params.metadata).toEqual({ key: 'val' });
    expect(result.params.tags).toEqual(['tag1']);
    expect(result.params.statusCode).toBe(201);
  });

  test('test extracts workflow type from galileoSpan', () => {
    const spanData = {
      type: 'custom',
      __galileoCustom: true,
      _galileoSpan: {
        type: 'workflow',
        input: 'wf in',
        output: 'wf out'
      }
    };
    const result = extractGalileoCustomData(spanData);
    expect(result.nodeType).toBe('workflow');
    expect(result.params.input).toBe('wf in');
    expect(result.params.output).toBe('wf out');
  });

  test('test extracts agent type from galileoSpan', () => {
    const spanData = {
      type: 'custom',
      __galileoCustom: true,
      _galileoSpan: {
        type: 'agent',
        input: 'agent in'
      }
    };
    const result = extractGalileoCustomData(spanData);
    expect(result.nodeType).toBe('agent');
    expect(result.params.input).toBe('agent in');
  });

  test('test falls back to workflow for unrecognized galileoSpan type', () => {
    const spanData = {
      type: 'custom',
      __galileoCustom: true,
      _galileoSpan: { type: 'future_type', input: 'x' }
    };
    const result = extractGalileoCustomData(spanData);
    expect(result.nodeType).toBe('workflow');
    expect(result.params.input).toBe('x');
  });

  test('test falls back to workflow for llm type (not delegated)', () => {
    const spanData = {
      type: 'custom',
      __galileoCustom: true,
      _galileoSpan: { type: 'llm', input: 'prompt' }
    };
    const result = extractGalileoCustomData(spanData);
    expect(result.nodeType).toBe('workflow');
  });

  test('test falls back to extractWorkflowData when no galileoSpan', () => {
    const spanData = {
      type: 'custom',
      __galileoCustom: true,
      data: { input: 'plain input', output: 'plain output' }
    };
    const result = extractGalileoCustomData(spanData);
    expect(result.nodeType).toBe('workflow');
    expect(result.params.input).toBe('plain input');
    expect(result.params.output).toBe('plain output');
  });

  test('test falls back to extractWorkflowData when galileoSpan is not an object', () => {
    const spanData = {
      type: 'custom',
      __galileoCustom: true,
      _galileoSpan: 'not-an-object'
    };
    const result = extractGalileoCustomData(spanData);
    expect(result.nodeType).toBe('workflow');
  });

  test('test serializes object input/output from galileoSpan', () => {
    const spanData = {
      type: 'custom',
      __galileoCustom: true,
      _galileoSpan: {
        type: 'tool',
        input: { query: 'hello' },
        output: { answer: 'world' }
      }
    };
    const result = extractGalileoCustomData(spanData);
    expect(result.params.input).toBe(JSON.stringify({ query: 'hello' }));
    expect(result.params.output).toBe(JSON.stringify({ answer: 'world' }));
  });

  test('test omits tags and statusCode when not provided', () => {
    const spanData = {
      type: 'custom',
      __galileoCustom: true,
      _galileoSpan: { type: 'tool', input: 'in' }
    };
    const result = extractGalileoCustomData(spanData);
    expect(result.params).not.toHaveProperty('tags');
    expect(result.params).not.toHaveProperty('statusCode');
  });

  test('test handles missing galileoSpan gracefully', () => {
    const spanData = {
      type: 'custom',
      __galileoCustom: true
    };
    const result = extractGalileoCustomData(spanData);
    expect(result.nodeType).toBe('workflow');
  });

  test('test defaults to empty input when galileoSpan has no input', () => {
    const spanData = {
      type: 'custom',
      __galileoCustom: true,
      _galileoSpan: { type: 'tool' }
    };
    const result = extractGalileoCustomData(spanData);
    expect(result.params.input).toBe('');
    expect(result.params.output).toBeUndefined();
    expect(result.params.metadata).toEqual({});
  });
});
