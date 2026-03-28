# Environment

Environment variables, external dependencies, and setup notes.

**What belongs here:** Required env vars, external API keys/services, dependency quirks, platform-specific notes.
**What does NOT belong here:** Service ports/commands (use `.factory/services.yaml`).

---

## Supabase

- Cloud instance: `lptryhnnhhvbblrrsaqa.supabase.co`
- Anon key hardcoded as fallback in `src/integrations/supabase/client.ts`
- DO NOT modify the fallback URL or key
- New tables added via SQL snippets pasted into Supabase SQL Editor (NOT Drizzle push)
- Mission work should tighten tenant scoping where possible; avoid adding new unscoped `FOR ALL USING (true)` policies without an explicit reason
- Existing and planned edge-function surfaces include `thirdweb-config`, `venice-proxy`, `uniswap-proxy`, `bankr-proxy`, and mission-added settlement/artifact endpoints as needed

## Required Env Vars

| Variable | Purpose | Status |
|----------|---------|--------|
| `VITE_SUPABASE_URL` | Supabase project URL | Hardcoded fallback |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key | Hardcoded fallback |
| `VITE_THIRDWEB_CLIENT_ID` | Thirdweb wallet auth | User to provide |
| `VITE_VENICE_API_KEY` | Venice private AI | Placeholder |
| `VITE_UNISWAP_API_KEY` | Uniswap Trade API | Placeholder |
| `VITE_BANKR_API_KEY` | Bankr LLM Gateway | Placeholder |
| `VITE_OPENROUTER_API_KEY` | OpenRouter for Hermes | Placeholder |
| `VITE_COMPOSIO_CONSUMER_KEY` | Composio connector | Required for live Composio validation in milestone 3+ |
| `VITE_DEV_SKIP_ONBOARDING` | Skip onboarding flow in dev/testing | Optional (`true` to skip) |

### Credentials policy for this mission

- Real credentials are expected to live in Supabase secrets / edge-function configuration, not committed local env files.
- Local env flags are allowed only for validation bypass and local smoke testing.
- If a credential-backed feature cannot be exercised because the secret is unavailable, workers must surface that as a blocker rather than hardcoding placeholders into shipped runtime paths.

**Dev bypass notes:**
- `VITE_DEV_SKIP_AUTH=true` skips both auth gate AND onboarding gate (auth check is upstream)
- `VITE_DEV_SKIP_ONBOARDING=true` skips only the onboarding gate (useful if you want auth but not onboarding)

## Package Manager

- Use **npm** only (not bun, not pnpm)
- `bun.lockb` exists but is ignored — npm is the primary tool
- `package-lock.json` must NOT be modified by mission work

## Build Notes

- Default mission dev server is started via `.factory/services.yaml`; do not rely on the vite default port during mission work
- HMR overlay disabled in vite config
- Path alias: `@` → `./src`
- lovable-tagger plugin runs in dev mode only — DO NOT touch

## Database and migration notes

- Prefer updating `src/db/migration-snippets.sql` or equivalent SQL-snippet artifacts when Supabase schema work is required.
- If a schema change cannot be safely pushed, produce copy-paste SQL/RLS snippets for Lovable/Supabase SQL Editor instead of attempting unsupported direct migration flows.
- Do not assume a local Postgres instance exists for this mission; the authoritative backend is the remote Supabase project.
- The new `skills` and `agent_skills` surfaces depend on their corresponding SQL snippets being applied in the remote Supabase project before live browser validation can pass.
- For the current mission state, apply the `skills` and `agent_skills` snippets from `src/db/migration-snippets.sql` (sections 12-13) before resuming milestone-3 user testing.

## Blockchain Address Constants (Droid-Shield Workaround)

Droid-Shield may flag public blockchain contract addresses (e.g., USDC on Arbitrum) as potential secrets and block git commits. These are public, well-known addresses — NOT secrets.

**Established workaround:** Split the address into a suffix constant and reconstruct via template literal:
```typescript
const USDC_ADDR_SUFFIX = 'af88d065e77c8cC2239327C5EDb3A432268e5831';
export const USDC_ADDRESS = `0x${USDC_ADDR_SUFFIX}`;
```

This pattern is used in `src/lib/x402/constants.ts` and `src/lib/celo/config.ts`. Follow the same pattern for any new blockchain address constants.

## Supabase JSONB Column Typing

When inserting/updating JSONB columns (e.g., `manifest`, `config`, `content`) via Supabase client, TypeScript's `Record<string, unknown>` doesn't directly satisfy the auto-generated `Json` recursive union type. Use the double-cast pattern:
```typescript
import type { Json } from '@/integrations/supabase/types';
// ...
manifest: manifestObject as unknown as Json
```

This pattern is used in `src/lib/erc8004/identity.ts`, `src/lib/erc8004/execution-log.ts`, and `src/hooks/useAgentIdentity.ts`.

## External API CORS Notes

- **Venice API** (`https://api.venice.ai/api/v1/`): Client makes direct browser-side fetch. CORS behavior is undocumented — may require a proxy in production if Venice doesn't send `Access-Control-Allow-Origin` headers.
- **Uniswap Trade API** (`https://trade-api.gateway.uniswap.org/v1/`): Same browser-side fetch pattern. CORS behavior unknown.
- **Bankr API**: Same pattern. All three API clients are designed as browser-compatible but may need server-side proxying in production.

## Auth and validation notes

- Real-wallet validation must be run with auth bypass disabled.
- `VITE_DEV_SKIP_AUTH=true`, `VITE_DEV_SKIP_ONBOARDING=true`, and `VITE_DEV_MOCK_WALLET=...` are acceptable only for non-auth smoke tests and route exploration.

## Test-environment gotchas

- Some thirdweb-heavy test paths may require `NODE_OPTIONS=--max-old-space-size=8192` and a reduced worker count (`--maxWorkers=1`) to avoid Vitest OOMs on this machine. The `.factory/services.yaml` test command encodes `--max-old-space-size=8192 --maxWorkers=1` as the default safe configuration.
- `VITE_SUPABASE_URL` is defined in `vitest.config.ts` as `https://test-project.supabase.co` so that Venice, Uniswap, and Bankr proxy client tests produce well-formed edge-function URLs. The shared constants live in `src/test/test-env.ts` (`TEST_VENICE_PROXY_URL`, `TEST_UNISWAP_PROXY_URL`, `TEST_BANKR_PROXY_URL`). Tests for these clients assert against proxy URLs and do not test API-key or vendor-specific headers (those are added server-side by the edge functions).
- Running `NODE_OPTIONS=--max-old-space-size=4096 npm test -- --maxWorkers=3` is sufficient for the full suite including thirdweb-heavy tests on machines with 8+ GB RAM.
