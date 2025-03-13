/* eslint-disable @typescript-eslint/no-explicit-any */
import { GalileoLogger } from './utils/galileo-logger'; // Assuming these are implemented
import { GalileoSingleton } from './singleton'; // Assuming these are implemented
import OpenAI from 'openai';

// Gets the current timestamp in UTC
function getTimestamp(): Date {
  return new Date(); // Automatically in UTC
}

function serializeToStr(inputData: any): string {
  /** Safely serialize data to a JSON string. */

  // If input is already a string, return as is
  if (typeof inputData === 'string') {
    return inputData;
  }

  // If input is a primitive type (null, boolean, number), return JSON stringified version
  if (inputData === null || ['boolean', 'number'].includes(typeof inputData)) {
    return JSON.stringify(inputData);
  }

  try {
    return JSON.stringify(inputData);
  } catch (error) {
    // Fallback if anything goes wrong
    console.warn(
      `Serialization failed for object of type ${typeof inputData || 'Unknown'}`
    );
    return '';
  }
}

// Type definitions
interface OpenAiModuleDefinition {
  method: string;
  type: string;
  sync: boolean;
  minVersion?: string;
}

interface OpenAiInputData {
  name: string;
  metadata: Record<string, any>;
  startTime: Date;
  input: any;
  modelParameters: Record<string, any>;
  model?: string;
  temperature: number;
}

// Define the methods we want to wrap
const OPENAI_CLIENT_METHODS: OpenAiModuleDefinition[] = [
  {
    method: 'chat.completions.create',
    type: 'chat',
    sync: true
  }
  // Add more methods as needed
];

class OpenAiArgsExtractor {
  args: Record<string, any>;
  kwargs: Record<string, any>;

  constructor(
    name?: string,
    metadata?: Record<string, any>,
    kwargs: Record<string, any> = {}
  ) {
    this.args = {
      name,
      metadata: kwargs.response_format
        ? {
            ...(metadata || {}),
            response_format: kwargs.response_format
          }
        : metadata
    };
    this.kwargs = kwargs;
  }

  getGalileoArgs(): Record<string, any> {
    return { ...this.args, ...this.kwargs };
  }

  getOpenAiArgs(): Record<string, any> {
    // Handle OpenAI model distillation if needed
    if (this.kwargs.store) {
      this.kwargs.metadata = this.args.metadata || {};
      // Remove non-string values from metadata
      if (this.kwargs.metadata.response_format) {
        delete this.kwargs.metadata.response_format;
      }
    }
    return this.kwargs;
  }
}

function extractChatPrompt(kwargs: Record<string, any>): any {
  const prompt: Record<string, any> = {};

  if (kwargs.functions) {
    prompt.functions = kwargs.functions;
  }

  if (kwargs.function_call) {
    prompt.function_call = kwargs.function_call;
  }

  if (kwargs.tools) {
    prompt.tools = kwargs.tools;
  }

  if (Object.keys(prompt).length > 0) {
    // If the user provided functions, we need to send these together with messages to Galileo
    prompt.messages = kwargs.messages || [];
    return prompt;
  } else {
    return kwargs.messages || [];
  }
}

function extractChatResponse(
  response: Record<string, any>
): Record<string, any> {
  const result: Record<string, any> = {
    role: response.role || null,
    content: response.content || ''
  };

  if (response.function_call && typeof response.function_call === 'object') {
    result.tool_calls = [
      {
        id: '',
        function: {
          name: response.function_call.name || '',
          arguments: response.function_call.arguments || ''
        }
      }
    ];
  } else if (response.tool_calls && Array.isArray(response.tool_calls)) {
    const toolCalls = response.tool_calls.map((toolCall) => ({
      id: toolCall.id || '',
      function: {
        name: toolCall.function?.name || '',
        arguments: toolCall.function?.arguments || ''
      }
    }));

    result.tool_calls = toolCalls.length ? toolCalls : null;
  }

  return result;
}

