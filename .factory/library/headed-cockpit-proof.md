# Headed Cockpit Scene Proof Procedure

How to prove live NPC population and backend-to-scene propagation in a headed browser session for VAL-THREE-002 and VAL-THREE-003.

**What belongs here:** The step-by-step procedure, queryable selectors, and evidence capture instructions for the headed cockpit scene proof.

---

## Why Headed Proof Is Needed

Headless Chromium does not support WebGPU. In headless mode the cockpit scene degrades gracefully (VAL-THREE-001 passes), but the 3D scene never reaches the `ready` state. To prove that:

1. **NPCs populate the scene from live backend agents** (VAL-THREE-002)
2. **Backend state changes propagate into the scene and inspector** (VAL-THREE-003)

...a headed/manual browser session is required.

## Prerequisites

- A headed browser (Chrome, Edge, or another WebGPU-capable browser)
- The dev server running at `http://127.0.0.1:3101` (or whatever port is configured)
- Seeded live data in the Supabase project for the active company
- Dev bypass flags if needed: `VITE_DEV_SKIP_AUTH=true`, `VITE_DEV_SKIP_ONBOARDING=true`

## Proof Surface: Scene Proof Panel

The cockpit page includes a **Scene Proof Panel** at the bottom-right of the 3D scene container. This panel:

- Is always visible as a collapsed pill showing the current scene status
- Expands to show data source, company, phase, NPC count, agent names, and last sync timestamp
- Exposes all values as DOM-queryable `data-*` attributes for automation

### Key Selectors

| Selector | What it proves |
|---|---|
| `[data-testid="cockpit-scene-proof-panel"]` | Root element with all proof attributes |
| `[data-proof-scene-status="ready"]` | The 3D scene successfully booted |
| `[data-proof-data-source="supabase"]` | Data is coming from the live backend |
| `[data-proof-npc-count]` | Number of NPC agents rendered in the scene |
| `[data-proof-npc-names]` | Comma-separated list of agent role names |
| `[data-proof-phase]` | Current project phase (idle/working/awaiting_approval/done) |
| `[data-proof-last-sync]` | ISO timestamp of the last data refresh |
| `[data-proof-agent-name]` | Individual agent name (one per NPC, visible when expanded) |

### Top-Level Cockpit Attributes

The cockpit page root also exposes:

| Selector | What it proves |
|---|---|
| `[data-testid="cockpit-page"]` | The cockpit page root |
| `[data-cockpit-source]` | "supabase" or "demo" |
| `[data-cockpit-phase]` | Current project phase |
| `[data-cockpit-agent-count]` | NPC count at page level |
| `[data-cockpit-scene-status]` | Scene lifecycle status |

## Proof Procedure: VAL-THREE-002 (NPC Population)

1. Open `/cockpit` in a headed browser at 1440×900 or wider
2. Wait for the scene proof panel to show `ready` status (scene loaded)
3. Verify `data-proof-data-source="supabase"` (not demo mode)
4. Click the proof panel toggle to expand it
5. Verify the NPC count and agent names match the expected live company agents
6. Query Supabase to confirm the same agent count and names for the active company
7. Screenshot the expanded proof panel and the 3D scene showing NPCs

### Evidence Required

- Screenshot of the cockpit with visible NPCs and the expanded proof panel
- Screenshot or DOM query showing `data-proof-scene-status="ready"`
- Supabase query result showing agents for the active company
- Console error log (should be clean)

## Proof Procedure: VAL-THREE-003 (Backend-to-Scene Propagation)

1. Open `/cockpit` in a headed browser
2. Wait for scene to reach `ready` status
3. Note the current `data-proof-npc-count` and `data-proof-last-sync` values
4. Perform a named backend mutation:
   - **Option A:** Create a new agent via the agent creation flow
   - **Option B:** Change a run status via Supabase (update `runs` table)
   - **Option C:** Create a new approval
5. Wait up to 10 seconds (the configured sync window)
6. Verify the proof panel updates:
   - NPC count changes (if agent was added)
   - Phase changes (if approval was added → `awaiting_approval`)
   - Last sync timestamp advances
7. If testing inspector propagation, select an NPC and verify the inspector shows the updated run/approval state

### Evidence Required

- Screenshot BEFORE the mutation (showing proof panel values)
- Description of the mutation performed (which table, which record)
- Screenshot AFTER the mutation (showing updated proof panel values within 10s)
- The `data-proof-last-sync` value should have advanced
- Console error log (should be clean)

## Sync Window

The cockpit data refreshes every **10 seconds** via React Query's `refetchInterval` when the data source is `supabase`. The proof panel's `data-proof-last-sync` attribute reflects when the last successful refresh occurred.

## Fallback: Headless Graceful Degradation

In headless environments, the scene proof panel will show:
- `data-proof-scene-status="unsupported"` or `"error"`
- All other attributes (NPC count, names, phase, source) remain accurate since they come from the data layer, not the 3D renderer

This means headless validators can still verify data-layer correctness (NPC population mapping, phase derivation) even without WebGPU, but cannot prove the 3D scene itself rendered.
