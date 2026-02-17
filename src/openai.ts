/* eslint-disable @typescript-eslint/no-explicit-any */
import { GalileoLogger } from './utils/galileo-logger';
import { GalileoSingleton } from './singleton';
import { calculateDurationNs } from './utils/utils';
import { parseUsage } from './openai/usage';
import { extractStatusFromError } from './utils/errors';
import {
  extractRequestParameters,
  mergeWithRequestMetadata
} from './openai/parameters';
import {
  processOutputItems,
  processFunctionCallOutputs,
  hasPendingFunctionCalls,
  isResponsesApiResponse
} from './openai/output-items';

try {
  require.resolve('openai');
} catch (e) {
  // eslint-disable-next-line no-console
  console.warn('openai package is not installed. Some features may not work.');
}

interface BetaType {
  chat?: {
    // Optional: v6 removed beta.chat
    completions?: {
      stream?: any;
    };
  };
  realtime?: any; // Realtime API (v4.50+, v5+, v6+)
  assistants?: any; // Assistants API (v4.0+, v5+, v6+)
  threads?: any; // Threads API (v4.0+, v5+, v6+)
  vectorStores?: any; // Vector Stores API (v4.20+, v5+) - removed in v6
  chatkit?: any; // Chatkit API (v6+ only)
}

interface ChatType {
  completions: any;
}

interface ResponsesType {
  create?: (...args: any[]) => Promise<any>;
}

interface OpenAIType {
  chat: ChatType;
  responses?: ResponsesType;
  embeddings: any;
  moderations: any;
  beta?: BetaType;
}

/**
 * Wraps an OpenAI instance with logging.
 * @param openAIClient The OpenAI instance to wrap.
 * @param logger The logger to use. Defaults to a new GalileoLogger instance.
 * @returns The wrapped OpenAI instance.
 *
 * Usage:
 *
 * ```typescript
 * import { wrapOpenAI } from 'galileo'
 *
 * const openai = wrapOpenAI(new OpenAI({apiKey: process.env.OPENAI_API_KEY}));
 *
 * await openai.chat.completions.create({
 *   model: "gpt-4o",
 *   messages: [{ content: "Say hello world!", role: "user" }],
 * });
 * ```
 */
export function wrapOpenAI<T extends OpenAIType>(
  openAIClient: T,
  logger?: GalileoLogger
): T {
  const handler: ProxyHandler<T> = {
    get(target, prop: string | symbol) {
      const originalMethod = target[prop as keyof T];

      if (
        prop === 'chat' &&
        typeof originalMethod === 'object' &&
        originalMethod !== null
      ) {
        return generateChatCompletionProxy(originalMethod, logger);
      }

      if (
        prop === 'responses' &&
        typeof originalMethod === 'object' &&
        originalMethod !== null
      ) {
        return generateResponseApiProxy(originalMethod, logger);
      }

      return originalMethod;
    }
  };

  return new Proxy(openAIClient, handler);
}

