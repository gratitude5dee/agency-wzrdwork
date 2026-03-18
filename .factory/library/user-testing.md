# User Testing

Testing surface, validation tooling, and resource cost classification.

**What belongs here:** Validation surface findings, tool configuration, concurrency limits, testing gotchas, and evidence rules.

---

## Validation Surfaces

### 1. Browser surface

- **URL:** `http://127.0.0.1:3101`
- **Tool:** `agent-browser`
- **Dev server:** `npm run dev -- --host 127.0.0.1 --port 3101`
- **Health check:** `curl -sf http://127.0.0.1:3101/dashboard`
- **Primary targets:** landing/auth/onboarding, dashboard, cockpit, org chart, agents, integrations, settings, artifact download surfaces

### 2. Terminal/API harness surface

- **Tools:** shell, `curl`, targeted Vitest suites, and edge/API smoke commands
- **Primary targets:** x402 settlement, ERC-8004 manifests/logs, autonomous runtime, delegation/budget guardrails, integration proxy paths, artifact endpoints
- **Rule:** If an assertion depends on runtime or finance artifacts that are not yet fully browser-driven, validators may use a named API/harness flow as long as the evidence still proves the same agent/company/run IDs visible in the product

## Known Limitations

- **3D cockpit:** Headless Chromium may not fully prove WebGL/WebGPU behavior. Browser validators may verify surrounding UI and graceful overlays in headless mode, but true scene-state assertions should use headed/manual evidence when required.
- **React Router future warnings:** `v7_startTransition` and `v7_relativeSplatPath` warnings are noise unless they block navigation.
- **Real-wallet auth:** Assertions that require real wallet auth must be run with auth bypass disabled. Mock/bypass flows are not substitutes for those assertions.

## Validation Concurrency

### Browser surface

- **Machine baseline used for planning:** macOS, ~25.8 GB RAM, 12 CPU cores
- **Observed dry-run footprint:** ~1.19 GB RSS for one dev server + one browser session
- **Safe max concurrent validators:** `2`

#### Rationale

The browser dry run on `3101` showed meaningful existing desktop load plus a ~1.19 GB combined transient footprint. Using 70% of safe headroom favors reliability over throughput, so start with `2` concurrent browser validators. Treat `/cockpit` as the heaviest route.

### Terminal/API harness surface

- **Observed cost:** light to moderate
- **Safe max concurrent validators:** `3`

#### Rationale

Targeted shell/API validations are much lighter than browser sessions, but some hit the same Supabase project and external services. Cap at `3` to reduce rate-limit and fixture-collision risk.

## Browser Validation Guidance

### Navigation rules

- Use in-product navigation when the assertion is about reachability; direct URL entry alone does not prove navigability.
- Capture route or breadcrumb evidence when proving that one surface links to another.

### Auth and onboarding modes

- **Real auth mode:** use when validating `VAL-AUTH-*` and `VAL-CROSS-001`.
- **Bypass smoke mode:** allowed for non-auth route exploration and some setup checks.
  - `VITE_DEV_SKIP_AUTH=true`
  - `VITE_DEV_SKIP_ONBOARDING=true`
  - `VITE_DEV_MOCK_WALLET=0x1234567890abcdef1234567890abcdef12345678`
- Mock/bypass mode does **not** satisfy assertions that explicitly require real-wallet auth.

### Cockpit and scene rules

- For `VAL-THREE-*`, record whether the run is **headed/manual** or **headless/degraded**.
- The scene sync window for `VAL-THREE-003` is **10 seconds** unless the feature under test documents a different value.
- Headless evidence is acceptable for overlay/graceful-degradation checks, but not for claiming full WebGPU scene correctness.
- For `VAL-KANBAN-004`, use a wide enough browser viewport to keep the logs panel expanded; narrow headless layouts may collapse it and hide the activity content you need to prove.

### Isolation rules

- All validators share the same remote Supabase project.
- Use unique fixture names when creating companies, agents, or issues.
- Do not mutate data unless the assertion requires it.
- When testing wallet/company scoping, seed or reference distinct company fixtures and capture both the authenticated wallet and the target company ID in evidence.

## Terminal/API Harness Guidance

- Use named commands or scripts from the feature verification steps whenever possible.
- For any non-browser assertion, capture at least one stable ID shared with product-visible evidence (`company_id`, `agent_id`, `run_id`, `issue_id`, `invoice_id`, or tx hash).
- Prefer server-side settlement/artifact endpoints over direct browser-side secret usage.

