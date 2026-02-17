/**
 * Parses OpenAI usage data into a standardized structure.
 * Supports Chat Completions API (prompt_tokens/completion_tokens) and
 * Responses API (input_tokens/output_tokens) plus detailed breakdowns
 * (reasoning_tokens, cached_tokens) for o1/o3/o4 models.
 */

export interface ParsedUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number | null;
  reasoningTokens: number;
  cachedTokens: number;
  rejectedPredictionTokens: number;
}

/**
 * Safely parse usage data from OpenAI responses.
 * Handles both legacy (prompt_tokens/completion_tokens) and modern
 * (input_tokens/output_tokens) formats, plus input_tokens_details and
 * output_tokens_details for reasoning and cached tokens.
 */
export function parseUsage(usageData: unknown): ParsedUsage {
  const result: ParsedUsage = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: null,
    reasoningTokens: 0,
    cachedTokens: 0,
    rejectedPredictionTokens: 0
  };

  if (usageData == null) {
    return result;
  }

  let usage: Record<string, unknown>;
  if (typeof usageData === 'object' && usageData !== null) {
    if (
      'model_dump' in usageData &&
      typeof (usageData as { model_dump?: () => Record<string, unknown> })
        .model_dump === 'function'
    ) {
      try {
        usage = (
          usageData as { model_dump: () => Record<string, unknown> }
        ).model_dump();
      } catch {
        usage = usageData as Record<string, unknown>;
      }
    } else {
      usage = usageData as Record<string, unknown>;
    }
  } else {
    return result;
  }

  // Input/output tokens (support both naming conventions)
  const inputRaw = usage.input_tokens ?? usage.prompt_tokens;
  const outputRaw = usage.output_tokens ?? usage.completion_tokens;
  result.inputTokens = typeof inputRaw === 'number' ? inputRaw : 0;
  result.outputTokens = typeof outputRaw === 'number' ? outputRaw : 0;

  // Total tokens
  const totalRaw = usage.total_tokens;
  if (typeof totalRaw === 'number') {
    result.totalTokens = totalRaw;
  } else if (result.inputTokens > 0 || result.outputTokens > 0) {
    result.totalTokens = result.inputTokens + result.outputTokens;
  }

  // Detailed token breakdowns (o1/o3/o4)
  // Responses API: input_tokens_details / output_tokens_details
  // Chat Completions: prompt_tokens_details / completion_tokens_details
  const inputDetails =
    usage.input_tokens_details ?? usage.prompt_tokens_details;
  if (inputDetails != null && typeof inputDetails === 'object') {
    const details = inputDetails as Record<string, unknown>;
    const cached = details.cached_tokens;
    if (typeof cached === 'number') {
      result.cachedTokens = cached;
    }
  }

  const outputDetails =
    usage.output_tokens_details ?? usage.completion_tokens_details;
  if (outputDetails != null && typeof outputDetails === 'object') {
    const details = outputDetails as Record<string, unknown>;
    const reasoning = details.reasoning_tokens;
    if (typeof reasoning === 'number') {
      result.reasoningTokens = reasoning;
    }
  }

  // Some APIs return reasoning_tokens/cached_tokens at top level
  if (
    result.reasoningTokens === 0 &&
    typeof usage.reasoning_tokens === 'number'
  ) {
    result.reasoningTokens = usage.reasoning_tokens;
  }
  if (result.cachedTokens === 0 && typeof usage.cached_tokens === 'number') {
    result.cachedTokens = usage.cached_tokens;
  }

  // Predicted Outputs - rejected_prediction_tokens (in output_tokens_details, completion_tokens_details, or top-level)
  const outDetails = (usage.output_tokens_details ??
    usage.completion_tokens_details) as Record<string, unknown> | undefined;
  if (outDetails && typeof outDetails.rejected_prediction_tokens === 'number') {
    result.rejectedPredictionTokens = outDetails.rejected_prediction_tokens;
  } else if (typeof usage.rejected_prediction_tokens === 'number') {
    result.rejectedPredictionTokens = usage.rejected_prediction_tokens;
  }

  return result;
}
