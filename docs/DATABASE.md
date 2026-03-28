# Database Architecture

The Agency Synthesis system uses a canonical Postgres database via Drizzle ORM, with support for both embedded and external postgres instances.

## Schema Overview

The database contains **54 core tables** organized into logical domains:

### Core Entities
- `companies` — Workspace/organization
- `users` — Human users
- `agents` — AI agents (with wallet identity)
- `agent_api_keys` — Agent authentication tokens

### Execution & Workflow
- `issues` — Tasks/issues with chat history
- `issue_comments` — Threaded comments
- `issue_labels` — Category labels
- `issue_read_states` — Read status tracking
- `projects` — Project groupings
- `project_goals` — Goal tracking
- `goals` — Strategic goals

### Permissions & Access
- `principals` — Roles (users/agents/teams)
- `principal_permission_grants` — Fine-grained access control
- `access_control_lists` — Board-level permissions
- `join_requests` — Pending membership

### Agent Execution
- `agent_runs` — Execution records
- `agent_run_entries` — Structured execution logs
- `heartbeat_run_events` — Health tracking
- `cost_events` — Token/API cost tracking

### Business Operations
- `approvals` — Approval workflows
- `delegations` — Authority chains (CEO → Dept → Agent)
- `workspace_operations` — Long-running async operations
- `plugin_entities` — Plugin data isolation

### Agency Bridge (Compatibility)
- `agency_*` tables — Read-only from Supabase RLS views
- Enables gradual migration from Supabase-only to canonical DB

## Migration System

**39 SQL migrations** (in `packages/db/src/migrations/`)

| Stage | Migrations | Purpose |
|-------|-----------|---------|
| Foundation | 0000-0015 | Base tables (agents, issues, users) |
| Features | 0016-0030 | Goals, plugins, costs, delegations |
| Refinement | 0031-0037 | Indexes, constraints, optimizations |
| Bridge | 0038 | Agency compatibility (read-only Supabase sync) |

**Key migrations:**
- `0000_*` — Core schema creation
- `0004_issue_identifiers` — Unique issue numbering
- `0015_project_color_archived` — Project metadata
- `0029_plugin_tables` — Plugin isolation
- `0038_agency_bridge` — Supabase RLS compatibility layer

## Embedded vs External Postgres

### Embedded Mode (Default)

Auto-managed by the CLI. Data stored in:

```
~/.paperclip/instances/<instance-id>/data/postgres
```

**Start:**
```bash
npm run dev  # auto-starts embedded postgres
```

**Stop:**
```bash
pnpm exec kill-dev.sh  # graceful shutdown
```

**Advantages:**
- Zero setup
- Automatic backups
- Isolated per instance
- Perfect for development

### External Mode

Set `DATABASE_URL` to any Postgres 15+ database:

```env
DATABASE_URL=postgresql://user:pass@prod-db.example.com:5432/agency
```

**Run migrations:**
```bash
npm run db:migrate:canonical
```

**Advantages:**
- Shared across multiple servers
- Production-grade backups
- Better monitoring
- Multi-region support

## Backfill from Supabase

For migrating from Supabase-only to canonical database:

```bash
npm run paperclipai db:backfill-supabase
```

This runs `scripts/backfill-from-supabase.ts` which:

1. Fetches all tables from Supabase (via RLS views)
2. Transforms data to canonical schema
3. Writes to target Postgres database
4. Validates row counts and data integrity

**Backfill script:** `/sessions/festive-nice-shannon/agency-wzrdwork-main-work/scripts/backfill-from-supabase.ts`

### Agency-Specific Extensions

The canonical schema includes columns for Agency features:

| Table | New Columns | Purpose |
|-------|------------|---------|
| `agents` | `wallet_address`, `erc8004_manifest_url` | On-chain identity |
| `companies` | `x402_payment_channel` | Payment tracking |
| `agent_runs` | `protocol_labs_execution_log_id`, `budget_tokens` | Autonomous execution |
| `cost_events` | `cost_usd`, `model_name` | Financial tracking |

## Drizzle ORM Configuration

**Config file:** `packages/db/drizzle.config.ts`

- Dialect: `postgresql`
- Schema generation: `packages/db/src/schema/`
- Migrations: `packages/db/src/migrations/`
- Studio: Web UI at `http://localhost:4983`

### Generate Migrations

```bash
npm run db:generate
# Drizzle compares schema/*.ts files to actual DB
# Creates migration in packages/db/src/migrations/
```

### Push to Database

```bash
npm run db:push
# Applies all pending migrations
```

## Database Client

**Location:** `packages/db/src/client.ts`

Provides:

- Drizzle database instance with type-safe queries
- Connection pooling (PgBoss for queues)
- Automatic migration runner
- Backup utilities

**Usage:**

```typescript
import { db } from "@agency-wzrdwork/db";

const agents = await db.query.agents.findMany();
const newAgent = await db.insert(agents).values({...});
```

## Schema Files

Each table has its own file in `packages/db/src/schema/`:

```
schema/
├── agents.ts
├── companies.ts
├── issues.ts
├── approvals.ts
├── delegations.ts
├── workspace_operations.ts
└── ... (54 files total)
```

## Indexes & Performance

Key indexes for common queries:

- `agents(company_id, name)` — Agent lookup
- `issues(company_id, project_id)` — Issue filtering
- `agent_runs(agent_id, created_at desc)` — Run history
- `cost_events(company_id, created_at desc)` — Cost tracking

Generate with: `npm run db:generate`

## Backup & Recovery

### Automatic Backups

Embedded postgres auto-backs up daily to:

```
~/.paperclip/instances/<id>/data/backups/
```

### Manual Backup

```bash
npm run db:backup
```

**Backup utility:** `packages/db/src/backup-lib.ts`

### Restore

```bash
npm run paperclipai db:restore <backup-id>
```

## Testing Database

Tests use separate, isolated databases:

```bash
npm run test
# Creates temporary test DB, cleans up after
```

**Test client:** `packages/db/src/client.test.ts`

## Next Steps

- See [DEVELOPING.md](./DEVELOPING.md) for dev setup
- Check [MIGRATION-GUIDE.md](./MIGRATION-GUIDE.md) for Supabase migration
- Review [AGENCY-COMPAT.md](./AGENCY-COMPAT.md) for compatibility layer