function extractInputDataFromKwargs(
  resource: OpenAiModuleDefinition,
  startTime: Date,
  kwargs: Record<string, any>
): OpenAiInputData {
  const name = kwargs.name || 'openai-client-generation';
  const metadata = kwargs.metadata || {};
  const model = kwargs.model || null;

  let prompt = null;
  if (resource.type === 'completion') {
    prompt = kwargs.prompt;
  } else if (resource.type === 'chat') {
    prompt = extractChatPrompt(kwargs);
  }

  // Parse parameters with defaults if not provided
  const temperature =
    typeof kwargs.temperature !== 'undefined'
      ? parseFloat(kwargs.temperature)
      : 1;
  const maxTokens =
    typeof kwargs.max_tokens !== 'undefined' ? kwargs.max_tokens : Infinity;
  const topP = typeof kwargs.top_p !== 'undefined' ? kwargs.top_p : 1;
  const frequencyPenalty =
    typeof kwargs.frequency_penalty !== 'undefined'
      ? kwargs.frequency_penalty
      : 0;
  const presencePenalty =
    typeof kwargs.presence_penalty !== 'undefined'
      ? kwargs.presence_penalty
      : 0;
  const seed = typeof kwargs.seed !== 'undefined' ? kwargs.seed : null;
  const n = typeof kwargs.n !== 'undefined' ? kwargs.n : 1;

  const modelParameters: Record<string, any> = {
    temperature,
    max_tokens: maxTokens,
    top_p: topP,
    frequency_penalty: frequencyPenalty,
    presence_penalty: presencePenalty
  };

  if (n > 1) {
    modelParameters.n = n;
  }

  if (seed !== null) {
    modelParameters.seed = seed;
  }

  return {
    name,
    metadata,
    startTime,
    input: prompt,
    modelParameters,
    model,
    temperature
  };
}

function parseUsage(usage: any): Record<string, any> | null {
  if (!usage) return null;

  const usageDict = { ...usage };

  ['prompt_tokens_details', 'completion_tokens_details'].forEach(
    (tokenDetail) => {
      if (usageDict[tokenDetail]) {
        usageDict[tokenDetail] = Object.fromEntries(
          Object.entries(usageDict[tokenDetail]).filter(([, v]) => v !== null)
        );
      }
    }
  );

  return usageDict;
}

function extractDataFromDefaultResponse(
  resource: OpenAiModuleDefinition,
  response: Record<string, any>
): [any, any, any] {
  if (!response) {
    return [null, '<NoneType response returned from OpenAI>', null];
  }

  const model = response.model || null;
  let completion = null;

  if (resource.type === 'completion') {
    const choices = response.choices || [];
    if (choices.length > 0) {
      completion = choices[choices.length - 1].text;
    }
  } else if (resource.type === 'chat') {
    const choices = response.choices || [];
    if (choices.length > 0) {
      if (choices.length > 1) {
        completion = choices.map((choice: any) =>
          extractChatResponse(choice.message || choice.delta || {})
        );
      } else {
        completion = extractChatResponse(
          choices[0].message || choices[0].delta || {}
        );
      }
    }
  }

  const usage = parseUsage(response.usage);

  return [model, completion, usage];
}

function extractStreamedOpenAIResponse(
  resource: OpenAiModuleDefinition,
  chunks: any[]
): [any, any, any] {
  if (resource.type === 'chat') {
    const completion: Record<string, any> = {
      role: null,
      content: '',
      function_call: null,
      tool_calls: null
    };

    let model = null;
    let usage = null;

    for (const chunk of chunks) {
      model = model || chunk.model || null;
      usage = chunk.usage || usage;

      const choices = chunk.choices || [];

      for (const choice of choices) {
        const delta = choice.delta || {};

        // Handle role
        if (delta.role) {
          completion.role = delta.role;
        }

        // Handle content
        if (delta.content !== null && delta.content !== undefined) {
          completion.content += delta.content;
        }

        // Handle function call
        if (delta.function_call) {
          if (!completion.function_call) {
            completion.function_call = {
              name: delta.function_call.name || '',
              arguments: delta.function_call.arguments || ''
            };
          } else {
            completion.function_call.name =
              completion.function_call.name || delta.function_call.name;
            completion.function_call.arguments +=
              delta.function_call.arguments || '';
          }
        }

        // Handle tool calls
        if (delta.tool_calls && delta.tool_calls.length > 0) {
          if (!completion.tool_calls) {
            completion.tool_calls = [];
          }

          const toolCall = delta.tool_calls[0];

          if (toolCall.function) {
            if (toolCall.function.name) {
              completion.tool_calls.push({
                name: toolCall.function.name,
                arguments: toolCall.function.arguments || ''
              });
            } else if (completion.tool_calls.length > 0) {
              // Update the last tool call
              const lastToolCall =
                completion.tool_calls[completion.tool_calls.length - 1];
              lastToolCall.arguments += toolCall.function.arguments || '';
            }
          }
        }
      }
    }

    // Prepare final response format
    const finalResponse = completion.content
      ? { role: 'assistant', content: completion.content }
      : completion.function_call
        ? { role: 'assistant', function_call: completion.function_call }
        : completion.tool_calls
          ? {
              role: 'assistant',
              tool_calls: completion.tool_calls.map((tc: any) => ({
                function: tc
              }))
            }
          : null;

    return [model, finalResponse, usage];
  } else {
    // Handle completion type
    let completion = '';
    let model = null;
    let usage = null;

    for (const chunk of chunks) {
      model = model || chunk.model || null;
      usage = chunk.usage || usage;

      const choices = chunk.choices || [];
      for (const choice of choices) {
        completion += choice.text || '';
      }
    }

    return [model, completion, usage];
  }
}

