import {
  type GalileoAPIStandardErrorData,
  GalileoAPIError,
  isGalileoAPIStandardErrorData
} from '../../src/types/errors.types';

/**
 * Catalog-aligned with Orbit 1006 "Resource not found" (error_catalog/errors.yaml).
 * Represents "dataset not found" via 1006 with overridden message.
 */
const EXAMPLE_STANDARD_ERROR_FULL: GalileoAPIStandardErrorData = {
  error_code: 1006,
  error_type: 'not_found_error',
  error_group: 'shared',
  severity: 'medium',
  message: 'Dataset with the given id was not found.',
  user_action: 'Verify the identifier and try again.',
  documentation_link: null,
  retriable: false,
  blocking: true,
  http_status_code: 404,
  source_service: 'api',
  context: { dataset_id: 'ds-123' }
};

/**
 * Catalog-aligned minimal: Orbit 1006 required fields only (no optional fields).
 */
const EXAMPLE_STANDARD_ERROR_MINIMAL: GalileoAPIStandardErrorData = {
  error_code: 1006,
  error_type: 'not_found_error',
  error_group: 'shared',
  severity: 'medium',
  message: 'The requested resource could not be found.',
  retriable: false,
  blocking: false
};

describe('GalileoAPIError', () => {
  test('test GalileoAPIError is instanceof Error', () => {
    const err = new GalileoAPIError(EXAMPLE_STANDARD_ERROR_FULL);
    expect(err).toBeInstanceOf(Error);
  });

  test('test GalileoAPIError construction with full standard_error data', () => {
    const err = new GalileoAPIError(EXAMPLE_STANDARD_ERROR_FULL);

    expect(err.name).toBe('GalileoAPIError');
    expect(err.message).toBe(EXAMPLE_STANDARD_ERROR_FULL.message);
    expect(err.errorCode).toBe(EXAMPLE_STANDARD_ERROR_FULL.error_code);
    expect(err.errorType).toBe(EXAMPLE_STANDARD_ERROR_FULL.error_type);
    expect(err.errorGroup).toBe(EXAMPLE_STANDARD_ERROR_FULL.error_group);
    expect(err.severity).toBe(EXAMPLE_STANDARD_ERROR_FULL.severity);
    expect(err.userAction).toBe(EXAMPLE_STANDARD_ERROR_FULL.user_action);
    expect(err.documentationLink).toBe(
      EXAMPLE_STANDARD_ERROR_FULL.documentation_link
    );
    expect(err.retriable).toBe(EXAMPLE_STANDARD_ERROR_FULL.retriable);
    expect(err.blocking).toBe(EXAMPLE_STANDARD_ERROR_FULL.blocking);
    expect(err.httpStatusCode).toBe(
      EXAMPLE_STANDARD_ERROR_FULL.http_status_code
    );
    expect(err.sourceService).toBe(EXAMPLE_STANDARD_ERROR_FULL.source_service);
    expect(err.context).toEqual(EXAMPLE_STANDARD_ERROR_FULL.context);
  });

  test('test GalileoAPIError construction with minimal required fields', () => {
    const err = new GalileoAPIError(EXAMPLE_STANDARD_ERROR_MINIMAL);

    expect(err.name).toBe('GalileoAPIError');
    expect(err.message).toBe(EXAMPLE_STANDARD_ERROR_MINIMAL.message);
    expect(err.errorCode).toBe(EXAMPLE_STANDARD_ERROR_MINIMAL.error_code);
    expect(err.errorType).toBe(EXAMPLE_STANDARD_ERROR_MINIMAL.error_type);
    expect(err.errorGroup).toBe(EXAMPLE_STANDARD_ERROR_MINIMAL.error_group);
    expect(err.severity).toBe(EXAMPLE_STANDARD_ERROR_MINIMAL.severity);
    expect(err.retriable).toBe(EXAMPLE_STANDARD_ERROR_MINIMAL.retriable);
    expect(err.blocking).toBe(EXAMPLE_STANDARD_ERROR_MINIMAL.blocking);

    expect(err.userAction).toBeUndefined();
    expect(err.documentationLink).toBeNull();
    expect(err.httpStatusCode).toBeUndefined();
    expect(err.sourceService).toBeNull();
    expect(err.context).toBeNull();
  });

  test('test GalileoAPIError toJSON includes all properties and stack', () => {
    const err = new GalileoAPIError(EXAMPLE_STANDARD_ERROR_FULL);
    const json = err.toJSON();

    expect(json.name).toBe('GalileoAPIError');
    expect(json.message).toBe(EXAMPLE_STANDARD_ERROR_FULL.message);
    expect(json.errorCode).toBe(EXAMPLE_STANDARD_ERROR_FULL.error_code);
    expect(json.errorType).toBe(EXAMPLE_STANDARD_ERROR_FULL.error_type);
    expect(json.errorGroup).toBe(EXAMPLE_STANDARD_ERROR_FULL.error_group);
    expect(json.severity).toBe(EXAMPLE_STANDARD_ERROR_FULL.severity);
    expect(json.userAction).toBe(EXAMPLE_STANDARD_ERROR_FULL.user_action);
    expect(json.documentationLink).toBe(
      EXAMPLE_STANDARD_ERROR_FULL.documentation_link
    );
    expect(json.retriable).toBe(EXAMPLE_STANDARD_ERROR_FULL.retriable);
    expect(json.blocking).toBe(EXAMPLE_STANDARD_ERROR_FULL.blocking);
    expect(json.httpStatusCode).toBe(
      EXAMPLE_STANDARD_ERROR_FULL.http_status_code
    );
    expect(json.sourceService).toBe(EXAMPLE_STANDARD_ERROR_FULL.source_service);
    expect(json.context).toEqual(EXAMPLE_STANDARD_ERROR_FULL.context);
    expect(json.stack).toBe(err.stack);
  });

  test('test GalileoAPIError toJSON with optional fields omitted', () => {
    const err = new GalileoAPIError(EXAMPLE_STANDARD_ERROR_MINIMAL);
    const json = err.toJSON();

    expect(json.name).toBe('GalileoAPIError');
    expect(json.message).toBe(EXAMPLE_STANDARD_ERROR_MINIMAL.message);
    expect(json.errorCode).toBe(EXAMPLE_STANDARD_ERROR_MINIMAL.error_code);
    expect(json.userAction).toBeUndefined();
    expect(json.documentationLink).toBeNull();
    expect(json.httpStatusCode).toBeUndefined();
    expect(json.sourceService).toBeNull();
    expect(json.context).toBeNull();
    expect(json.stack).toBe(err.stack);
  });
});

