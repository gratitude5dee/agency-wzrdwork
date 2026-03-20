

## Plan: Fix build errors and sync from GitHub

### 1. Fix edge function TypeScript errors

Three edge functions have `error` typed as `unknown` in catch blocks. Fix by casting to `Error`:

**Files:**
- `supabase/functions/bankr-proxy/index.ts` line 39
- `supabase/functions/venice-proxy/index.ts` line 40
- `supabase/functions/uniswap-proxy/index.ts` line 47

Change: `error.message` → `(error as Error).message`

### 2. GitHub sync

Lovable's bidirectional GitHub sync should automatically pull the latest commit. If it hasn't, the build errors above may be blocking the build pipeline. Fixing these errors should unblock the build.

### 3. Supabase connection

Will connect the `agency` Supabase project to this Lovable project so edge functions and database are properly linked.