class ResponseGeneratorSync {
  private items: any[] = [];
  private resource: OpenAiModuleDefinition;
  private response: AsyncIterableIterator<any>;
  private inputData: OpenAiInputData;
  private logger: GalileoLogger;
  private shouldCompleteTrace: boolean;
  private completionStartTime: Date | null = null;

  constructor(
    resource: OpenAiModuleDefinition,
    response: AsyncIterableIterator<any>,
    inputData: OpenAiInputData,
    logger: GalileoLogger,
    shouldCompleteTrace: boolean
  ) {
    this.resource = resource;
    this.response = response;
    this.inputData = inputData;
    this.logger = logger;
    this.shouldCompleteTrace = shouldCompleteTrace;
  }

  async *[Symbol.asyncIterator]() {
    try {
      for await (const chunk of this.response) {
        this.items.push(chunk);

        if (!this.completionStartTime) {
          this.completionStartTime = getTimestamp();
        }

        yield chunk;
      }
    } finally {
      await this._finalize();
    }
  }

  private async _finalize() {
    const [model, completion, usage] = extractStreamedOpenAIResponse(
      this.resource,
      this.items
    );

    const endTime = getTimestamp();
    const durationNs = this.completionStartTime
      ? Math.round(
          (endTime.getTime() - this.completionStartTime.getTime()) * 1e6
        )
      : 0;

    // Add span to the current trace
    this.logger.addLlmSpan({
      input: this.inputData.input,
      output: completion,
      name: this.inputData.name,
      model: model,
      temperature: this.inputData.temperature,
      durationNs: durationNs,
      numInputTokens: usage?.prompt_tokens || 0,
      numOutputTokens: usage?.completion_tokens || 0,
      totalTokens: usage?.total_tokens || 0,
      metadata: Object.fromEntries(
        Object.entries(this.inputData.modelParameters).map(([k, v]) => [
          k,
          String(v)
        ])
      )
    });

    // Conclude the trace if top-level call
    if (this.shouldCompleteTrace) {
      this.logger.conclude({
        output: serializeToStr(completion),
        durationNs: durationNs
      });
    }
  }
}

class OpenAIGalileo {
  private _galileoLogger: GalileoLogger | null = null;

  initialize(): GalileoLogger {
    this._galileoLogger = GalileoSingleton.getInstance().getClient();

    return this._galileoLogger;
  }

