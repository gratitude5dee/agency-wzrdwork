# Schema Migration Analysis: Paperclip → Agency

**Generated:** 2026-03-21  
**Source:** Comprehensive comparison of Paperclip canonical schemas vs. Agency current implementation

## Executive Summary

- **53 canonical Paperclip schemas** in `/packages/db/src/schema/`
- **53 matching Agency schemas** in `/packages/db/src/schema/`
- **Status:** 100% alignment - All Paperclip schemas have identical counterparts in Agency
- **Additional tables:** 2 Agency-specific tables created via Supabase migrations (chat_sessions, chat_messages)

## Key Findings

### 1. Core Schema Status: ALIGNED ✓

All 53 canonical Paperclip schema files are present and identically structured in Agency:
- Same table names
- Same column definitions  
- Same column counts
- Same data types and constraints

**Files verified:** activity_log, agent_api_keys, agent_config_revisions, agent_runtime_state, agents, approvals, assets, auth, budget_incidents, budget_policies, companies, cost_events, documents, execution_workspaces, finance_events, goals, heartbeat_run_events, heartbeat_runs, issues, join_requests, labels, plugins, projects, workspace_operations, and 28 others.

### 2. Agency Extensions (Not in Paperclip Canonical)

The following tables are created in Agency but not defined in Paperclip's canonical schema directory:

| Table | Created Via | Purpose | Migration File |
|-------|-----------|---------|-----------------|
| chat_sessions | Supabase Migration | Conversation sessions for agent orchestration | 202603180001 |
| chat_messages | Supabase Migration | Messages within chat sessions | 202603180001 |
| agent_integrations | Supabase Migration | Per-agent integration configuration | 202603180001 |

These tables are NOT defined in `/packages/db/src/schema/` for either Paperclip or Agency.

### 3. Schema Definition Locations

All 53 canonical tables are defined in:
- **Paperclip:** `/packages/db/src/schema/` (53 TypeScript files)
- **Agency:** `/packages/db/src/schema/` (53 identical TypeScript files)

Drizzle ORM TypeScript definitions are the source of truth for the schema structure.

### 4. Column Additions in Migrations

The Supabase migration `202603180001_paperclip_port_schemas.sql` adds these columns to existing tables:

| Table | New Columns | Migration File |
|-------|-----------|-----------------|
| agents | wallet_address, budget_usd, prompt_template | 202603180001 |
| companies | wallet_address | 202603180001 |

These columns are NOT reflected in the TypeScript schema definitions yet.

## Migration Readiness Assessment

### What's Complete ✓
- All 53 canonical schema files exist and are identical
- Drizzle ORM TypeScript definitions are synchronized
- Paperclip schemas can be imported from Agency's packages/db

### What Needs Attention ⚠
- **Chat tables** (chat_sessions, chat_messages) are created via raw SQL migration but have no TypeScript schema definitions
- **Schema drift:** Columns added via migration (wallet_address, budget_usd, prompt_template) are not in TypeScript definitions
- **Migration file review:** Supabase migrations contain additional tables not defined in canonical schemas

## Recommendations

1. **Verify schema drift:** Update TypeScript schema definitions to include all columns from migrations (wallet_address, budget_usd, prompt_template)
2. **Create TypeScript schemas** for chat_sessions, chat_messages, and agent_integrations
3. **Review Supabase migrations** for any additional tables or columns not captured in canonical schema files
4. **Align schema definitions:** Ensure all database tables have corresponding TypeScript Drizzle ORM definitions

## Files Generated

- `/docs/schema-migration-mapping.csv` - Detailed mapping table (CSV format)
- `/docs/SCHEMA_MIGRATION_ANALYSIS.md` - This document

## Methodology

Analysis performed by:
1. Enumerating all `.ts` files in Paperclip's `/packages/db/src/schema/` directory (53 files)
2. Enumerating all `.ts` files in Agency's `/packages/db/src/schema/` directory (53 files)
3. Extracting table names and column definitions from each Drizzle ORM schema
4. Performing column-level comparison between matched files
5. Checking for Agency-only extensions
6. Reviewing Supabase migration files for additional table definitions

**Result:** 100% structural alignment with noted extensions for Agency-specific features.
