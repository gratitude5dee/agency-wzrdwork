# /goal — Agency Cockpit ⇄ Paperclip Control Plane Integration

> Spec file: `GOAL-cockpit-paperclip-port.md`
> Owner: Codex
> Base repo: `agency-wzrdwork-main/`
> Reference repo: `paperclip-master 2/` (read-only)
> Mode: Build inside the base repo. Do not replace it.

---

## Phase 0 Findings & Spec Updates

This plan was copied into the base repo on 2026-05-19 after re-running Phase 0 against the current `paperclip-master 2/` reference. The historical `docs/PARITY_MATRIX.md` claim from 2026-03-21 is stale: the reference repo now has additional routes, services, schemas, shared contracts, adapters, adapter utilities, plugins, and tests that are not in Agency.

Authoritative audit: `docs/PARITY_REVERIFY_2026-05-19.md`.

Implementation update:

- Keep `agency-wzrdwork-main/` as the base repo and preserve Agency-only cockpit/Web3/integration surfaces.
- Do not assume that all Paperclip runtime functionality is already ported.
- Phase 1 still starts with the local schema drift called out below (`chat_sessions`, `chat_messages`, `agent_integrations`, agent/company wallet/budget/prompt fields).
- Before declaring the overall `/goal` complete, catch up the newer Paperclip primitives that the cockpit needs to visualize: `issue_relations`, `issue_thread_interactions`, `issue_execution_decisions`, `secret_access_events`, environment/workspace runtime support, plugin-managed resources, and their shared/server contracts.
- The live repo uses `docs/` rather than the stale `doc/` path referenced by `AGENTS.md`; new plan docs belong in `docs/plans/`.

## Implementation Status — 2026-05-19

This working pass completed the local Phase 1 schema drift closure and implemented the cockpit-facing portions of Phases 2, 3, 4, 5, 9, and 10 for the primitives already present in Agency's database/server contracts.

Completed:

- Added local schema coverage for `chat_sessions`, `chat_messages`, `agent_integrations`, and agent/company wallet, budget, and prompt-template fields.
- Extended the agency snapshot contract with dashboard, cost, budget, heartbeat, runtime-state, document, work-product, attachment, workspace, runtime-service, plugin, routine, and secret-metadata sections.
- Expanded `getAgencySnapshot()` with company-scoped optional reads for the Paperclip control-plane tables. Optional reads tolerate not-yet-applied tables/columns and return empty sections rather than breaking the cockpit.
- Updated cockpit mappers, runtime store, 3D NPC driver, overlay bubbles, project view, and agent inspector to render Paperclip visual states including queued, working, heartbeat, awaiting approval, blocked, over budget, paused, failed, completed, needs input, producing work product, and terminated.
- Added shared snapshot types and validators for downstream package consumers.
- Kept secrets metadata-only in the snapshot; secret values are not exposed to the client.
- Rewired server package metadata enough for deploy checks to reach real server TypeScript issues: local Paperclip workspace dependencies are now declared, stale `.agency-backup.ts` files are excluded from server compile, and Express request actor typing is restored.

Validated:

- `pnpm --filter @paperclipai/shared build`
- `pnpm --filter @paperclipai/db typecheck`
- `pnpm exec tsc -p tsconfig.app.json`
- `pnpm exec tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --skipLibCheck server/src/services/core.ts`
- `pnpm --filter @paperclipai/db generate` produced no migration changes.
- `pnpm exec vitest run src/test/cockpit-mappers.test.ts src/test/three-scene-live-agent-sync.test.tsx src/test/cockpit-kanban-live-data.test.tsx src/test/kanban-panel.test.tsx`
- `pnpm build`
- Exact Vercel build command from `vercel.json`: `pnpm --filter @paperclipai/shared build && pnpm --filter @paperclipai/db build && pnpm --filter @paperclipai/adapter-utils build && pnpm --filter @paperclipai/plugin-sdk build && pnpm --filter @paperclipai/server compile && pnpm exec vite build`
- Browser smoke at `http://127.0.0.1:5182/cockpit` with auth/onboarding bypass showed the cockpit, ready scene proof, Kanban, project info, and live-summary panels with no browser page errors.

Known blockers before claiming the full `/goal` done:

- Vercel is now linked to `5dee-studios/agency-wzrdwork`, and local production build output exists under `.vercel/output`. Production deploy still needs the missing Vercel/Supabase environment variables from `VERCEL_DEPLOYMENT.md`; as of 2026-05-20 only `DATABASE_URL` is configured in Vercel Production.
- Full `pnpm test:run` cleanup is now closed as of the validation/UI parity pass below: 67 files / 906 tests passed.
- The newer Paperclip route/service behavior listed in `docs/PARITY_REVERIFY_2026-05-19.md` is substantially caught up for the cockpit/control-plane lane. The schema/snapshot subset needed by the cockpit is now implemented, and sidebar preferences, issue tree control, workspace command authz, environment CRUD/probe routes, workspace runtime service authz helpers, adapter/plugin settings helpers, environment runtime orchestration, Vercel Sandbox workspace sync, local-adapter sandbox execution, workspace runtime command-control routes, external adapter hot-install/reload/reinstall, richer adapter runtime helpers, and bundled adapter parity have been ported. Production Vercel/Supabase linking, deploy, and live environment verification remain before final parity can be claimed.

## Implementation Status — 2026-05-20 Vercel Production Readiness

This pass hardened the Vercel serverless entrypoint and deployment checklist after the local production build path was unblocked.

Completed:

- Kept Thirdweb in the app, but made server-side wallet signature verification lazy so Thirdweb/Viem do not get statically traced into cron functions.
- Reduced cron function traces by importing the heartbeat service directly from cron endpoints instead of the broad services barrel.
- Removed the temporary `/api/debug` function and rewrite after it caused recursive Vercel output tracing.
- Updated the Vercel entrypoint to use the real configured Paperclip storage service when `PAPERCLIP_STORAGE_PROVIDER=s3` is set, with a clear serverless storage error when storage is absent.
- Aligned Vercel serverless deployment mode, exposure, allowed hostnames, and company-deletion reads with the `PAPERCLIP_*` env names while keeping legacy aliases.
- Updated `.env.example` and `VERCEL_DEPLOYMENT.md` with the required Production env vars, manual `CRON_SECRET`, S3-compatible storage settings, and Supabase Edge Function Thirdweb note.

Validated:

- Focused Vercel trace of `api/cron/heartbeat-scheduler.ts` dropped to 756 traced files with no Thirdweb/Viem/adapter packages in the top trace output.
- `pnpm --filter @paperclipai/server compile`
- `vercel build --prod --yes` reached `.vercel/output` with server, cron, and sandbox function output present.

Remaining before full `/goal` completion:

- Add the missing Vercel Production env vars; `DATABASE_URL` is currently the only configured Production variable.
- Confirm live Supabase migration/schema parity against the linked project once credentials/tooling allow a direct schema check.
- Run `vercel deploy --prebuilt --prod` after envs are configured, then smoke `/`, `/cockpit`, `/api/health`, `/api/agency/snapshot`, cron endpoints, sandbox endpoints, auth, document/asset upload, and Thirdweb wallet flow.

## Implementation Status — 2026-05-19 Reference Primitive Catch-Up

This follow-up pass closed the cockpit-facing schema and snapshot gap for the newer reference-only Paperclip primitives that directly affect 3D state, inspector detail, governance, runtime environments, plugins, and secret metadata.

Completed:

- Added Drizzle schema coverage for `issue_relations`, `issue_thread_interactions`, `issue_execution_decisions`, `environments`, `environment_leases`, `plugin_managed_resources`, `company_secret_bindings`, and `secret_access_events`.
- Generated migration `packages/db/src/migrations/0040_clammy_lady_deathstrike.sql` and rewrote it to be idempotent: guarded foreign keys, `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, RLS enabled, and no broad public policies on the new sensitive tables.
- Extended shared snapshot types and validators so `@paperclipai/shared` describes the control-plane snapshot sections the cockpit now consumes.
- Expanded `getAgencySnapshot()` with optional, company-scoped reads for issue relations, thread interactions, execution decisions, environments, environment leases, plugin-managed resources, secret bindings, and secret access events.
- Kept environment config and secret values server-only. The cockpit receives summaries, IDs, providers, status, timestamps, binding metadata, and recent access metadata, not raw secret/config payloads.
- Updated cockpit mapping and inspector models so blockers drive Kanban `blocked`, thread interactions and execution decisions appear in the technical debug log, and agent inspectors show governance, environments, plugin-managed resources, secret bindings, and secret access events.

Validated:

- `pnpm --filter @paperclipai/db generate` after the migration reported no further schema changes.
- `pnpm --filter @paperclipai/db typecheck`
- `pnpm --filter @paperclipai/shared build`
- `pnpm exec tsc -p tsconfig.app.json`
- `pnpm --filter @paperclipai/server compile`
- `pnpm exec vitest run src/test/cockpit-mappers.test.ts src/test/three-scene-live-agent-sync.test.tsx src/test/cockpit-kanban-live-data.test.tsx src/test/kanban-panel.test.tsx`
- Exact Vercel build command from `vercel.json`: `pnpm --filter @paperclipai/shared build && pnpm --filter @paperclipai/db build && pnpm --filter @paperclipai/adapter-utils build && pnpm --filter @paperclipai/plugin-sdk build && pnpm --filter @paperclipai/server compile && pnpm exec vite build`
- Browser smoke at `http://127.0.0.1:5186/cockpit` with auth/onboarding bypass showed the cockpit, scene proof, Kanban including the `BLOCKED` column, and project links with no browser page errors.

Remaining before full `/goal` completion:

- Port the runtime routes/services that make the new primitives actionable. Sidebar preferences, issue tree control, host workspace-command mutation guards, environment CRUD/probe routes, workspace-runtime service authz helpers, and adapter/plugin settings helpers are now implemented.
- Add route-backed cockpit actions for environment selection, issue tree hold/control decisions, approval decisions, and workspace command/runtime authorization instead of read-only cockpit visualization.
- Refresh the full `pnpm test` lane after those non-cockpit route/test-harness gaps are addressed.

## Implementation Status — 2026-05-19 Route/Authz Catch-Up

This pass moved beyond read-only snapshot parity by adding two small but actionable Paperclip server primitives from the current reference: sidebar ordering preferences and host workspace-command mutation protection.

Completed:

- Added Drizzle schema for `user_sidebar_preferences` and `company_user_sidebar_preferences`, plus migration `packages/db/src/migrations/0041_cute_thanos.sql`.
- Kept the 0041 migration idempotent with guarded foreign key creation, `CREATE INDEX IF NOT EXISTS`, RLS enabled, and no broad public policies.
- Added shared sidebar preference types/validators and exported them through `@paperclipai/shared`.
- Added `sidebarPreferenceService` and `sidebarPreferenceRoutes`, mounted under `/api/sidebar-preferences/me` and `/api/companies/:companyId/sidebar-preferences/me`.
- Added `workspace-command-authz` helpers and wired them into existing agent, project, issue, and execution-workspace mutations so agent-authenticated callers cannot change host-executed `provisionCommand`, `teardownCommand`, or `cleanupCommand` fields.
- Added a focused unit test for the workspace-command guard and command-path collectors.

Validated:

