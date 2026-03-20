# Architecture

Architectural decisions, mission invariants, and worker-facing implementation rules.

**What belongs here:** Component patterns, state/data invariants, porting rules, and cross-surface integration guidance.

---

## App Structure

- **Entry:** `src/main.tsx` → `src/App.tsx`
- **Auth chain:** `ThirdwebProvider` → `AuthGate` → `OnboardingGate` → `AppShell`
- **Primary surfaces:** `CockpitPage`, `SectionPage`, `DetailPage`, top-level pages under `src/pages/`
- **3D scene:** `src/features/cockpit/delegation/three/**`
- **Adapters:** `src/adapters/**` with registry lookup in `src/adapters/registry.ts`
- **Supabase edge functions:** `supabase/functions/**`

## Mission Invariants

### Active company resolution is a hard requirement

Company-scoped reads and writes must resolve the active company from the authenticated wallet and/or persisted onboarding context. Do **not** rely on `limit(1)`, first-row lookups, or unscoped global queries for:

- dashboard counts
- cockpit snapshot data
- sidebar badges and lists
- org chart data
- integrations config
- settings state
- wallet sync
- agent creation, invoices, manifests, execution logs, and related artifacts

If a shared helper for active-company lookup does not exist, create one and reuse it.

### Demo fallback must never be silent

If the app falls back to demo data, the UI must visibly communicate that state. Mission work should remove silent mixing of live and demo data across dashboard, cockpit, org chart, and counts.

### Runtime artifacts must be traceable by shared identifiers

Runs, execution logs, manifests, invoices, settlements, finance events, approvals, and issue updates must share stable IDs that can be surfaced in UI/API proofs. Avoid flows that require manual offline correlation.

## State and Data Patterns

- **Server state:** TanStack React Query v5
- **Client state:** Zustand for cockpit/delegation state only
- **Supabase client:** `src/integrations/supabase/client.ts`
- **Types:** `src/integrations/supabase/types.ts`
- **Reads:** `useQuery` + typed Supabase `select`
- **Writes:** `useMutation` + typed Supabase `insert/update/delete`
- **JSONB writes:** cast through `Json` from generated Supabase types when needed

## UI and Routing Conventions

- Use existing Shadcn components from `src/components/ui/`
- Use `lucide-react` for icons
- Use `cn()` from `src/lib/utils.ts`
- Keep routes flat (`/*`), no company-prefix routing
- If a new capability would disrupt an existing working page, add a new left-nav route rather than regressing the current surface
- New top-level pages belong in `src/pages/`; cockpit-specific pages/components belong in `src/features/cockpit/**`

## Porting and Reference Rules

Read-only source repos:

| Source | Location | Typical use |
|---|---|---|
| Paperclip UI/server/packages | `/Users/gratitud3/Downloads/Agency-Synthesis/paperclip-master 2/` | Kanban/org chart/dashboard parity, richer schema domains, adapter patterns |
| Hermes agent | `/Users/gratitud3/Downloads/Agency-Synthesis/hermes-agent-main/` | Hermes config/runtime behavior, tool registry, skills patterns |
| OpenClaw Composio plugin | `/Users/gratitud3/Downloads/Agency-Synthesis/openclaw-composio-plugin-master/` | Composio config/tool-discovery patterns |
| Thirdweb repos | `/Users/gratitud3/Downloads/Agency-Synthesis/thirdweb repos/` | wallet auth, x402, settlement, invoice patterns |

Porting rules:

1. Replace reference REST/Express access with the existing Supabase client unless the feature explicitly needs an edge function.
2. Preserve existing route structure and styling conventions in the target repo.
3. Prefer incremental parity: port the user-visible behavior and data shape, not the reference repo’s entire internal architecture.
4. Use new routes/pages when adding large mission surfaces such as Skills or artifact download views.

## Mission-Specific Product Expectations

- **Cockpit + org + dashboard** must agree on the same active-company dataset.
- **Hermes** must be selectable, configurable, and resolvable through the adapter registry.
- **Composio + skills** must be load-bearing, not decorative config-only surfaces.
- **Protocol Labs artifacts** must be retrievable as `agent.json` and run-scoped `agent_log.json`.
- **Integrations page** must own saved config while downstream product/tool flows prove that config is actually used.
- **3D cockpit** must support graceful degradation in unsupported/headless contexts while preserving surrounding UI usability.
- **Budget guardrails** currently read max budget from `agent_identities.manifest.compute_constraints.budget_usd` with a default fallback when absent; preserve or deliberately migrate that source of truth when changing runtime budget behavior.
