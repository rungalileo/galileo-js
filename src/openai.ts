/* eslint-disable @typescript-eslint/no-explicit-any */
import { GalileoLogger } from './utils/galileo-logger';
import { GalileoSingleton } from './singleton';
import { calculateDurationNs } from './utils/utils';

try {
  require.resolve('openai');
} catch (e) {
  // eslint-disable-next-line no-console
  console.warn('openai package is not installed. Some features may not work.');
}

interface BetaType {
  chat: {
    completions: {
      stream: any;
    };
  };
  embeddings: any;
}

interface ChatType {
  completions: any;
}

interface OpenAIType {
  chat: ChatType;
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

                      const startTrace = logger.currentParent() === undefined;

                      if (startTrace) {
                        logger!.startTrace({
                          input: JSON.stringify(requestData.messages),
                          output: undefined,
                          name: 'openai-client-generation',
                          createdAt: startTime
                        });
                      }

                      let response;
                      try {
                        response = await completionsTarget[completionsProp](
                          ...args
                        );
                      } catch (error: Error | unknown) {
                        const errorMessage =
                          error instanceof Error
                            ? error.message
                            : String(error);

                        if (startTrace) {
                          // If a trace was started, conclude it
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
                          startTrace
                        );
                      }

                      const durationNs = calculateDurationNs(startTime);
                      const output = response?.choices?.map((choice: any) =>
                        JSON.parse(JSON.stringify(choice.message))
                      );

                      logger!.addLlmSpan({
                        input: JSON.parse(JSON.stringify(requestData.messages)),
                        output,
                        name: 'openai-client-generation',
                        createdAt: startTime,
                        model: requestData.model || 'unknown',
                        numInputTokens: response?.usage?.prompt_tokens || 0,
                        numOutputTokens:
                          response?.usage?.completion_tokens || 0,
                        durationNs,
                        metadata: requestData.metadata || {},
                        statusCode: 200
                      });

                      if (startTrace) {
                        // If a trace was started, conclude it
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

      return originalMethod;
    }
  };

  return new Proxy(openAIClient, handler);
}

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

  constructor(
    private stream: AsyncIterable<any>,
    private requestData: any,
    private logger: GalileoLogger,
    private startTime: Date,
    private shouldCompleteTrace: boolean
  ) {
    this.iterator = this.stream[Symbol.asyncIterator]();
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
    // Extract delta content from the chunk
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

    // Clean up output format for log
    const finalOutput = { ...this.completeOutput };

    // If no tool calls were used, remove the property
    if (!this.hasToolCalls || this.completeOutput.tool_calls.length === 0) {
      delete finalOutput.tool_calls;
    } else {
      // Filter out any empty slots in the tool_calls array
      finalOutput.tool_calls = this.completeOutput.tool_calls.filter(Boolean);
    }

    // Calculate tokens (this is approximate as streaming doesn't return token counts)
    // You would need to implement or use a tokenizer library for accurate counts
    const inputTokensEstimate = 0;
    const outputTokensEstimate = 0;

    // Log the complete interaction
    this.logger.addLlmSpan({
      input: JSON.parse(JSON.stringify(this.requestData.messages)),
      output: finalOutput,
      name: 'openai-client-generation',
      createdAt: endTime,
      model: this.requestData.model || 'unknown',
      numInputTokens: inputTokensEstimate,
      numOutputTokens: outputTokensEstimate,
      durationNs: calculateDurationNs(startTimeForMetrics, endTime),
      metadata: this.requestData.metadata || {},
      statusCode: 200
    });

    // Conclude the trace if this was the top-level call
    if (this.shouldCompleteTrace) {
      this.logger.conclude({
        output: JSON.stringify(finalOutput),
        durationNs: calculateDurationNs(this.startTime, endTime)
      });
    }
  }
}
