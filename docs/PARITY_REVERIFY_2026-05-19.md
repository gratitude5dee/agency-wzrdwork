# Paperclip -> Agency Parity Reverification

**Date:** 2026-05-19
**Base repo:** `agency-wzrdwork-main/`
**Reference repo:** `paperclip-master 2/`
**Goal source:** `../GOAL-cockpit-paperclip-port.md`

## Summary

The previous `docs/PARITY_MATRIX.md` snapshot from 2026-03-21 is stale. It correctly describes the historical port state, but it no longer proves current parity against `paperclip-master 2/`. The reference repo has materially advanced across server routes, services, database schemas, shared contracts, adapters, adapter utilities, plugins, and tests.

This does not change the integration target: Agency remains the base repo and Paperclip remains the read-only reference. It does mean the cockpit Paperclip port cannot assume that "Paperclip is already fully ported" without additional catch-up work.

## Audit Commands

Executed from `agency-wzrdwork-main/`:

```sh
diff -qr server/src/routes ../'paperclip-master 2'/server/src/routes
diff -qr server/src/services ../'paperclip-master 2'/server/src/services
diff -qr server/src/middleware ../'paperclip-master 2'/server/src/middleware
diff -qr server/src/adapters ../'paperclip-master 2'/server/src/adapters
diff -qr server/src/storage ../'paperclip-master 2'/server/src/storage
diff -qr server/src/secrets ../'paperclip-master 2'/server/src/secrets
diff -qr server/src/realtime ../'paperclip-master 2'/server/src/realtime
diff -qr server/src/auth ../'paperclip-master 2'/server/src/auth
diff -qr packages/db/src/schema ../'paperclip-master 2'/packages/db/src/schema
diff -qr packages/shared ../'paperclip-master 2'/packages/shared
diff -qr packages/adapters ../'paperclip-master 2'/packages/adapters
diff -qr packages/adapter-utils ../'paperclip-master 2'/packages/adapter-utils
diff -qr packages/plugins ../'paperclip-master 2'/packages/plugins
```

## Category Results

| Area | Base count | Reference count | Byte-identical? | Current finding |
|---|---:|---:|---|---|
| `server/src/routes/*.ts` | 28 | 36 | No | 10 reference-only route files, 2 Agency-only route files, 21 differing files. |
| `server/src/services/*.ts` | 68 | 109 | No | 47 reference-only service files, 5 Agency-only service files, 39 differing files. |
| `server/src/middleware` | 6 | 7 | No | `http-log-policy.ts` is reference-only; 4 middleware files differ. |
| `server/src/adapters` | 12 | 15 | No | `builtin-adapter-types.ts`, `plugin-loader.ts`, and `http/execute.test.ts` are reference-only; 7 files differ. |
| `server/src/storage` | 5 | 5 | Yes | No drift found. |
| `server/src/secrets` | 4 | 6 | No | AWS/configured secret providers are reference-only; 4 files differ. |
| `server/src/realtime` | 1 | 1 | Yes | No drift found for `live-events-ws.ts`. |
| `server/src/auth` | 1 | 1 | No | `better-auth.ts` differs. |
| `packages/db/src/schema/*.ts` | 59 | 79 | No | 20 reference-only schema files, 13 differing shared schema files. |
| `packages/shared/src/**/*.ts` | 52 | 97 | No | 41 reference-only TS files, 37 differing TS files. Base also contains built `.js` artifacts that should not be treated as source parity. |
| `packages/adapters` | existing adapter set | newer reference set | No | 3 reference-only adapter packages: `acpx-local`, `cursor-cloud`, `grok-local`; 58 differing files. |
| `packages/adapter-utils` | older utility set | newer reference set | No | 20 reference-only utility/test files, including sandbox and remote execution helpers. |
| `packages/plugins` | older plugin SDK/examples | newer reference set | No | 4 reference-only plugin packages/dirs plus 30 differing files. |

## Reference-Only Routes

These routes exist in `paperclip-master 2/server/src/routes/` but not in Agency:

- `adapters.ts`
- `environment-selection.ts`
- `environments.ts`
- `inbox-dismissals.ts`
- `instance-database-backups.ts`
- `issue-tree-control.ts`
- `sidebar-preferences.ts`
- `user-profiles.ts`
- `workspace-command-authz.ts`
- `workspace-runtime-service-authz.ts`

Agency-only routes found during this pass:

- `agency.ts`
- `integrations.ts`

The `.agency-backup` files under `server/src/routes/` are base-only backup artifacts, not active parity assets.

## Reference-Only Services

