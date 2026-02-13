/* eslint-disable @typescript-eslint/no-explicit-any */
import { serializeToStr } from '../entities/serialization';

/**
 * Converts a value to a string using advanced serialization.
 * @param value - The value to convert to a string.
 * @returns A string representation of the value.
 */
export const toStringValue = (value: unknown): string => {
  // Use EventSerializer for advanced serialization
  return serializeToStr(value);
};

/**
 * Extracts parameter names and their default values from a function by parsing its source.
 * Supports both synchronous and async functions (returning R or Promise<R>).
 *
 * @param fn - The function to inspect (sync or async).
 * @returns An array of parameter descriptors with name and optional default value.
 */
export const extractParamsInfo = <T extends unknown[], R>(
  fn: (...args: T) => R | Promise<R>
): { name: string; defaultValue?: unknown }[] => {
  const fnStr = fn.toString();

  // Match the function parameters within the first parentheses
  const paramMatch = fnStr.match(/\(([^)]*)\)/);

  if (!paramMatch || !paramMatch[1].trim()) {
    return [];
  }

  // Split the parameters and process each one
  return paramMatch[1].split(',').map((param) => {
    param = param.trim();

    // Check if parameter has a default value (contains "=")
    const defaultValueMatch = param.match(/(\w+)\s*=\s*([^,]+)/);

    if (defaultValueMatch) {
      const paramName = defaultValueMatch[1].trim();
      const defaultValueStr = defaultValueMatch[2].trim();

      // Parse the default value
      let defaultValue: unknown;
      try {
        // For string literals with quotes
        if (
          defaultValueStr.startsWith("'") ||
          defaultValueStr.startsWith('"')
        ) {
          // Remove quotes and handle escaping
          defaultValue = defaultValueStr
            .slice(1, -1)
            .replace(/\\"/g, '"')
            .replace(/\\'/g, "'");
        }
        // For numeric, boolean, null, undefined
        else if (
          defaultValueStr === 'null' ||
          defaultValueStr === 'undefined' ||
          defaultValueStr === 'true' ||
          defaultValueStr === 'false' ||
          !Number.isNaN(defaultValueStr)
        ) {
          defaultValue = eval(defaultValueStr);
        }
        // For object/array literals or other expressions (less reliable)
        else {
          // This is simplistic and may not work for complex expressions
          defaultValue = defaultValueStr;
        }
      } catch (e) {
        defaultValue = defaultValueStr; // Fallback to string representation
      }

      return { name: paramName, defaultValue };
    } else {
      // Extract just the parameter name (before any type annotation)
      const paramName = param.split(':')[0].trim();
      return { name: paramName };
    }
  });
};

/**
 * Converts function arguments to a dictionary using parameter names and default values
 */
export const argsToDict = <T extends unknown[]>(
  paramsInfo: { name: string; defaultValue?: unknown }[],
  args: T
): Record<string, unknown> => {
  const result: Record<string, unknown> = {};

  paramsInfo.forEach((param, index) => {
    if (index < args.length) {
      // Use the provided argument
      result[param.name] = args[index];
    } else if (param.defaultValue !== undefined) {
      // Use the default value when no argument is provided
      result[param.name] = param.defaultValue;
    }
  });

  return result;
};

/**
 * Convert a record with arbitrary values to a Record<string, string> by converting
 * all values to their string representations.
 *
 * @param metadata - The metadata object with potentially complex values
 * @returns A new object with all values converted to strings
 */
export const convertToStringDict = (
  metadata: Record<string, any>
): Record<string, string> => {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(metadata)) {
    // Ensure key is a string (already guaranteed by Object.entries)
    const stringKey: string = key;

    // Convert value to string based on type
    let stringValue: string;

    if (value === null || value === undefined) {
      stringValue = '';
    } else if (typeof value === 'object') {
      // For complex types, use circular-safe serialization
      stringValue = serializeToStr(value);
    } else {
      // For primitive types, convert directly to string
      stringValue = String(value);
    }

    result[stringKey] = stringValue;
  }

  return result;
};
