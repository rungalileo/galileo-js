/**
 * Extracts request parameters from OpenAI Chat Completions / Responses API requests
 * for span metadata and observability. Designed to support both APIs and be
 * extensible for future parameters.
 */

export interface ExtractedParameters {
  /** Merged with request metadata; all values stringified for Galileo metadata */
  metadata: Record<string, string>;
  /** Raw tools definitions for span tools field (if present) */
  tools?: Record<string, unknown>[];
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

  // Scalars
  const scalars = [
    'max_tokens',
    'top_p',
    'frequency_penalty',
    'presence_penalty',
    'seed',
    'n',
    'temperature'
  ] as const;
  for (const key of scalars) {
    const v = request[key];
    if (v !== undefined && v !== null) {
      metadata[key] = String(v);
    }
  }

  // Reasoning (o1/o3/o4) – Python parity: keys reasoning_effort, reasoning_verbosity, reasoning_generate_summary
  // Chat Completions: top-level reasoning_effort (e.g. { model: 'o3', reasoning_effort: 'high' })
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

  // response_format - format for UI: simple type-only → short label; complex → pretty-printed JSON
  const responseFormat = request.response_format;
  if (responseFormat !== undefined && responseFormat !== null) {
    if (typeof responseFormat === 'object' && responseFormat !== null) {
      const rf = responseFormat as Record<string, unknown>;
      const keys = Object.keys(rf);
      // Simple shape { type: 'json_object' } or { type: 'text' } → show type value for cleaner UI
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

  return { metadata, tools: toolsForSpan };
}

/**
 * Merge extracted parameters with request metadata. Request metadata takes precedence
 * for overlapping keys; extracted params fill in missing keys.
 */
export function mergeWithRequestMetadata(
  extracted: ExtractedParameters,
  requestMetadata?: Record<string, unknown> | null
): Record<string, string> {
  const result: Record<string, string> = { ...extracted.metadata };
  if (requestMetadata && typeof requestMetadata === 'object') {
    for (const [k, v] of Object.entries(requestMetadata)) {
      if (v !== undefined && v !== null) {
        result[k] = typeof v === 'string' ? v : JSON.stringify(v);
      }
    }
  }
  return result;
}