function generateChatCompletionProxy<T extends OpenAIType>(
  originalMethod: T[keyof T] & object,
  logger: GalileoLogger | undefined
): T {
  return new Proxy(originalMethod, {
    get(chatTarget: any, chatProp: string | symbol) {
      if (
        chatProp === 'completions' &&
        typeof chatTarget[chatProp] === 'object'
      ) {
        return new Proxy(chatTarget[chatProp], {
          get(completionsTarget: any, completionsProp: string | symbol) {
            if (
              completionsProp === 'create' &&
              typeof completionsTarget[completionsProp] === 'function'
            ) {
              return async function wrappedCreate(...args: any[]) {
                const [requestData] = args;
                const startTime = new Date();
                if (!logger) {
                  logger = GalileoSingleton.getInstance().getClient();
                }

                const isParentTraceValid = !!logger.currentParent();

                if (!isParentTraceValid) {
                  logger!.startTrace({
                    input: JSON.stringify(requestData.messages),
                    output: undefined,
                    name: 'openai-client-generation'
                  });
                }

                let response: any;
                try {
                  response = await completionsTarget[completionsProp](...args);
                } catch (error: unknown) {
                  const errorMessage =
                    error instanceof Error ? error.message : String(error);
                  const statusCode = extractStatusFromError(error) ?? 500;

                  if (!isParentTraceValid) {
                    const extracted = extractRequestParameters(
                      requestData as Record<string, unknown>
                    );
                    const metadata = mergeWithRequestMetadata(
                      extracted,
                      requestData.metadata
                    );

                    const temperature =
                      typeof requestData.temperature === 'number'
                        ? requestData.temperature
                        : undefined;
                    logger!.addLlmSpan({
                      input: JSON.parse(JSON.stringify(requestData.messages)),
                      output: { content: `Error: ${errorMessage}` },
                      name: 'openai-client-generation',
                      model: requestData.model || 'unknown',
                      numInputTokens: 0,
                      numOutputTokens: 0,
                      durationNs: calculateDurationNs(startTime),
                      metadata,
                      statusCode,
                      temperature
                    });
                    logger!.conclude({
                      output: `Error: ${errorMessage}`,
                      durationNs: calculateDurationNs(startTime)
                    });
                  }
                  throw error;
                }

                // Check if this is a streaming response
                if (requestData.stream) {
                  // Return a wrapped stream that will collect chunks and log on completion
                  return new StreamWrapper(
                    response,
                    requestData,
                    logger!,
                    startTime,
                    !isParentTraceValid, // Complete trace only if we started it (no parent)
                    false // Chat Completions API, not Responses API
                  );
                }

                const durationNs = calculateDurationNs(startTime);
                const output = response?.choices?.map((choice: any) =>
                  JSON.parse(JSON.stringify(choice.message))
                );
                const usage = parseUsage(response?.usage);
                const extracted = extractRequestParameters(
                  requestData as Record<string, unknown>
                );
                const metadata = mergeWithRequestMetadata(
                  extracted,
                  requestData.metadata
                );

                const finalMetadata = { ...metadata };
                if (usage.rejectedPredictionTokens > 0) {
                  finalMetadata.rejected_prediction_tokens = String(
                    usage.rejectedPredictionTokens
                  );
                }

                // temperature is a dedicated span field (galileo-python parity); top_p, seed, etc. stay in metadata
                const temperature =
                  typeof requestData.temperature === 'number'
                    ? requestData.temperature
                    : undefined;

                logger!.addLlmSpan({
                  input: JSON.parse(JSON.stringify(requestData.messages)),
                  output,
                  name: 'openai-client-generation',
                  model: requestData.model || 'unknown',
                  numInputTokens: usage.inputTokens,
                  numOutputTokens: usage.outputTokens,
                  totalTokens: usage.totalTokens ?? undefined,
                  numReasoningTokens: usage.reasoningTokens,
                  numCachedInputTokens: usage.cachedTokens,
                  durationNs,
                  metadata: finalMetadata,
                  tools: extracted.tools as any,
                  statusCode: 200,
                  temperature
                });

                if (!isParentTraceValid) {
                  // If we started a trace (no parent), conclude it
                  logger!.conclude({
                    output: JSON.stringify(output),
                    durationNs
                  });
                }

                return response;
              };
            }
            return completionsTarget[completionsProp];
          }
        });
      }
      return chatTarget[chatProp];
    }
  });
}

