/**
 * SSO provider types supported by the API
 * Matches the AuthMethod enum from API types
 */
export type SSOProvider = 'okta' | 'google' | 'github' | 'azure-ad' | 'custom';
export const SSOProviders: SSOProvider[] = [
  'okta',
  'google',
  'github',
  'azure-ad',
  'custom'
];

/**
 * SSO login response
 */
export interface AccessTokenResponse {
  access_token: string;
}
