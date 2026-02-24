/**
 * Extracts request parameters from OpenAI Chat Completions / Responses API requests
 * for span metadata and observability. Designed to support both APIs and be
 * extensible for future parameters.
 */

/**
 * OpenAI scalar parameters to extract from requests for observability metadata.
 * These parameters are logged to Galileo for tracking model behavior and configuration.
 * Reference: https://platform.openai.com/docs/api-reference/chat/create
 */
const OPENAI_SCALAR_PARAMETERS = [
  /** Maximum number of tokens to generate in the completion. Model-dependent, no universal default. */
  'max_tokens',
  /** Nucleus sampling: only tokens with top_p probability mass considered. Range: 0-1. Default: 1 */
  'top_p',
  /** Reduces repetition by penalizing tokens based on frequency. Range: -2.0 to 2.0. Default: 0 */
  'frequency_penalty',
  /** Reduces repetition by penalizing tokens that already appear. Range: -2.0 to 2.0. Default: 0 */
  'presence_penalty',
  /** Random seed for deterministic sampling. When set, attempts to return same result for same input. */
  'seed',
  /** Number of completion choices to generate per input. Note: billed for all tokens across all choices. Default: 1 */
  'n',
  /** Sampling temperature controlling randomness. Range: 0 (deterministic) to 2 (very random). Default: 1 */
  'temperature'
] as const;

/**
 * Default values for OpenAI API parameters according to OpenAI documentation.
 * Used to skip logging parameters when they match defaults (reduces noise).
 * Reference: https://platform.openai.com/docs/api-reference/chat/create
 */
const OPENAI_PARAMETER_DEFAULTS: Record<string, number | null> = {
  n: 1,
  temperature: 1,
  top_p: 1,
  frequency_penalty: 0,
  presence_penalty: 0
} as const;

export interface ExtractedParameters {
  /** Extracted OpenAI parameters; all values stringified for Galileo metadata */
  metadata: Record<string, string>;
  /** Raw tools definitions for span tools field (if present) */
  tools?: Record<string, unknown>[];
}

/**
 * Returns true if value is a plain object (not array, primitive, or null).
 * Matches galileo-python's isinstance(metadata, dict) validation so we don't
 * forward primitives/arrays to filterMetadataForDistillation (which would
 * produce invalid character/index keys sent to OpenAI).
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

/**
 * Get the OpenAI request arguments, including filtered metadata if distillation is enabled.
 *
 * When `store=true` (model distillation enabled):
 * - Includes caller metadata filtered for OpenAI compatibility
 * - Removes fields not allowed in OpenAI metadata (e.g., response_format)
 * - Converts types to OpenAI-compatible format (booleans → strings)
 * - Validates metadata is a plain object; throws TypeError if not (parity with galileo-python)
 *
 * When `store` is not true or missing:
 * - Returns request options unchanged
 */
export function getOpenAiArgs(
  requestData: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...requestData };
  const callerMetadata = requestData.metadata as
    | Record<string, unknown>
    | undefined;

  // Only add metadata if distillation is explicitly enabled
  // Reference: https://platform.openai.com/docs/guides/distillation
  if (
    result.store === true &&
    callerMetadata !== undefined &&
    callerMetadata !== null
  ) {
    if (!isPlainObject(callerMetadata)) {
      throw new TypeError('metadata must be a plain object');
    }
    const filteredMetadata = filterMetadataForDistillation(callerMetadata);
    if (Object.keys(filteredMetadata).length > 0) {
      result.metadata = filteredMetadata;
    }
  }

  return result;
}

/**
 * Filter caller metadata for OpenAI distillation compatibility.
 *
 * OpenAI restrictions on metadata:
 * - Only allows string and number types
 * - Does not support complex types (objects, arrays, functions)
 * - Does not allow response_format in metadata
 *
 * This method ensures metadata meets these requirements.
 */
function filterMetadataForDistillation(
  callerMetadata: Record<string, unknown>
): Record<string, string | number> {
  const filtered: Record<string, string | number> = {};

  for (const [key, value] of Object.entries(callerMetadata)) {
    // OpenAI does not allow response_format in metadata for distillation
    if (key === 'responseFormat' || key === 'response_format') {
      continue;
    }

    // Skip null and undefined values
    if (value === null || value === undefined) {
      continue;
    }

    // Accept strings and numbers as-is
    if (typeof value === 'string' || typeof value === 'number') {
      filtered[key] = value;
      continue;
    }

    // Convert booleans to strings for OpenAI compatibility
    if (typeof value === 'boolean') {
      filtered[key] = value ? 'true' : 'false';
      continue;
    }

    // Skip complex types: objects, arrays, functions, symbols, etc.
    // These cannot be serialized safely for OpenAI
  }

  return filtered;
}

