import {
  extractEmbeddedToolCalls,
  getToolNameFromType,
  extractToolInput,
  extractToolOutput
} from '../../../src/handlers/openai-agents/embedded-tools';

describe('getToolNameFromType', () => {
  test('test maps code_interpreter_call to code_interpreter', () => {
    expect(getToolNameFromType('code_interpreter_call')).toBe(
      'code_interpreter'
    );
  });

  test('test maps file_search_call to file_search', () => {
    expect(getToolNameFromType('file_search_call')).toBe('file_search');
  });

  test('test maps web_search_call to web_search', () => {
    expect(getToolNameFromType('web_search_call')).toBe('web_search');
  });

  test('test maps computer_call to computer', () => {
    expect(getToolNameFromType('computer_call')).toBe('computer');
  });

  test('test maps custom_tool_call to custom_tool', () => {
    expect(getToolNameFromType('custom_tool_call')).toBe('custom_tool');
  });

  test('test returns original string for unknown type', () => {
    expect(getToolNameFromType('unknown_type')).toBe('unknown_type');
  });
});

describe('extractToolInput', () => {
  test('test code_interpreter_call extracts code field', () => {
    const result = extractToolInput(
      { code: 'print("hello")' },
      'code_interpreter_call'
    );
    expect(result).toBe('print("hello")');
  });

  test('test code_interpreter_call returns null when no code', () => {
    expect(extractToolInput({}, 'code_interpreter_call')).toBeNull();
  });

  test('test file_search_call extracts queries', () => {
    const result = extractToolInput(
      { queries: ['find docs', 'search code'] },
      'file_search_call'
    );
    expect(result).toBe(JSON.stringify(['find docs', 'search code']));
  });

  test('test web_search_call extracts action.query', () => {
    const result = extractToolInput(
      { action: { query: 'latest news' } },
      'web_search_call'
    );
    expect(result).toBe('latest news');
  });

  test('test web_search_call returns null when no action', () => {
    expect(extractToolInput({}, 'web_search_call')).toBeNull();
  });

  test('test computer_call extracts action object', () => {
    const action = { type: 'click', coordinate: [100, 200] };
    const result = extractToolInput({ action }, 'computer_call');
    expect(result).toBe(JSON.stringify(action));
  });

  test('test custom_tool_call extracts input string', () => {
    const result = extractToolInput({ input: 'my input' }, 'custom_tool_call');
    expect(result).toBe('my input');
  });

  test('test custom_tool_call serialises object input', () => {
    const result = extractToolInput(
      { input: { key: 'val' } },
      'custom_tool_call'
    );
    expect(result).toBe(JSON.stringify({ key: 'val' }));
  });
});

describe('extractToolOutput', () => {
  test('test code_interpreter_call concatenates log outputs', () => {
    const result = extractToolOutput(
      { outputs: [{ logs: 'line1' }, { logs: 'line2' }] },
      'code_interpreter_call'
    );
    expect(result).toBe('line1\nline2');
  });

  test('test code_interpreter_call extracts url output', () => {
    const result = extractToolOutput(
      { outputs: [{ url: 'https://example.com/file.png' }] },
      'code_interpreter_call'
    );
    expect(result).toBe('https://example.com/file.png');
  });

  test('test code_interpreter_call returns null for empty outputs', () => {
    expect(
      extractToolOutput({ outputs: [] }, 'code_interpreter_call')
    ).toBeNull();
  });

  test('test file_search_call extracts results', () => {
    const results = [{ id: '1', content: 'doc' }];
    const result = extractToolOutput({ results }, 'file_search_call');
    expect(result).toBe(JSON.stringify(results));
  });

  test('test file_search_call returns null when no results', () => {
    expect(extractToolOutput({}, 'file_search_call')).toBeNull();
  });

  test('test web_search_call returns action as json', () => {
    const action = { query: 'news', status: 'done' };
    const result = extractToolOutput({ action }, 'web_search_call');
    expect(result).toBe(JSON.stringify(action));
  });

  test('test computer_call returns null', () => {
    expect(
      extractToolOutput({ result: 'screenshot' }, 'computer_call')
    ).toBeNull();
  });

  test('test custom_tool_call extracts output string', () => {
    const result = extractToolOutput({ output: 'done' }, 'custom_tool_call');
    expect(result).toBe('done');
  });
});

describe('extractEmbeddedToolCalls', () => {
  test('test returns empty array for null response', () => {
    expect(extractEmbeddedToolCalls(null)).toEqual([]);
  });

  test('test returns empty array for response without output', () => {
    expect(extractEmbeddedToolCalls({})).toEqual([]);
  });

  test('test skips non-embedded-tool output items', () => {
    const response = {
      output: [{ type: 'message', content: 'hello' }]
    };
    expect(extractEmbeddedToolCalls(response)).toEqual([]);
  });

  test('test extracts code_interpreter_call', () => {
    const response = {
      output: [
        {
          type: 'code_interpreter_call',
          id: 'ci_001',
          code: 'x = 1',
          outputs: [{ logs: 'output log' }],
          status: 'completed'
        }
      ]
    };
    const result = extractEmbeddedToolCalls(response);
    expect(result.length).toBe(1);
    expect(result[0].type).toBe('code_interpreter_call');
    expect(result[0].function.name).toBe('code_interpreter');
    expect(result[0].tool_call_id).toBe('ci_001');
    expect(result[0].tool_call_input).toBe('x = 1');
    expect(result[0].tool_call_output).toBe('output log');
    expect(result[0].tool_call_status).toBe('completed');
  });

  test('test extracts file_search_call', () => {
    const response = {
      output: [
        {
          type: 'file_search_call',
          id: 'fs_001',
          queries: ['find docs'],
          results: [{ id: 'doc1', content: 'text' }]
        }
      ]
    };
    const result = extractEmbeddedToolCalls(response);
    expect(result.length).toBe(1);
    expect(result[0].function.name).toBe('file_search');
    expect(result[0].tool_call_input).toBe(JSON.stringify(['find docs']));
  });

  test('test extracts web_search_call', () => {
    const response = {
      output: [
        {
          type: 'web_search_call',
          id: 'ws_001',
          action: { query: 'latest AI news' }
        }
      ]
    };
    const result = extractEmbeddedToolCalls(response);
    expect(result.length).toBe(1);
    expect(result[0].function.name).toBe('web_search');
    expect(result[0].tool_call_input).toBe('latest AI news');
  });

  test('test extracts multiple embedded tool calls', () => {
    const response = {
      output: [
        { type: 'code_interpreter_call', code: 'x=1', outputs: [] },
        { type: 'message', content: 'hi' },
        { type: 'web_search_call', action: { query: 'test' } }
      ]
    };
    const result = extractEmbeddedToolCalls(response);
    expect(result.length).toBe(2);
    expect(result[0].type).toBe('code_interpreter_call');
    expect(result[1].type).toBe('web_search_call');
  });

  test('test handles null output items gracefully', () => {
    const response = {
      output: [
        null,
        undefined,
        { type: 'web_search_call', action: { query: 'q' } }
      ]
    };
    const result = extractEmbeddedToolCalls(response);
    expect(result.length).toBe(1);
  });
});
