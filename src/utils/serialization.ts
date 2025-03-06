/**
 * Converts a value to a string
 */
export const toStringValue = (value: unknown): string => {
  if (value === null) {
    return 'null';
  }

  if (value === undefined) {
    return 'undefined';
  }

  if (typeof value === 'object') {
    try {
      // For complex objects, you might want to limit the depth/size of the output
      return JSON.stringify(value, null, 0);
    } catch (e) {
      return '[Complex Object]';
    }
  }

  // Handle other special cases like functions
  if (typeof value === 'function') {
    return '[Function]';
  }

  return String(value);
};

/**
 * Extracts parameter names from a function
 */
export const extractParamNames = <T extends unknown[], R>(
  fn: (...args: T) => Promise<R>
): string[] => {
  const fnStr = fn.toString();
  // Match the function parameters within the first parentheses
  const paramMatch = fnStr.match(/\(([^)]*)\)/);

  if (!paramMatch || !paramMatch[1].trim()) {
    return [];
  }

  // Split the parameters and clean them up
  return paramMatch[1].split(',').map((param) => {
    // Extract just the parameter name (before any type annotation)
    const paramName = param.trim().split(':')[0].trim();
    return paramName;
  });
};

/**
 * Converts function arguments to a dictionary with string values
 */
export const argsToDict = <T extends unknown[]>(
  paramNames: string[],
  args: T
): Record<string, string> => {
  return paramNames.reduce(
    (dict, paramName, index) => {
      if (index < args.length) {
        dict[paramName] = toStringValue(args[index]);
      }
      return dict;
    },
    {} as Record<string, string>
  );
};
