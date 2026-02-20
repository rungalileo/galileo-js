/* eslint-disable @typescript-eslint/no-explicit-any */
import { GalileoLogger } from '../../utils/galileo-logger';
import { GalileoSingleton } from '../../singleton';
import { calculateDurationNs } from '../../utils/utils';
import { parseUsage } from './usage';
import { extractStatusFromError } from '../../utils/errors';
import { extractRequestParameters, getOpenAiArgs } from './parameters';
import {
  processOutputItems,
  processFunctionCallOutputs,
  hasPendingFunctionCalls
} from './output-items';
import { JsonObject } from 'src/types/base.types';

// Warn if openai package is not available (optional dependency)
import('openai').catch(() => {
  // eslint-disable-next-line no-console
  console.warn('openai package is not installed. Some features may not work.');
});

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
              return async function wrappedCreate(
                ...args: Record<string, unknown>[]
              ) {
                const [requestData] = args;
                const OpenAISdkOptions = args.slice(1);
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
                  // Get OpenAI request with filtered metadata if distillation enabled
                  const openaiRequest = getOpenAiArgs(requestData);
                  const callArgs = [openaiRequest, ...OpenAISdkOptions];
                  response = await completionsTarget[completionsProp](
                    ...callArgs
                  );
                } catch (error: unknown) {
                  if (!isParentTraceValid) {
                    processErrorSpan(
                      error,
                      logger!,
                      'openai-completion-generation',
                      requestData as Record<string, unknown>,
                      startTime
                    );
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

                const finalMetadata = { ...extracted.metadata };
                if (usage.rejectedPredictionTokens > 0) {
                  finalMetadata.rejected_prediction_tokens = String(
                    usage.rejectedPredictionTokens
                  );
                }

                const temperature =
                  typeof requestData.temperature === 'number'
                    ? requestData.temperature
                    : undefined;

                logger!.addLlmSpan({
                  input: JSON.parse(JSON.stringify(requestData.messages)),
                  output,
                  name: 'openai-client-generation',
                  model: (requestData.model as string) || 'unknown',
                  numInputTokens: usage.inputTokens,
                  numOutputTokens: usage.outputTokens,
                  totalTokens: usage.totalTokens ?? undefined,
                  numReasoningTokens: usage.reasoningTokens,
                  numCachedInputTokens: usage.cachedTokens,
                  durationNs,
                  metadata: finalMetadata,
                  tools: extracted.tools as JsonObject[] | undefined,
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
        return async function wrappedResponsesCreate(
          ...args: Record<string, unknown>[]
        ) {
          const [requestData] = args;
          const OpenAISdkOptions = args.slice(1);
          const startTime = new Date();
          if (!logger) {
            logger = GalileoSingleton.getInstance().getClient();
          }

          const isParentTraceValid = !!logger.currentParent();

          const normalizedInput =
            requestData.input != null
              ? typeof requestData.input === 'string'
                ? requestData.input
                : JSON.stringify(requestData.input)
              : '';

          if (!isParentTraceValid) {
            logger!.startTrace({
              input: normalizedInput,
              output: undefined,
              name: 'openai-responses-generation'
            });
          }

          // Get OpenAI request with filtered metadata if distillation enabled
          const openaiRequest = getOpenAiArgs(requestData);

          let response: any;
          try {
            const callArgs = [openaiRequest, ...OpenAISdkOptions];
            response = await responsesTarget[responsesProp](...callArgs);
          } catch (error: unknown) {
            if (!isParentTraceValid) {
              processErrorSpan(
                error,
                logger!,
                'openai-responses-generation',
                requestData as Record<string, unknown>,
                startTime
              );
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
          } else {
            // Safely extract output items with fallback for invalid/unexpected response formats
            // Implemented graceful degradation, instead of failing processing immediately
            const outputItems =
              response && Array.isArray(response.output) ? response.output : [];

            const extracted = extractRequestParameters(
              requestData as Record<string, unknown>
            );

            // Process input items first to log tool executions from previous turns
            if (Array.isArray(requestData.input)) {
              processFunctionCallOutputs(requestData.input, logger);
            }

            const consolidatedOutput = processOutputItems({
              outputItems,
              logger,
              model: response?.model || requestData.model,
              originalInput: requestData.input,
              tools: extracted.tools,
              usage: response?.usage,
              statusCode: 200,
              metadata: extracted.metadata
            });

            // Only conclude trace if there are no pending function calls
            // Pending calls indicate multi-turn conversation continues
            const hasPending = hasPendingFunctionCalls(outputItems);
            if (!isParentTraceValid && !hasPending) {
              logger!.conclude({
                output: JSON.stringify(consolidatedOutput),
                durationNs: calculateDurationNs(startTime)
              });
            }

            return response;
          }
        };
      }
      return responsesTarget[responsesProp];
    }
  });
}

