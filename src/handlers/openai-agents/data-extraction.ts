import type { GalileoSpanLike } from './custom-span';
import type { NodeType } from './node';

const MODEL_PARAM_KEYS = [
  'temperature',
  'max_output_tokens',
  'top_p',
  'tool_choice',
  'parallel_tool_calls',
  'truncation',
  'seed',
  'frequency_penalty',
  'presence_penalty'
];

const RESPONSE_EXCLUDE = new Set([
  'input',
  'output',
  'usage',
  'tools',
  'error',
  'status'
]);

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

  // Reasoning tokens live in output_tokens_details (Responses API) or details (legacy Agents SDK shape)
  const outputDetails =
    (usageData.output_tokens_details as Record<string, unknown> | undefined) ??
    (usageData.details as Record<string, unknown> | undefined) ??
    {};
  // Cached tokens live in input_tokens_details (Responses API) or the same details object
  const inputDetails =
    (usageData.input_tokens_details as Record<string, unknown> | undefined) ??
    outputDetails;
  const reasoningTokens =
    (outputDetails.reasoning_tokens as number | undefined) ??
    (usageData.reasoning_tokens as number | undefined) ??
    0;
  const cachedTokens =
    (inputDetails.cached_tokens as number | undefined) ??
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
 * Serialize a value to a string for LLM span input/output fields.
 * Strings are returned as-is; null/undefined produce ''; everything else is JSON-serialized.
 */
function llmSerializeToString(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
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
    const usageRaw =
      (spanData.usage as Record<string, unknown> | undefined) ?? {};
    const usage = parseUsage(usageRaw);
    const modelConfig =
      (spanData.model_config as Record<string, unknown> | undefined) ?? {};
    const inputDetails =
      (usageRaw.input_tokens_details as Record<string, unknown> | undefined) ??
      null;
    const outputDetails =
      (usageRaw.output_tokens_details as Record<string, unknown> | undefined) ??
      null;

    return {
      input: llmSerializeToString(spanData.input),
      output: llmSerializeToString(spanData.output),
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
        model_config: modelConfig,
        ...(inputDetails ? { input_tokens_details: inputDetails } : {}),
        ...(outputDetails ? { output_tokens_details: outputDetails } : {})
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

    const modelParameters: Record<string, unknown> = response
      ? Object.fromEntries(
          MODEL_PARAM_KEYS.filter((k) => response[k] !== undefined).map((k) => [
            k,
            response[k]
          ])
        )
      : {};

    const responseMetadata: Record<string, unknown> = response
      ? Object.fromEntries(
          Object.entries(response).filter(([k]) => !RESPONSE_EXCLUDE.has(k))
        )
      : {};

    return {
      input: llmSerializeToString(input),
      output: llmSerializeToString(response?.output),
      model,
      temperature,
      tools: tools !== undefined ? tools : undefined,
      modelParameters,
      numInputTokens: usage.inputTokens,
      numOutputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens ?? undefined,
      numReasoningTokens: usage.reasoningTokens,
      numCachedInputTokens: usage.cachedTokens,
      metadata: {
        gen_ai_system: 'openai',
        ...(Object.keys(responseMetadata).length > 0
          ? { response_metadata: responseMetadata }
          : {}),
        ...(response?.instructions !== undefined
          ? { instructions: response.instructions }
          : {})
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
      output: JSON.stringify({ triggered }),
      metadata: {
        triggered,
        ...(triggered ? { status: 'warning' } : {})
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
    const agentType =
      typeof spanData.agentType === 'string' ? spanData.agentType : undefined;
    return {
      input: '',
      output: undefined,
      ...(agentType !== undefined ? { agentType } : {}),
      metadata: {
        ...(tools !== undefined ? { tools } : {}),
        ...(handoffs !== undefined ? { handoffs } : {}),
        ...(outputType !== undefined ? { output_type: outputType } : {})
      }
    };
  }

  if (spanData.type === 'handoff') {
    const from = String((spanData.from_agent as string | undefined) ?? '');
    const to = String((spanData.to_agent as string | undefined) ?? '');
    return {
      input: from ? JSON.stringify({ from_agent: from }) : '',
      output: to ? JSON.stringify({ to_agent: to }) : undefined,
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

    // Everything except input/output goes to metadata; values are kept as-is
    const metaEntries = Object.entries(data)
      .filter(
        ([k, v]) =>
          k !== 'input' && k !== 'output' && v !== null && v !== undefined
      )
      .reduce<Record<string, unknown>>((acc, [k, v]) => {
        acc[k] = v;
        return acc;
      }, {});

    return { input, output, metadata: metaEntries };
  }

  return { input: '', output: undefined, metadata: {} };
}

const VALID_GALILEO_NODE_TYPES: readonly string[] = [
  'tool',
  'workflow',
  'agent'
];

/**
 * Extracts span parameters from a GalileoCustomSpanData, delegating to the
 * inner galileoSpan for input, output, metadata, tags, statusCode, and type.
 *
 * @param spanData - The span data object (must have __galileoCustom: true).
 * @returns The effective node type and extracted parameters.
 */
export function extractGalileoCustomData(spanData: Record<string, unknown>): {
  nodeType: NodeType;
  params: Record<string, unknown>;
} {
  const galileoSpan = spanData._galileoSpan as GalileoSpanLike | undefined;

  if (!galileoSpan || typeof galileoSpan !== 'object') {
    return { nodeType: 'workflow', params: extractWorkflowData(spanData) };
  }

  const input =
    galileoSpan.input !== undefined
      ? typeof galileoSpan.input === 'string'
        ? galileoSpan.input
        : JSON.stringify(galileoSpan.input)
      : '';
  const output =
    galileoSpan.output !== undefined
      ? typeof galileoSpan.output === 'string'
        ? galileoSpan.output
        : JSON.stringify(galileoSpan.output)
      : undefined;
  const metadata = galileoSpan.metadata ?? {};
  const tags = galileoSpan.tags;
  const statusCode = galileoSpan.statusCode;

  const nodeType: NodeType =
    typeof galileoSpan.type === 'string' &&
    VALID_GALILEO_NODE_TYPES.includes(galileoSpan.type)
      ? (galileoSpan.type as NodeType)
      : 'workflow';

  return {
    nodeType,
    params: {
      input,
      output,
      metadata,
      ...(tags !== undefined ? { tags } : {}),
      ...(statusCode !== undefined ? { statusCode } : {})
    }
  };
}