These top-level services exist in `paperclip-master 2/server/src/services/` but not in Agency:

- `adapter-plugin-store.ts`
- `agent-start-lock.ts`
- `company-member-roles.ts`
- `company-search-rate-limit.ts`
- `company-search.ts`
- `default-agent-instructions.ts`
- `environment-config.ts`
- `environment-execution-target.ts`
- `environment-probe.ts`
- `environment-run-orchestrator.ts`
- `environment-runtime.ts`
- `environments.ts`
- `feedback-redaction.ts`
- `feedback-share-client.ts`
- `feedback.ts`
- `github-fetch.ts`
- `heartbeat-stop-metadata.ts`
- `inbox-dismissals.ts`
- `invite-grants.ts`
- `issue-continuation-summary.ts`
- `issue-execution-policy.ts`
- `issue-liveness.ts`
- `issue-recovery-actions.ts`
- `issue-references.ts`
- `issue-thread-interactions.ts`
- `issue-tree-control.ts`
- `json-schema-secret-refs.ts`
- `local-service-supervisor.ts`
- `plugin-database.ts`
- `plugin-environment-driver.ts`
- `plugin-local-folders.ts`
- `plugin-managed-agents.ts`
- `plugin-managed-routines.ts`
- `plugin-managed-skills.ts`
- `productivity-review.ts`
- `project-workspace-runtime-config.ts`
- `run-continuations.ts`
- `run-liveness.ts`
- `sandbox-provider-runtime.ts`
- `session-workspace-cwd.ts`
- `sidebar-preferences.ts`
- `workspace-realization.ts`
- `workspace-runtime-read-model.ts`

Reference-only service subdirectories/files also include `recovery/` and several colocated tests.

Agency-only services found during this pass:

- `auth.ts`
- `core.ts`
- `integrations.ts`
- `plugins.ts`
- `access.agency-backup.ts`

## Schema Findings

At audit time, `docs/SCHEMA_MIGRATION_ANALYSIS.md` correctly identified local Agency drift:

- `chat_sessions`, `chat_messages`, and `agent_integrations` are created by `supabase/migrations/202603180001_paperclip_port_schemas.sql` but have no Drizzle schema files.
- `agents.wallet_address`, `agents.budget_usd`, `agents.prompt_template`, and `companies.wallet_address` are added by that Supabase migration but are missing from Drizzle schema files.

Newer reference drift also exists. At audit time, `paperclip-master 2/packages/db/src/schema/` contained these schema files that Agency did not:

- `company_secret_bindings.ts`
- `company_secret_provider_configs.ts`
- `company_user_sidebar_preferences.ts`
- `environment_leases.ts`
- `environments.ts`
- `feedback_exports.ts`
- `feedback_votes.ts`
- `heartbeat_run_watchdog_decisions.ts`
- `inbox_dismissals.ts`
- `issue_execution_decisions.ts`
- `issue_recovery_actions.ts`
- `issue_reference_mentions.ts`
- `issue_relations.ts`
- `issue_thread_interactions.ts`
- `issue_tree_hold_members.ts`
- `issue_tree_holds.ts`
- `plugin_database.ts`
- `plugin_managed_resources.ts`
- `secret_access_events.ts`
- `user_sidebar_preferences.ts`

These reference-only schema files are relevant to the requested cockpit state model, especially blockers, issue thread interactions, execution decisions, secret access metadata, environment/workspace state, and plugin-managed resources.

Implementation update on 2026-05-19:

- The local Agency drift for `chat_sessions`, `chat_messages`, `agent_integrations`, and the wallet/budget/prompt columns was closed in the first implementation pass.
- Agency now has cockpit-facing Drizzle coverage for `issue_relations`, `issue_thread_interactions`, `issue_execution_decisions`, `environments`, `environment_leases`, `plugin_managed_resources`, `company_secret_bindings`, and `secret_access_events`.
- Migration `packages/db/src/migrations/0040_clammy_lady_deathstrike.sql` creates those tables idempotently, enables RLS, and avoids recreating broad public policies on the new sensitive runtime/config tables.
- Agency now has Drizzle coverage for `user_sidebar_preferences` and `company_user_sidebar_preferences` via migration `packages/db/src/migrations/0041_cute_thanos.sql`.
- Agency now has Drizzle coverage for `issue_tree_holds` and `issue_tree_hold_members` via migration `packages/db/src/migrations/0042_silent_the_order.sql`.
- The remaining reference-only schema files are still parity work: `company_secret_provider_configs`, `feedback_exports`, `feedback_votes`, `heartbeat_run_watchdog_decisions`, `inbox_dismissals`, `issue_recovery_actions`, `issue_reference_mentions`, and `plugin_database`.