function processErrorSpan(
  error: unknown,
  logger: GalileoLogger,
  name: string,
  requestData: Record<string, unknown>,
  startTime: Date
) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const statusCode = extractStatusFromError(error) ?? 500;
  const extracted = extractRequestParameters(
    requestData as Record<string, unknown>
  );

  const temperature =
    typeof requestData.temperature === 'number'
      ? requestData.temperature
      : undefined;
  logger.addLlmSpan({
    input: JSON.parse(JSON.stringify(requestData.messages)),
    output: { content: `Error: ${errorMessage}` },
    name,
    model: (requestData.model as string) || 'unknown',
    numInputTokens: 0,
    numOutputTokens: 0,
    durationNs: calculateDurationNs(startTime),
    metadata: extracted.metadata,
    statusCode,
    temperature
  });
  logger.conclude({
    output: `Error: ${errorMessage}`,
    durationNs: calculateDurationNs(startTime)
  });
}

/**
 * Wraps an Azure OpenAI instance with Galileo logging and observability.
 *
 * Alias for wrapOpenAI - AzureOpenAI extends OpenAI and has the same API surface.
 *
 * @param azureOpenAIClient The AzureOpenAI instance to wrap
 * @param logger Optional GalileoLogger instance. If not provided, uses the singleton instance.
 * @returns The wrapped Azure OpenAI instance
 *
 */
export const wrapAzureOpenAI = wrapOpenAI;