## Flow Validator Guidance: Browser

### Setup

- **URL:** `http://127.0.0.1:3101`
- **Tool:** Invoke the `agent-browser` skill via the Skill tool at session start
- **Session naming:** Use a unique `--session` ID provided by the synthesizer
- **Viewport:** Default desktop width (1280×720 minimum); use wider (1440×900) for cockpit/Kanban to avoid collapsed panels

### Dev bypass environment

The dev server is started with:
- `VITE_DEV_SKIP_AUTH=true` — skips auth gate
- `VITE_DEV_SKIP_ONBOARDING=true` — skips onboarding gate
- `VITE_DEV_MOCK_WALLET=0x1234567890abcdef1234567890abcdef12345678` — mock wallet

These bypass flags allow route exploration and data-layer validation without real wallet auth.

### Isolation boundaries

- All validators share the same remote Supabase project and dev server instance
- Use unique identifiable prefixes when creating test data (companies, agents, issues)
- Do NOT mutate data unless the assertion requires it (e.g., drag-drop for VAL-DATA-003/VAL-KANBAN-003)
- When mutation is required, record the exact IDs used and verify against the backend afterward
- Do NOT create/delete companies or modify global state — use existing seeded data

### Assertion evidence requirements

For each assertion:
1. Take screenshots of the relevant surfaces
2. Check the browser console for errors (`console-errors`)
3. Query Supabase for backend state where the assertion requires it (use `curl` to the Supabase REST API or describe expected behavior based on UI evidence)
4. Report results in the flow report JSON

### Three.js / cockpit special handling

- Headless Chromium may not render WebGL/WebGPU scenes correctly
- For VAL-THREE-* assertions, validate:
  - That the cockpit shell UI is usable (overlay, controls, surrounding panels)
  - That graceful degradation messaging appears in headless mode
  - Scene sync window: 10 seconds
- True WebGPU scene correctness requires headed evidence (mark if headless)

### What to write

Write your report to the path specified in your task prompt as a JSON file with this shape:
```json
{
  "flowId": "<group-id>",
  "milestone": "paperclip-data-cockpit-sync",
  "assertions": {
    "<assertion-id>": {
      "status": "pass" | "fail" | "blocked",
      "evidence": ["<description of evidence collected>"],
      "issues": ["<any issues found>"]
    }
  },
  "frictions": ["<any testing frictions encountered>"],
  "blockers": ["<any blockers encountered>"],
  "toolsUsed": ["agent-browser"]
}
```

## Discovered Session Knowledge

### Cockpit Logs Panel Breakpoint
The ActionLogPanel (Logs) is hidden when the viewport width is below 1500px (`COCKPIT_LOG_COLLAPSE_BREAKPOINT`). To test VAL-KANBAN-004 and logs-related assertions, use a viewport width of 1600px or more.

### Kanban Drag-and-Drop
- The `agent-browser drag @ref1 @ref2` command does not support `@ref` syntax — use mouse-level commands (`mouse move`, `mouse down`, `mouse up`) for drag-and-drop testing
- Card elements have `cursor-grab` class and `role="button"` but not `draggable="true"` attribute
- Column positions can be found via DOM query for `min-w-[240px]` class elements

### Subagent Spawning
Task tool subagent spawning fails in this repo with bun-eval parsing errors. Direct testing in the current session is the reliable fallback. Document this consistently.

### Test Issue Schema
Issues table uses `assignee_agent_id` (not `assignee_id`). Required fields: `title`, `status`, `priority`, `company_id`. Optional: `assignee_agent_id`, `identifier`, `description`, `project_id`.

### WebGPU / Three.js Limitations
Headless Chromium does not support WebGPU. The cockpit scene degrades gracefully with a clear error overlay. Surrounding cockpit UI (Kanban, Inspector, Logs, toolbar) remains fully functional. VAL-THREE-002 and VAL-THREE-003 require headed browser evidence for full verification.

## Evidence Rules

- **Cross-surface assertions:** prove the same record across all named surfaces, not a representative subset.
- **Scoping assertions:** include a negative control (for example, a decoy company) whenever the assertion is about tenant isolation.
- **Artifact assertions:** capture both the retrieval surface and the artifact contents.
- **Recovery-state assertions:** show the recovery interaction, not only the error screen.