describe('isGalileoAPIStandardErrorData', () => {
  test('test isGalileoAPIStandardErrorData returns true for valid full object', () => {
    expect(isGalileoAPIStandardErrorData(EXAMPLE_STANDARD_ERROR_FULL)).toBe(
      true
    );
  });

  test('test isGalileoAPIStandardErrorData returns true for valid minimal object', () => {
    expect(isGalileoAPIStandardErrorData(EXAMPLE_STANDARD_ERROR_MINIMAL)).toBe(
      true
    );
  });

  test('test isGalileoAPIStandardErrorData returns false for null and undefined', () => {
    expect(isGalileoAPIStandardErrorData(null)).toBe(false);
    expect(isGalileoAPIStandardErrorData(undefined)).toBe(false);
  });

  test('test isGalileoAPIStandardErrorData returns false for non-objects', () => {
    expect(isGalileoAPIStandardErrorData('string')).toBe(false);
    expect(isGalileoAPIStandardErrorData(123)).toBe(false);
    expect(isGalileoAPIStandardErrorData(true)).toBe(false);
  });

  test('test isGalileoAPIStandardErrorData returns false when required field error_code is missing', () => {
    const { error_code: _k, ...rest } = EXAMPLE_STANDARD_ERROR_FULL;
    void _k;
    expect(isGalileoAPIStandardErrorData(rest)).toBe(false);
  });

  test('test isGalileoAPIStandardErrorData returns false when required field error_code has wrong type', () => {
    expect(
      isGalileoAPIStandardErrorData({
        ...EXAMPLE_STANDARD_ERROR_MINIMAL,
        error_code: '1006'
      })
    ).toBe(false);
  });

  test('test isGalileoAPIStandardErrorData returns false when required field retriable has wrong type', () => {
    expect(
      isGalileoAPIStandardErrorData({
        ...EXAMPLE_STANDARD_ERROR_MINIMAL,
        retriable: 'true'
      })
    ).toBe(false);
  });

  test('test isGalileoAPIStandardErrorData returns false when user_action is non-string', () => {
    expect(
      isGalileoAPIStandardErrorData({
        ...EXAMPLE_STANDARD_ERROR_MINIMAL,
        user_action: 1
      })
    ).toBe(false);
  });

  test('test isGalileoAPIStandardErrorData returns false when context is array', () => {
    expect(
      isGalileoAPIStandardErrorData({
        ...EXAMPLE_STANDARD_ERROR_MINIMAL,
        context: []
      })
    ).toBe(false);
    expect(
      isGalileoAPIStandardErrorData({
        ...EXAMPLE_STANDARD_ERROR_MINIMAL,
        context: [1, 2]
      })
    ).toBe(false);
  });

  test('test isGalileoAPIStandardErrorData returns false for empty object', () => {
    expect(isGalileoAPIStandardErrorData({})).toBe(false);
  });

  test('test isGalileoAPIStandardErrorData returns false when error_type is number', () => {
    expect(
      isGalileoAPIStandardErrorData({
        ...EXAMPLE_STANDARD_ERROR_MINIMAL,
        error_type: 1
      })
    ).toBe(false);
  });

  test('test isGalileoAPIStandardErrorData returns false when message is number', () => {
    expect(
      isGalileoAPIStandardErrorData({
        ...EXAMPLE_STANDARD_ERROR_MINIMAL,
        message: 1
      })
    ).toBe(false);
  });

  test('test isGalileoAPIStandardErrorData returns false when documentation_link is number', () => {
    expect(
      isGalileoAPIStandardErrorData({
        ...EXAMPLE_STANDARD_ERROR_MINIMAL,
        documentation_link: 1
      })
    ).toBe(false);
  });

  test('test isGalileoAPIStandardErrorData returns false when http_status_code is string', () => {
    expect(
      isGalileoAPIStandardErrorData({
        ...EXAMPLE_STANDARD_ERROR_MINIMAL,
        http_status_code: '404'
      })
    ).toBe(false);
  });

  test('test isGalileoAPIStandardErrorData returns true when object has extra unknown properties', () => {
    expect(
      isGalileoAPIStandardErrorData({
        ...EXAMPLE_STANDARD_ERROR_MINIMAL,
        extra: 'x',
        foo: 1
      })
    ).toBe(true);
  });

  test('test isGalileoAPIStandardErrorData returns true when optional fields are null or undefined', () => {
    expect(
      isGalileoAPIStandardErrorData({
        ...EXAMPLE_STANDARD_ERROR_MINIMAL,
        user_action: undefined
      })
    ).toBe(true);
    expect(
      isGalileoAPIStandardErrorData({
        ...EXAMPLE_STANDARD_ERROR_MINIMAL,
        user_action: null
      })
    ).toBe(true);
    expect(
      isGalileoAPIStandardErrorData({
        ...EXAMPLE_STANDARD_ERROR_MINIMAL,
        documentation_link: null
      })
    ).toBe(true);
    expect(
      isGalileoAPIStandardErrorData({
        ...EXAMPLE_STANDARD_ERROR_MINIMAL,
        context: null
      })
    ).toBe(true);
  });
});
