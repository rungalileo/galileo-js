/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Normalised token count structure returned by parseUsage.
 */
export interface ParsedUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number | null;
  reasoningTokens: number;
  cachedTokens: number;
}

/**
 * Normalises token counts from various OpenAI usage shapes.
 * @param usageData - The raw usage data from a span.
 * @returns Normalised token counts.
 */
export function parseUsage(
  usageData: Record<string, unknown> | null | undefined
): ParsedUsage {
  if (!usageData) {
    return {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: null,
      reasoningTokens: 0,
      cachedTokens: 0
    };
  }

  // Support both input_tokens/output_tokens (Responses/Agents SDK)
  // and prompt_tokens/completion_tokens (Chat Completions legacy)
  const inputTokens =
    (usageData.input_tokens as number | undefined) ??
    (usageData.prompt_tokens as number | undefined) ??
    0;
  const outputTokens =
    (usageData.output_tokens as number | undefined) ??
    (usageData.completion_tokens as number | undefined) ??
    0;
  const totalTokens = (usageData.total_tokens as number | undefined) ?? null;

  // details is a flat Record<string, unknown> in the Agents SDK
  const details = (usageData.details as Record<string, unknown>) ?? {};
  const reasoningTokens =
    (details.reasoning_tokens as number | undefined) ??
    (usageData.reasoning_tokens as number | undefined) ??
    0;
  const cachedTokens =
    (details.cached_tokens as number | undefined) ??
    (usageData.cached_tokens as number | undefined) ??
    0;

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    reasoningTokens,
    cachedTokens
  };
}

/**
 * Extracts LLM-relevant fields from a GenerationSpanData or ResponseSpanData.
 * @param spanData - The span data object (must have type 'generation' or 'response').
 * @returns A flat record of LLM span parameters.
 */
export function extractLlmData(
  spanData: Record<string, unknown>
): Record<string, unknown> {
  if (spanData.type === 'generation') {
    const usage = parseUsage(
      (spanData.usage as Record<string, unknown> | undefined) ?? null
    );
    const modelConfig =
      (spanData.model_config as Record<string, unknown> | undefined) ?? {};

    return {
      input: spanData.input !== undefined ? JSON.stringify(spanData.input) : '',
      output:
        spanData.output !== undefined ? JSON.stringify(spanData.output) : '',
      model: (spanData.model as string | undefined) ?? 'unknown',
      temperature: (modelConfig.temperature as number | undefined) ?? undefined,
      modelParameters: modelConfig,
      numInputTokens: usage.inputTokens,
      numOutputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens ?? undefined,
      numReasoningTokens: usage.reasoningTokens,
      numCachedInputTokens: usage.cachedTokens,
      metadata: {
        gen_ai_system: 'openai',
        model_config: JSON.stringify(modelConfig)
      }
    };
  }

  if (spanData.type === 'response') {
    // ResponseSpanData uses underscore-prefixed fields in TypeScript SDK
    const input = spanData._input ?? spanData.input;
    const response = (spanData._response ?? spanData.response) as
      | Record<string, unknown>
      | undefined;

    const model =
      (response?.model as string | undefined) ??
      (spanData.model as string | undefined) ??
      'unknown';
    const usage = parseUsage(
      (response?.usage as Record<string, unknown> | undefined) ?? null
    );
    const temperature =
      (response?.temperature as number | undefined) ?? undefined;
    const tools = response?.tools;

    return {
      input: input !== undefined ? JSON.stringify(input) : '',
      output:
        response?.output !== undefined ? JSON.stringify(response.output) : '',
      model,
      temperature,
      tools: tools !== undefined ? JSON.stringify(tools) : undefined,
      numInputTokens: usage.inputTokens,
      numOutputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens ?? undefined,
      numReasoningTokens: usage.reasoningTokens,
      numCachedInputTokens: usage.cachedTokens,
      metadata: {
        gen_ai_system: 'openai'
      },
      _responseObject: response
    };
  }

  return {};
}

/**
 * Extracts tool-relevant fields from a FunctionSpanData or GuardrailSpanData.
 * @param spanData - The span data object (must have type 'function' or 'guardrail').
 * @returns A flat record of tool span parameters.
 */
export function extractToolData(
  spanData: Record<string, unknown>
): Record<string, unknown> {
  if (spanData.type === 'function') {
    return {
      input:
        spanData.input !== undefined
          ? typeof spanData.input === 'string'
            ? spanData.input
            : JSON.stringify(spanData.input)
          : '',
      output:
        spanData.output !== undefined
          ? typeof spanData.output === 'string'
            ? spanData.output
            : JSON.stringify(spanData.output)
          : undefined,
      metadata:
        (spanData.mcp_data as Record<string, unknown> | undefined) !== undefined
          ? { mcp_data: JSON.stringify(spanData.mcp_data) }
          : {}
    };
  }

  if (spanData.type === 'guardrail') {
    const triggered = Boolean(spanData.triggered);
    return {
      input: '',
      output: triggered ? 'Guardrail triggered' : 'Guardrail passed',
      metadata: {
        triggered: String(triggered),
        guardrail_name: String((spanData.name as string | undefined) ?? '')
      }
    };
  }

  // Transcription / Speech / speech_group / mcp_tools — map to tool but no deep extraction
  return {
    input: '',
    output: undefined,
    metadata: {}
  };
}

/**
 * Extracts workflow-relevant fields from an AgentSpanData, HandoffSpanData, or CustomSpanData.
 * @param spanData - The span data object (must have type 'agent', 'handoff', or 'custom').
 * @returns A flat record of workflow span parameters.
 */
export function extractWorkflowData(
  spanData: Record<string, unknown>
): Record<string, unknown> {
  if (spanData.type === 'agent') {
    const tools = spanData.tools;
    const handoffs = spanData.handoffs;
    const outputType = spanData.output_type;
    return {
      input: '',
      output: undefined,
      metadata: {
        ...(tools !== undefined ? { tools: JSON.stringify(tools) } : {}),
        ...(handoffs !== undefined
          ? { handoffs: JSON.stringify(handoffs) }
          : {}),
        ...(outputType !== undefined
          ? { output_type: JSON.stringify(outputType) }
          : {})
      }
    };
  }

  if (spanData.type === 'handoff') {
    const from = String((spanData.from_agent as string | undefined) ?? '');
    const to = String((spanData.to_agent as string | undefined) ?? '');
    return {
      input: from,
      output: to,
      metadata: {
        from_agent: from,
        to_agent: to
      }
    };
  }

  if (spanData.type === 'custom') {
    const data = (spanData.data as Record<string, unknown> | undefined) ?? {};
    const input =
      data.input !== undefined
        ? typeof data.input === 'string'
          ? data.input
          : JSON.stringify(data.input)
        : '';
    const output =
      data.output !== undefined
        ? typeof data.output === 'string'
          ? data.output
          : JSON.stringify(data.output)
        : undefined;

    // Everything except input/output goes to metadata
    const metaEntries = Object.entries(data)
      .filter(([k]) => k !== 'input' && k !== 'output')
      .reduce<Record<string, string>>((acc, [k, v]) => {
        acc[k] = typeof v === 'string' ? v : JSON.stringify(v);
        return acc;
      }, {});

    return { input, output, metadata: metaEntries };
  }

  return { input: '', output: undefined, metadata: {} };
}