/**
 * StreamWrapper class for handling OpenAI streaming responses.
 *
 * Supports two streaming modes:
 * 1. Chat Completions API: Processes chunks incrementally to build the complete response
 * 2. Responses API: Collects chunks and extracts output from the final completion event
 *
 * ## Responses API Streaming Approach
 *
 * - Intermediate events (response.output_text.delta, etc.) are progress indicators only
 * - The `response.completed` or `response.done` event contains the authoritative data
 * - We don't attempt to incrementally build output from deltas/intermediate events
 * - Instead, we wait for the completion event and extract its `response.output` array
 *
 * This approach is simpler and more reliable than trying to merge incremental updates,
 * and ensures we have the complete, consistent output array for processing.
 *
 * ## Why Not Process Intermediate Events?
 *
 * The OpenAI Responses API streaming events are structured as:
 * - `response.created` - Initial event with metadata
 * - `response.output_text.delta` - Partial text chunks (progress only)
 * - `response.output_item.added` - Items being added (progress only)
 * - `response.completed` - Final event with complete `response.output` array
 *
 * The completion event's `output` array is the single source of truth and includes:
 * - All message content (complete, not deltas)
 * - All function_call items with full arguments
 * - All tool call items (file_search, code_interpreter, etc.)
 * - All reasoning items
 *
 * Attempting to merge deltas from intermediate events risks:
 * - Data inconsistency (partial arguments, incomplete reasoning)
 * - Duplicate items (if intermediate events overlap with final output)
 * - Lost data (if replacement logic discards collected deltas)
 *
 * By waiting for the authoritative completion event, we ensure correctness.
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
  private completedResponse: any = null;
  private finalized = false;

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
          console.error('Error in stream processing:', error);
          this.finalize();
          throw error;
        }
      },
      return: async (value: any): Promise<IteratorResult<any>> => {
        this.finalize();
        return { done: true, value };
      },
      throw: async (error: any): Promise<IteratorResult<any>> => {
        console.error('Error in stream processing:', error);
        this.finalize();
        throw error;
      }
    };
  }

  private processChunk(chunk: any) {
    const isResponsesFormat = this.isResponseStreamEvent(chunk);

    // Detect Responses API on first matching chunk
    // Can be detected via event type (response.*) or presence of output array
    if (isResponsesFormat && !this.isResponsesApi) {
      this.isResponsesApi = true;
    }

    // Handle Responses API streaming
    //
    // The streaming events are informational/progress indicators. The final
    // `response.completed` or `response.done` event contains a `response` object
    // with a complete `output` array that has all messages, tool calls, and reasoning.
    //
    // This is fundamentally different from Chat Completions API where we must
    // incrementally build the response from deltas because there's no final
    // consolidated event.
    //
    // Approach:
    // 1. Store all chunks (happens in [Symbol.asyncIterator])
    // 2. Wait for response.completed/response.done event
    // 3. Extract response.output array in finalize()
    // 4. Process output items to create spans
    if (this.isResponsesApi) {
      const chunkType = chunk?.type as string | undefined;

      // Capture the completion event which carries the complete response object
      // with the authoritative output[] array containing all items
      if (chunkType === 'response.completed' || chunkType === 'response.done') {
        this.completedResponse = chunk?.response ?? null;
      }

      // All other events (response.output_text.delta, response.output_item.added, etc.)
      // are progress indicators only - we don't process them incrementally
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

  /**
   * Detects if a chunk is from the Responses API.
   *
   * Detection methods:
   * 1. Event-based format: chunks with 'type' field starting with 'response.'
   *    - response.created
   *    - response.output_text.delta
   *    - response.output_item.added
   *    - response.completed
   *    - response.done
   *
   * 2. Output-based format: chunks with 'output' array (and no 'choices' field)
   *    - Some Responses API streams may send chunks with just output arrays
   *    - Distinct from Chat Completions which have 'choices' arrays
   *
   * This is distinct from Chat Completions API chunks which have 'choices' arrays
   * with 'delta' objects.
   */
  private isResponseStreamEvent(chunk: unknown): boolean {
    if (typeof chunk !== 'object' || chunk === null) {
      return false;
    }

    const chunkObj = chunk as any;

    // Method 1: Check for response.* event type
    const hasResponseEventType =
      'type' in chunkObj &&
      typeof chunkObj.type === 'string' &&
      chunkObj.type.startsWith('response.');

    // Method 2: Check for output array (without choices - to distinguish from Chat Completions)
    const hasOutputArray =
      'output' in chunkObj &&
      Array.isArray(chunkObj.output) &&
      !('choices' in chunkObj);

    return hasResponseEventType || hasOutputArray;
  }

  private finalize() {
    if (this.finalized) return;
    this.finalized = true;

    if (this.chunks.length === 0) return;

    const endTime = new Date();
    const startTimeForMetrics = this.completionStartTime || this.startTime;

    if (this.isResponsesApi) {
      this.finalizeResponsesApi(startTimeForMetrics, endTime);
    } else {
      this.finalizeChatCompletionApi(startTimeForMetrics, endTime);
    }
  }

  /**
   * Finalizes Responses API streaming by processing the completed response.
   * This mirrors the non-streaming Responses API handler logic
   *
   * Flow:
   * 1. Extract output[] array from the completion event's response object
   * 2. Process function_call_output items from input (previous turn tool executions)
   * 3. Call processOutputItems() to create consolidated LLM span and tool spans
   * 4. Conclude trace only if there are no pending function calls
   *
   * The output[] array from response.completed contains all items in their final form:
   * - message items with complete content
   * - function_call items with full arguments
   * - reasoning items with complete summaries
   * - tool call items (file_search, code_interpreter, etc.)
   *
   * This is the authoritative source - we don't need to merge with any incrementally
   * collected data because the API provides everything we need in this final event.
   */
  private finalizeResponsesApi(startTimeForMetrics: Date, endTime: Date) {
    const extracted = extractRequestParameters(
      this.requestData as Record<string, unknown>
    );

    // Process input items first
    if (Array.isArray(this.requestData.input)) {
      processFunctionCallOutputs(this.requestData.input, this.logger);
    }

    // Extract output items from the completed response event
    let outputItems: any[] = [];
    if (
      this.completedResponse?.output &&
      Array.isArray(this.completedResponse.output)
    ) {
      outputItems = this.completedResponse.output;
    } else {
      // If no completed response, try to extract output from chunks directly
      // This handles cases where chunks themselves have output arrays
      for (const chunk of this.chunks) {
        if (chunk && typeof chunk === 'object' && Array.isArray(chunk.output)) {
          outputItems = outputItems.concat(chunk.output);
        }
      }
    }

    // Try to extract usage from completed response or last chunk
    let usage = null;
    if (this.completedResponse?.usage) {
      usage = this.completedResponse.usage;
    } else {
      const lastChunk = this.chunks[this.chunks.length - 1];
      if (lastChunk?.usage) {
        usage = lastChunk.usage;
      }
    }

    // Extract model from completed response, chunks, or requestData
    let model = this.requestData.model;
    if (!model && this.completedResponse?.model) {
      model = this.completedResponse.model;
    }
    if (!model && this.chunks.length > 0) {
      model = this.chunks[0].model || 'unknown';
    }

    // Process output items to create LLM span and tool spans
    const consolidatedOutput = processOutputItems({
      outputItems,
      logger: this.logger,
      model: model || 'unknown',
      originalInput: this.requestData.input,
      tools: extracted.tools,
      usage,
      statusCode: 200,
      metadata: extracted.metadata
    });

    // Only conclude trace if there are no pending function calls
    const hasPending = hasPendingFunctionCalls(outputItems);
    if (this.shouldCompleteTrace && !hasPending) {
      this.logger.conclude({
        output: JSON.stringify(consolidatedOutput),
        durationNs: calculateDurationNs(startTimeForMetrics, endTime)
      });
    }
  }

  private finalizeChatCompletionApi(startTimeForMetrics: Date, endTime: Date) {
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
      metadata: extracted.metadata,
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
}
