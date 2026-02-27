/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * A lightweight subtype of CustomSpanData that carries a reference to a
 * pre-configured GalileoSpan so it can be injected into the agent tracing flow.
 *
 * The __galileoCustom flag is used by mapSpanType() to distinguish this from
 * ordinary CustomSpanData objects.
 */
export interface GalileoCustomSpanData {
  /** Always 'custom' to satisfy the SDK's SpanData union discriminant. */
  type: 'custom';
  /** (Optional) Display name for the span. */
  name?: string;
  /** Arbitrary data payload, must contain a 'galileoSpan' key with the GalileoSpan reference. */
  data: Record<string, unknown> & { galileoSpan: unknown };
  /** Sentinel flag used internally by mapSpanType() to identify this type. */
  __galileoCustom: true;
}

/**
 * Creates a GalileoCustomSpanData object that wraps an existing Galileo span.
 * @param galileoSpan - The Galileo span object to embed.
 * @param name - (Optional) Display name for the span.
 * @param extraData - (Optional) Additional data to include in the span data payload.
 * @returns A GalileoCustomSpanData object.
 */
export function createGalileoCustomSpanData(
  galileoSpan: unknown,
  name?: string,
  extraData?: Record<string, unknown>
): GalileoCustomSpanData {
  return {
    type: 'custom',
    name,
    data: {
      ...extraData,
      galileoSpan
    },
    __galileoCustom: true
  };
}

/**
 * Type guard that checks whether a span data object is a GalileoCustomSpanData.
 * @param spanData - The span data to check.
 * @returns True if the span data is a GalileoCustomSpanData.
 */
export function isGalileoCustomSpanData(
  spanData: unknown
): spanData is GalileoCustomSpanData {
  return (
    typeof spanData === 'object' &&
    spanData !== null &&
    (spanData as any).__galileoCustom === true
  );
}
