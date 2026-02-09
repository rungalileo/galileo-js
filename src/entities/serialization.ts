/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Custom JSON encoder to assist in the serialization of a wide range of objects.
 */
export class EventSerializer {
  private seen: Set<object> = new Set();

  /**
   * Serialize a value to its JSON-compatible representation.
   * @param obj - The object to serialize.
   * @returns The serialized representation.
   */
  public default(obj: any): any {
    try {
      // Handle Date objects
      if (obj instanceof Date) {
        return this.serializeDatetime(obj);
      }

      // Handle Error objects
      if (obj instanceof Error) {
        return `${obj.constructor.name}: ${obj.message}`;
      }

      // Handle null and undefined
      if (obj === null || obj === undefined) {
        return obj;
      }

      // Handle primitives
      if (typeof obj === 'string' || typeof obj === 'boolean') {
        return obj;
      }

      // Handle numbers (check for JavaScript safe integer range)
      if (typeof obj === 'number') {
        if (Number.isInteger(obj) && !this.isJsSafeInteger(obj)) {
          return String(obj);
        }
        return obj;
      }

      // Handle enums (objects with a 'value' property that are typically enums)
      if (
        typeof obj === 'object' &&
        'value' in obj &&
        typeof obj.value !== 'undefined'
      ) {
        return obj.value;
      }

      // Handle ArrayBuffer and TypedArray
      if (obj instanceof ArrayBuffer) {
        try {
          const decoder = new TextDecoder('utf-8');
          return decoder.decode(obj);
        } catch {
          return '<not serializable bytes>';
        }
      }

      if (
        obj instanceof Uint8Array ||
        obj instanceof Uint16Array ||
        obj instanceof Uint32Array
      ) {
        try {
          const decoder = new TextDecoder('utf-8');
          return decoder.decode(obj);
        } catch {
          return '<not serializable bytes>';
        }
      }

      // Handle arrays
      if (Array.isArray(obj)) {
        return obj.map((item) => this.default(item));
      }

      // Handle Sets
      if (obj instanceof Set) {
        return Array.from(obj).map((item) => this.default(item));
      }

      // Handle Maps
      if (obj instanceof Map) {
        const result: Record<string, any> = {};
        for (const [key, value] of obj.entries()) {
          result[String(key)] = this.default(value);
        }
        return result;
      }

      // Handle objects with __dict__-like structures or plain objects
      if (typeof obj === 'object' && obj !== null) {
        if (this.seen.has(obj)) {
          // Break on circular references
          return `<${obj.constructor?.name || 'Object'}>`;
        }
        this.seen.add(obj);

        try {
          const result: Record<string, any> = {};
          // Iterate over own properties, excluding those starting with _
          for (const key in obj) {
            if (
              Object.prototype.hasOwnProperty.call(obj, key) &&
              !key.startsWith('_')
            ) {
              result[key] = this.default(obj[key]);
            }
          }
          // Note: WeakSet doesn't have delete, but entries are automatically garbage collected
          // We can't manually remove, but that's fine for our use case
          this.seen.delete(obj);
          return result;
        } catch {
          this.seen.delete(obj);
          return `<${obj.constructor?.name || 'Object'}>`;
        }
      }

      // Fallback: return object type name
      return `<${obj?.constructor?.name || typeof obj}>`;
    } catch (error) {
      return `"<not serializable object of type: ${obj?.constructor?.name || typeof obj}>"`;
    }
  }

  /**
   * Encode an object to a JSON string.
   * @param obj - The object to encode.
   * @returns The JSON string representation.
   */
  public encode(obj: any): string {
    // Create a new WeakSet for each encode call to track circular references
    this.seen = new Set();
    try {
      const processed = this.default(obj);
      return JSON.stringify(processed);
    } catch {
      return `"<not serializable object of type: ${obj?.constructor?.name || typeof obj}>"`;
    }
  }

  /**
   * Serialize a datetime to ISO format with timezone support.
   * @param date - The Date object to serialize.
   * @returns ISO format string with timezone.
   */
  private serializeDatetime(date: Date): string {
    // JavaScript Date objects are always in local time or UTC
    // Convert to ISO string, which includes timezone info
    const isoString = date.toISOString();
    // ISO string format: YYYY-MM-DDTHH:mm:ss.sssZ
    // For UTC, it ends with 'Z', which is what we want
    return isoString;
  }

  /**
   * Check if a number is within JavaScript's safe integer range.
   * @param value - The integer value to check.
   * @returns True if the value is safe, false otherwise.
   */
  private isJsSafeInteger(value: number): boolean {
    const maxSafeInt = 2 ** 53 - 1;
    const minSafeInt = -(2 ** 53) + 1;
    return minSafeInt <= value && value <= maxSafeInt;
  }
}

/**
 * Safely serialize data to a JSON string.
 * @param inputData - The data to serialize.
 * @returns A JSON string representation of the data.
 */
export function serializeToStr(inputData: unknown): string {
  if (typeof inputData === 'string') {
    return inputData;
  }

  if (inputData === null || inputData === undefined) {
    return JSON.stringify(inputData);
  }

  if (typeof inputData === 'boolean' || typeof inputData === 'number') {
    return JSON.stringify(inputData);
  }

  try {
    const serializer = new EventSerializer();
    return serializer.encode(inputData);
  } catch {
    return '';
  }
}

/**
 * Safely stringifies data to JSON, handling circular references by replacing
 * cycles with a placeholder string.
 *
 * @param obj - The data to stringify.
 * @param space - (Optional) Number of spaces for pretty-printing (same as JSON.stringify).
 * @returns A JSON string representation, or a fallback string on failure.
 */
export function safeStringify(obj: unknown, space?: number): string {
  try {
    const serializer = new EventSerializer();
    const processed = serializer.default(obj);
    return JSON.stringify(processed, null, space);
  } catch {
    return `"<not serializable object of type: ${(obj as object)?.constructor?.name ?? typeof obj}>"`;
  }
}