function generateResponseApiProxy<T extends OpenAIType>(
  originalMethod: T[keyof T] & object,
  logger: GalileoLogger | undefined
): T {
  return new Proxy(originalMethod, {
    get(responsesTarget: any, responsesProp: string | symbol) {
      if (
        responsesProp === 'create' &&
        typeof responsesTarget[responsesProp] === 'function'
      ) {
        return async function wrappedResponsesCreate(...args: any[]) {
          const [requestData] = args;
          const startTime = new Date();
          if (!logger) {
            logger = GalileoSingleton.getInstance().getClient();
          }

          const isParentTraceValid = !!logger.currentParent();

          const inputForTrace =
            requestData.input != null
              ? typeof requestData.input === 'string'
                ? requestData.input
                : JSON.stringify(requestData.input)
              : '';

          if (!isParentTraceValid) {
            logger!.startTrace({
              input: inputForTrace,
              output: undefined,
              name: 'openai-responses-generation'
            });
          }

          let response: any;
          try {
            response = await responsesTarget[responsesProp](...args);
          } catch (error: unknown) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            const statusCode = extractStatusFromError(error) ?? 500;

            if (!isParentTraceValid) {
              const extracted = extractRequestParameters(
                requestData as Record<string, unknown>
              );
              const metadata = mergeWithRequestMetadata(
                extracted,
                requestData.metadata
              );
              const temperature =
                typeof requestData.temperature === 'number'
                  ? requestData.temperature
                  : undefined;
              logger!.addLlmSpan({
                input: inputForTrace,
                output: { content: `Error: ${errorMessage}` },
                name: 'openai-responses-generation',
                model: requestData.model || 'unknown',
                numInputTokens: 0,
                numOutputTokens: 0,
                durationNs: calculateDurationNs(startTime),
                metadata,
                statusCode,
                temperature
              });
              logger!.conclude({
                output: `Error: ${errorMessage}`,
                durationNs: calculateDurationNs(startTime)
              });
            }
            throw error;
          }

          // Check if this is a streaming response
          if (requestData.stream) {
            // Return a wrapped stream that will collect chunks and log on completion
            return new StreamWrapper(
              response,
              requestData,
              logger!,
              startTime,
              !isParentTraceValid, // Complete trace only if we started it (no parent)
              true // Responses API stream
            );
          }

          if (!isResponsesApiResponse(response)) {
            return response;
          }

          const outputItems = response.output || [];
          const extracted = extractRequestParameters(
            requestData as Record<string, unknown>
          );
          const metadata = mergeWithRequestMetadata(
            extracted,
            requestData.metadata
          );

          // Process input items first to log tool executions from previous turns
          if (Array.isArray(requestData.input)) {
            processFunctionCallOutputs(requestData.input, logger);
          }

          const consolidatedOutput = processOutputItems({
            outputItems,
            logger,
            model: response.model || requestData.model,
            originalInput: requestData.input,
            tools: extracted.tools,
            usage: response.usage,
            statusCode: 200,
            metadata
          });

          // Only conclude trace if there are no pending function calls
          // Pending calls indicate multi-turn conversation continues
          const hasPending = hasPendingFunctionCalls(outputItems);
          if (isParentTraceValid && !hasPending) {
            logger!.conclude({
              output: JSON.stringify(consolidatedOutput),
              durationNs: calculateDurationNs(startTime)
            });
          }

          return response;
        };
      }
      return responsesTarget[responsesProp];
    }
  });
}

/**
 * Wraps an Azure OpenAI instance with logging.
 * Alias for wrapOpenAI - AzureOpenAI extends OpenAI and has the same API surface (chat, responses).
 * @param azureOpenAIClient The AzureOpenAI instance to wrap.
 * @param logger The logger to use. Defaults to a new GalileoLogger instance.
 * @returns The wrapped Azure OpenAI instance.
 */
export const wrapAzureOpenAI = wrapOpenAI;

/**
 * StreamWrapper class to handle streaming responses from OpenAI.
 * Collects all chunks and logs the complete response at the end.
 */
class StreamWrapper implements AsyncIterable<any> {
  private chunks: any[] = [];
  private completionStartTime: Date | null = null;
  private completeOutput: any = {
    content: '',
    role: 'assistant',
    tool_calls: []
  };
  private hasToolCalls: boolean = false;
  private iterator: AsyncIterator<any>;
  private isResponsesApi: boolean = false;
  private outputItems: any[] = [];

