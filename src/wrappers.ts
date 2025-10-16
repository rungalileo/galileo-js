import { GalileoLogger } from './utils/galileo-logger';
import { GalileoSingleton } from './singleton';
import {
  argsToDict,
  extractParamsInfo,
  toStringValue
} from './utils/serialization';
import {
  isLlmSpanAllowedInputType,
  isLlmSpanAllowedOutputType,
  isRetrieverSpanAllowedOutputType
} from './types/logging/step.types';
import { isValidAgentType } from './types/logging/span.types';
import { DatasetRecord } from './types';
import { calculateDurationNs } from './utils/utils';

export type SpanType = 'llm' | 'retriever' | 'tool' | 'workflow' | 'agent';

export interface LogOptions {
  spanType?: SpanType;
  name?: string;
  params?: Record<string, unknown>;
  datasetRecord?: DatasetRecord;
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

    let argsDict: Record<string, unknown> = argsToDict(paramsInfo, args);
    if (!('input' in argsDict)) {
      argsDict = { input: argsDict };
    }
    const input: unknown = argsDict['input'];
    const inputString: string = toStringValue(input);
    const name: string =
      argsDict?.name !== undefined
        ? toStringValue(argsDict.name)
        : options?.name || fn.name || 'Function';
    let createdAt: Date;
    if (argsDict?.createdAt instanceof Date) {
      createdAt = argsDict.createdAt;
    } else if (
      typeof argsDict?.createdAt === 'number' ||
      typeof argsDict?.createdAt === 'string'
    ) {
      createdAt = new Date(argsDict.createdAt);
    } else {
      createdAt = new Date();
    }

    let concludeCount = 0;
    const conclude = (result: R, durationNs?: number) => {
      if (!logger || concludeCount == 0) {
        return;
      }
      try {
        logger.conclude({
          output: toStringValue(result),
          durationNs: durationNs
        });
      } catch (error) {
        console.error(error);
      }
      concludeCount = concludeCount - 1;
      conclude(result, durationNs);
    };

    try {
      logger = GalileoSingleton.getInstance().getClient();

      if (!logger.currentParent()) {
        logger.startTrace({
          input: inputString,
          name: name,
          createdAt: createdAt,
          datasetInput: options.datasetRecord?.input,
          datasetOutput: options.datasetRecord?.output,
          datasetMetadata: options.datasetRecord?.metadata
        });
        concludeCount = concludeCount + 1;
      }

      if (!options.spanType || options.spanType === 'workflow') {
        logger.addWorkflowSpan({
          input: inputString,
          createdAt: createdAt,
          output: undefined,
          name
        });
        concludeCount = concludeCount + 1;
      }
    } catch (error) {
      console.error(error);
    }

    try {
      result = await fn(...args);

      const resultToString = JSON.stringify(result);

      if (options.spanType === 'llm') {
        logger?.addLlmSpan({
          input: isLlmSpanAllowedInputType(input) ? input : inputString,
          output: isLlmSpanAllowedOutputType(result) ? result : resultToString,
          createdAt: createdAt,
          model:
            'model' in argsDict ? toStringValue(argsDict['model']) : undefined
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
          input: inputString,
          output: isRetrieverSpanAllowedOutputType(result)
            ? result
            : resultToString,
          createdAt: createdAt,
          name: name
        });
      } else if (options.spanType === 'tool') {
        logger?.addToolSpan({
          input: inputString,
          output: resultToString,
          createdAt: createdAt,
          name: name
        });
      } else if (options.spanType === 'agent') {
        logger?.addAgentSpan({
          input: inputString,
          agentType: isValidAgentType(argsDict['agentType'])
            ? argsDict['agentType']
            : undefined,
          createdAt: createdAt,
          name: name
        });
      }

      return result;
    } catch (error) {
      console.warn('Error while executing function:', error);
      throw error;
    } finally {
      const durationNs = calculateDurationNs(createdAt);
      conclude(result, durationNs);
    }
  };
}
