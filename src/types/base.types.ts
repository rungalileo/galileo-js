/**
 * JSON-serializable value type.
 * Represents any value that can be serialized to JSON.
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/**
 * JSON-serializable object type.
 * Allows undefined values which will be omitted during JSON serialization.
 */
export type JsonObject = { [key: string]: JsonValue | undefined };

/**
 * JSON-serializable array type.
 */
export type JsonArray = JsonValue[];
