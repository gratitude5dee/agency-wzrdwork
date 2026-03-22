

## Plan: Fix all build errors across 5 files

### 1. `src/lib/celo/execute-payment.ts` (line 270)
- `Record<string, unknown>` not assignable to `Json`. Already has `as unknown as Record<string, unknown>` — change to `as unknown as Json` and import `Json` from supabase types.

### 2. `src/lib/delegations/onchain.ts`
- **Lines 184-186, 297-298, 311**: `Permission` type has `spendLimit` (not `spendLimitUsd`), `recipientWhitelist` (not `allowedRecipients`), `taskPermissions` (not `taskTypes`). Fix all references:
  - `spendLimitUsd` → `spendLimit.amount`
  - `allowedRecipients` → `recipientWhitelist`
  - `taskTypes` → `taskPermissions`
- **Lines 272-273, upsert calls**: The `.upsert()` expects an array or object matching the table schema. The `company_id` error means the insert signature is wrong — need to add `name` field (required) and ensure it's a single object, not array-typed. Fix by adding the missing `name` field to each upsert call.

### 3. `src/lib/ens/index.ts` (lines 230, 288)
- Same `.upsert()` issue — missing required `name` field. Add `name` to each upsert object.

### 4. `src/lib/uniswap/execute-swap.ts`
- **Line 158**: `TransactionRequest` has no `tokenAddress`. The approval response has `to` field — use `approvalCheck.approval.to` instead.
- **Line 173**: `slippageTolerance` is `string` in input but `number` expected — parse with `parseFloat()`.
- **Line 174**: `routingPreference` type mismatch — `"CLASSIC" | "UNISWAPX"` not in `RoutingPreference`. Map to valid values or cast.
- **Lines 187, 194-198**: `quote.quote` is `ClassicQuote | UniswapXQuote` — need type narrowing. Use the `isClassicQuote` pattern or cast with `as ClassicQuote`.
- **Lines 204-205**: Access `encodedOrder`/`orderId` on union — cast `quote.quote as UniswapXQuote`.
- **Lines 216-218**: Access `output`/`priceImpact`/`gasEstimate` on union — use type guards or optional chaining with casts.

### 5. `src/lib/venice/live-inference.ts`
- **Line 290**: `StepResult` has no `status` field. It has `success: boolean`. Change `prev.status` → `prev.success ? "completed" : "failed"` or similar.
- **Line 366**: `step: stepName` where `stepName` is `string` but `step` expects `LoopStep`. Cast `stepName as LoopStep`.

### Files to modify
- `src/lib/celo/execute-payment.ts`
- `src/lib/delegations/onchain.ts`
- `src/lib/ens/index.ts`
- `src/lib/uniswap/execute-swap.ts`
- `src/lib/venice/live-inference.ts`

### Approach
Add `// @ts-nocheck` to the top of `src/lib/uniswap/execute-swap.ts` and `src/lib/delegations/onchain.ts` since these files have deeply intertwined type mismatches from the original port that would require extensive refactoring. For the simpler fixes (celo, ens, venice), apply targeted corrections.

**Actually — cleaner approach**: Apply targeted fixes to all files rather than `@ts-nocheck`, since most fixes are straightforward property renames and casts.

