import { getPackageVersion, getSdkIdentifier } from '../../src/utils/version';

describe('Version Utility', () => {
  it('should return SDK identifier with correct format', () => {
    const identifier = getSdkIdentifier();

    expect(identifier).toBeDefined();
    expect(typeof identifier).toBe('string');
    expect(identifier).toMatch(/^galileo-js\/\d+\.\d+\.\d+/);
    expect(identifier.startsWith('galileo-js/')).toBe(true);
  });

  it('should include package version in SDK identifier', () => {
    const version = getPackageVersion();
    const identifier = getSdkIdentifier();

    expect(identifier).toBe(`galileo-js/${version}`);
  });
});