  constructor(
    private stream: AsyncIterable<any>,
    private requestData: any,
    private logger: GalileoLogger,
    private startTime: Date,
    private shouldCompleteTrace: boolean,
    isResponsesApiStream: boolean = false
  ) {
    this.iterator = this.stream[Symbol.asyncIterator]();
    this.isResponsesApi = isResponsesApiStream;
  }

  [Symbol.asyncIterator](): AsyncIterator<any> {
    return {
      next: async (): Promise<IteratorResult<any>> => {
        try {
          // Get the next chunk from the original stream
          const result = await this.iterator.next();

          if (!result.done) {
            // Record the first chunk arrival time
            if (this.completionStartTime === null) {
              this.completionStartTime = new Date();
            }

            // Store the chunk for later processing
            this.chunks.push(result.value);

            // Process the chunk to build the complete output
            this.processChunk(result.value);

            return result;
          } else {
            // Stream is done, finalize logging
            this.finalize();
            return result;
          }
        } catch (error) {
          // Handle any errors during streaming
          console.error('Error in stream processing:', error);
          this.finalize();
          throw error;
        }
      },
      // Optionally implement return and throw methods if needed
      return: async (value: any): Promise<IteratorResult<any>> => {
        this.finalize();
        return { done: true, value };
      },
      throw: async (error: any): Promise<IteratorResult<any>> => {
        console.error('Error in stream processing:', error);
        this.finalize();
        return { done: true, value: undefined };
      }
    };
  }

  private processChunk(chunk: any) {
    const hasOutputArray = chunk?.output != null && Array.isArray(chunk.output);
    const isResponsesFormat = hasOutputArray && !('choices' in chunk);

    if (isResponsesFormat) {
      this.isResponsesApi = true;
      if (typeof chunk?.delta === 'string' && chunk.delta) {
        this.outputItems.push({
          type: 'message',
          content: [{ text: chunk.delta }]
        });
      }
      this.outputItems.push(...chunk.output);
      return;
    }
    if (this.isResponsesApi) {
      // Event-style chunks (e.g. response.output_text.delta) carry content in chunk.delta
      if (typeof chunk?.delta === 'string' && chunk.delta) {
        this.outputItems.push({
          type: 'message',
          content: [{ text: chunk.delta }]
        });
      }
      if (hasOutputArray) {
        this.outputItems.push(...chunk.output);
      }
      return;
    }

    // Chat Completions API: extract delta content from the chunk
    const delta = chunk.choices?.[0]?.delta;
    if (!delta) return;

    // Process content
    if (delta.content) {
      this.completeOutput.content += delta.content;
    }

    // Process role
    if (delta.role) {
      this.completeOutput.role = delta.role;
    }

    // Process tool calls
    if (delta.tool_calls && delta.tool_calls.length > 0) {
      this.hasToolCalls = true;

      for (const toolCall of delta.tool_calls) {
        const id = toolCall.index;

        // Initialize tool call if it doesn't exist
        if (!this.completeOutput.tool_calls[id]) {
          this.completeOutput.tool_calls[id] = {
            id: toolCall.id || `tool_${id}`,
            function: {
              name: toolCall.function?.name || '',
              arguments: toolCall.function?.arguments || ''
            }
          };
        } else {
          // Append to existing tool call
          if (toolCall.function?.name) {
            this.completeOutput.tool_calls[id].function.name =
              toolCall.function.name;
          }
          if (toolCall.function?.arguments) {
            this.completeOutput.tool_calls[id].function.arguments +=
              toolCall.function.arguments;
          }
        }
      }
    }

    // Process function call (legacy format)
    if (delta.function_call) {
      this.hasToolCalls = true;

      // Initialize function call entry if needed
      if (!this.completeOutput.tool_calls[0]) {
        this.completeOutput.tool_calls[0] = {
          id: 'function_call_0',
          function: {
            name: delta.function_call.name || '',
            arguments: delta.function_call.arguments || ''
          }
        };
      } else {
        // Append to existing function call
        if (delta.function_call.name) {
          this.completeOutput.tool_calls[0].function.name =
            delta.function_call.name;
        }
        if (delta.function_call.arguments) {
          this.completeOutput.tool_calls[0].function.arguments +=
            delta.function_call.arguments;
        }
      }
    }
  }

