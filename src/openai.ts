/* eslint-disable @typescript-eslint/no-explicit-any */
import { GalileoLogger } from './utils/galileo-logger';
import { GalileoSingleton } from './singleton';

try {
  require.resolve('openai');
} catch (e) {
  // eslint-disable-next-line no-console
  console.warn('openai package is not installed. Some features may not work.');
}

interface OpenAIType {
  completions: {
    create: any;
  };
  embeddings: any;
  moderations: any;
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
 * await openai.completions.create({
 *   model: "gpt-4",
 *   prompt: "Say hello world!",
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
        prop === 'completions' &&
        typeof originalMethod === 'object' &&
        originalMethod !== null
      ) {
        return new Proxy(originalMethod, {
          get(completionsTarget: any, completionsProp: string | symbol) {
            if (
              completionsProp === 'create' &&
              typeof completionsTarget[completionsProp] === 'function'
            ) {
              return async function wrappedCreate(...args: any[]) {
                const [requestData] = args;
                const startTime = Date.now();
                if (!logger) {
                  logger = GalileoSingleton.getInstance().getClient();
                }

                const startTrace = logger.currentParent() === undefined;

                if (startTrace) {
                  logger!.startTrace({
                    input: JSON.stringify(requestData.prompt),
                    output: undefined,
                    name: 'openai-client-generation',
                    createdAt: startTime
                  });
                }

                let response;
                try {
                  response = await completionsTarget[completionsProp](...args);
                } catch (error: Error | unknown) {
                  const errorMessage =
                    error instanceof Error ? error.message : String(error);

                  if (startTrace) {
                    logger!.conclude({
                      output: `Error: ${errorMessage}`
                    });
                  }
                  throw error;
                }

                // Check if this is a streaming response
                if (requestData.stream) {
                  return new StreamWrapper(
                    response,
                    requestData,
                    logger!,
                    startTime,
                    startTrace
                  );
                }

                const endTime = Date.now();
                const durationNs = (endTime - startTime) * 1_000_000;
                const output = response?.choices?.map((choice: any) => ({
                  content: choice.text,
                  role: 'assistant'
                }));

                logger!.addLlmSpan({
                  input: JSON.parse(JSON.stringify(requestData.prompt)),
                  output,
                  name: 'openai-client-generation',
                  model: requestData.model || 'unknown',
                  numInputTokens: response?.usage?.prompt_tokens || 0,
                  numOutputTokens: response?.usage?.completion_tokens || 0,
                  durationNs,
                  metadata: requestData.metadata || {},
                  statusCode: 200
                });

                if (startTrace) {
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
  private completionStartTime: number | null = null;
  private completeOutput: any = {
    content: '',
    role: 'assistant'
  };
  private iterator: AsyncIterator<any>;

  constructor(
    private stream: AsyncIterable<any>,
    private requestData: any,
    private logger: GalileoLogger,
    private startTime: number,
    private shouldCompleteTrace: boolean
  ) {
    this.iterator = this.stream[Symbol.asyncIterator]();
  }

  [Symbol.asyncIterator](): AsyncIterator<any> {
    return {
      next: async (): Promise<IteratorResult<any>> => {
        try {
          const result = await this.iterator.next();

          if (!result.done) {
            if (this.completionStartTime === null) {
              this.completionStartTime = Date.now();
            }

            this.chunks.push(result.value);
            this.processChunk(result.value);

            return result;
          } else {
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
        return { done: true, value: undefined };
      }
    };
  }

  private processChunk(chunk: any) {
    const delta = chunk.choices?.[0]?.text;
    if (delta) {
      this.completeOutput.content += delta;
    }
  }

  private finalize() {
    if (this.chunks.length === 0) return;

    const endTime = Date.now();
    const startTimeForMetrics = this.completionStartTime || this.startTime;

    this.logger.addLlmSpan({
      input: JSON.parse(JSON.stringify(this.requestData.prompt)),
      output: this.completeOutput,
      name: 'openai-client-generation',
      model: this.requestData.model || 'unknown',
      numInputTokens: 0, // Approximate as streaming doesn't return token counts
      numOutputTokens: 0,
      durationNs: Number(endTime - startTimeForMetrics),
      metadata: this.requestData.metadata || {},
      statusCode: 200
    });

    if (this.shouldCompleteTrace) {
      this.logger.conclude({
        output: JSON.stringify(this.completeOutput),
        durationNs: Number(endTime - this.startTime)
      });
    }
  }
}
