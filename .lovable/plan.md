

## Plan: Add missing CONTROL_PLANE_ENCRYPTION_KEY secret

### Current state
All 6 runtime API keys are already set:
- VENICE_API_KEY, OPENROUTER_API_KEY, UNISWAP_API_KEY, BANKR_API_KEY, VITE_THIRDWEB_CLIENT_ID, LOVABLE_API_KEY

The 3 Supabase built-in secrets (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY) are auto-available in edge functions.

Composio API keys are stored per-company in the `integrations` table via the app UI, not as Supabase secrets — so that's handled through the Integrations page.

### Only missing secret
**CONTROL_PLANE_ENCRYPTION_KEY** — needed by the `adapter-secrets` edge function to encrypt/decrypt agent secrets at rest. Must be a 32-byte key encoded as base64.

### Action
1. Generate a cryptographically random 32-byte key via a script, encode as base64.
2. Add it as a Supabase secret using the secrets tool.

### Result
After this, every edge function will have all required secrets and the app will work out of the box for demo purposes. No code changes needed.