  private finalize() {
    if (this.chunks.length === 0) return;

    const endTime = new Date();
    const startTimeForMetrics = this.completionStartTime || this.startTime;

    if (this.isResponsesApi) {
      this.finalizeResponsesApi(endTime);
      return;
    }

    // Chat Completions API finalization (existing logic)
    // Clean up output format for log
    const finalOutput = { ...this.completeOutput };

    // If no tool calls were used, remove the property
    if (!this.hasToolCalls || this.completeOutput.tool_calls.length === 0) {
      delete finalOutput.tool_calls;
    } else {
      // Filter out any empty slots in the tool_calls array
      finalOutput.tool_calls = this.completeOutput.tool_calls.filter(Boolean);
    }

    // Try to extract usage from the last chunk (OpenAI may include it in the final stream message)
    let usage = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: null as number | null,
      reasoningTokens: 0,
      cachedTokens: 0
    };
    const lastChunk = this.chunks[this.chunks.length - 1];
    if (lastChunk?.usage) {
      usage = parseUsage(lastChunk.usage);
    }

    const extracted = extractRequestParameters(
      this.requestData as Record<string, unknown>
    );
    const metadata = mergeWithRequestMetadata(
      extracted,
      this.requestData.metadata
    );

    const temperature =
      typeof this.requestData.temperature === 'number'
        ? this.requestData.temperature
        : undefined;

    // Log the complete interaction
    this.logger.addLlmSpan({
      input: JSON.parse(JSON.stringify(this.requestData.messages)),
      output: finalOutput,
      name: 'openai-client-generation',
      model: this.requestData.model || 'unknown',
      numInputTokens: usage.inputTokens,
      numOutputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens ?? undefined,
      numReasoningTokens: usage.reasoningTokens,
      numCachedInputTokens: usage.cachedTokens,
      durationNs: calculateDurationNs(startTimeForMetrics, endTime),
      metadata,
      tools: extracted.tools as any,
      statusCode: 200,
      temperature
    });

    // Conclude the trace if this was the top-level call
    if (this.shouldCompleteTrace) {
      this.logger.conclude({
        output: JSON.stringify(finalOutput),
        durationNs: calculateDurationNs(this.startTime, endTime)
      });
    }
  }

  /**
   * Mirrors the non-streaming Responses API handler logic
   */
  private finalizeResponsesApi(endTime: Date) {
    const extracted = extractRequestParameters(
      this.requestData as Record<string, unknown>
    );
    const metadata = mergeWithRequestMetadata(
      extracted,
      this.requestData.metadata
    );

    // Process input items first
    if (Array.isArray(this.requestData.input)) {
      processFunctionCallOutputs(this.requestData.input, this.logger);
    }

    // Try to extract usage from the last chunk
    let usage = null;
    const lastChunk = this.chunks[this.chunks.length - 1];
    if (lastChunk?.usage) {
      usage = lastChunk.usage;
    }

    // Extract model from chunks or requestData
    let model = this.requestData.model;
    if (!model && this.chunks.length > 0) {
      model = this.chunks[0].model || 'unknown';
    }

    // Process output items to create LLM span and tool spans
    const consolidatedOutput = processOutputItems({
      outputItems: this.outputItems,
      logger: this.logger,
      model: model || 'unknown',
      originalInput: this.requestData.input,
      tools: extracted.tools,
      usage,
      statusCode: 200,
      metadata
    });

    // Only conclude trace if there are no pending function calls
    const hasPending = hasPendingFunctionCalls(this.outputItems);
    if (this.shouldCompleteTrace && !hasPending) {
      this.logger.conclude({
        output: JSON.stringify(consolidatedOutput),
        durationNs: calculateDurationNs(this.startTime, endTime)
      });
    }
  }
}
