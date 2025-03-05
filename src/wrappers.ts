import { GalileoLogger } from './utils/galileo-logger';
import { GalileoSingleton } from './singleton';
import { MessageRole } from './types/message.types';

export type SpanType = 'llm' | 'retriever' | 'tool' | 'workflow';

export interface LogOptions {
  spanType?: SpanType;
  name?: string;
  params?: Record<string, unknown>;
}

/**
 * Wraps a function to log its execution as a span in Galileo.
 */
export function log<T extends unknown[], R>(
  options: LogOptions,
  fn: (...args: T) => Promise<R>
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    let logger: GalileoLogger | undefined = undefined;
    let result: R = {} as R;
    let concludeSpan = false;
    const argsToString = JSON.stringify(args);
    const name = options?.name || fn.name || 'Function';

    const conclude = (result: R) => {
      if (!logger || !concludeSpan) {
        return;
      }
      try {
        logger.conclude({
          output: JSON.stringify(result)
        });
      } catch (error) {
        console.error(error);
      }
    };

    try {
      logger = GalileoSingleton.getInstance().getClient();

      if (!logger.currentParent()) {
        console.log('Starting new trace.');
        logger.addTrace(argsToString, undefined, name);
      }

      if (!options.spanType || options.spanType === 'workflow') {
        console.log('Starting new workflow span.');
        logger.addWorkflowSpan(argsToString, undefined, name);
        concludeSpan = true;
      }
    } catch (error) {
      console.error(error);
    }

    try {
      result = await fn(...args);

      const resultToString = JSON.stringify(result);

      console.log('🔵 Result:', resultToString);

      console.log('🔵 Ending span.');

      if (options.spanType === 'llm') {
        logger?.addLlmSpan({
          input: [{ role: MessageRole.user, content: argsToString }],
          output: { role: MessageRole.user, content: resultToString }
          // TODO: add a param mapper to apply span values
          //   model: options.model,
          //   tools: options.tools,
          //   numInputTokens: options.numInputTokens,
          //   numOutputTokens: options.numOutputTokens,
          //   totalTokens: options.totalTokens,
          //   temperature: options.temperature,
          //   statusCode: options.statusCode
        });
      } else if (options.spanType === 'retriever') {
        logger?.addRetrieverSpan(argsToString, [], name);
      } else if (options.spanType === 'tool') {
        logger?.addToolSpan(argsToString, resultToString, name);
      }

      return result;
    } catch (error) {
      console.warn('Error while executing function:', error);
      throw error;
    } finally {
      conclude(result);
    }
  };
}