## Shared Contract Findings

`packages/shared/` is not current with the reference repo. Reference-only source files include:

- Adapter/environment contracts: `adapter-type.ts`, `execution-workspace-guards.ts`, `environment-support.ts`, `network-bind.ts`, `workspace-commands.ts`.
- Issue and routine contracts: `issue-references.ts`, `issue-thread-interactions.test.ts`, `routine-variables.ts`.
- Telemetry: `telemetry/*`.
- Types/validators for adapter skills, company skills, environments, feedback, inbox dismissal, issue tree control, search, sidebar preferences, user profile, and text helpers.

Implementation update on 2026-05-19:

- Agency now has shared issue tree control constants, types, validators, and API handles for `/api/issues/:issueId/tree-control` and `/api/issues/:issueId/tree-holds`.
- Agency now has shared environment constants/types/validators/capability helpers and API handles for environment and adapter routes.
- Agency now has shared workspace runtime realization/control contracts needed by the environment runtime layer: execution workspace config, workspace command definitions, runtime desired state, and workspace realization records.

The base package also contains built `.js` files under `packages/shared/src/`, which makes source parity noisy. Those files are build artifacts and should not drive implementation decisions.

## Triage

### Fix Now

These are required before or during the cockpit Paperclip control-plane integration:

1. Close the local Drizzle drift for `chat_sessions`, `chat_messages`, `agent_integrations`, and the missing wallet/budget/prompt columns.
2. Add or port schema/contracts needed by the cockpit snapshot: `issue_relations`, `issue_thread_interactions`, `issue_execution_decisions`, `secret_access_events`, environment/workspace runtime summaries, plugin-managed resources, and any corresponding shared validators. Status: cockpit-facing schema, snapshot types, validators, server optional reads, and cockpit read surfaces are implemented as of the 0040 migration pass. Sidebar preference schema/contracts are implemented as of the 0041 migration pass. Issue tree hold schema/contracts are implemented as of the 0042 migration pass.
3. Bring the missing routes/services into Agency where the cockpit needs them for inline behavior: environment selection/environments, issue tree control, workspace command/runtime authz, sidebar preferences if route navigation depends on it, and adapter/plugin store helpers. Status: sidebar preference routes/services, issue tree control routes/services/runtime pause enforcement, workspace command authz guards, environment CRUD/probe routes/services, workspace-runtime service authz helpers, adapter inventory/settings helpers, environment execution target/runtime helpers, workspace realization records, the built-in Vercel Sandbox provider, the `environment-run-orchestrator` boundary, heartbeat lease acquisition/realization/release wiring, sandbox workspace archive upload/download restore sync, local-adapter sandbox execution bridge work, full workspace runtime command-control routes, external adapter plugin hot-install/reload/reinstall, the richer adapter-utils remote runtime helper layer, and the bundled `grok-local`, `cursor-cloud`, and `acpx-local` adapters are implemented.
4. Preserve Agency-only `server/src/routes/agency.ts`, `server/src/routes/integrations.ts`, `server/src/services/core.ts`, `server/src/services/integrations.ts`, and cockpit UI files.

### Later Goal Slices

These are not blockers for Phase 1 schema drift closure but are still part of full Paperclip parity before the overall goal can be called complete:

- Feedback export/voting services and schemas.
- Instance database backups.
- User profile and sidebar preference polish.
- New plugin packages (`plugin-llm-wiki`, `plugin-workspace-diff`, sandbox providers) unless plugin POI/inspector surfaces depend on them.

The external adapter plugin loader is now implemented for hot-install/reload/reinstall, and the reference bundled adapter packages `grok-local`, `cursor-cloud`, and `acpx-local` are now present as built-in Agency adapters. The frontend adapter registry also exposes `grok_local`, `cursor_cloud`, and `acpx_local` in the New Agent flow, and a browser smoke verified the adapter dropdown in the running Vite app.

## Spec Update

The in-repo plan should not claim that all Paperclip runtime functionality is already ported. The correct current state is:

1. Agency contains a substantial historical Paperclip port and Agency cockpit integration scaffold.
2. The current Paperclip reference has advanced substantially since the March matrix.
3. The cockpit integration can proceed incrementally, but final completion requires both cockpit expression work and catch-up parity for the Paperclip primitives the cockpit visualizes.

The copied goal plan has been placed at `docs/plans/2026-05-19-cockpit-paperclip-port.md` because this repo uses `docs/`, not the stale `doc/` path referenced by `AGENTS.md`.