- `pnpm --filter @paperclipai/db generate` after the 0041 migration reported no further schema changes.
- `pnpm --filter @paperclipai/db typecheck`
- `pnpm --filter @paperclipai/shared build`
- `pnpm exec tsc -p tsconfig.app.json`
- `pnpm --filter @paperclipai/server compile`
- `pnpm exec vitest run src/test/workspace-command-authz.test.ts`
- Exact Vercel build command from `vercel.json`: `pnpm --filter @paperclipai/shared build && pnpm --filter @paperclipai/db build && pnpm --filter @paperclipai/adapter-utils build && pnpm --filter @paperclipai/plugin-sdk build && pnpm --filter @paperclipai/server compile && pnpm exec vite build`

Remaining before full `/goal` completion:

- Environment runtime remains the largest unported route/service group beyond CRUD/probe: environment execution target/runtime/orchestrator helpers and the Vercel Sandbox-backed execution provider.
- Workspace runtime command endpoints are still limited in Agency; the shared authz helper exists, but the full reference command-control route behavior is not yet ported.
- External adapter plugin hot-install/reload/reinstall remains intentionally unavailable; Agency now has adapter inventory/toggle routes and persistent settings helpers only.

## Implementation Status — 2026-05-19 Issue Tree Control Catch-Up

This pass added the Paperclip subtree hold/control model so the cockpit and board APIs can preview, pause, resume, cancel, restore, and release issue subtrees rather than only rendering read-only issue state.

Completed:

