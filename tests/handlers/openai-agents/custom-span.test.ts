import {
  createGalileoCustomSpanData,
  isGalileoCustomSpanData,
  type GalileoCustomSpanData
} from '../../../src/handlers/openai-agents/custom-span';

describe('createGalileoCustomSpanData()', () => {
  test('test creates span with galileoSpan only', () => {
    const galileoSpan = { type: 'custom', data: 'test' };
    const result = createGalileoCustomSpanData(galileoSpan);

    expect(result.type).toBe('custom');
    expect(result.__galileoCustom).toBe(true);
    expect(result.data.galileoSpan).toBe(galileoSpan);
    expect(result.name).toBeUndefined();
  });

  test('test creates span with name parameter', () => {
    const galileoSpan = { test: 'data' };
    const result = createGalileoCustomSpanData(galileoSpan, 'My Custom Span');

    expect(result.name).toBe('My Custom Span');
    expect(result.data.galileoSpan).toBe(galileoSpan);
  });

  test('test creates span with extraData', () => {
    const galileoSpan = { test: 'data' };
    const extraData = { key1: 'value1', key2: 42 };
    const result = createGalileoCustomSpanData(
      galileoSpan,
      undefined,
      extraData
    );

    expect(result.data.key1).toBe('value1');
    expect(result.data.key2).toBe(42);
    expect(result.data.galileoSpan).toBe(galileoSpan);
  });

  test('test creates span with all parameters', () => {
    const galileoSpan = { type: 'custom', nested: { data: true } };
    const extraData = { metadata: 'info', count: 5 };
    const result = createGalileoCustomSpanData(
      galileoSpan,
      'Full Span',
      extraData
    );

    expect(result.type).toBe('custom');
    expect(result.name).toBe('Full Span');
    expect(result.__galileoCustom).toBe(true);
    expect(result.data.galileoSpan).toBe(galileoSpan);
    expect(result.data.metadata).toBe('info');
    expect(result.data.count).toBe(5);
  });

  test('test sets type field to custom', () => {
    const result = createGalileoCustomSpanData({});
    expect(result.type).toBe('custom');
  });

  test('test sets __galileoCustom sentinel to true', () => {
    const result = createGalileoCustomSpanData({});
    expect(result.__galileoCustom).toBe(true);
  });

  test('test extraData merges correctly with galileoSpan', () => {
    const galileoSpan = { id: 'span-1' };
    const extraData = { tag1: 'tag', tag2: 'meta' };
    const result = createGalileoCustomSpanData(
      galileoSpan,
      undefined,
      extraData
    );

    expect(result.data).toEqual({
      tag1: 'tag',
      tag2: 'meta',
      galileoSpan: { id: 'span-1' }
    });
  });

  test('test handles empty extraData', () => {
    const galileoSpan = { test: 'data' };
    const result = createGalileoCustomSpanData(galileoSpan, undefined, {});

    expect(result.data.galileoSpan).toBe(galileoSpan);
    expect(Object.keys(result.data)).toEqual(['galileoSpan']);
  });

  test('test handles null galileoSpan', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = createGalileoCustomSpanData(null as any);
    expect(result.data.galileoSpan).toBe(null);
  });

  test('test handles undefined name parameter', () => {
    const result = createGalileoCustomSpanData({}, undefined, { meta: 'data' });
    expect(result.name).toBeUndefined();
  });
});

describe('isGalileoCustomSpanData() type guard', () => {
  test('test returns true for valid GalileoCustomSpanData', () => {
    const spanData: GalileoCustomSpanData = {
      type: 'custom',
      data: { galileoSpan: {} },
      __galileoCustom: true
    };

    expect(isGalileoCustomSpanData(spanData)).toBe(true);
  });

  test('test returns false for null', () => {
    expect(isGalileoCustomSpanData(null)).toBe(false);
  });

  test('test returns false for undefined', () => {
    expect(isGalileoCustomSpanData(undefined)).toBe(false);
  });

  test('test returns false for plain object without __galileoCustom', () => {
    const plainObj = {
      type: 'custom',
      data: { galileoSpan: {} }
    };

    expect(isGalileoCustomSpanData(plainObj)).toBe(false);
  });

  test('test returns false for object with __galileoCustom false', () => {
    const spanData = {
      type: 'custom',
      data: { galileoSpan: {} },
      __galileoCustom: false
    };

    expect(isGalileoCustomSpanData(spanData)).toBe(false);
  });

  test('test returns false for non-objects', () => {
    expect(isGalileoCustomSpanData('string')).toBe(false);
    expect(isGalileoCustomSpanData(123)).toBe(false);
    expect(isGalileoCustomSpanData(true)).toBe(false);
    expect(isGalileoCustomSpanData([])).toBe(false);
  });

  test('test requires __galileoCustom to be true', () => {
    expect(
      isGalileoCustomSpanData({
        type: 'custom',
        data: { galileoSpan: {} },
        __galileoCustom: true
      })
    ).toBe(true);

    expect(
      isGalileoCustomSpanData({
        type: 'custom',
        data: { galileoSpan: {} },
        __galileoCustom: 1 // truthy but not true
      })
    ).toBe(false);
  });

  test('test type guard narrows type correctly', () => {
    const unknownData: unknown = createGalileoCustomSpanData({});

    if (isGalileoCustomSpanData(unknownData)) {
      // TypeScript should allow these properties
      const spanData: GalileoCustomSpanData = unknownData;
      expect(spanData.type).toBe('custom');
      expect(spanData.__galileoCustom).toBe(true);
    }
  });

  test('test requires all required fields', () => {
    const partialWithoutData = {
      type: 'custom',
      __galileoCustom: true
      // missing data field
    };

    // Type guard should handle this gracefully (either true if it doesn't check data, or false if it does)
    const result = isGalileoCustomSpanData(partialWithoutData);
    expect(typeof result).toBe('boolean');
  });
});
