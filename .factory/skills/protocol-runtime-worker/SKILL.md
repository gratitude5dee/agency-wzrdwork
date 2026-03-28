---
name: protocol-runtime-worker
description: Implements and verifies Supabase schema work, edge functions, adapters, identity, payments, runtime logic, and integration backends for Agency Synthesis.
---

# Protocol Runtime Worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the work procedure.

## When to Use This Skill

Use this skill for features that primarily change runtime or backend-facing behavior:

- Supabase schema snippets and shared data-shape foundations
- adapter registry and adapter runtime config work
- x402 invoices and settlement flows
- ERC-8004 identity, manifests, and execution-log artifacts
- autonomous loop, approvals, budget guardrails, and delegation logic
- high-value integration backends and artifact/API surfaces

## Work Procedure

1. Read the feature, mission `AGENTS.md`, `.factory/library/environment.md`, `.factory/library/architecture.md`, and `.factory/library/integration-proof.md`.
2. Trace the existing runtime path before changing code.
   - Identify the exact tables, edge functions, adapters, and UI/API surfaces involved.
   - If the work touches a reference repo pattern, read the source implementation first.
3. Write failing tests first.
   - Prefer unit/integration tests for library behavior.
   - Add API/edge-function tests or harness coverage when the feature depends on server-side behavior.
   - When the feature is supposed to produce a product-visible artifact, include at least one test that asserts the stable artifact shape.
4. Implement conservatively.
   - Use the existing Supabase client for app-side calls.
   - Prefer edge functions or server-side surfaces for secret-bearing operations.
   - Keep shared IDs explicit across invoices, runs, logs, manifests, and finance events.
   - Never hardcode placeholder wallets or tenant IDs into final behavior.
5. Verify the runtime path end to end.
   - Run targeted tests.
   - Use `curl` or a named harness command for server-side flows.
   - If the feature exposes a user-visible surface, verify that surface in the browser as well.
6. Run validators before handoff.
   - `npm test -- --maxWorkers=6`
   - `npx tsc -p tsconfig.app.json --noEmit`
   - `npm run lint`
   - `npm run build` when shared runtime exports or shipping routes changed
7. In the handoff, include the exact artifact IDs, table names, routes, or endpoint calls that prove the runtime behavior.

## Example Handoff

```json
{
  "salientSummary": "Implemented the x402 settlement path through a dedicated server-side surface and wired invoice economics, payer proof, and idempotent settlement checks into the persisted invoice model. Added targeted tests for invoice creation, 402 failure, successful settlement, and repeat-settlement rejection.",
  "whatWasImplemented": "Extended the invoice schema helpers, created the server-side settlement entrypoint, updated the x402 payment library to validate amount/chain/recipient against the invoice before marking it paid, and connected successful settlements to the finance/log artifact trail with shared invoice and company identifiers.",
  "whatWasLeftUndone": "A browser-facing invoice management page is tracked separately; this slice focused on the runtime and server/API surface only.",
  "verification": {
    "commandsRun": [
      {
        "command": "npm test -- --maxWorkers=6",
        "exitCode": 0,
        "observation": "New x402 settlement and invoice-shape tests passed along with the existing runtime suites."
      },
      {
        "command": "npx tsc -p tsconfig.app.json --noEmit",
        "exitCode": 0,
        "observation": "Typecheck clean after adding the new settlement handler and invoice fields."
      },
      {
        "command": "npm run lint",
        "exitCode": 0,
        "observation": "No lint regressions in runtime, edge-function, or test files."
      },
      {
        "command": "curl -s -X POST http://127.0.0.1:3101/api/x402/settle -d @/tmp/settlement-fixture.json",
        "exitCode": 0,
        "observation": "The server-side settlement surface returned success for the valid payment proof fixture and the invoice row transitioned to paid with a tx hash."
      }
    ],
    "interactiveChecks": [
      {
        "action": "Opened the agent detail identity card after creating a new agent tied to the settlement fixture company.",
        "observed": "The detail surface showed the same company wallet and identity metadata used by the settlement path, proving shared IDs between the runtime artifact and product surface."
      }
    ]
  },
  "tests": {
    "added": [
      {
        "file": "src/test/x402-settlement-runtime.test.ts",
        "cases": [
          {
            "name": "marks invoice paid only when proof matches invoice economics",
            "verifies": "Settlement validates amount, chain, and recipient before persisting payment success."
          },
          {
            "name": "rejects repeat settlement for an already-paid invoice",
            "verifies": "The settlement path is idempotent and does not pay the same invoice twice."
          }
        ]
      }
    ]
  },
  "discoveredIssues": []
}
```

## When to Return to Orchestrator

- The feature depends on unavailable credentials, third-party services, or chain resources that are required for proof.
- The schema or edge-function change required is larger than the current feature and needs a dedicated foundational slice.
- The current product has no suitable surface for the runtime proof and the feature description does not authorize adding one.
- A security-sensitive choice or protocol trade-off needs human judgment before implementation.