/**
 * Extract parameters from a request for logging. Handles both Chat Completions
 * (messages) and Responses API (input, instructions) shapes.
 * All metadata values are stringified since Galileo metadata is Record<string, string>.
 */
export function extractRequestParameters(
  request: Record<string, unknown>
): ExtractedParameters {
  const metadata: Record<string, string> = {};

  for (const key of OPENAI_SCALAR_PARAMETERS) {
    const v = request[key];
    if (v !== undefined && v !== null) {
      if (
        key in OPENAI_PARAMETER_DEFAULTS &&
        v === OPENAI_PARAMETER_DEFAULTS[key]
      ) {
        continue;
      }
      metadata[key] = String(v);
    }
  }

  const topLevelEffort = request.reasoning_effort;
  if (topLevelEffort !== undefined && topLevelEffort !== null) {
    metadata['reasoning_effort'] = String(topLevelEffort);
  }
  // Responses API (and some clients): nested reasoning { effort, summary, generate_summary }
  const reasoning = request.reasoning as Record<string, unknown> | undefined;
  if (reasoning && typeof reasoning === 'object') {
    const effort = reasoning.effort;
    if (
      effort !== undefined &&
      effort !== null &&
      !('reasoning_effort' in metadata)
    ) {
      metadata['reasoning_effort'] = String(effort);
    }
    const summary = reasoning.summary;
    if (summary !== undefined && summary !== null) {
      metadata['reasoning_verbosity'] = String(summary);
    }
    const generateSummary = reasoning.generate_summary;
    if (generateSummary !== undefined && generateSummary !== null) {
      metadata['reasoning_generate_summary'] = String(generateSummary);
    }
  }

  // tool_choice
  const toolChoice = request.tool_choice;
  if (toolChoice !== undefined && toolChoice !== null) {
    metadata['tool_choice'] =
      typeof toolChoice === 'object'
        ? JSON.stringify(toolChoice)
        : String(toolChoice);
  }

  const responseFormat = request.response_format;
  if (responseFormat !== undefined && responseFormat !== null) {
    if (typeof responseFormat === 'object' && responseFormat !== null) {
      const rf = responseFormat as Record<string, unknown>;
      const keys = Object.keys(rf);
      if (
        keys.length === 1 &&
        keys[0] === 'type' &&
        typeof rf.type === 'string'
      ) {
        metadata['response_format'] = rf.type;
      } else {
        metadata['response_format'] = JSON.stringify(responseFormat, null, 2);
      }
    } else {
      metadata['response_format'] = String(responseFormat);
    }
  }

  // tools - store definitions for span; add summary to metadata
  const tools = request.tools as unknown[] | undefined;
  let toolsForSpan: Record<string, unknown>[] | undefined;
  if (Array.isArray(tools) && tools.length > 0) {
    toolsForSpan = tools.map((t) =>
      typeof t === 'object' && t !== null
        ? (t as Record<string, unknown>)
        : { raw: t }
    );
    metadata['tools_count'] = String(tools.length);
  }

  // Responses API parameters (extensible)
  const input = request.input;
  if (input !== undefined && input !== null) {
    metadata['input_type'] = Array.isArray(input) ? 'array' : 'string';
  }
  const instructions = request.instructions;
  if (
    instructions !== undefined &&
    instructions !== null &&
    typeof instructions === 'string'
  ) {
    metadata['instructions_length'] = String(instructions.length);
  }
  const store = request.store;
  if (store !== undefined && store !== null) {
    metadata['store'] = String(store);
  }

  // Predicted Outputs
  const prediction = request.prediction;
  if (prediction !== undefined && prediction !== null) {
    metadata['prediction_type'] =
      typeof prediction === 'object' &&
      prediction !== null &&
      'type' in prediction
        ? String((prediction as { type?: unknown }).type)
        : 'unknown';
  }

  // Strict mode on function tools (Structured Outputs)
  if (Array.isArray(tools)) {
    const hasStrict = tools.some(
      (t) =>
        typeof t === 'object' &&
        t !== null &&
        (t as { function?: { strict?: boolean } }).function?.strict === true
    );
    if (hasStrict) metadata['tools_include_strict'] = 'true';
  }

  return { metadata, tools: toolsForSpan } as ExtractedParameters;
}
