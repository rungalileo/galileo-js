/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  webSearchCall,
  mcpCall,
  mcpListTools,
  fileSearchCall,
  computerCall,
  imageGenerationCall,
  codeInterpreterCall,
  localShellCall,
  localShellCallOutput,
  customToolCall,
  functionCallOutput,
  getToolExtractor,
  TOOL_SPAN_TYPES,
  TOOL_EXTRACTORS
} from '../../../src/handlers/openai/tool-extractors';

describe('Tool Extractors', () => {
  describe('webSearchCall', () => {
    test('extracts web search call with sources', () => {
      const item = {
        type: 'web_search_call',
        action: {
          query: 'weather in New York',
          url: 'https://example.com',
          pattern: 'summary',
          sources: [{ title: 'Weather.com', url: 'https://weather.com' }]
        },
        status: 'completed'
      };

      const result = webSearchCall(item);

      expect(result.input).toContain('web_search_call');
      expect(result.input).toContain('weather in New York');
      expect(result.output).toContain('Weather.com');
    });

    test('extracts web search call with status when no sources', () => {
      const item = {
        type: 'web_search_call',
        action: {},
        status: 'failed'
      };

      const result = webSearchCall(item);

      expect(result.output).toContain('failed');
    });

    test('handles missing action gracefully', () => {
      const item = {
        type: 'web_search_call',
        sources: [{ title: 'Test' }]
      };

      const result = webSearchCall(item);

      expect(result.input).toBeDefined();
      expect(result.output).toBeDefined();
    });
  });

  describe('mcpCall', () => {
    test('extracts MCP call with all fields', () => {
      const item = {
        name: 'get_weather',
        server_label: 'weather_server',
        arguments: '{"location": "New York"}',
        output: 'Sunny, 72F'
      };

      const result = mcpCall(item);

      expect(result.input).toContain('get_weather');
      expect(result.input).toContain('weather_server');
      expect(result.output).toContain('Sunny');
    });

    test('handles missing fields with defaults', () => {
      const item = {};

      const result = mcpCall(item);

      expect(result.input).toContain('""');
      expect(result.output).toBeDefined();
    });
  });

  describe('mcpListTools', () => {
    test('extracts list of tools from MCP server', () => {
      const item = {
        server_label: 'my_server',
        tools: [
          { name: 'tool1', description: 'First tool' },
          { name: 'tool2', description: 'Second tool' }
        ]
      };

      const result = mcpListTools(item);

      expect(result.input).toBe('my_server');
      expect(result.output).toContain('tool1');
      expect(result.output).toContain('tool2');
    });

    test('handles empty tools array', () => {
      const item = {
        server_label: 'empty_server',
        tools: []
      };

      const result = mcpListTools(item);

      expect(result.output).toContain('[]');
    });
  });

  describe('fileSearchCall', () => {
    test('extracts file search with queries and results', () => {
      const item = {
        queries: ['document.pdf', 'image.jpg'],
        results: [{ id: '1', name: 'document.pdf', score: 0.95 }],
        status: 'completed'
      };

      const result = fileSearchCall(item);

      expect(result.input).toContain('document.pdf');
      expect(result.input).toContain('image.jpg');
      expect(result.output).toBe('completed');
    });
  });

  describe('computerCall', () => {
    test('extracts computer action call', () => {
      const item = {
        action: {
          type: 'screenshot',
          coordinates: [100, 200]
        },
        status: 'success'
      };

      const result = computerCall(item);

      expect(result.input).toContain('screenshot');
      expect(result.output).toContain('success');
    });

    test('handles missing action', () => {
      const item = {
        status: 'pending'
      };

      const result = computerCall(item);

      expect(result.output).toBe('pending');
    });
  });

  describe('imageGenerationCall', () => {
    test('extracts image generation call', () => {
      const item = {
        id: 'img_123',
        status: 'succeeded',
        result: 'https://example.com/image.png'
      };

      const result = imageGenerationCall(item);

      expect(result.input).toContain('img_123');
      expect(result.output).toContain('https://example.com/image.png');
    });

    test('handles missing result', () => {
      const item = {
        id: 'img_456',
        status: 'failed'
      };

      const result = imageGenerationCall(item);

      expect(result.input).toContain('img_456');
      expect(result.output).toBe('');
    });
  });

  describe('codeInterpreterCall', () => {
    test('extracts code interpreter execution with outputs', () => {
      const item = {
        id: 'code_1',
        code: 'print("hello")',
        container_id: 'container_123',
        status: 'success',
        outputs: [{ type: 'stdout', content: 'hello' }]
      };

      const result = codeInterpreterCall(item);

      expect(result.input).toContain('code_1');
      expect(result.input).toContain('hello');
      expect(result.output).toContain('stdout');
    });

    test('handles empty outputs', () => {
      const item = {
        id: 'code_2',
        code: 'x = 1',
        outputs: []
      };

      const result = codeInterpreterCall(item);

      expect(result.output).toContain('[]');
    });
  });

  describe('localShellCall', () => {
    test('extracts local shell command execution', () => {
      const item = {
        id: 'shell_1',
        call_id: 'call_123',
        status: 'completed',
        action: {
          command: 'ls -la',
          cwd: '/home/user'
        }
      };

      const result = localShellCall(item);

      expect(result.input).toContain('shell_1');
      expect(result.input).toContain('call_123');
      expect(result.output).toContain('completed');
    });
  });

  describe('localShellCallOutput', () => {
    test('extracts shell command output', () => {
      const item = {
        id: 'shell_output_1',
        status: 'success',
        output: 'total 48\ndrwxr-xr-x  5 user  staff  160 ...'
      };

      const result = localShellCallOutput(item);

      expect(result.input).toContain('shell_output_1');
      expect(result.output).toContain('total 48');
    });
  });

  describe('customToolCall', () => {
    test('extracts custom tool invocation', () => {
      const item = {
        name: 'my_custom_tool',
        arguments: '{"param1": "value1"}',
        status: 'executed'
      };

      const result = customToolCall(item);

      expect(result.input).toContain('my_custom_tool');
      expect(result.output).toContain('executed');
    });
  });

  describe('functionCallOutput', () => {
    test('extracts function call output', () => {
      const item = {
        call_id: 'func_call_1',
        output: { temperature: 72, humidity: 65 }
      };

      const result = functionCallOutput(item);

      expect(result.input).toContain('func_call_1');
      expect(result.output).toContain('temperature');
      expect(result.output).toContain('72');
    });

    test('handles string output', () => {
      const item = {
        call_id: 'func_call_2',
        output: 'Execution successful'
      };

      const result = functionCallOutput(item);

      expect(result.output).toContain('Execution successful');
    });

    test('handles missing output', () => {
      const item = {
        call_id: 'func_call_3'
      };

      const result = functionCallOutput(item);

      expect(result.input).toContain('func_call_3');
    });
  });

  describe('getToolExtractor', () => {
    test('returns correct extractor for known type', () => {
      const extractor = getToolExtractor('web_search_call');

      expect(extractor).toBe(webSearchCall);
    });

    test('returns generic extractor for unknown type', () => {
      const extractor = getToolExtractor('unknown_tool_type');

      // Verify it's a function that works
      const result = extractor({ name: 'test', status: 'done' });
      expect(result.input).toBeDefined();
      expect(result.output).toBeDefined();
    });

    test('all registered types return correct extractors', () => {
      const expectedTypes = [
        'web_search_call',
        'mcp_call',
        'mcp_list_tools',
        'file_search_call',
        'computer_call',
        'image_generation_call',
        'code_interpreter_call',
        'local_shell_call',
        'local_shell_call_output',
        'custom_tool_call',
        'function_call_output'
      ];

      expectedTypes.forEach((type) => {
        const extractor = getToolExtractor(type);
        expect(typeof extractor).toBe('function');
      });
    });
  });

  describe('TOOL_SPAN_TYPES', () => {
    test('contains all registered tool types', () => {
      const expectedTypes = [
        'web_search_call',
        'mcp_call',
        'mcp_list_tools',
        'file_search_call',
        'computer_call',
        'image_generation_call',
        'code_interpreter_call',
        'local_shell_call',
        'local_shell_call_output',
        'custom_tool_call',
        'function_call_output'
      ];

      expectedTypes.forEach((type) => {
        expect(TOOL_SPAN_TYPES.has(type)).toBe(true);
      });
    });

    test('TOOL_SPAN_TYPES has correct size', () => {
      expect(TOOL_SPAN_TYPES.size).toBe(11);
    });
  });

  describe('TOOL_EXTRACTORS registry', () => {
    test('contains all extractors', () => {
      expect(TOOL_EXTRACTORS.web_search_call).toBe(webSearchCall);
      expect(TOOL_EXTRACTORS.mcp_call).toBe(mcpCall);
      expect(TOOL_EXTRACTORS.mcp_list_tools).toBe(mcpListTools);
      expect(TOOL_EXTRACTORS.file_search_call).toBe(fileSearchCall);
      expect(TOOL_EXTRACTORS.computer_call).toBe(computerCall);
      expect(TOOL_EXTRACTORS.image_generation_call).toBe(imageGenerationCall);
      expect(TOOL_EXTRACTORS.code_interpreter_call).toBe(codeInterpreterCall);
      expect(TOOL_EXTRACTORS.local_shell_call).toBe(localShellCall);
      expect(TOOL_EXTRACTORS.local_shell_call_output).toBe(
        localShellCallOutput
      );
      expect(TOOL_EXTRACTORS.custom_tool_call).toBe(customToolCall);
      expect(TOOL_EXTRACTORS.function_call_output).toBe(functionCallOutput);
    });
  });

  describe('Edge cases and robustness', () => {
    test('extractors handle undefined values gracefully', () => {
      const extractors = [
        webSearchCall,
        mcpCall,
        fileSearchCall,
        computerCall,
        codeInterpreterCall
      ];

      extractors.forEach((extractor) => {
        const result = extractor({});

        expect(typeof result.input).toBe('string');
        expect(typeof result.output).toBe('string');
      });
    });

    test('extractors handle nested objects correctly', () => {
      const item = {
        action: {
          nested: {
            deeply: {
              value: 'test'
            }
          }
        },
        status: 'ok'
      };

      const result = computerCall(item);

      expect(result.input).toContain('nested');
      expect(result.output).toBe('ok');
    });

    test('safeStringify handles circular references by failing gracefully', () => {
      const item: any = {
        name: 'test',
        arguments: ''
      };
      // Create a circular reference
      item.self = item;

      // Should not throw, but return a string representation
      const result = customToolCall(item);

      expect(typeof result.input).toBe('string');
      expect(result.input.length > 0).toBe(true);
    });
  });
});
