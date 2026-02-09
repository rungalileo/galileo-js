import type { GalileoLogger } from './utils/galileo-logger';
import {
  experimentContext,
  GalileoSingleton,
  loggerContext
} from './singleton';
import { safeStringify, serializeToStr } from './entities/serialization';
import {
  argsToDict,
  convertToStringDict,
  extractParamsInfo,
  toStringValue
} from './utils/serialization';
import {
  isLlmSpanAllowedInputType,
  isLlmSpanAllowedOutputType,
  isRetrieverSpanAllowedOutputType
} from './types/logging/step.types';
import { isValidAgentType } from './types/logging/span.types';
import type { DatasetRecord } from './types';
import type { JsonObject } from './types/base.types';
import { calculateDurationNs } from './utils/utils';

export type SpanType = 'llm' | 'retriever' | 'tool' | 'workflow' | 'agent';

type ParamMapper = string | ((input: Record<string, unknown>) => unknown);
type ParamMapping = Record<string, ParamMapper>;

/**
 * Options for the log() wrapper. Controls span type, naming, params mapping,
 * dataset association, metadata/tags, and distributed tracing (traceId/parentId).
 */
export interface LogOptions {
  /** (Optional) The span type. */
  spanType?: SpanType;
  /** (Optional) The span name. */
  name?: string;
  /** (Optional) Mapping of parameter names or mappers to span params. */
  params?: ParamMapping;
  /** (Optional) Dataset record for input/output/metadata. */
  datasetRecord?: DatasetRecord;
  /** (Optional) Top-level metadata applied to the span (merged with params/args). */
  metadata?: Record<string, string>;
  /** (Optional) Top-level tags applied to the span (merged with params/args). */
  tags?: string[];
  /** (Optional) Distributed tracing: ID of the trace to continue. */
  traceId?: string;
  /** (Optional) Distributed tracing: parent span ID to continue under. */
  parentId?: string;
}

const isPromise = <T>(value: unknown): value is Promise<T> =>
  typeof (value as Promise<T>)?.then === 'function';

const isGenerator = (value: unknown): value is Generator<unknown> =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Generator<unknown>).next === 'function' &&
  typeof (value as Generator<unknown>).throw === 'function';

const isAsyncGenerator = (value: unknown): value is AsyncGenerator<unknown> =>
  typeof value === 'object' &&
  value !== null &&
  Symbol.asyncIterator in (value as object);

const applyParamMapping = (
  mapping: ParamMapping | undefined,
  input: Record<string, unknown>
): Record<string, unknown> => {
  if (!mapping) {
    return {};
  }

  const result: Record<string, unknown> = {};
  for (const [key, mapper] of Object.entries(mapping)) {
    if (typeof mapper === 'function') {
      result[key] = mapper(input);
      continue;
    }
    result[key] = input[mapper];
  }

  return result;
};

const getSpanParamNames = (spanType?: SpanType): string[] => {
  const common = [
    'metadata',
    'tags',
    'statusCode',
    'stepNumber',
    'redactedInput',
    'redactedOutput'
  ];

  switch (spanType) {
    case 'llm':
      return [
        ...common,
        'model',
        'tools',
        'numInputTokens',
        'numOutputTokens',
        'totalTokens',
        'timeToFirstTokenNs',
        'temperature'
      ];
    case 'tool':
      return [...common, 'toolCallId'];
    case 'agent':
      return [...common, 'agentType'];
    case 'retriever':
    case 'workflow':
    default:
      return common;
  }
};

const toNumber = (value: unknown): number | undefined =>
  typeof value === 'number' ? value : undefined;

/**
 * Wraps a function to log its execution as a span in Galileo.
 * Supports synchronous functions, Promises, and sync/async Generators.
 *
 * @param options - The span options.
 * @param options.spanType - (Optional) The span type.
 * @param options.name - (Optional) The span name.
 * @param options.params - (Optional) Mapping of parameter names or mappers to span params.
 * @param options.datasetRecord - (Optional) Dataset record for input/output/metadata.
 * @param options.metadata - (Optional) Top-level metadata applied to the span.
 * @param options.tags - (Optional) Top-level tags applied to the span.
 * @param options.traceId - (Optional) Distributed tracing: ID of the trace to continue.
 * @param options.parentId - (Optional) Distributed tracing: parent span ID to continue under.
 * @param fn - The function to wrap. Can return R, Promise<R>, Generator<R>, or AsyncGenerator<R>.
 * @returns A wrapped function with the same signature and return type as fn.
 */
