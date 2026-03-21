# Agency Compatibility Layer

Guide to the compatibility layer that bridges Agency-only code (Supabase RLS) with the canonical database API.

## Overview

The Agency Synthesis merger unified 5 codebases into a single platform. The **compatibility layer** enables gradual migration from Supabase-only direct database reads to the canonical API, without requiring a "big bang" rewrite.

## Architecture

### Three Data Access Patterns

```
┌─────────────────────────────────────────────────────┐
│ Application Code (React, API routes)                │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────────┐      ┌──────────────────┐   │
│  │ Agency Hooks     │      │ Canonical API    │   │
│  │ (Supabase RLS)   │      │ (REST/GraphQL)   │   │
│  └────────┬─────────┘      └────────┬─────────┘   │
│           │                         │              │
│  ┌────────v─────────────────────────v────────┐   │
│  │ Compatibility Client (compat-client.ts)   │   │
│  │ - Intercepts Agency hooks                 │   │
│  │ - Maps to canonical REST API              │   │
│  │ - Caches results                          │   │
│  └────────┬─────────────────────────────────┘   │
│           │                                     │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌────────────────┐  ┌────────────────┐       │
│  │ Canonical DB   │  │ Supabase RLS   │       │
│  │ (PostgreSQL)   │  │ (Read-only)    │       │
│  └────────────────┘  └────────────────┘       │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Three Phases

| Phase | Pattern | Status | Notes |
|-------|---------|--------|-------|
| **Agency-only** | Direct Supabase RLS reads | Legacy | Uses row-level security |
| **Compatibility** | Hooks → API calls | **Current** | Via compat client |
| **Canonical** | Direct API calls | Target | Supabase removed |

## Compatibility Client

**Location:** `src/db/compat-client.ts`

### What It Does

1. Intercepts Agency Supabase hooks (`useCompany`, `useAgents`, etc.)
2. Maps them to equivalent REST API endpoints
3. Handles data transformation (Supabase schema → canonical schema)
4. Caches results using React Query
5. Falls back to Supabase if API unavailable

### Agency Hook to API Mapping

| Agency Hook | Maps To | Canonical Endpoint |
|-------------|---------|-------------------|
| `useCompany` | GET /api/companies/:id | `/api/companies/current` |
| `useAgents` | GET /api/agents | `/api/agents` |
| `useIssues` | GET /api/issues | `/api/issues?project_id=...` |
| `useProjects` | GET /api/projects | `/api/projects` |
| `useDelegations` | GET /api/delegations | `/api/delegations` |

### Data Transformation

Supabase schema fields are mapped to canonical schema:

```typescript
// Supabase format (agency_agents table)
{
  id: "uuid",
  name: "string",
  company_id: "uuid",
  created_at: "timestamp"
}

// Canonical format (agents table)
{
  id: "uuid",
  name: "string",
  company_id: "uuid",
  created_at: "timestamp",
  // New fields
  wallet_address: "string",
  erc8004_manifest_url: "string"
}
```

**Transformation happens in:** `src/db/compat-transformer.ts`

## Using the Compat Client

### In React Components

Before (Agency-only):

```typescript
import { useAgents } from '@/db/hooks'  // Supabase

export function AgentsList() {
  const { data: agents } = useAgents()
  return <>{agents.map(a => a.name)}</>
}
```

After (with compat):

```typescript
import { useAgents } from '@/db/hooks'  // Still same import!

export function AgentsList() {
  const { data: agents } = useAgents()  // Now uses compat client
  return <>{agents.map(a => a.name)}</>
}
```

**Migration is transparent.** No code changes needed.

### In API Routes

Before (Agency-only):

```typescript
export async function GET(req: Request) {
  const { data } = await supabase
    .from('agency_agents')
    .select('*')
    .eq('company_id', companyId)

  return Response.json(data)
}
```

After (canonical):

```typescript
export async function GET(req: Request) {
  const agents = await db.query.agents.findMany({
    where: eq(schema.agents.company_id, companyId)
  })

  return Response.json(agents)
}
```

## Backfill Process

To migrate data from Supabase to canonical database:

```bash
npm run paperclipai db:backfill-supabase
```

**What it does:**

1. **Connect** to both Supabase and target Postgres
2. **Read all tables** from Supabase (via RLS views)
3. **Transform** schema to canonical format
4. **Write** to target database
5. **Validate** row counts and data integrity
6. **Report** any mismatches

**Backfill script:** `scripts/backfill-from-supabase.ts` (33KB)

### Manual Backfill

```typescript
import { backfillFromSupabase } from '@agency-wzrdwork/db'

await backfillFromSupabase({
  supabaseUrl: 'https://...',
  supabaseKey: 'anon-key',
  targetUrl: 'postgresql://...',
  tables: ['agents', 'companies', 'issues'] // optional filter
})
```

## Environment Variables

Control compatibility behavior:

```env
# Which DB to read from (production, staging)
VITE_SUPABASE_URL=https://lptryhnnhhvbblrrsaqa.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Canonical database (target after migration)
DATABASE_URL=postgresql://user:pass@localhost:5432/agency

