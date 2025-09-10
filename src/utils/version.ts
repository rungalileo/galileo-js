import packageJson from '../../package.json';

/**
 * Gets the current package version from package.json
 * @returns The version string (e.g., "1.26.0")
 */
export function getPackageVersion(): string {
  return packageJson.version;
}

/**
 * Gets the SDK identifier string for telemetry headers
 * @returns The SDK identifier (e.g., "galileo-js/1.26.0")
 */
export function getSdkIdentifier(): string {
  return `galileo-js/${getPackageVersion()}`;
}