  wrapOpenAI(openaiInstance: OpenAI): OpenAI {
    // Create a proxy for the OpenAI instance
    return new Proxy(openaiInstance, {
      get: (target, prop, receiver) => {
        const value = Reflect.get(target, prop, receiver);

        // If we're accessing the chat property, which should be an object
        if (prop === 'chat' && value && typeof value === 'object') {
          // Proxy the chat object
          return new Proxy(value, {
            get: (chatTarget, chatProp, chatReceiver) => {
              const chatValue = Reflect.get(chatTarget, chatProp, chatReceiver);

              // If we're accessing the completions property
              if (
                chatProp === 'completions' &&
                chatValue &&
                typeof chatValue === 'object'
              ) {
                // Proxy the completions object
                return new Proxy(chatValue, {
                  get: (
                    completionsTarget,
                    completionsProp,
                    completionsReceiver
                  ) => {
                    const completionsValue = Reflect.get(
                      completionsTarget,
                      completionsProp,
                      completionsReceiver
                    );

                    // If we're accessing the create method
                    if (
                      completionsProp === 'create' &&
                      typeof completionsValue === 'function'
                    ) {
                      // Return our wrapped function
                      return async (...args: any[]) => {
                        const resource = OPENAI_CLIENT_METHODS.find(
                          (r) => r.method === 'chat.completions.create'
                        );

                        if (!resource) {
                          return completionsValue.apply(
                            completionsTarget,
                            args
                          );
                        }

                        const startTime = getTimestamp();
                        const kwargs = args[0] || {};

                        // Extract name and metadata from kwargs if they exist
                        const { name, metadata, ...restKwargs } = kwargs;
                        const argExtractor = new OpenAiArgsExtractor(
                          name,
                          metadata,
                          restKwargs
                        );

                        const inputData = extractInputDataFromKwargs(
                          resource,
                          startTime,
                          argExtractor.getGalileoArgs()
                        );

                        const galileoLogger = this.initialize();

                        const shouldCompleteTrace = true;

                        galileoLogger.startTrace(
                          serializeToStr(inputData.input),
                          undefined,
                          inputData.name,
                          startTime.getTime(),
                          undefined,
                          inputData.metadata
                        );

                        try {
                          const openaiResponse = await completionsValue.apply(
                            completionsTarget,
                            [argExtractor.getOpenAiArgs()]
                          );

                          // Handle streaming responses
                          if (
                            kwargs.stream &&
                            openaiResponse &&
                            typeof openaiResponse[Symbol.asyncIterator] ===
                              'function'
                          ) {
                            return new ResponseGeneratorSync(
                              resource,
                              openaiResponse[Symbol.asyncIterator](),
                              inputData,
                              galileoLogger,
                              shouldCompleteTrace
                            );
                          } else {
                            // Handle regular responses
                            const [model, completion, usage] =
                              extractDataFromDefaultResponse(
                                resource,
                                openaiResponse
                              );

                            const endTime = getTimestamp();
                            const durationNs = Math.round(
                              (endTime.getTime() - startTime.getTime()) * 1e6
                            );

                            galileoLogger.addLlmSpan({
                              input: inputData.input,
                              output: completion,
                              name: inputData.name,
                              model: model,
                              temperature: inputData.temperature,
                              durationNs: durationNs,
                              numInputTokens: usage?.prompt_tokens || 0,
                              numOutputTokens: usage?.completion_tokens || 0,
                              totalTokens: usage?.total_tokens || 0,
                              metadata: Object.fromEntries(
                                Object.entries(inputData.modelParameters).map(
                                  ([k, v]) => [k, String(v)]
                                )
                              )
                            });

                            if (shouldCompleteTrace) {
                              galileoLogger.conclude({
                                output: serializeToStr(completion),
                                durationNs: durationNs
                              });
                            }

                            return openaiResponse;
                          }
                        } catch (error: Error | unknown) {
                          const errorMessage =
                            error instanceof Error
                              ? error.message
                              : String(error);
                          console.error(
                            `Error while processing OpenAI request: ${errorMessage}`
                          );
                          throw new Error(
                            `Failed to process the OpenAI Request: ${errorMessage}`
                          );
                        }
                      };
                    }
                    return completionsValue;
                  }
                });
              }
              return chatValue;
            }
          });
        }
        return value;
      }
    });
  }
}

// Create and export a singleton instance of the wrapper
const openaiGalileoWrapper = new OpenAIGalileo();

// Create a factory function for creating wrapped OpenAI instances
export function createOpenAI(
  config: ConstructorParameters<typeof OpenAI>[0]
): OpenAI {
  const openaiInstance = new OpenAI(config);
  return openaiGalileoWrapper.wrapOpenAI(openaiInstance);
}

// Export the wrapper for more advanced use cases
export { OpenAIGalileo };
