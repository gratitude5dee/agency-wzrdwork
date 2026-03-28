/**
 * Test-environment constants for proxy URL assertions.
 *
 * The Vitest config defines `import.meta.env.VITE_SUPABASE_URL` as this URL
 * so that proxy-based clients (Venice, Uniswap, Bankr) generate well-formed
 * edge-function URLs in tests instead of "undefined/functions/v1/…".
 */
export const TEST_SUPABASE_URL = "https://test-project.supabase.co";

/** Expected base URL for the Venice proxy edge function in tests */
export const TEST_VENICE_PROXY_URL = `${TEST_SUPABASE_URL}/functions/v1/venice-proxy`;

/** Expected base URL for the Uniswap proxy edge function in tests */
export const TEST_UNISWAP_PROXY_URL = `${TEST_SUPABASE_URL}/functions/v1/uniswap-proxy`;

/** Expected base URL for the Bankr proxy edge function in tests */
export const TEST_BANKR_PROXY_URL = `${TEST_SUPABASE_URL}/functions/v1/bankr-proxy`;
