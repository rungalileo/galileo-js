import { GalileoLogger } from './utils/galileo-logger';
import { GalileoSingleton } from './singleton';
import { argsToDict, extractParamsInfo } from './utils/serialization';
import { RetrieverStepAllowedOutputType } from './types/step.types';
import { Document } from './types/document.types';

export type SpanType = 'llm' | 'retriever' | 'tool' | 'workflow';

export interface LogOptions {
  spanType?: SpanType;
  name?: string;
  params?: Record<string, unknown>;
}

function _isRetrieverOutput<R>(output: R): boolean {
  try {
    return (
      typeof output === 'string' ||
      (Array.isArray(output) &&
        (output.length === 0 || typeof output[0] === 'string')) ||
      output instanceof Document ||
      (Array.isArray(output) &&
        (output.length === 0 || output[0] instanceof Document)) ||
      (typeof output === 'object' &&
        output !== null &&
        !Array.isArray(output) &&
        Object.values(output).every((val) => typeof val === 'string')) ||
      (Array.isArray(output) &&
        (output.length === 0 ||
          (typeof output[0] === 'object' &&
            output[0] !== null &&
            !Array.isArray(output[0]) &&
            Object.values(output[0]).every((val) => typeof val === 'string'))))
    );
  } catch (e) {
    console.warn('Unable to check if output is a retriever output', e);
    return false;
  }
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
        logger?.addRetrieverSpan({
          input: argsToString,
          output:
            result && _isRetrieverOutput(result)
              ? (result! as RetrieverStepAllowedOutputType)
              : resultToString,
          name
        });
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
