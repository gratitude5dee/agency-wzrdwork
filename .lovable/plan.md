

## Plan: Fix build errors, deploy edge functions, and run migrations

### Problem Summary

The build is failing due to three categories of issues:
1. **`bun install` failure**: `package.json` declares workspace paths (`server`, `control-plane`, `cli`, `ui`) that exist in the full monorepo but cause lockfile migration failures in Lovable's build environment.
2. **Edge function TypeScript errors**: Three proxy functions and the shared `control-plane.ts` have type errors.
3. **Missing config**: `x402-settle` edge function exists but isn't registered in `config.toml`.

### Changes

**1. Fix `package.json` — remove workspace entries that break Lovable's build**

Remove the `workspaces` field entirely. Lovable only builds the Vite frontend; the monorepo workspace resolution for `server`, `control-plane`, `cli`, `ui`, and `packages/*` is irrelevant here and actively breaks `bun install`.

**2. Fix edge function TypeScript errors**

- `supabase/functions/bankr-proxy/index.ts` line 39: `error.message` → `(error as Error).message`
- `supabase/functions/venice-proxy/index.ts` line 40: `error.message` → `(error as Error).message`
- `supabase/functions/uniswap-proxy/index.ts` line 47: `error.message` → `(error as Error).message`
- `supabase/functions/_shared/control-plane.ts` line 85-87: Cast `rawKey` to `ArrayBuffer` via `.buffer` to fix `Uint8Array` → `BufferSource` incompatibility:
  ```typescript
  rawKey.buffer as ArrayBuffer,
  ```

**3. Add `x402-settle` to `supabase/config.toml`**

```toml
[functions.x402-settle]
verify_jwt = false
```

**4. Deploy edge functions**

Deploy all 7 edge functions:
- `thirdweb-config`
- `venice-proxy`
- `bankr-proxy`
- `uniswap-proxy`
- `agent-wakeup`
- `adapter-secrets`
- `x402-settle`

**5. Run pending migrations**

The migrations directory has 12 migration files. The database tables already exist (visible in the schema dump), so these migrations have likely already been applied. I'll verify by checking if any new tables/columns are missing.

### Files to modify
- `package.json` — remove `workspaces` field
- `supabase/functions/bankr-proxy/index.ts`
- `supabase/functions/venice-proxy/index.ts`
- `supabase/functions/uniswap-proxy/index.ts`
- `supabase/functions/_shared/control-plane.ts`
- `supabase/config.toml`

### Expected outcome
- `bun install` succeeds (no workspace resolution errors)
- All edge function TypeScript compiles cleanly
- All 7 edge functions deployed and callable
- Database schema verified as current