export function log<T extends unknown[], R>(
  options: LogOptions,
  fn: (...args: T) => R
): (...args: T) => R;
export function log<T extends unknown[], R>(
  options: LogOptions,
  fn: (...args: T) => Promise<R>
): (...args: T) => Promise<R>;
export function log<T extends unknown[], R>(
  options: LogOptions,
  fn: (...args: T) => Generator<R>
): (...args: T) => Generator<R>;
export function log<T extends unknown[], R>(
  options: LogOptions,
  fn: (...args: T) => AsyncGenerator<R>
): (...args: T) => AsyncGenerator<R>;
export function log<T extends unknown[], R>(
  options: LogOptions,
  fn: (...args: T) => R | Promise<R> | Generator<R> | AsyncGenerator<R>
): (...args: T) => R | Promise<R> | Generator<R> | AsyncGenerator<R> {
  // Extract default parameters when wrapping the function
  const paramsInfo = extractParamsInfo(fn);

  return (...args: T): R | Promise<R> | Generator<R> | AsyncGenerator<R> => {
    const context = loggerContext.getStore();
    const parentStack = context?.parentStack ? [...context.parentStack] : [];

    return loggerContext.run({ parentStack }, () => {
      let logger: GalileoLogger | undefined;
      let result: R = {} as R;
      let isPromiseResult = false;
      let skipFinalize = false;

      let argsJson: Record<string, unknown> = argsToDict(paramsInfo, args);
      console.log(
        '[DEBUG] argsJson after argsToDict:',
        safeStringify(argsJson, 2)
      );

      if (!('input' in argsJson)) {
        argsJson = { input: argsJson };
      }
      console.log(
        '[DEBUG] argsJson after input check:',
        safeStringify(argsJson, 2)
      );

      const input: unknown = argsJson['input'];
      const inputString: string = toStringValue(input);
      const name: string =
        argsJson?.name !== undefined
          ? toStringValue(argsJson.name)
          : options?.name || fn.name || 'Function';
      let createdAt: Date;
      if (argsJson?.createdAt instanceof Date) {
        createdAt = argsJson.createdAt;
      } else if (
        typeof argsJson?.createdAt === 'number' ||
        typeof argsJson?.createdAt === 'string'
      ) {
        createdAt = new Date(argsJson.createdAt);
      } else {
        createdAt = new Date();
      }

      // Used to passthrough dates sent by caller. If not used, send undefined to let
      // functions declare creation date using controlled static method.
      const mappedParams = applyParamMapping(options.params, argsJson);
      const spanParams: Record<string, unknown> = {};
      for (const key of getSpanParamNames(options.spanType)) {
        const value = mappedParams[key] ?? argsJson[key];
        if (value !== undefined) {
          spanParams[key] = value;
        }
      }
      console.log(
        '[DEBUG] spanParams after extraction:',
        safeStringify(spanParams, 2)
      );

      if (options.metadata !== undefined) {
        spanParams.metadata = options.metadata;
      }
      if (options.tags !== undefined) {
        spanParams.tags = options.tags;
      }
      const metadata =
        spanParams.metadata &&
        typeof spanParams.metadata === 'object' &&
        spanParams.metadata !== null
          ? convertToStringDict(spanParams.metadata as Record<string, unknown>)
          : undefined;
      const tags = Array.isArray(spanParams.tags)
        ? spanParams.tags.map((tag) => toStringValue(tag))
        : undefined;

      let concludeCount = 0;
      const conclude = (result: R, durationNs?: number) => {
        if (!logger || concludeCount === 0) {
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
        // Use getLogger() with current context so the wrapper respects project/experiment/logstream
        // set via experimentContext.run() or init(). If no context exists, use getClient() to
        // retrieve the last logger configured during the ongoing workflow.
        const exp = experimentContext.getStore();
        const logStore = loggerContext.getStore();

        // Priority: logStore (loggerContext) > exp (experimentContext) > getClient()
        const hasLogStoreData =
          logStore &&
          (logStore.logStreamName ||
            logStore.sessionId ||
            (logStore.parentStack && logStore.parentStack.length > 0));
        const hasExpData =
          exp && (exp.projectName || exp.experimentId || exp.logStreamName);

        console.log('logStore: ', logStore);
        if (hasLogStoreData) {
          // Use loggerContext data if available
          logger = GalileoSingleton.getInstance().getLogger({
            projectName: exp?.projectName,
            experimentId: exp?.experimentId,
            logstream: logStore?.logStreamName ?? exp?.logStreamName
          });
        } else if (hasExpData) {
          // Use experimentContext data if available
          logger = GalileoSingleton.getInstance().getLogger({
            projectName: exp?.projectName,
            experimentId: exp?.experimentId,
            logstream: exp?.logStreamName
          });
        } else {
          // Fallback to last available logger
          logger = GalileoSingleton.getInstance().getClient();
        }
      } catch (error) {
        console.error(error);
      }

      const runRest = (): R | Promise<R> | Generator<R> | AsyncGenerator<R> => {
        if (logger && !logger.currentParent()) {
          logger.startTrace({
            input: inputString,
            name: name,
            datasetInput: options.datasetRecord?.input,
            datasetOutput: options.datasetRecord?.output,
            datasetMetadata: options.datasetRecord?.metadata
          });
          concludeCount = concludeCount + 1;
        }

        if (logger && (!options.spanType || options.spanType === 'workflow')) {
          logger.addWorkflowSpan({
            input: inputString,
            output: undefined,
            name,
            redactedInput:
              spanParams.redactedInput !== undefined
                ? toStringValue(spanParams.redactedInput)
                : undefined,
            redactedOutput:
              spanParams.redactedOutput !== undefined
                ? toStringValue(spanParams.redactedOutput)
                : undefined,
            metadata,
            tags,
            stepNumber: toNumber(spanParams.stepNumber)
          });
          concludeCount = concludeCount + 1;
        } else if (logger && options.spanType === 'agent') {
          logger.addAgentSpan({
            input: inputString,
            agentType: isValidAgentType(spanParams.agentType)
              ? spanParams.agentType
              : undefined,
            name: name,
            redactedInput:
              spanParams.redactedInput !== undefined
                ? toStringValue(spanParams.redactedInput)
                : undefined,
            redactedOutput:
              spanParams.redactedOutput !== undefined
                ? toStringValue(spanParams.redactedOutput)
                : undefined,
            metadata,
            tags,
            stepNumber: toNumber(spanParams.stepNumber)
          });
          concludeCount = concludeCount + 1;
        }

        const handleResult = (resolved: R): R => {
          result = resolved;
          const resultToString = serializeToStr(resolved);

          if (options.spanType === 'llm') {
            const redactedInput =
              spanParams.redactedInput !== undefined
                ? isLlmSpanAllowedInputType(spanParams.redactedInput)
                  ? spanParams.redactedInput
                  : toStringValue(spanParams.redactedInput)
                : undefined;
            const redactedOutput =
              spanParams.redactedOutput !== undefined
                ? isLlmSpanAllowedOutputType(spanParams.redactedOutput)
                  ? spanParams.redactedOutput
                  : toStringValue(spanParams.redactedOutput)
                : undefined;

            logger?.addLlmSpan({
              input: isLlmSpanAllowedInputType(input) ? input : inputString,
              output: isLlmSpanAllowedOutputType(resolved)
                ? resolved
                : resultToString,
              redactedInput,
              redactedOutput,
              model:
                spanParams.model !== undefined
                  ? toStringValue(spanParams.model)
                  : undefined,
              tools: Array.isArray(spanParams.tools)
                ? (spanParams.tools as JsonObject[])
                : undefined,
              metadata,
              tags,
              numInputTokens: toNumber(spanParams.numInputTokens),
              numOutputTokens: toNumber(spanParams.numOutputTokens),
              totalTokens: toNumber(spanParams.totalTokens),
              timeToFirstTokenNs: toNumber(spanParams.timeToFirstTokenNs),
              temperature: toNumber(spanParams.temperature),
              statusCode: toNumber(spanParams.statusCode),
              stepNumber: toNumber(spanParams.stepNumber)
            });
          } else if (options.spanType === 'retriever') {
            logger?.addRetrieverSpan({
              input: inputString,
              output: isRetrieverSpanAllowedOutputType(resolved)
                ? resolved
                : resultToString,
              name: name,
              redactedInput:
                spanParams.redactedInput !== undefined
                  ? toStringValue(spanParams.redactedInput)
                  : undefined,
              redactedOutput:
                spanParams.redactedOutput !== undefined
                  ? toStringValue(spanParams.redactedOutput)
                  : undefined,
              metadata,
              tags,
              statusCode: toNumber(spanParams.statusCode),
              stepNumber: toNumber(spanParams.stepNumber)
            });
          } else if (options.spanType === 'tool') {
            logger?.addToolSpan({
              input: inputString,
              output: resultToString,
              name: name,
              redactedInput:
                spanParams.redactedInput !== undefined
                  ? toStringValue(spanParams.redactedInput)
                  : undefined,
              redactedOutput:
                spanParams.redactedOutput !== undefined
                  ? toStringValue(spanParams.redactedOutput)
                  : undefined,
              metadata,
              tags,
              statusCode: toNumber(spanParams.statusCode),
              toolCallId:
                spanParams.toolCallId !== undefined
                  ? toStringValue(spanParams.toolCallId)
                  : undefined,
              stepNumber: toNumber(spanParams.stepNumber)
            });
          }

          return resolved;
        };

        const finalize = () => {
          const durationNs = calculateDurationNs(createdAt);
          conclude(result, durationNs);
        };

        const wrapSyncGeneratorResult = function* (
          generator: Generator<R>
        ): Generator<R> {
          const items: R[] = [];
          try {
            for (const item of generator) {
              items.push(item);
              yield item;
            }
          } catch (error) {
            console.warn('Error while iterating generator:', error);
          } finally {
            const output =
              items.length === 0
                ? ''
                : items.every((item) => typeof item === 'string')
                  ? (items as string[]).join('')
                  : items;
            handleResult(output as unknown as R);
            finalize();
          }
        };

        const wrapAsyncGeneratorResult = async function* (
          generator: AsyncGenerator<R>
        ): AsyncGenerator<R> {
          const items: R[] = [];
          try {
            for await (const item of generator) {
              items.push(item);
              yield item;
            }
          } catch (error) {
            console.warn('Error while iterating async generator:', error);
          } finally {
            const output =
              items.length === 0
                ? ''
                : items.every((item) => typeof item === 'string')
                  ? (items as string[]).join('')
                  : items;
            handleResult(output as unknown as R);
            finalize();
          }
        };

        try {
          const fnResult = fn(...args);
          if (isAsyncGenerator(fnResult)) {
            skipFinalize = true;
            return wrapAsyncGeneratorResult(fnResult as AsyncGenerator<R>);
          }

          if (isGenerator(fnResult)) {
            skipFinalize = true;
            return wrapSyncGeneratorResult(fnResult as Generator<R>);
          }

          isPromiseResult = isPromise<R>(fnResult);

          if (isPromiseResult) {
            return (fnResult as Promise<R>)
              .then((resolved) => handleResult(resolved))
              .catch((error) => {
                console.warn('Error while executing function:', error);
                throw error;
              })
              .finally(() => {
                finalize();
              });
          }

          handleResult(fnResult as R);
          return fnResult as R;
        } catch (error) {
          console.warn('Error while executing function:', error);
          throw error;
        } finally {
          if (!isPromiseResult && !skipFinalize) {
            finalize();
          }
        }
      };

      if (options.traceId && logger && !logger.currentParent()) {
        return (async () => {
          await logger.continueTrace(
            options.traceId as string,
            options.parentId
          );
          return runRest();
        })() as unknown as R | Promise<R> | Generator<R> | AsyncGenerator<R>;
      }
      return runRest();
    });
  };
}
