import type OpenAI from 'openai';

import { GalileoLogger } from './utils/galileo-logger';
import { GalileoSingleton } from './singleton';

try {
  require.resolve('openai');
} catch (e) {
  // eslint-disable-next-line no-console
  console.warn('openai package is not installed. Some features may not work.');
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
export function wrapOpenAI(
  openAIClient: OpenAI,
  logger?: GalileoLogger
): OpenAI {
  const handler: ProxyHandler<OpenAI> = {
    get(target, prop: keyof OpenAI) {
      const originalMethod = target[prop];

      if (
        prop === 'chat' &&
        typeof originalMethod === 'object' &&
        originalMethod !== null
      ) {
        return new Proxy(originalMethod, {
          get(chatTarget, chatProp) {
            if (
              chatProp === 'completions' &&
              typeof chatTarget[chatProp] === 'object'
            ) {
              return new Proxy(chatTarget[chatProp], {
                get(completionsTarget, completionsProp) {
                  if (
                    completionsProp === 'create' &&
                    typeof completionsTarget[completionsProp] === 'function'
                  ) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    return async function wrappedCreate(...args: any[]) {
                      const [requestData] = args;
                      const startTime = Date.now();
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
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      } catch (error: Error | unknown) {
                        const errorMessage =
                          error instanceof Error
                            ? error.message
                            : String(error);

                        if (startTrace) {
                          // If a trace was started, conclude it
                          logger!.conclude({
                            output: `Error: ${errorMessage}`,
                            durationNs: Number(startTime - startTime)
                          });
                        }
                        throw error;
                      }

                      const endTime = Date.now();
                      const output = response?.choices
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        ?.map((choice: any) =>
                          JSON.parse(JSON.stringify(choice.message))
                        );

                      logger!.addLlmSpan({
                        input: JSON.parse(JSON.stringify(requestData.messages)),
                        output,
                        name: 'openai-client-generation',
                        model: requestData.model || 'unknown',
                        numInputTokens: response?.usage?.prompt_tokens || 0,
                        numOutputTokens:
                          response?.usage?.completion_tokens || 0,
                        durationNs: Number(endTime - startTime),
                        metadata: requestData.metadata || {}
                      });

                      if (startTrace) {
                        // If a trace was started, conclude it
                        logger!.conclude({
                          output: JSON.stringify(output),
                          durationNs: Number(endTime - startTime)
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