- Added Drizzle schema for `issue_tree_holds` and `issue_tree_hold_members`, plus migration `packages/db/src/migrations/0042_silent_the_order.sql`.
- Kept the 0042 migration idempotent with guarded foreign key creation, `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, RLS enabled, and no broad public policies.
- Added shared issue tree constants, types, validators, and API handles through `@paperclipai/shared`.
- Added `issueTreeControlService` with subtree preview, active pause gate lookup, hold creation/list/get/release, cancel/restore status application, and queued wakeup cancellation.
- Added `issueTreeControlRoutes`, mounted under `/api/issues/:id/tree-control/*` and `/api/issues/:id/tree-holds/*`.
- Wired heartbeat runtime enforcement so active subtree pause holds suppress new issue wakeups, queued runs, and deferred wake promotion unless the wake is a verified interaction wake.
- Added a focused shared-contract test for issue tree route handles, constants, and validators.

Validated:

- `pnpm --filter @paperclipai/db generate` after the 0042 migration reported no further schema changes.
- `pnpm --filter @paperclipai/db typecheck`
- `pnpm --filter @paperclipai/shared build`
- `pnpm --filter @paperclipai/server compile`
- `pnpm exec tsc -p tsconfig.app.json`
- `pnpm --filter @paperclipai/db build`
- `pnpm exec vite build`
- `pnpm exec vitest run src/test/issue-tree-control-contracts.test.ts src/test/workspace-command-authz.test.ts`
- Exact Vercel build command from `vercel.json`: `pnpm --filter @paperclipai/shared build && pnpm --filter @paperclipai/db build && pnpm --filter @paperclipai/adapter-utils build && pnpm --filter @paperclipai/plugin-sdk build && pnpm --filter @paperclipai/server compile && pnpm exec vite build`

Remaining before full `/goal` completion:

- Environment runtime remains the largest unported route/service group beyond CRUD/probe: environment execution target/runtime/orchestrator helpers and the Vercel Sandbox-backed execution provider.
- Workspace runtime command endpoints are still limited in Agency; the shared authz helper exists, but the full reference command-control route behavior is not yet ported.
- External adapter plugin hot-install/reload/reinstall remains intentionally unavailable; Agency now has adapter inventory/toggle routes and persistent settings helpers only.

## Implementation Status — 2026-05-19 Environment & Adapter Helper Catch-Up

This pass closed the actionable helper layer for environment configuration and adapter/runtime authorization without replacing Agency's existing runtime model.

Completed:

- Added shared environment constants, types, validators, capability helpers, and API handles.
- Added `environmentService`, environment config normalization, secret-backed SSH private-key persistence, and environment probe support for local/fake-sandbox plus explicit unsupported responses for SSH/plugin/sandbox providers not installed in this Agency runtime.
- Added `environmentRoutes`, mounted under `/api/companies/:companyId/environments`, `/api/environments/:id`, and environment lease/probe routes.
- Added `environment-selection` validation and wired environment ownership/status checks into project and issue environment selections.
- Added cleanup helpers so deleted environments clear project, issue, and execution-workspace selections.
- Added `workspace-runtime-service-authz` helpers for board callers, CEO agents, and reporting-subtree agents with linked eligible issues.
- Added adapter plugin/settings persistence, adapter inventory/toggle routes under `/api/adapters`, disabled-adapter registry behavior, and adapter API handles.
- Added focused contract/store tests for environment contracts and adapter-plugin settings.

Validated:

- `pnpm --filter @paperclipai/db generate` reported no schema changes.
- `pnpm --filter @paperclipai/db typecheck`
- `pnpm --filter @paperclipai/shared build`
- `pnpm --filter @paperclipai/server compile`
- `pnpm exec tsc -p tsconfig.app.json`
- `pnpm exec vitest run src/test/adapter-plugin-store.test.ts src/test/environment-contracts.test.ts src/test/issue-tree-control-contracts.test.ts src/test/workspace-command-authz.test.ts`
- Exact Vercel build command from `vercel.json`: `pnpm --filter @paperclipai/shared build && pnpm --filter @paperclipai/db build && pnpm --filter @paperclipai/adapter-utils build && pnpm --filter @paperclipai/plugin-sdk build && pnpm --filter @paperclipai/server compile && pnpm exec vite build`

Remaining before full `/goal` completion:

- Port real environment execution target/runtime/orchestrator behavior and the Vercel Sandbox-backed execution provider; current Agency support is CRUD/probe/capability metadata, not remote run orchestration.
- Port full workspace runtime command-control route behavior if the cockpit needs start/stop/restart/run actions inline.
- Port the reference external adapter plugin loader and newer adapter packages if hot-install/reload/reinstall must be live rather than explicitly unsupported.

## Implementation Status — 2026-05-19 Environment Runtime & Vercel Sandbox Slice

This pass moved environment support beyond CRUD/probe metadata by adding the first executable runtime layer while keeping Agency's existing local workspace runtime intact.

Completed:

- Added `sandbox-provider-runtime` with built-in fake and Vercel Sandbox providers.
- Vercel Sandbox support uses the current `@vercel/sandbox` API shape: `Sandbox.create`, `Sandbox.get`, `runCommand`, and `stop`, with `node24` as the default runtime and `/vercel/sandbox` as the default remote cwd.
- Added sandbox lease acquire/resume/release/destroy helpers, reusable-lease matching, lease metadata reconstruction, provider workspace preparation, and direct command execution delegation.
- Added `environmentRuntimeService` with local and sandbox run-lease drivers, workspace realization, sandbox command execution, and release cleanup status tracking. SSH/plugin drivers now fail explicitly at acquisition instead of silently pretending to run.
- Added `workspace-realization` helpers and shared `WorkspaceRealizationRequest` / `WorkspaceRealizationRecord` contracts so runtime leases can produce cockpit/inspector-readable local/remote sync metadata.
- Added `environment-execution-target` helpers that resolve local, SSH, and sandbox adapter execution targets. Sandbox targets can now carry an environment-runtime-backed runner for local adapter types such as Codex, Claude, Gemini, OpenCode, Pi, ACPx, and Cursor.
- Added `environment-run-orchestrator` as the heartbeat-facing boundary for environment resolution, lease acquisition, transport resolution, workspace realization, provisioning, execution-target resolution, and lease release activity logging.
- Added a minimal `@paperclipai/adapter-utils/execution-target` subpath for remote execution target contracts without pulling the full reference adapter-utils runtime into Agency yet.
- Updated environment probing so built-in sandbox providers are resolved through the provider registry rather than hardcoding only fake sandbox responses.

Validated:

- `pnpm --filter @paperclipai/shared build`
- `pnpm --filter @paperclipai/adapter-utils build`
- `pnpm --filter @paperclipai/server compile`
- `pnpm exec tsc -p tsconfig.app.json`
- `pnpm exec vitest run src/test/sandbox-provider-runtime.test.ts src/test/environment-execution-target.test.ts src/test/environment-contracts.test.ts`
- Exact Vercel build command from `vercel.json`: `pnpm --filter @paperclipai/shared build && pnpm --filter @paperclipai/db build && pnpm --filter @paperclipai/adapter-utils build && pnpm --filter @paperclipai/plugin-sdk build && pnpm --filter @paperclipai/server compile && pnpm exec vite build`

Remaining before full `/goal` completion:

- Complete the workspace archive upload/download synchronization lifecycle for sandbox-backed execution workspaces.
- Port the richer reference adapter-side remote execution bridge for Codex/Claude/Gemini/OpenCode/Pi/Cursor so stdin prompts, runtime homes, session identity, and workspace restore work end-to-end in sandbox-backed local adapters.
- Port full workspace runtime command-control routes if the cockpit should start/stop/restart/run workspace commands inline.
- External adapter plugin hot-install/reload/reinstall remains intentionally unavailable; Agency still has adapter inventory/toggle/settings helpers only.

---

## Implementation Status — 2026-05-19 Heartbeat Environment Runtime Wiring

This pass connected the environment runtime layer to real heartbeat runs and added the first adapter-side command runner hook.

Completed:

- Extended `AdapterExecutionContext` with optional `executionTarget` and legacy `executionTransport` fields so heartbeat can pass provider-neutral local/sandbox/SSH execution details to adapters.
- Added execution workspace environment selection policy: persisted workspace config wins, then issue settings, then project policy, then the company local environment.
- Persisted selected environment/runtime config snapshots into execution workspace metadata and taught the execution workspace read model to parse `metadata.config` into `ExecutionWorkspace.config`.
- Wired `heartbeatService` to ensure the local default environment, acquire an environment lease for each run, realize the workspace through `environment-run-orchestrator`, store `paperclipEnvironment` / workspace realization metadata in the run context, pass execution targets into adapters, and release active leases in the existing `finally` path based on the final run status.
- Added sandbox execution target dispatch to `runChildProcess` and threaded it through the built-in process adapter, giving generic process runs a real managed sandbox runner path.
- Added focused root Vitest coverage for environment selection/config snapshots and sandbox execution target dispatch.

Validated:

- `pnpm exec vitest run src/test/adapter-execution-target-runner.test.ts src/test/execution-workspace-policy.test.ts src/test/environment-execution-target.test.ts src/test/sandbox-provider-runtime.test.ts`
- `pnpm --filter @paperclipai/shared build`
- `pnpm --filter @paperclipai/db build`
- `pnpm --filter @paperclipai/adapter-utils build`
- `pnpm --filter @paperclipai/plugin-sdk build`
- `pnpm --filter @paperclipai/server compile`
- `pnpm exec tsc -p tsconfig.app.json`
- `pnpm exec vite build`

Remaining before full `/goal` completion:

- Port the full adapter-side remote bridge from the reference local adapters. The generic process adapter now honors sandbox execution targets, but Codex/Claude/Gemini/OpenCode/Pi/Cursor still need the richer prompt/session/runtime-home bridge before they can execute real AI-agent sessions inside sandbox environments.
- Fill the remaining workspace runtime command-control routes if the cockpit should manage workspace services inline.

---

## Implementation Status — 2026-05-19 Sandbox Workspace Sync Slice

This pass completed the built-in Vercel Sandbox workspace movement lifecycle so sandbox-backed execution workspaces are not just remote command targets; they now receive local workspace files before execution and restore sandbox-side changes on lease cleanup.

Completed:

- Extended the built-in Vercel sandbox provider with archive-based workspace upload/download using the current `@vercel/sandbox` file APIs (`mkDir`, `writeFiles`, `readFileToBuffer`) and sandbox command execution.
- `prepareWorkspace()` now snapshots the local execution workspace, excludes `.paperclip-runtime`, uploads a tar archive into the sandbox, clears the remote workspace except runtime metadata, extracts the archive at the requested remote path, and records sync metadata for cockpit/inspector visibility.
- Lease release and forced destroy now attempt to restore the sandbox workspace before stopping or reusing the sandbox.
- Restore now downloads a sandbox archive, merges changed remote files back into the local workspace, removes locally unchanged files that were deleted in the sandbox, preserves local edits made after upload, and leaves `.paperclip-runtime` untouched.
- Added focused Vitest coverage for the sandbox restore merge behavior.

Validated:

- `pnpm exec vitest run src/test/sandbox-provider-runtime.test.ts`
- `pnpm exec vitest run src/test/sandbox-provider-runtime.test.ts src/test/adapter-execution-target-runner.test.ts src/test/execution-workspace-policy.test.ts src/test/environment-execution-target.test.ts`
- `pnpm --filter @paperclipai/shared --filter @paperclipai/db --filter @paperclipai/adapter-utils --filter @paperclipai/plugin-sdk build`
- `pnpm --filter @paperclipai/server compile`
- `pnpm exec tsc -p tsconfig.app.json`
- `pnpm exec vite build`

Remaining before full `/goal` completion:

- Fill the remaining workspace runtime command-control routes if the cockpit should manage workspace services inline.
- External adapter plugin hot-install/reload/reinstall remains intentionally unavailable; Agency still has adapter inventory/toggle/settings helpers only.

---

## Implementation Status — 2026-05-19 Adapter Remote Bridge Slice

This pass made the existing local AI adapters sandbox-aware enough for heartbeat execution to send real prompt-driven agent sessions through the environment execution target instead of only supporting generic process commands.

Completed:

- Added stdin wrapping for Vercel Sandbox command execution so adapter prompts can be streamed through the SDK path even though the sandbox `runCommand` API does not expose a direct stdin field.
- Updated Codex, Claude, Gemini, OpenCode, Cursor, and Pi local adapters to honor remote execution targets, skip host-only command checks during sandbox runs, run commands at the sandbox workspace cwd, and return sandbox cwd/session metadata.
- Prevented Codex from leaking a host `CODEX_HOME` into sandbox commands; remote Codex runs now use `${remoteCwd}/.paperclip-runtime/codex-home` after configured env merging.
- Added focused Codex remote execution coverage that verifies command, cwd, remote `CODEX_HOME`, `PAPERCLIP_WORKSPACE_CWD`, stdin prompt handoff, and returned session params.

Validated:

- `pnpm exec vitest run src/test/sandbox-provider-runtime.test.ts src/test/adapter-execution-target-runner.test.ts src/test/codex-local-remote-execution.test.ts`
- `pnpm --filter @paperclipai/adapter-utils build`
- `pnpm --filter @paperclipai/adapter-codex-local build`
- `pnpm --filter @paperclipai/adapter-claude-local build`
- `pnpm --filter @paperclipai/adapter-opencode-local build`
- `pnpm --filter @paperclipai/adapter-cursor-local build`
- `pnpm --filter @paperclipai/adapter-pi-local build`
- `pnpm exec tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --esModuleInterop --skipLibCheck packages/adapters/gemini-local/src/server/execute.ts`
- `pnpm --filter @paperclipai/server compile`
- `pnpm exec tsc -p tsconfig.app.json`
- `pnpm exec vite build`

Remaining before full `/goal` completion:

- External adapter plugin hot-install/reload/reinstall remains intentionally unavailable; Agency still has adapter inventory/toggle/settings helpers only.
- Richer reference-level adapter environment mirroring is still not fully ported: remote managed-home hydration, adapter-specific skill/config sync, and env value path rewriting should be added if sandbox AI sessions need complete parity with local host session state.

---

## Implementation Status — 2026-05-19 Workspace Runtime Command-Control Slice

This pass completed the Paperclip workspace command-control route/service layer so configured workspace services and jobs can be managed from execution workspaces and project workspaces instead of only being observed.

Completed:

- Added shared workspace command helpers for normalizing `workspaceRuntime.commands`, fallback `services`/`jobs`, stable command ids, service indexes, and runtime-service matching.
- Added runtime control validators plus execution/project workspace runtime config support, including `workspaceRuntime` desired state and per-service state maps persisted in metadata.
- Added project workspace runtime config read/merge helpers that preserve sibling metadata while storing runtime defaults under `metadata.runtimeConfig`.
- Added execution workspace runtime endpoints under `/api/execution-workspaces/:id/runtime-services/:action` and `/api/execution-workspaces/:id/runtime-commands/:action`.
- Added project workspace runtime endpoints under `/api/projects/:id/workspaces/:workspaceId/runtime-services/:action` and `/api/projects/:id/workspaces/:workspaceId/runtime-commands/:action`.
- Supported `start`, `stop`, `restart`, and `run`, including job-only `run` validation, service start/restart validation, selected `workspaceCommandId`, `runtimeServiceId`, and `serviceIndex` targets.
- Persisted desired runtime service state after manual control operations and kept manual starts FK-safe by allowing service records without a heartbeat-run lease.
- Reused workspace operation recording for command output, activity logging, and bounded stdout/stderr response payloads.
- Updated archive cleanup to honor persisted execution workspace config, including provision/cleanup/teardown command metadata.

Validated:

- `pnpm exec vitest run src/test/workspace-runtime-control-contracts.test.ts src/test/workspace-command-authz.test.ts`
- `pnpm --filter @paperclipai/shared build`
- `pnpm --filter @paperclipai/server compile`
- `pnpm exec tsc -p tsconfig.app.json`
- `pnpm exec vite build`
- `pnpm --filter @paperclipai/db build`
- `pnpm --filter @paperclipai/adapter-utils build`
- `pnpm --filter @paperclipai/plugin-sdk build`

Remaining before full `/goal` completion:

- Richer reference-level adapter environment mirroring is still not fully ported: remote managed-home hydration, adapter-specific skill/config sync, and env value path rewriting should be added if sandbox AI sessions need complete parity with local host session state.
- Production Vercel/Supabase linking, deployment, and full-test cleanup remain outstanding.

---

## Implementation Status — 2026-05-19 Adapter Plugin Hot-Reload Slice

This pass replaced the intentionally unsupported adapter management stubs with the Paperclip external adapter plugin loader and runtime management path.

Completed:

- Added `server/src/adapters/plugin-loader.ts` for loading external adapter packages from the adapter-plugin store, validating `createServerAdapter()`, extracting `./ui-parser` exports, and reloading modules with cache-busted file URLs.
- Taught the server adapter registry to load persisted external adapters at startup, preserve builtin fallbacks for overridden types, resolve host session-management defaults for external modules, and restore builtin adapters when overrides are unregistered.
- Replaced `/api/adapters/install`, `/api/adapters/:type/reload`, and `/api/adapters/:type/reinstall` 501 responses with live instance-admin implementations.
- Added `DELETE /api/adapters/:type` for unregistering/removing external adapters and npm uninstall for npm-sourced plugins.
- Extended adapter inventory/config metadata so external adapters can report config schemas, capability flags, model profiles, runtime command specs, package versions, local-path source, disabled state, override state, and optional UI parser assets.
- Added focused loader tests using temporary local adapter packages so install/reload behavior is covered without network access or npm registry calls.

Validated:

- `pnpm exec vitest run src/test/adapter-plugin-loader.test.ts src/test/adapter-plugin-store.test.ts`
- `pnpm --filter @paperclipai/adapter-utils build`
- `pnpm --filter @paperclipai/plugin-sdk build`
- `pnpm --filter @paperclipai/shared build`
- `pnpm --filter @paperclipai/server compile`
- `pnpm exec tsc -p tsconfig.app.json`

Remaining before full `/goal` completion:

- Richer reference-level adapter environment mirroring is still not fully ported: remote managed-home hydration, adapter-specific skill/config sync, and env value path rewriting should be added if sandbox AI sessions need complete parity with local host session state.
- At this point in the implementation log, new bundled adapter package parity remained: the reference repo included `acpx-local`, `cursor-cloud`, and `grok-local` packages that were not yet in Agency. Later slices below close all three.
- Production Vercel/Supabase linking, deployment, and full-test cleanup remain outstanding.

---

## Implementation Status — 2026-05-19 Adapter Utils + Grok Local Slice

This pass pulled the richer reference adapter runtime utilities into Agency and added the safest missing bundled adapter package, `grok-local`, without introducing a new registry dependency.

Completed:

- Replaced the minimal adapter-utils remote execution bridge with the reference runtime utility layer needed by current local adapters: remote/sandbox managed runtime helpers, workspace restore merge helpers, command redaction, sandbox shell/install helpers, remote execution env helpers, expanded execution-target helpers, expanded server-utils, and shared adapter types.
- Preserved compatibility for Agency's existing local/process execution paths by keeping `runChildProcess()` usable with both legacy remote specs and the newer provider-neutral `executionTarget`.
- Kept copied adapter-utils code compatible with the app compiler target by avoiding newer `String.replaceAll()` library requirements.
- Updated environment transport typing so SSH/sandbox execution specs flow through `environment-run-orchestrator` without being forced into a loose `Record<string, unknown>`.
- Added `packages/adapters/grok-local` from the reference repo, aligned its TypeScript config with Agency adapter packages, and added a package-level Vitest config for its Node tests.
- Registered `grok_local` as a built-in server adapter with skills sync, session codec, materialized runtime skills, instructions bundle support, runtime command metadata, and remote execution eligibility.
- Added `@paperclipai/adapter-grok-local` to the server workspace dependencies and relinked the workspace with `pnpm install`.
- Fixed the existing `gemini-local` package build config to use the shared package tsconfig, matching the other adapter packages.

Validated:

- `pnpm --filter @paperclipai/adapter-utils build`
- `pnpm --filter @paperclipai/adapter-grok-local build`
- `pnpm --filter @paperclipai/adapter-gemini-local build`
- `pnpm --filter @paperclipai/adapter-claude-local build`
- `pnpm --filter @paperclipai/adapter-codex-local build`
- `pnpm --filter @paperclipai/adapter-cursor-local build`
- `pnpm --filter @paperclipai/adapter-opencode-local build`
- `pnpm --filter @paperclipai/adapter-pi-local build`
- `pnpm --filter @paperclipai/shared --filter @paperclipai/db --filter @paperclipai/plugin-sdk build`
- `pnpm --filter @paperclipai/server compile`
- `pnpm exec tsc -p tsconfig.app.json`
- `pnpm exec vite build`
- `pnpm exec vitest run --config vitest.config.ts` from `packages/adapters/grok-local/` — 7 files / 26 tests passed.

Remaining before full `/goal` completion:

- Bundled adapter package parity still has two dependency-bearing packages left at this point in the log: `acpx-local` and `cursor-cloud`. Later slices below close both.
- Production Vercel/Supabase linking, deployment, and full-test cleanup remain outstanding.

---

## Implementation Status — 2026-05-19 Cursor Cloud Bundled Adapter Slice

This pass added the reference `cursor-cloud` bundled adapter, including the official Cursor SDK dependency and server registry support.

Completed:

- Added `packages/adapters/cursor-cloud` from the reference repo, aligned its package dependency style with Agency, excluded copied tests from the package build, and added a package-level Node Vitest config.
- Added `@cursor/sdk` through `@paperclipai/adapter-cursor-cloud` and relinked the workspace with `pnpm install --force --network-concurrency=1` after the first high-concurrency network attempt failed on transient registry resets.
- Registered `cursor_cloud` as a built-in server adapter with session codec, config schema, instructions bundle support, and non-local-JWT cloud execution semantics.
- Added `@paperclipai/adapter-cursor-cloud` to server workspace dependencies and built-in adapter type tracking.

Validated:

- `pnpm --filter @paperclipai/adapter-cursor-cloud build`
- `pnpm --filter @paperclipai/adapter-grok-local --filter @paperclipai/adapter-cursor-cloud build`
- `pnpm --filter @paperclipai/adapter-utils build`
- `pnpm --filter @paperclipai/server compile`
- `pnpm exec tsc -p tsconfig.app.json`
- `pnpm exec vitest run --config vitest.config.ts` from `packages/adapters/cursor-cloud/` — 4 files / 12 tests passed.
- `pnpm --filter @paperclipai/shared --filter @paperclipai/db --filter @paperclipai/plugin-sdk build`
- `pnpm exec vite build`

Remaining before full `/goal` completion:

- Bundled adapter package parity now has one package left: `acpx-local`.
- Production Vercel/Supabase linking, deployment, and full-test cleanup remain outstanding.

---

## Implementation Status — 2026-05-19 ACPX Local Bundled Adapter Slice

This pass added the final reference bundled adapter package, `acpx-local`, including ACPX, Claude ACP, and Codex ACP dependencies plus server registry support.

Completed:

- Added `packages/adapters/acpx-local` from the reference repo, aligned its adapter-utils dependency style with Agency, excluded copied tests from the package build, and added a package-level Node Vitest include.
- Added `@paperclipai/adapter-acpx-local` to server workspace dependencies and relinked the workspace with `pnpm install --force --network-concurrency=1`. The sandboxed install hit DNS restrictions, so the install was rerun with network escalation.
- Registered `acpx_local` as a built-in server adapter with skills sync, session codec, config schema, instructions bundle support, local-agent JWT support, and combined Claude/Codex model metadata.
- Confirmed the current adapter-utils package already includes the ACPX-required Paperclip workspace env helpers (`applyPaperclipWorkspaceEnv`, `shapePaperclipWorkspaceEnvForExecution`, `rewriteWorkspaceCwdEnvVarsForExecution`, and `resolvePaperclipInstanceRootForAdapter`).
- Kept ACPX adapter tests sandbox-safe by routing the process-env isolation test state directory through a temp root instead of the default `~/.paperclip` path.

Validated:

- `pnpm --filter @paperclipai/adapter-utils build`
- `pnpm --filter @paperclipai/adapter-acpx-local build`
- `pnpm --filter @paperclipai/server compile`
- `pnpm exec tsc -p tsconfig.app.json`
- `pnpm exec vitest run --config vitest.config.ts` from `packages/adapters/acpx-local/` — 4 files / 29 tests passed.
- `pnpm --filter @paperclipai/adapter-acpx-local --filter @paperclipai/adapter-grok-local --filter @paperclipai/adapter-cursor-cloud build`
- `pnpm exec vite build`

Remaining before full `/goal` completion:

- Bundled adapter package parity is now closed for `acpx-local`, `cursor-cloud`, and `grok-local`.
- Full-test cleanup is now closed by the validation/UI parity pass below.
- Production Vercel/Supabase linking, deployment, and live environment verification remain outstanding.

## Implementation Status — 2026-05-19 Validation + UI Adapter Parity

This pass closed the stale full-suite failures from the server API migration and exposed the newly ported bundled adapters in the Agency UI registry.

Completed:

- Updated the affected tests for the current server API and active-company contracts across agent management, first-run consistency, loading/error states, live-data hooks, submission proof, and adapter execution target handling.
- Added UI adapter modules for `grok_local`, `cursor_cloud`, and `acpx_local`, including config builders, config fields, stdout parsers, registry entries, executable-adapter support, and default config values for adapter schema fields.
- Added the new local adapters to the New Agent working-directory affordance and kept `cursor_cloud` available as an executable cloud adapter.
- Updated adapter registry tests for the 13-adapter UI set.

Validated:

- `pnpm exec vitest run src/test/adapter-execution-target-runner.test.ts src/test/agent-detail-control-plane.test.tsx src/test/agent-management.test.tsx src/test/loading-error-empty-states.test.tsx src/test/live-data-hooks-demo-mode.test.tsx src/test/submission-proof-panel.test.tsx`
- `pnpm exec vitest run src/test/first-run-agent-consistency.test.tsx`
- `pnpm exec vitest run src/test/hermes-adapter.test.ts src/test/adapter-system.test.ts`
- `pnpm exec tsc -p tsconfig.app.json`
- `pnpm -r typecheck`
- Exact Vercel build command from `vercel.json`: `pnpm --filter @paperclipai/shared build && pnpm --filter @paperclipai/db build && pnpm --filter @paperclipai/adapter-utils build && pnpm --filter @paperclipai/plugin-sdk build && pnpm --filter @paperclipai/server compile && pnpm exec vite build`
- `pnpm test:run` — 67 files / 906 tests passed.
- Browser smoke at `http://127.0.0.1:5190/agents/new` with auth/onboarding bypass verified the New Agent adapter dropdown includes `Grok Build (local)`, `Cursor Cloud`, and `ACPX (local)`.

Remaining before final completion:

- `.vercel/project.json` is still absent, so the checkout has not been linked or deployed to a Vercel production project in this pass.
- Supabase is locally linked to project `lptryhnnhhvbblrrsaqa`, but live Supabase migration status, edge-function deploy status, advisors, and production environment variables were not verified in this pass.
- Final completion should include Vercel project link/deploy validation plus live Supabase verification against the intended production project.

---

## 1. Title and Objective

**Title.** Express the full Paperclip autonomous-company control plane through Agency's 3D Delegation cockpit, with live, company-scoped, governance-aware behavior and zero regression to Agency-only surfaces.

**One-paragraph mission.** Paperclip's runtime (companies, agents, goals, projects, issues, comments, runs, heartbeats, approvals, budgets, costs, documents, work products, activity, plugins, routines, secrets, execution workspaces) is already substantially ported into `agency-wzrdwork-main/` at the server, schema, package, and route levels. The remaining work is integrative, not foundational: extend the cockpit's data snapshot, runtime mapper, 3D state machine, inspector surfaces, kanban, action log, and approval/budget UX so the Delegation 3D environment becomes an honest, real-time visualization of the Paperclip control plane — while preserving every Agency-only feature (3D cockpit, Web3/wallet auth, Delegations, integrations dashboard, proof pack, ERC-8004, x402, MetaMask delegations, Bankr/Celo/Lido/Uniswap/Venice/OpenServ/Composio/Hermes, Crossflow tracing, compat client) and the existing route surface.

**Desired end state.** A board operator opens `/cockpit`, sees the active company materialized as a 3D office populated by NPCs representing live agents, with each NPC's animation, expression, alert bubble, and inspector reflecting its current Paperclip state (idle, queued, running heartbeat, awaiting approval, blocked, over budget / paused, failed, completed, needs user input, producing work product). The Kanban panel is bound to live `issues`; the Action Log panel surfaces real `activity_log` and `heartbeat_run_events`; the Inspector panel exposes the agent's active issue, latest run, pending approval, documents/work products, cost & token burn, heartbeat history, and adapter config — with deep links into `/issues/:id`, `/approvals/:id`, `/runs/:id`, `/agents/:id`. Approval/budget/run-state interventions can be initiated inline from the cockpit without losing scene synchronization. Demo mode remains a graceful fallback.

---

## 2. Current-State Findings

This section is grounded by direct reads of:

- `agency-wzrdwork-main/AGENTS.md`
- `agency-wzrdwork-main/docs/PARITY_MATRIX.md`
- `agency-wzrdwork-main/docs/SCHEMA_MIGRATION_ANALYSIS.md`
- `agency-wzrdwork-main/src/App.tsx`
- `agency-wzrdwork-main/src/features/cockpit/pages/CockpitPage.tsx`
- `agency-wzrdwork-main/src/features/cockpit/lib/mappers.ts`
- `agency-wzrdwork-main/src/features/cockpit/lib/useAgencyData.ts`
- `agency-wzrdwork-main/src/features/cockpit/lib/domain.ts`
- `agency-wzrdwork-main/src/features/cockpit/delegation/store/agencyStore.ts`
- `agency-wzrdwork-main/src/features/cockpit/delegation/types.ts`
- `agency-wzrdwork-main/src/features/cockpit/delegation/components/*`
- `agency-wzrdwork-main/server/src/routes/agency.ts`
- `agency-wzrdwork-main/server/src/routes/index.ts`
- `paperclip-master 2/AGENTS.md`, `README.md`, `doc/GOAL.md`, `doc/PRODUCT.md`, `doc/SPEC-implementation.md`, `doc/DATABASE.md`

### 2.1 Already present in the base repo

Per `docs/PARITY_MATRIX.md` (dated 2026-03-21, 99.4% coverage) and direct file inspection:

- **Server (124 files)**: every Paperclip route, service, middleware, storage provider, secrets provider, adapter, and root server file is ported. `server/src/routes/agency.ts` already exposes `GET /api/agency/snapshot?companyId=...` and reads via `getAgencySnapshot()` in `services/core.ts`. Routes index includes `health, companies, agents, projects, issues, goals, approvals, secrets, costs, activity, dashboard, sidebar-badges, llms, access, instance-settings, assets, execution-workspaces, plugin-ui-static, routines, company-skills, org-chart-svg` — and ancillary `auth, integrations, plugins, issues-checkout-wakeup`.
- **Packages**: `packages/db` (Drizzle, 53 schemas), `packages/shared`, `packages/adapters`, `packages/adapter-utils`, `packages/plugins` all present.
- **UI workspace**: legacy Paperclip UI directory is ported as upstream parity, separate from the Agency cockpit UI in `agency-wzrdwork-main/src/`.
- **Agency cockpit**: `src/features/cockpit/` provides:
  - `pages/CockpitPage.tsx` — top-level shell hosting `SceneManager`, `UIOverlay`, `ActionLogPanel`, `KanbanPanel`, `InspectorPanel`, `CockpitSceneOverlay`, `CockpitSceneProofPanel`.
  - `lib/useAgencyData.ts` — `useQuery(['agency-snapshot', companyId])` against `getAgencySnapshotRecord` → `/api/agency/snapshot`. 10s polling when server-backed; demo fallback via `DEMO_SNAPSHOT`.
  - `lib/mappers.ts` — `buildCockpitRuntime(snapshot)` converts an `AgencySnapshot` (company + agents + projects + goals + issues + approvals + runs + activity) into runtime `AgentSet`, `tasks`, `actionLog`, `debugLog`, `projectInspector`, `agentInspectors`, `phase`.
  - `delegation/three/*` — Three.js engine (`Engine`, `Stage`, `WorldManager`, `CharacterManager`, `NavMeshManager`, `PoiManager`, `DriverManager`, `NpcAgentDriver`, `PlayerInputDriver`, `CharacterController`) and behavior buffers (`CharacterStateMachine`, `AgentStateBuffer`, `ExpressionBuffer`).
  - `delegation/components/*` — `UIOverlay` (alert bubbles + name plates), `KanbanPanel` (DnD-kit board bound to live issues with optimistic status mutations), `ActionLogPanel` (Activity tab from `snapshot.activity` and Technical tab from runtime `debugLog`), `InspectorPanel` (auto-switches between `ProjectView` and `AgentView`).
- **Routes in `App.tsx`**: `cockpit`, `dashboard`, `inbox`, `issues`, `issues/:issueId`, `goals`, `approvals`, `approvals/:approvalId`, `projects`, `projects/:projectId`, `agents`, `agents/new`, `agents/:id`, `org`, `org-chart`, `costs`, `activity`, `integrations`, `skills`, `delegations`, `submission-proof`, `chat`, `chat/:sessionId`, `design-guide`, `settings`, `runs/:runId`, `plugins`, `budgets`, `documents`, `workspaces`, `invites`. Auth via `ThirdwebProvider` + `AuthGate` + `OnboardingGate`. `SupabaseLiveUpdates` is mounted.
- **Agency-only features preserved** (per parity matrix): 3D Cockpit, Wallet Auth, ERC-8004, x402, MetaMask delegations, Uniswap, Celo, Lido, Venice, Bankr, OpenServ, Composio, Hermes, Crossflow Tracing, Integrations Dashboard, Proof Pack, Compat API Client.

### 2.2 Real remaining gap

This is NOT a "port Paperclip" task. The port is functionally complete. The gap is **integration & expression** — wiring Paperclip's full control-plane semantics through the cockpit's runtime and 3D state machine, plus closing the documented schema drift.

#### 2.2.1 Cockpit snapshot is too narrow

`src/features/cockpit/lib/domain.ts` defines `AgencySnapshot` with only: `company, agents, projects, goals, issues, approvals, runs, activity`. Missing from the snapshot vs. Paperclip's first-class entities (`paperclip-master 2/doc/SPEC-implementation.md` §7.x):

- `issue_comments`, `issue_documents` / `documents` / `document_revisions`, `issue_work_products`, `issue_attachments` / `assets`, `issue_relations` (blockers), `labels` / `issue_labels`, `issue_approvals`, `issue_execution_decisions`
- `heartbeat_runs` proper (the runs we have are a subset), `heartbeat_run_events`, `agent_runtime_state`, `agent_wakeup_requests`, `agent_task_sessions`
- `budget_policies`, `budget_incidents`, `cost_events` rollups (`costs/summary`, `costs/by-agent`, `costs/by-project`)
- `execution_workspaces`, `project_workspaces`, `workspace_runtime_services`, `workspace_operations`
- `plugins`, plugin jobs/logs (active count), `routines`, `routine_runs` (next/last)
- `company_secrets` metadata (count + provider, never values), `secret_access_events` (recent)
- `agent_api_keys` (count + last_used) for the agent inspector "Health" section
- Dashboard rollups already provided by `/api/companies/:companyId/dashboard` and `/api/companies/:companyId/costs/summary` — these are NOT joined into the cockpit snapshot

#### 2.2.2 Runtime mapper is shallow

`buildCockpitRuntime` (lib/mappers.ts) only emits five visual phases (`idle | briefing | working | awaiting_approval | done`) and four task statuses (`scheduled | on_hold | in_progress | done`). Paperclip's actual agent states (`active | idle | running | paused | error | pending_approval | terminated`) and issue states (`backlog | todo | in_progress | in_review | blocked | done | cancelled`) collapse lossy onto the cockpit. The 3D state machine never sees `queued`, `over_budget`, `failed`, `needs_input`, `producing_work_product`, or `heartbeat_tick`.

#### 2.2.3 3D state machine ignores Paperclip semantics

`delegation/three/behavior/CharacterStateMachine.ts` and `CharacterManager.ts` drive animation/expression from a coarse `AgentBehavior` (IDLE / GOTO / SEATED) and the `AnimationName` enum (Idle/Walk/Talk/Listen/Sit/...). `UIOverlay` only renders `Siren` (orchestrator idle), `PartyPopper` (project done), or `MessageSquareWarning` (approval needed). There is no visual binding for:

- queued or scheduled heartbeat → standing/look-around
- running heartbeat → sit_work + speech-bubble pulse
- over-budget hard-stop → red expression, pause icon, stop sign
- failed / error → sad expression, broken bubble
- producing work product → happy + write/pick animation + outbox indicator
- needs user input → wave + chat bubble
- terminated → seat empty / despawn

#### 2.2.4 Inspector under-uses the data already present

`AgentView.tsx` renders `agentInspectors[index]` which carries fields for `activeIssue, pendingApproval, latestRun, lastHeartbeat, session, lastError, tokenStats, totalCost, recentIssues, links` (see `delegation/store/inspector.ts`). The mapper populates these, but the snapshot does not yet carry the underlying data (documents, work products, heartbeat events, budget incidents). Inspector "links" must point to live detail pages (`/issues/:id`, `/approvals/:id`, `/runs/:id`, `/agents/:id`) and the inspector tabs need first-class sections for Documents, Work Products, Heartbeats, Costs, Adapter Config, Permissions.

#### 2.2.5 Approval flow is not interactive inside the cockpit

Clicking an "Approval Needed" alert bubble currently calls `setSelectedNpc(agent.index)` — it opens the inspector but does not jump to the approval. There is no inline approve/reject affordance; the user must navigate to `/approvals/:id`. Paperclip's V1 contract requires board approvals to be one click away.

#### 2.2.6 Live updates are still polling

`useAgencyData` uses `refetchInterval: 10_000`. Paperclip ships a WebSocket (`server/src/realtime/live-events-ws.ts`), and Agency mounts `SupabaseLiveUpdates`. These are not wired into the cockpit invalidation path; agent state changes do not propagate to the 3D scene faster than 10s.

#### 2.2.7 Documented schema drift (per `docs/SCHEMA_MIGRATION_ANALYSIS.md`)

- `chat_sessions`, `chat_messages`, `agent_integrations` created via Supabase migration `202603180001_paperclip_port_schemas.sql` but **no Drizzle TypeScript schema files** in `packages/db/src/schema/`.
- Columns added by migration but missing from Drizzle: `agents.wallet_address`, `agents.budget_usd`, `agents.prompt_template`, `companies.wallet_address`.
- Effect: server services that read these columns lose type-safety and `pnpm db:generate` cannot round-trip the schema.

#### 2.2.8 Cockpit does not surface plugins, routines, secrets, execution workspaces

The base repo has full route/service implementations (`/api/plugins`, `/api/routines`, `/api/secrets`, `/api/execution-workspaces`) but the cockpit/scene/inspector never reference them. The Agency-only pages (`PluginManager`, `ExecutionWorkspaces`, `AssetsDocuments`, `BudgetQuota`, `InviteSettings`) exist as standalone routes — they should additionally project into the cockpit (POI hotspots in the 3D office, inspector tabs, alert bubbles for failed routines / plugin job crashes / secret-rotation due).

#### 2.2.9 Test coverage of the integration layer

Tests for `buildCockpitRuntime`, `useAgencyData`, the inspector models, and the scene-data sync do not appear to cover the broader state matrix. Need targeted unit tests for each new cockpit visual state and an integration test that drives `getAgencySnapshot` through realistic Paperclip fixtures.

---

## 3. Product Model — Paperclip ↔ Agency 3D Cockpit Mapping

| Paperclip concept | Cockpit expression |
|---|---|
| **Company** | The 3D office / cockpit scene context. Company `brandColor` drives manager NPC color; `brief` shown in live-brief overlay; `name` in header. One active company at a time, resolved via `useActiveCompany`. |
| **Goals (hierarchy)** | "Mission" plaque on the wall; project inspector's company brief and quick-link to `/goals`. Hover reveals goal chain ancestry for the selected issue. |
| **Projects** | Department zones inside the 3D office (engineering pod, marketing wall, ops corner). Each project = a clustered POI region; `project.lead_agent_id` sits at the head seat. |
| **Agents (org chart)** | NPCs. The CEO/root manager NPC takes the center seat colored with `company.brandColor`. Reporting tree drives seating layout (manager forward, reports in a half-ring). Player (board) is `PLAYER_INDEX = 0`. |
| **Agent adapter type** | Inspector "Adapter" badge; emote variant (`process` → typing emote, `http` → satellite-dish emote, `cli` → laptop emote, `claude_local`/`codex_local`/`cursor` → branded sprite tints). |
| **Issues (tasks)** | Kanban cards (lower panel) AND task-cards floating above the assigned NPC when expanded. Card priority drives card border color; status drives column. |
| **Single assignee + atomic checkout** | An issue card can only animate at one NPC at a time. While `checkout_run_id` is non-null, the NPC sits in `Sit_Work` with a lock chip on the card. |
| **Comments** | Inspector "Comments" tab inside the issue context (Detail page) — cockpit shows the most recent comment as a one-line speech bubble. |
| **Issue documents / work products** | Inspector "Outputs" tab with thumbnails; in the 3D scene, a small artifact prop appears next to the NPC when `issue_work_products.created_at` advanced in the last poll cycle. |
| **Attachments / assets** | Same Outputs tab, file-type chips with deep links into `/documents` page. |
| **Runs (`heartbeat_runs`)** | Active state of an NPC. `queued` → standing-LookAround; `running` → Sit_Work + speech pulse; `succeeded` → Happy emote, brief; `failed` → Sad + red bubble; `timed_out` → DoubtfulFace + amber bubble; `cancelled` → Idle + grey bubble. |
| **Heartbeat events (`heartbeat_run_events`)** | Stream into the Action Log → Technical tab as `phase = request | response` entries. |
| **Approvals** | Orange `MessageSquareWarning` bubble above the NPC who requested it. Click → inline Approval Sheet inside the cockpit overlay (approve / reject / request revision) calling `/approvals/:id/approve|reject`. Pending count surfaces in the header badge. |
| **Budgets (company + agent)** | Each NPC shows a thin budget ring around the seat. Ring fills as monthly spend approaches limit. At warning threshold → amber pulse. On hard-stop → red ring + Pause icon + `BUDGET PAUSED` chip in inspector. Company-wide breach dims the whole scene and shows a top-bar "OVER BUDGET — auto-paused" banner. |
| **Costs (`cost_events`)** | Inspector "Usage" grid (tokens in/out/cached, USD); company project inspector shows month-to-date spend gauge from `/costs/summary`. |
| **Activity log** | Action Log panel "Activity" tab (already in place). Filter by agent uses `agent_id`. |
| **Execution workspaces / project workspaces / runtime services** | Inspector "Workspace" tab: shows `execution_workspace_id`, runtime services (preview URL), workspace operations recent ops. Click → `/workspaces`. |
| **Plugins** | A "plugin shelf" POI in the office. Each loaded plugin = a glowing book; failing plugin job pulses red. Click → `/plugins`. Inspector exposes per-agent plugin tool exposure. |
| **Adapters / plugin tool dispatcher** | Inspector "Adapter" tab: adapter type, config (redacted), tools exposed, recent tool-call summaries (from runtime debug log). |
| **Secrets** | A safe icon POI in the manager's corner. Inspector shows secret bindings for the agent (names + version refs only, never values). |
| **Routines (cron / webhook)** | Calendar POI on the wall. Each routine shows next run countdown; routine failure bubble appears over the assigned agent. |
| **Org chart** | Full graph view from header → existing `/org-chart` (preserved). Cockpit shows the live working slice (top 12). |
| **Dashboard rollups** | `ProjectView` Live Summary cards (Agents online, Open issues, Pending approvals, Budget %, Active runs). Sourced from `/api/companies/:companyId/dashboard`. |
| **Activity & audit log** | Action Log Activity tab (already correct). Add filter by entity type. |
| **Demo / fallback mode** | Preserved. When `snapshot.source !== "server"` the cockpit shows the `DemoModeBanner`, the `CockpitSceneProofPanel` surfaces `dataSource = "demo"`, and writes are short-circuited inside `useAgencyData` (no server calls when demo). |

---

## 4. Implementation Plan (decision-complete, phased)

> Codex must do work in this order. Earlier phases unlock later ones.

### 4.1 Phase 0 — Repo Audit & Parity Verification

**Intent.** Re-confirm parity-matrix claims against the live code before writing anything. The matrix is dated 2026-03-21; drift is possible.

**Actions.**

1. Diff `agency-wzrdwork-main/server/src/` vs `paperclip-master 2/server/src/` file-by-file (routes, services, middleware, adapters, storage, secrets, realtime, auth). Output a `docs/PARITY_REVERIFY_<DATE>.md` table listing: file, present?, byte-identical?, semantic drift?
2. Diff `packages/db/src/schema/*.ts` between repos. Confirm 53/53 matched. Note any new schemas added in either repo since 2026-03-21.
3. Diff `packages/shared/` types/validators/api-path constants between repos.
4. Diff `packages/adapters/`, `packages/adapter-utils/`, `packages/plugins/`.
5. Verify the Supabase migration `202603180001_paperclip_port_schemas.sql` matches what the Drizzle schema *should* describe (drift items in §2.2.7).
6. Catalog Agency-only files (those in base that are not in Paperclip) so subsequent phases avoid touching them by mistake.

**Files / dirs.** `agency-wzrdwork-main/{server,packages,supabase/migrations}`, `paperclip-master 2/{server,packages}`.

**Acceptance.**
- `docs/PARITY_REVERIFY_<YYYY-MM-DD>.md` exists.
- Any new drift since 2026-03-21 is enumerated and triaged into "fix now" vs "out of scope for this goal".

### 4.2 Phase 1 — Schema Drift Closure

**Intent.** Restore TypeScript schema fidelity for tables/columns the server already depends on.

**Actions.**

1. Add Drizzle schema files in `packages/db/src/schema/`:
   - `chat_sessions.ts`, `chat_messages.ts`, `agent_integrations.ts` — mirror the Supabase migration `202603180001`.
2. Extend existing schemas:
   - `agents.ts` → add `wallet_address text`, `budget_usd numeric`, `prompt_template text` (preserve existing `budget_monthly_cents` for Paperclip parity; the two are coexisting accounting lanes).
   - `companies.ts` → add `wallet_address text`.
3. Export new schemas from `packages/db/src/schema/index.ts`.
4. Run `pnpm db:generate` and commit the generated migration. Verify it diff-matches the existing Supabase migration (no destructive drift).
5. Update `packages/shared` types to reflect the new columns where domain types are exported.

**Files.** `packages/db/src/schema/{chat_sessions,chat_messages,agent_integrations,agents,companies}.ts`, `packages/db/src/schema/index.ts`, `packages/shared/src/types/*`, generated `packages/db/migrations/*.sql`.

**Acceptance.**
- `pnpm -r typecheck` green.
- `pnpm db:generate` produces a no-op diff against the database created by the canonical Supabase migration.
- Server services that read these columns are now typed end-to-end (search for any `as any` cast on these fields and remove).

### 4.3 Phase 2 — Snapshot Surface Expansion

**Intent.** `/api/agency/snapshot` becomes the single source of truth the cockpit needs, joining the Paperclip primitives the 3D scene must visualize.

**Actions.**

1. Extend `AgencySnapshot` (`src/features/cockpit/lib/domain.ts`) with new sections:
   - `dashboard: { agentsOnline, runsActive, openIssues, pendingApprovals, monthSpendUsd, monthBudgetUsd, budgetUtilization }`
   - `costs: { byAgent: Record<agentId, { tokensIn, tokensOut, cached, usd }>; byProject: ...; total: ... }`
   - `budgets: { company: BudgetPolicySummary; perAgent: Record<agentId, BudgetPolicySummary>; incidents: BudgetIncidentSummary[] }`
   - `heartbeats: { byAgent: Record<agentId, { lastTickAt, lastStatus, runIds: string[] }>; recentEvents: HeartbeatEventSummary[] }`
   - `runtimeState: { byAgent: Record<agentId, { phase, sessionId, lastError, lastHeartbeatAt }> }`
   - `documents: DocumentSummary[]; workProducts: WorkProductSummary[]; attachments: AttachmentSummary[]`
   - `executionWorkspaces: ExecutionWorkspaceSummary[]; runtimeServices: RuntimeServiceSummary[]`
   - `plugins: { installed: PluginSummary[]; activeJobs: number; failingJobs: number }`
   - `routines: { upcoming: RoutineNext[]; recentRuns: RoutineRunSummary[] }`
   - `secrets: { count, providers, lastRotatedAt }` (metadata only — never values)
2. Add server snapshot composer in `server/src/services/core.ts` (extending `getAgencySnapshot`): join dashboard, cost, budget, heartbeat, document, work-product, plugin, routine, secret summaries; **enforce company scoping at every join**.
3. Add corresponding zod validators in `packages/shared/`.
4. Update `src/lib/server-api/agency.ts` typings.
5. Maintain backward-compat — old consumers (KanbanPanel, ActionLogPanel) keep working; new fields are additive.

**Files.** `server/src/services/core.ts`, `server/src/services/dashboard.ts`, `server/src/services/costs.ts`, `server/src/services/budgets.ts`, `server/src/services/heartbeat-run-summary.ts`, `server/src/services/documents.ts`, `server/src/services/work-products.ts`, `server/src/services/plugin-*.ts`, `server/src/routes/agency.ts`, `packages/shared/src/types/agency-snapshot.ts`, `src/features/cockpit/lib/domain.ts`, `src/lib/server-api/agency.ts`.

**Acceptance.**
- `GET /api/agency/snapshot?companyId=...` returns the extended payload.
- A zod schema in `packages/shared` validates both server response and client decode.
- Snapshot payload size remains under 200 KB for a fixture company of 12 agents / 100 issues (cap arrays where needed).
- Snapshot is company-scoped; cross-company leakage is impossible (regression test in §7).

### 4.4 Phase 3 — Cockpit Runtime Mapper Expansion

**Intent.** Translate the full Paperclip state space into cockpit-visible state.

**Actions.**

1. Expand cockpit visual state taxonomy in `src/features/cockpit/delegation/store/agencyStore.ts`:
   - Add `AgentVisualState`: `idle | queued | working | heartbeat_tick | awaiting_approval | blocked | over_budget | paused | failed | completed | needs_input | producing_work_product | terminated`.
   - Persist this per-agent in `agentInspectors[index].visualState`.
2. Extend `Task` status to mirror full issue status: `backlog | todo | in_progress | in_review | blocked | done | cancelled` (drop the lossy mapping; keep kanban-compatible).
3. Expand `ProjectPhase` to include `over_budget` and `failed`.
4. Rewrite `buildCockpitRuntime` (`src/features/cockpit/lib/mappers.ts`):
   - Compute each agent's `visualState` from `agent.status`, `runtimeState[agentId]`, `budgets.perAgent[agentId]`, `approvals` (pending requested by agent), `runs` (most recent terminal), `workProducts` (created within last 30s of snapshot), `heartbeats.byAgent[agentId]`.
   - Drive priority: terminated > over_budget > paused > failed > awaiting_approval > needs_input > blocked > producing_work_product > heartbeat_tick > working > queued > completed > idle.
   - Map agent → POI (seat / workstation) using `reports_to` tree depth and project membership.
5. Update `buildAgentInspectorModel` / `buildProjectInspectorModel` (`lib/inspectorModels.ts`) to surface documents, work products, heartbeats, costs, adapter config, plugin tools, secret bindings (names only), execution workspace.

**Files.** `src/features/cockpit/lib/mappers.ts`, `src/features/cockpit/lib/inspectorModels.ts`, `src/features/cockpit/delegation/store/agencyStore.ts`, `src/features/cockpit/delegation/store/inspector.ts`.

**Acceptance.**
- Unit tests in `src/features/cockpit/lib/__tests__/mappers.test.ts` cover every `AgentVisualState` transition (see §7).
- No agent is ever in two visual states simultaneously.
- For demo snapshot, the previously visible cockpit states still render correctly (regression).

### 4.5 Phase 4 — 3D State Machine + UIOverlay Expansion

**Intent.** The 3D scene actually shows the new states.

**Actions.**

1. Extend `CharacterStateMachine.ts` and `CharacterManager.ts`:
   - Add character states `queued_lookaround`, `heartbeat_pulse`, `over_budget_freeze`, `failed_sad`, `paused_seated`, `produce_artifact`, `wave_for_input`.
   - Map `AgentVisualState` → animation + expression + speaking flag in a dedicated `visualStateToCharacterState` table.
   - Honor `interruptible` to avoid yanking working agents out of `Sit_Work` for transient transitions.
2. Add visual-state-aware POIs in `WorldManager` / `PoiManager`:
   - Department zones, plugin shelf, secret safe, routine calendar, budget ring.
3. Rebuild `UIOverlay.tsx`:
   - Bubble matrix per visual state: queued (clock), working (none — speaker pulse), awaiting_approval (current `MessageSquareWarning`), blocked (`Ban`), over_budget (`AlertOctagon`, red), paused (`Pause`), failed (`AlertTriangle`), completed (`CheckCircle2` brief), needs_input (`Hand`), producing_work_product (`FileOutput`), terminated (`Skull`, dim).
   - Bubbles clickable when actionable (approval → approval sheet; needs_input → comment composer overlay; over_budget → budget detail; failed → run detail).
4. Add a top-bar banner state for `phase === "over_budget"` (red) and `phase === "failed"` (amber), in `CockpitPage.tsx`.
5. `CockpitSceneProofPanel` — include `visualStateCounts` in the proof snapshot for QA.

**Files.** `src/features/cockpit/delegation/three/behavior/CharacterStateMachine.ts`, `src/features/cockpit/delegation/three/entities/CharacterManager.ts`, `src/features/cockpit/delegation/three/world/{WorldManager,PoiManager}.ts`, `src/features/cockpit/delegation/components/UIOverlay.tsx`, `src/features/cockpit/components/CockpitSceneProofPanel.tsx`, `src/features/cockpit/pages/CockpitPage.tsx`.

**Acceptance.**
- For each `AgentVisualState`, a corresponding visible animation/bubble is rendered. Manual QA matrix passes (§5).
- No scene-thrash: visual state transitions debounce at ≥ 250 ms.

### 4.6 Phase 5 — Inspector Behavior Expansion

**Intent.** The inspector becomes the deep-dive surface for everything a board operator needs.

**Actions.**

1. `InspectorPanel.tsx` gains tabs: `Overview | Issues | Runs | Documents | Workspaces | Adapter | Permissions | Costs | Chat`.
2. `AgentView.tsx` consumes the expanded `agentInspectors[index]` and renders each tab; tabs hide cleanly when empty.
3. Issue rows render `identifier · title`, priority chip, status chip, assignee, due date if present; click → `/issues/:id`.
4. Run rows render status, started/ended, model, tokens in/out, cost, exit code; click → `/runs/:id`.
5. Document rows show key (plan, design, notes), latest revision number, locked indicator; click → `/documents` (filtered to issue).
6. Workspace tab shows `execution_workspace_id`, branch/worktree path (redacted prefix), runtime service preview URL with copy button, recent workspace_operations.
7. Adapter tab shows adapter_type, redacted config, exposed tool names (from plugin_tool_registry), and recent tool-call summary.
8. Permissions tab shows `permissions` jsonb interpreted (board overrides, manager subtree budget, etc).
9. Costs tab pulls from `costs.byAgent[id]` with per-model breakdown.
10. Chat tab routes to `/chat?agent=<id>` (Agency-only) — do not embed chat inline (PRODUCT.md: "Not a chatbot").
11. `ProjectView.tsx` gets a top-level "Health" strip: agents online, runs active, approvals pending, budget utilization, failing plugin jobs, blocked issues.

**Files.** `src/features/cockpit/delegation/components/{InspectorPanel,AgentView,ProjectView}.tsx`, `src/features/cockpit/delegation/store/inspector.ts`.

**Acceptance.**
- Each inspector tab works against a live snapshot fixture.
- All links resolve to existing detail pages.

### 4.7 Phase 6 — Kanban / Action Log / Debug Log Behavior

**Intent.** Lower-panel surfaces respect the broader state model and the company-scoping invariant.

**Actions.**

1. `KanbanPanel`:
   - Add `cancelled` column hidden by default behind a toggle.
   - Drag-drop honors Paperclip status transitions in `SPEC-implementation.md` §8.2 — illegal drops snap back with a toast.
   - Card chips: blocker count (`issue_relations`), comments count, work-products indicator, attachments indicator.
   - Atomic checkout: when dragging into `in_progress`, call `POST /issues/:id/checkout` (already a server route); 409 returns assignee/status conflict and surfaces toast.
2. `ActionLogPanel`:
   - Activity tab adds entity-type filter (issue / approval / run / agent / plugin / budget).
   - Add `heartbeat_run_events` as a Technical tab data source alongside the local debug log; render request/response phases consistently.
   - Server-Sent Events / WebSocket subscription replaces 10s poll for activity (see Phase 8).
3. Debug log: continue to be runtime-local for sandbox use, gated behind tech tab.

**Files.** `src/features/cockpit/delegation/components/{KanbanPanel,ActionLogPanel}.tsx`, `src/lib/server-api/issues.ts`.

**Acceptance.**
- Illegal kanban drops are rejected with toast and no DB write.
- Checkout 409 path is exercised (test).
- Heartbeat events appear in Technical tab streamed from server in under 2 s.

### 4.8 Phase 7 — Approvals, Budgets, Governance UX

**Intent.** Inline operator interventions stay inside the cockpit.

**Actions.**

1. New `ApprovalSheet` overlay component (right-side drawer over the 3D scene): renders approval `type`, `payload` summary, requested-by agent, decision-note input, Approve / Reject / Request Revision buttons. Calls `POST /approvals/:id/approve|reject` with optimistic update.
2. Clicking an `awaiting_approval` alert bubble opens `ApprovalSheet` for that approval directly (not the inspector).
3. Budget banner at the top: when `dashboard.budgetUtilization >= 0.9` shows amber; `>= 1.0` shows red with `Resume` (board can lift hard-stop by raising `budget_monthly_cents`) and `Open budgets` actions.
4. Per-agent over-budget: NPC ring goes red, inspector "Costs" tab shows incident, board can `Pause`/`Resume`/`Raise budget` via existing agent routes.
5. Pause/Resume/Terminate buttons in agent inspector header trigger `/agents/:id/pause|resume|terminate`. Terminate gated behind a confirm dialog and a `confirmText` typed match.
6. All operator mutations write to `activity_log` server-side (already done by services) — verify and add tests.

**Files.** New `src/features/cockpit/components/ApprovalSheet.tsx`, `src/features/cockpit/components/BudgetBanner.tsx`, `src/features/cockpit/delegation/components/InspectorPanel.tsx`, `src/lib/server-api/approvals.ts`, `src/lib/server-api/agents.ts`.

**Acceptance.**
- Approve/reject completes in cockpit without route change; snapshot reflects updated approval within next refresh.
- Hard-stop pauses agents and disables new issue creation for that agent (server enforces; UI confirms).
- Terminate is irreversible (server) and reflected in the scene by despawn.

### 4.9 Phase 8 — Live Events Integration

**Intent.** Replace polling with realtime updates.

**Actions.**

1. Add a `useAgencyLiveUpdates` hook that subscribes to:
   - `server/src/realtime/live-events-ws.ts` (Paperclip's WS bus) for `issue.*`, `approval.*`, `run.*`, `cost.*`, `activity.*`, `heartbeat.*` events, scoped to `companyId`.
   - `SupabaseLiveUpdates` already mounted — use it to invalidate `['agency-snapshot', companyId]` on row-level changes.
2. Disable `refetchInterval` when WS is connected. Re-enable as fallback when WS drops.
3. Use `queryClient.setQueryData` with merge instead of refetch for low-latency state changes where the event payload contains the full new row.

**Files.** New `src/features/cockpit/lib/useAgencyLiveUpdates.ts`, `src/features/cockpit/lib/useAgencyData.ts`, `src/components/SupabaseLiveUpdates.tsx`.

**Acceptance.**
- Manual: starting a run on the server updates the NPC's animation within 1 s.
- No double-fetches; query cache stays consistent under reconnect.

### 4.10 Phase 9 — Plugin / Routine / Secret / Workspace Surfacing

**Intent.** The Paperclip extension subsystems become first-class cockpit elements without bloating it.

**Actions.**

1. Add a `CockpitFloorOverlay` with four POI markers in the 3D scene:
   - **Plugins shelf** → click opens `/plugins` (existing) AND surfaces inline state (installed plugins count, failing jobs alert).
   - **Routines calendar** → click opens `/routines` page (verify route exists; route file `routines.ts` exists in server). UI page may need to be added/wired.
   - **Secret safe** → click opens `/settings` secrets section; inspector tab on each agent shows secret bindings (names only).
   - **Execution workspace board** → click opens `/workspaces`.
2. Alert bubbles in scene-level (not agent-level) for: failing plugin job, missed routine fire, secret-rotation due, workspace cleanup pending.
3. Inspector "Adapter" tab consumes plugin-exposed tools registered against the agent.

**Files.** `src/features/cockpit/delegation/three/world/PoiManager.ts`, new `src/features/cockpit/components/CockpitFloorOverlay.tsx`, `src/features/cockpit/delegation/components/UIOverlay.tsx`, new route page for `/routines` if missing.

**Acceptance.**
- All four POIs are clickable and deep-link to the right page.
- Scene-level alerts respect the same priority ladder as agent alerts (no overlap).

### 4.11 Phase 10 — Documents / Work Products / Artifacts

**Intent.** Honor PRODUCT.md principle #5 ("output-first"): make the result visible.

**Actions.**

1. Inspector "Documents" tab renders `documents` keyed under the agent's issues with link to `/documents` filtered view.
2. Inspector "Outputs" tab (renamed) merges `issue_work_products` + `issue_attachments`. Show thumbnail/preview for images; render markdown work products inline (collapsible).
3. When `issue_work_products.created_at` is fresh, the producing NPC plays `produce_artifact` animation and a small "📄" sprite floats up.
4. `AssetsDocumentsPage` (Agency-only) becomes the canonical detail view; cockpit just links to it with prefilters.

**Files.** `src/features/cockpit/delegation/components/AgentView.tsx`, `src/features/cockpit/delegation/three/entities/CharacterManager.ts`, `src/pages/AssetsDocuments.tsx`.

**Acceptance.**
- A produced work product is visible in the cockpit within one snapshot tick.
- Click-through to `/documents` filters to the agent / issue context.

### 4.12 Phase 11 — Testing, Verification, Docs

(see §7 for the full plan)

---

## 5. UX Requirements for the Delegation 3D Interface

### 5.1 Visual state matrix (mandatory)

| Visual state | Driver fields | Animation | Expression | Bubble | Ring | Interaction |
|---|---|---|---|---|---|---|
| `idle` | agent.status=`idle` AND no queued/running run | `Idle` | `idle` | none | grey | hover shows name plate |
| `queued` | runtimeState.phase=`queued` OR wakeup_request pending | `LookAround` (loop) | `neutral` | `Clock`, blue | blue | click → inspector |
| `working` | run.status=`running` | `Sit_Work` (loop) | `neutral` | speaker pulse | green | click → inspector → Runs |
| `heartbeat_tick` | heartbeat_run_events tick in last 5s | `Sit_Work` + brief `Talk` | `neutral` | dot pulse | green | click → Technical tab |
| `awaiting_approval` | approvals.status=`pending` requested by this agent | `Sit_Idle` | `doubtful` | `MessageSquareWarning`, orange | orange | click → **ApprovalSheet** |
| `blocked` | active issue.status=`blocked` OR issue_relations blocker unresolved | `Sit_Idle` | `sad` | `Ban`, red | red dotted | click → inspector → Issues (blocker chain) |
| `over_budget` | budgets.perAgent[id].state=`hard_stop` OR company hard-stop | freeze (no anim) | `surprised` | `AlertOctagon`, red | red filled | click → budget detail overlay |
| `paused` | agent.status=`paused` | `Sit_Idle` | `neutral` | `Pause`, grey | grey | click → inspector with Resume CTA |
| `failed` | latest run.status=`failed` AND no recovery | `Sad` | `sad` | `AlertTriangle`, amber | amber | click → run detail |
| `completed` | issue just transitioned to `done` (last 10s) | `Happy` (one-shot) → fall to `Idle` | `happy` | `CheckCircle2`, emerald (3s) | emerald flash | none |
| `needs_input` | issue_thread_interactions pending user reply OR approval has `revision_requested` | `Wave` | `surprised` | `Hand`, yellow | yellow | click → comment composer in inspector |
| `producing_work_product` | new issue_work_products in last 10s | `Pick` | `happy` | `FileOutput`, blue | blue brief | click → Outputs tab |
| `terminated` | agent.status=`terminated` | despawn | n/a | `Skull`, dim | none | not interactive |

### 5.2 Interaction rules

- Clicking an agent → inspector opens, agent selected, alert bubble suppressed.
- Clicking a kanban card → opens `/issues/:id` (new tab if modifier).
- Clicking an approval bubble → opens `ApprovalSheet` directly. Not the inspector.
- Clicking a needs-input bubble → opens inspector with comment composer focused.
- Action Log filter by agent → also focuses that agent in the scene.
- The scene stays mounted across detail-page navigation when possible (preserve `SceneContext`).
- Demo mode banner visible whenever `snapshot.source !== "server"`; cockpit remains fully interactable for demo data (writes are no-ops with toast "Demo mode").
- Compact viewport (< 1024 px) hides Action Log by default and folds Kanban (already implemented — preserve).
- Cinematic intro stays one-shot per session (already correct).

### 5.3 Accessibility

- All bubbles have aria-labels matching their visual-state name.
- All scene-overlay buttons are reachable by keyboard via existing focusable overlay.
- Color is not the only signal — icon + animation accompany every state.

---

## 6. Data and Contract Requirements

### 6.1 Synchronization checklist (every change touches all four)

When any of these are modified, all four layers must be updated atomically (per `AGENTS.md` §5.2):

1. **`packages/db/src/schema/*`** — Drizzle definitions.
2. **`packages/shared/src/types|validators|constants`** — exported types, zod validators, API path constants.
3. **`server/src/routes/* + server/src/services/*`** — REST/WS endpoints with company-scoping checks.
4. **`src/lib/server-api/* + src/features/cockpit/lib/* + src/features/cockpit/delegation/*`** — client API, mapper, inspector models, store.

### 6.2 Specific contracts that must be added

- `packages/shared/src/types/agency-snapshot.ts` — the expanded `AgencySnapshot` type and zod schema.
- `packages/shared/src/api-paths.ts` — `/api/agency/snapshot`, `/api/agency/live` (WS), already-existing routes.
- New zod validators for incoming approval decisions, budget edits, agent lifecycle.

### 6.3 Schema drift to repair (from `docs/SCHEMA_MIGRATION_ANALYSIS.md`)

- `chat_sessions`, `chat_messages`, `agent_integrations` → add Drizzle schemas.
- `agents.wallet_address`, `agents.budget_usd`, `agents.prompt_template`, `companies.wallet_address` → add to Drizzle.
- Confirm `pnpm db:generate` reproduces a no-op migration against the canonical state.

### 6.4 Company-scoping invariant

Every new server-side query inside `getAgencySnapshot` and adjacent services must include a `company_id = :companyId` predicate. Add a test that posts a request with a `companyId` the actor does not have access to and expects `403`.

### 6.5 Realtime contract

- WS topic: `agency.snapshot.<companyId>`.
- Event types: `issue.created|updated|status_changed`, `approval.requested|decided`, `run.started|finished|failed`, `cost.recorded`, `activity.appended`, `heartbeat.tick`, `budget.warning|hard_stop|cleared`, `work_product.created`.
- All events carry `{ companyId, entityId, ...payload }`; client filters by active `companyId`.

---

## 7. Testing Plan

### 7.1 Unit tests

- `src/features/cockpit/lib/__tests__/mappers.test.ts`:
  - One test per `AgentVisualState` transition (13 states × at least one entry condition).
  - Priority ladder test (terminated > over_budget > paused > failed > awaiting_approval > needs_input > blocked > producing_work_product > heartbeat_tick > working > queued > completed > idle).
  - Goal-chain ancestry exposed in inspector.
  - Single-assignee invariant respected — only one NPC ever shows a given issue card.
- `src/features/cockpit/lib/__tests__/inspectorModels.test.ts`:
  - All inspector tabs render with empty / partial / full fixtures.
- `packages/shared/__tests__/agency-snapshot.test.ts`:
  - zod schema accepts the canonical fixture and rejects mutations.

### 7.2 Integration tests

- `src/features/cockpit/__tests__/useAgencyData.test.tsx`:
  - Server-success path returns server-shaped snapshot.
  - Server-failure path returns empty snapshot with `sourceMessage`.
  - Cross-company actor → 403 propagation.
- `server/src/services/__tests__/core.snapshot.test.ts`:
  - Joins return company-scoped data only (planted cross-company row stays out).
  - Snapshot size stays under 200 KB for the standard 12-agent / 100-issue fixture.

### 7.3 UI / scene sync tests

- `src/features/cockpit/pages/__tests__/CockpitPage.test.tsx`:
  - Renders demo snapshot and live snapshot side-by-side without race conditions.
  - `data-cockpit-source`, `data-cockpit-phase`, `data-cockpit-agent-count`, `data-cockpit-scene-status` attributes update on snapshot change.
- `src/features/cockpit/delegation/components/__tests__/UIOverlay.test.tsx`:
  - For each visual state in §5.1, the right bubble renders.
  - Clicking an approval bubble opens `ApprovalSheet`.

### 7.4 Scenario tests

For each scenario, drive `getAgencySnapshot` from fixture and assert the resulting cockpit state:

1. Approval requested → bubble + clickable.
2. Approval approved → bubble disappears, agent resumes working state.
3. Budget warning → amber banner; hard-stop → red banner + agent paused.
4. Run starts → working animation; run fails → failed bubble; run cancelled → idle.
5. Work product created → producing_work_product animation + Outputs tab updates.
6. Agent terminated → despawn; scene continues with N−1 NPCs.
7. Plugin job failing → scene-level alert; recovers when job succeeds.
8. Routine misfire → scene-level alert with link to `/routines`.

### 7.5 Regression checks (Agency-only features must NOT break)

- `/integrations`, `/delegations`, `/submission-proof`, `/chat`, `/landing`, `/auth`, `/org-chart`, `/plugins`, `/budgets`, `/documents`, `/workspaces`, `/invites`, `/skills` — render without console errors and existing assertions still pass.
- Wallet connect via `ThirdwebProvider` continues to work; `AuthGate` + `OnboardingGate` flow unchanged.
- `CinematicIntro` plays one-shot per session.

### 7.6 Command list (run before claiming done)

From the base repo root:

```sh
pnpm install
pnpm -r typecheck
pnpm test:run              # vitest
pnpm test:e2e              # if relevant scenes were touched
pnpm build
pnpm db:generate           # must produce no-op vs canonical state
```

Plus targeted scripts:

```sh
pnpm --filter @agency/cockpit test          # if a workspace exists
pnpm --filter @agency/server test           # server slice
```

If anything cannot be run, explicitly note what was not run and why.

---

## 8. Risks and Constraints

- **Do not replace the base repo wholesale.** The base repo is the foundation; Paperclip is reference, not source-of-truth. No bulk overwrites from `paperclip-master 2/`.
- **Do not break Agency-only features.** Anything tagged ★ preserved in `docs/PARITY_MATRIX.md` must keep functioning identically: 3D Cockpit, Wallet Auth, ERC-8004, x402, MetaMask delegations, Uniswap/Celo/Lido/Venice/Bankr/OpenServ/Composio/Hermes integrations, Crossflow tracing, Integrations Dashboard, Proof Pack, Compat API Client, and the `/integrations | /delegations | /submission-proof | /chat | /skills | /plugins | /budgets | /documents | /workspaces | /invites` pages.
- **Do not duplicate Paperclip systems already ported.** Routes/services/middleware/adapters/storage/secrets/realtime are present. Extend them — do not re-port.
- **Preserve company-scoping invariants.** Every snapshot field, every WS event, every mutation route must enforce `company_id`. Cross-company leakage is a release blocker.
- **Preserve control-plane invariants** (AGENTS.md §5): single-assignee issues; atomic checkout; approval gates; budget hard-stop auto-pause; activity logging on every mutation; no chat in core (Chat tab links out to Agency `/chat` page).
- **Keep contracts synchronized.** db ↔ shared ↔ server ↔ client cannot drift inside the same PR.
- **Schema migrations must be additive.** No destructive changes to existing tables; new columns nullable or with defaults; new tables only.
- **Demo fallback must never regress.** The cockpit must remain interactable with `DEMO_SNAPSHOT` so the landing/demo experience continues.
- **Realtime ≠ source of truth.** WS events update the cache; the snapshot endpoint remains canonical for cold start and recovery.
- **Performance.** Three.js scene must not stutter on agent population changes. Visual state transitions debounce ≥ 250 ms; SceneManager already resets only on agent count or phase change — keep that contract.
- **Incremental slices.** Each phase ships as its own PR. Phase 1 (schema drift) is independent and should land first. Phases 2–10 can land in dependency order.
- **Prefer additive UI.** New tabs/POIs/banners do not move or hide existing surfaces unless explicitly specified above (e.g., compact viewport behavior, which is preserved).

---

## 9. Final Codex Execution Instructions

> Execute the following sequence. Do not deviate. Report unresolved gaps explicitly at each phase boundary.

1. **First, audit current parity.**
   - Run Phase 0 (§4.1). Produce `docs/PARITY_REVERIFY_<YYYY-MM-DD>.md`.
   - Identify any drift from `docs/PARITY_MATRIX.md` since 2026-03-21.
   - Do not make code changes in this step beyond writing the audit doc.

2. **Then, finalize this `/goal` spec file in the repo.**
   - Copy this document into the base repo at `agency-wzrdwork-main/doc/plans/<YYYY-MM-DD>-cockpit-paperclip-port.md` (per `AGENTS.md` §5.5 plan-doc convention).
   - If anything in Phase 0 invalidates assumptions here, append a "Phase 0 Findings & Spec Updates" section to the in-repo plan doc rather than editing the original.

3. **Implement in phases** (only after the spec is committed):
   - Phase 1 — schema drift closure (independent, smallest blast radius).
   - Phase 2 — snapshot surface expansion (foundation for everything else).
   - Phase 3 — runtime mapper expansion.
   - Phase 4 — 3D state machine + overlay.
   - Phase 5 — inspector behavior expansion.
   - Phase 6 — kanban / action log / debug log.
   - Phase 7 — approvals / budgets / governance UX.
   - Phase 8 — live events integration.
   - Phase 9 — plugin / routine / secret / workspace surfacing.
   - Phase 10 — documents / work products / artifacts.
   - Each phase = its own PR, each PR matches the AGENTS.md PR template.

4. **Validate.**
   - After every phase: `pnpm -r typecheck && pnpm test:run`.
   - After Phases 4/5/6: targeted scene/UI tests.
   - Before claiming done: `pnpm -r typecheck && pnpm test:run && pnpm build && pnpm db:generate`.

5. **Report unresolved gaps explicitly.** If a phase cannot be completed:
   - State which acceptance criteria fail.
   - State which Paperclip primitive is the blocker.
   - Open a tracking issue using the existing issues route — do not silently regress scope.

6. **Definition of done for this `/goal`:**
   - All thirteen `AgentVisualState`s render correctly against fixture and live snapshots.
   - All Paperclip control-plane mutations (approve, reject, pause, resume, terminate, raise budget, kanban move, comment) are reachable from inside the cockpit without changing routes.
   - The cockpit reflects state changes via WS within 1 s; falls back to polling on disconnect.
   - Schema drift items in §6.3 are closed.
   - All Agency-only routes and features render without regression.
   - `pnpm -r typecheck && pnpm test:run && pnpm build && pnpm db:generate` all pass.
   - PR descriptions follow `AGENTS.md` §10.