# Compatibility settings
COMPAT_MODE=hybrid          # hybrid|agency-only|canonical
COMPAT_CACHE_TTL=300        # seconds
COMPAT_FALLBACK=true        # fallback to Supabase if API fails
```

## Migration Path (Step-by-Step)

### Step 1: Deploy Canonical Database

```bash
npm run db:migrate:canonical
npm run db:seed:canonical
```

Both Supabase and canonical databases exist.

### Step 2: Backfill Data

```bash
npm run paperclipai db:backfill-supabase
# Verify: compare row counts, spot-check data
```

### Step 3: Enable Compat Client

Set environment:

```env
COMPAT_MODE=hybrid
COMPAT_FALLBACK=true  # still read from Supabase if needed
```

Restart server. Agency hooks now read from canonical API.

### Step 4: Monitor & Validate

```bash
# Check compatibility logs
DEBUG=paperclip:compat npm run dev

# Run tests
npm run test

# Compare data between sources
npm run compat:validate
```

### Step 5: Switch to Canonical Only

Once confident:

```env
COMPAT_MODE=canonical
COMPAT_FALLBACK=false  # no fallback to Supabase
```

Agency and Supabase direct reads no longer work.

### Step 6: Remove Supabase Dependencies

Delete:
- Supabase hook files: `src/db/hooks.supabase.ts`
- Supabase client: `src/db/supabase.ts`
- Supabase imports throughout codebase

## Comparison: Agency vs Canonical

| Aspect | Agency (Supabase) | Canonical (API) |
|--------|-------------------|-----------------|
| **Location** | Supabase cloud | Local Postgres or external |
| **Auth** | RLS policies | Better Auth + grants |
| **Schema** | 40 tables | 54 tables (superset) |
| **Access** | Direct database | REST API |
| **Caching** | Supabase cache layer | React Query |
| **Migrations** | Manual SQL | Drizzle ORM |
| **Cost** | Pay per query | Own database |

## Troubleshooting

### Compat Client Returns Old Data

Clear React Query cache:

```typescript
import { useQueryClient } from '@tanstack/react-query'

const qc = useQueryClient()
qc.invalidateQueries({ queryKey: ['agents'] })
```

### Backfill Fails at Halfway

Idempotent: safe to re-run

```bash
npm run paperclipai db:backfill-supabase
# Continues from where it left off
```

### Data Mismatch After Migration

Check transformation logic:

```bash
npm run compat:validate --table agents
# Compares Supabase vs canonical row-by-row
```

### Can't Access Supabase

Fallback mode will read from canonical:

```env
COMPAT_FALLBACK=false  # bypass Supabase entirely
COMPAT_MODE=canonical
```

## Code Examples

### Migrate a Component

**Before (Agency Supabase hooks):**

```typescript
import { useAgents, useCompany } from '@/db/hooks'

export function Dashboard() {
  const { data: company } = useCompany()
  const { data: agents } = useAgents()

  return (
    <div>
      <h1>{company.name}</h1>
      <ul>{agents.map(a => <li key={a.id}>{a.name}</li>)}</ul>
    </div>
  )
}
```

**After (no changes needed!):**

```typescript
import { useAgents, useCompany } from '@/db/hooks'
// Same imports!

export function Dashboard() {
  const { data: company } = useCompany()
  const { data: agents } = useAgents()
  // Hooks now use compat client under the hood

  return (
    <div>
      <h1>{company.name}</h1>
      <ul>{agents.map(a => <li key={a.id}>{a.name}</li>)}</ul>
    </div>
  )
}
```

### Migrate an API Route

**Before (Supabase RLS):**

```typescript
import { supabase } from '@/db/supabase'

export async function GET(req: Request) {
  const { data } = await supabase
    .from('agency_agents')
    .select('*')
    .eq('company_id', req.user.company_id)

  return Response.json(data)
}
```

**After (canonical):**

```typescript
import { db } from '@agency-wzrdwork/db'
import { agents, companies } from '@agency-wzrdwork/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(req: Request) {
  const agentList = await db.query.agents.findMany({
    where: eq(agents.company_id, req.user.company_id)
  })

  return Response.json(agentList)
}
```

## Files

- **Compat client:** `/src/db/compat-client.ts`
- **Transformer:** `/src/db/compat-transformer.ts`
- **Backfill script:** `/scripts/backfill-from-supabase.ts`
- **Hooks:** `/src/db/hooks.ts` (imports from compat)

## Next Steps

- See [MIGRATION-GUIDE.md](./MIGRATION-GUIDE.md) for step-by-step migration
- Check [DATABASE.md](./DATABASE.md) for schema details
- Review [API.md](./API.md) for canonical API reference
