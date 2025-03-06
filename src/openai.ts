import type OpenAI from 'openai';

import { GalileoLogger } from './utils/galileo-logger';

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
  logger: GalileoLogger = new GalileoLogger()
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
                      logger.addTrace(JSON.stringify(requestData.messages));

                      const startTime = process.hrtime.bigint();
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
                        logger.conclude({
                          output: `Error: ${errorMessage}`,
                          durationNs: Number(
                            process.hrtime.bigint() - startTime
                          )
                        });
                        throw error;
                      }

                      const output = response?.choices
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        ?.map((choice: any) => JSON.stringify(choice.message))
                        .join('\n');

                      logger.addLlmSpan({
                        input: JSON.stringify(requestData.messages),
                        output,
                        model: requestData.model || 'unknown',
                        numInputTokens: response?.usage?.prompt_tokens || 0,
                        numOutputTokens:
                          response?.usage?.completion_tokens || 0,
                        durationNs: Number(process.hrtime.bigint() - startTime),
                        metadata: requestData.metadata || {}
                      });

                      logger.conclude({
                        output,
                        durationNs: Number(process.hrtime.bigint() - startTime)
                      });

                      logger.flush();

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
