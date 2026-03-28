---
name: product-surface-worker
description: Builds and verifies React, cockpit, dashboard, onboarding, integrations, and other product-facing surfaces in Agency Synthesis.
---

# Product Surface Worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the work procedure.

## When to Use This Skill

Use this skill for features that primarily change the product surface:

- cockpit, dashboard, org chart, Kanban, and sidebar flows
- agent creation/detail UI and routing
- onboarding, settings, and integrations page work
- skills registry, Composio/OpenClaw UI, and product-facing artifact retrieval surfaces
- data-hook and React Query wiring needed to make a user-facing flow work

## Work Procedure

1. Read the feature, `mission.md`, mission `AGENTS.md`, `.factory/library/architecture.md`, `.factory/library/source-porting.md`, and `.factory/library/user-testing.md`.
2. Identify the real target surfaces and any reference repo files to port from. Read the target repo files before editing.
3. Write failing tests first for the changed behavior.
   - Prefer component, hook, or page tests in `src/test/`.
   - If the feature is primarily cross-surface, add at least one characterization test for the data transform or route logic that will change.
4. Implement using existing patterns only.
   - Use the existing Supabase client.
   - Use React Query for server state.
   - Keep company scoping explicit; do not rely on first-row queries.
   - When parity would break a working surface, add a new left-nav page or linked surface instead of regressing the current page.
5. Manually verify the exact user flow on the browser surface.
   - Start the app on `3101` if needed.
   - Use in-product navigation for route-reachability assertions.
   - If the feature touches cockpit 3D behavior, record whether proof is headed/manual or headless/degraded.
6. Run validators before handoff.
   - `npm test -- --maxWorkers=6`
   - `npx tsc -p tsconfig.app.json --noEmit`
   - `npm run lint`
   - `npm run build` when shared routing/layout or shipping surfaces changed
7. In the handoff, prove the exact surface changed, the exact commands run, and the exact browser interactions observed.

## Example Handoff

```json
{
  "salientSummary": "Completed the cockpit Kanban parity slice: the board now renders the seven Paperclip workflow columns from live company-scoped Supabase data, drag/drop persists status updates, and the logs panel filters activity by agent. Verified the full flow in the browser on port 3101 and reran the repo validators.",
  "whatWasImplemented": "Updated the cockpit data hooks to resolve the active company explicitly, replaced mixed demo/live reads in the Kanban and log surfaces, added the org-chart entry point below the board, and wired the drag/drop mutation path so status changes persist and survive reloads.",
  "whatWasLeftUndone": "3D scene state propagation remains in a separate feature; this slice only covered the surrounding cockpit and Kanban/log surfaces.",
  "verification": {
    "commandsRun": [
      {
        "command": "npm test -- --maxWorkers=6",
        "exitCode": 0,
        "observation": "Targeted cockpit and page tests passed, including new live-data and Kanban persistence cases."
      },
      {
        "command": "npx tsc -p tsconfig.app.json --noEmit",
        "exitCode": 0,
        "observation": "No type errors after the data-hook changes."
      },
      {
        "command": "npm run lint",
        "exitCode": 0,
        "observation": "Lint clean for the touched cockpit files."
      },
      {
        "command": "npm run build",
        "exitCode": 0,
        "observation": "Build succeeds with the updated cockpit route and layout code."
      }
    ],
    "interactiveChecks": [
      {
        "action": "Navigated through the sidebar to Dashboard, then Cockpit, then used the in-cockpit org-chart link.",
        "observed": "All surfaces loaded on the same company dataset and no direct URL hacks were needed to reach the org chart."
      },
      {
        "action": "Dragged a live issue from todo to in_progress and refreshed the page.",
        "observed": "The card moved immediately, the logs panel showed the new activity entry, and the issue remained in the new column after reload."
      },
      {
        "action": "Opened the logs panel and filtered by a specific agent.",
        "observed": "Unrelated entries disappeared from both activity and technical views for the filtered state."
      }
    ]
  },
  "tests": {
    "added": [
      {
        "file": "src/test/cockpit-kanban-live-data.test.tsx",
        "cases": [
          {
            "name": "renders seven workflow columns from live company-scoped data",
            "verifies": "The board shows the full Paperclip workflow and excludes foreign-company issues."
          },
          {
            "name": "persists a status change mutation",
            "verifies": "Successful drag/drop writes the updated issue status and refetches the board."
          }
        ]
      }
    ]
  },
  "discoveredIssues": []
}
```

## When to Return to Orchestrator

- The feature depends on missing schema fields, tables, or edge/API surfaces that are not already planned.
- The only way to complete the feature would violate mission boundaries or modify off-limits files.
- Real-wallet or credential-backed behavior is required and the necessary secret/service is unavailable.
- A cross-company scoping bug appears in shared infrastructure that would affect multiple later features and needs dedicated decomposition.
