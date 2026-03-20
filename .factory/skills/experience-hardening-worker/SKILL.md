---
name: experience-hardening-worker
description: Hardens cross-surface UX, end-to-end flows, responsive behavior, artifact retrieval, and submission-ready proof paths for Agency Synthesis.
---

# Experience Hardening Worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the work procedure.

## When to Use This Skill

Use this skill for late-stage and cross-surface features:

- settings, integrations, and system-status hardening
- loading, empty, error, and responsive-state polish
- cross-area end-to-end flows
- Playwright/browser-regression additions
- artifact download/retrieval surfaces and submission-proof packaging
- README updates that are explicitly required near mission completion

## Work Procedure

1. Read the feature, mission `AGENTS.md`, `.factory/library/user-testing.md`, and `.factory/library/integration-proof.md`.
2. Identify the exact end-to-end flow to prove.
   - Name the route path(s), record IDs, and integration(s) involved.
   - Decide which parts need browser proof versus API/harness proof.
3. Write failing tests first.
   - Prefer targeted page/component tests for UI-state polish.
   - Add Playwright only when the feature explicitly needs durable end-to-end coverage.
   - For submission/artifact features, add tests or harness checks for the retrieval surface and the retrieved content.
4. Implement the minimal set of changes needed to make the flow proveable.
   - Favor explicit empty/error/loading states over hidden failure.
   - Ensure responsive layouts preserve primary actions.
   - Tie proof-pack surfaces to README instructions and stable URLs/buttons.
5. Verify the full flow end to end.
   - Run browser checks on desktop and the required responsive breakpoint.
   - If the feature includes artifact or finance proof, capture the same IDs in product and API/harness evidence.
6. Run validators before handoff.
   - `npm test -- --maxWorkers=6`
   - `npx tsc -p tsconfig.app.json --noEmit`
   - `npm run lint`
   - `npm run build`
   - `npx playwright test --workers=2` when the feature adds or changes e2e coverage
7. In the handoff, show the exact end-to-end path you validated and the exact artifacts/routes recovered from it.

## Example Handoff

```json
{
  "salientSummary": "Completed the submission-proof slice by wiring README-backed artifact retrieval links, run-scoped `agent_log.json` downloads, and a browser-visible proof panel that ties manifest, payment, and navigation evidence together. Verified the flow from Settings/Integrations/Agent Detail through the final proof surfaces and ran build plus e2e coverage.",
  "whatWasImplemented": "Added a submission-proof route and linked surfaces for manifest, run-log, and payment evidence; updated the README retrieval instructions to match the live buttons and URLs; added responsive layout fixes for the proof and settings panels; and introduced Playwright coverage for the documented retrieval path.",
  "whatWasLeftUndone": "Real on-chain tx hashes for optional stretch integrations remain out of scope for this feature and are tracked separately if needed.",
  "verification": {
    "commandsRun": [
      {
        "command": "npm test -- --maxWorkers=6",
        "exitCode": 0,
        "observation": "UI-state and artifact-retrieval tests passed, including new responsive proof-panel checks."
      },
      {
        "command": "npx tsc -p tsconfig.app.json --noEmit",
        "exitCode": 0,
        "observation": "No type errors after adding the proof route and retrieval helpers."
      },
      {
        "command": "npm run lint",
        "exitCode": 0,
        "observation": "Lint clean across settings, proof, and README-touching code."
      },
      {
        "command": "npm run build",
        "exitCode": 0,
        "observation": "Build succeeds with the new proof route and download handlers."
      },
      {
        "command": "npx playwright test --workers=2",
        "exitCode": 0,
        "observation": "The new submission-proof retrieval scenario passed on desktop and tablet widths."
      }
    ],
    "interactiveChecks": [
      {
        "action": "Followed the README instructions to open the proof route, download `agent.json`, download the run-scoped `agent_log.json`, and inspect the linked payment evidence.",
        "observed": "Each artifact matched the IDs shown in the product, and the proof route remained usable after reload."
      },
      {
        "action": "Repeated the same flow at tablet width.",
        "observed": "Primary actions remained visible, the sidebar/nav stayed usable, and no controls were clipped or overlapped."
      }
    ]
  },
  "tests": {
    "added": [
      {
        "file": "src/test/submission-proof-panel.test.tsx",
        "cases": [
          {
            "name": "renders manifest, run log, and payment evidence links for the selected agent and run",
            "verifies": "The proof panel exposes the self-contained artifact set required by the mission."
          },
          {
            "name": "keeps primary actions accessible at tablet width",
            "verifies": "Responsive layout preserves the main proof-retrieval actions."
          }
        ]
      }
    ]
  },
  "discoveredIssues": []
}
```

## When to Return to Orchestrator

- The required proof path depends on a missing upstream runtime feature that has not been built yet.
- A feature needs a real external credential or on-chain action that cannot be completed from the current environment.
- The requested scope is mostly new product development rather than hardening/polish and should be decomposed into earlier feature slices.
