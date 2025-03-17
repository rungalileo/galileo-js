import { GalileoLogger } from './utils/galileo-logger';
import { GalileoSingleton } from './singleton';
import { argsToDict, extractParamsInfo } from './utils/serialization';

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
  // Extract default parameters when wrapping the function
  const paramsInfo = extractParamsInfo(fn);

  return async (...args: T): Promise<R> => {
    let logger: GalileoLogger | undefined = undefined;
    let result: R = {} as R;
    let concludeSpan = false;

    const argsDict: Record<string, string> = argsToDict(paramsInfo, args);
    const argsToString = JSON.stringify(argsDict);
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
        logger.startTrace({ input: argsToString, output: undefined, name });
      }

      if (!options.spanType || options.spanType === 'workflow') {
        logger.addWorkflowSpan({
          input: argsToString,
          output: undefined,
          name
        });
        concludeSpan = true;
      }
    } catch (error) {
      console.error(error);
    }

    try {
      result = await fn(...args);

      const resultToString = JSON.stringify(result);

      if (options.spanType === 'llm') {
        logger?.addLlmSpan({
          input: argsDict,
          output: resultToString,
          model: 'model' in argsDict ? argsDict['model'] : undefined
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
        logger?.addRetrieverSpan({ input: argsToString, output: [], name });
      } else if (options.spanType === 'tool') {
        logger?.addToolSpan({
          input: argsToString,
          output: resultToString,
          name
        });
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
