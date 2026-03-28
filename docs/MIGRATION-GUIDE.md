# Migration Guide: Supabase to Canonical Database

Step-by-step guide for migrating from Agency Supabase-only architecture to the unified canonical database.

## Overview

The merged repository supports both Supabase (legacy) and canonical Postgres databases during transition. This guide walks through safe, incremental migration with rollback capability.

**Expected duration:** 30 minutes to 2 hours (depending on data size)
**Downtime:** 5-15 minutes (during backfill)
**Rollback:** Simple (keep both databases, revert environment)

## Prerequisites

- Access to both Supabase account and target Postgres database
- Backup of Supabase database
- Admin credentials for target database
- All environment variables configured

## Pre-Migration Checklist

```bash
# 1. Verify current state
npm run paperclipai health --verbose

# 2. Backup Supabase
supabase db pull  # or via Supabase dashboard → Export

# 3. Backup target database (if existing)
npm run db:backup

# 4. Test connectivity
npm run paperclipai db:verify-connection
```

## Step 1: Deploy Canonical Schema

### 1a. Apply migrations to target database

```bash
DATABASE_URL=postgresql://user:pass@host:5432/agency \
npm run db:migrate:canonical
```

**What happens:**
- Creates all 54 tables
- Creates indexes and constraints
- Sets up RLS policies
- Initializes sequence counters

**Verify:**
```bash
psql $DATABASE_URL -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"
# Should show ~54
```

### 1b. Seed initial data (optional)

For testing, seed demo data:

```bash
DATABASE_URL=postgresql://user:pass@host:5432/agency \
npm run db:seed:canonical
```

Skip in production if you're backfilling all data.

## Step 2: Prepare for Backfill

### 2a. Configure environment

Create `.env.backfill`:

```env
# Source: Supabase
VITE_SUPABASE_URL=https://your-supabase.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Target: Canonical database
DATABASE_URL=postgresql://user:pass@localhost:5432/agency

# Backfill options
BACKFILL_BATCH_SIZE=1000
BACKFILL_VERIFY=true
BACKFILL_LOG_LEVEL=info
```

### 2b. Verify Supabase connectivity

```bash
source .env.backfill
npm run paperclipai db:verify-supabase
```

Should connect and list tables.

## Step 3: Backfill Data

### 3a. Dry-run mode (recommended)

Test without modifying target database:

```bash
source .env.backfill
npm run paperclipai db:backfill-supabase --dry-run
```

**Output shows:**
```
Reading Supabase:
  ✓ 42 agents
  ✓ 5 companies
  ✓ 127 issues
  ...
  Total rows: 3,847

Target would be updated:
  ✓ agents (0 → 42)
  ✓ companies (0 → 5)
  ✓ issues (0 → 127)
  ...

No changes applied (--dry-run)
```

### 3b. Full backfill

Once dry-run looks good:

```bash
source .env.backfill
npm run paperclipai db:backfill-supabase
```

**Output:**
```
[1/54] Backfilling agents...        [████████████] 42/42
[2/54] Backfilling companies...     [████████████] 5/5
[3/54] Backfilling issues...        [████████████] 127/127
...
[54/54] Backfilling plugin_data...  [████████████] 8/8

Verification:
✓ agents: 42 rows match
✓ companies: 5 rows match
✓ issues: 127 rows match
...

Total: 3,847 rows synced (12 seconds)
Migration complete!
```

**What the script does:**

1. Reads all tables from Supabase (in batches)
2. Transforms schema (Supabase → canonical)
3. Writes to target database
4. Validates each table's row count
5. Spot-checks 10 random rows per table
6. Reports any mismatches

### 3c. Handle backfill errors

If backfill fails partway through, it's safe to re-run:

```bash
npm run paperclipai db:backfill-supabase
# Continues from last successful table
# Idempotent: won't duplicate rows
```

**Common errors and fixes:**

| Error | Cause | Fix |
|-------|-------|-----|
| "connection refused" | Database down | Check DATABASE_URL |
| "permission denied" | RLS policy blocks | Check Supabase RLS |
| "duplicate key" | Ran twice | See idempotent behavior |
| "constraint violation" | Foreign key mismatch | Check data integrity |

## Step 4: Validate Migration

### 4a. Compare row counts

```bash
npm run paperclipai db:validate --compare=supabase
```

**Output:**
```
Table          Supabase  Canonical  Match
──────────────────────────────────────────
agents         42        42         ✓
companies      5         5          ✓
issues         127       127        ✓
...
delegations    18        18         ✓
──────────────────────────────────────────
Total          3,847     3,847      ✓ PASS
```

### 4b. Spot-check data

```bash
# Sample 10 random agents
npm run paperclipai db:validate --table=agents --sample=10

# Validate joins (agents → companies)
npm run paperclipai db:validate --table=agents --check-fk
```

### 4c. Run application tests

```bash
npm run test
npm run test:e2e
```

Ensure no regressions.

## Step 5: Enable Compatibility Mode

### 5a. Switch read source (no downtime)

Update environment:

```env
COMPAT_MODE=hybrid
COMPAT_FALLBACK=true
```

Restart server:

```bash
npm run dev
# or in production
npm run server:start
```

**What happens:**
- Agency hooks read from canonical API
- Falls back to Supabase if API unavailable
- Writes still go to canonical database
- Both databases stay in sync

### 5b. Test reads and writes

```bash
# Create new agent (tests write)
curl -X POST http://localhost:3100/api/agents \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Agent", "company_id": "..."}'

# Read agents (tests read)
curl http://localhost:3100/api/agents
```

**Verify:**
- New agent appears in canonical database
- `SELECT * FROM agents WHERE name = 'Test Agent'`

## Step 6: Monitor & Adjust

### 6a. Check logs for errors

```bash
tail -f ~/.paperclip/instances/default/logs/server.log | grep -i compat

# Or with debug enabled
DEBUG=paperclip:compat npm run dev
```

**Expected logs:**
```
[compat] mapping useAgents to GET /api/agents
[compat] query time: 45ms (cache hit)
[compat] fallback not needed (canonical available)
```

**Red flags:**
```
[ERROR] compat fallback to Supabase
[ERROR] compat transformation failed
[ERROR] canonical API timeout
```

If you see errors, investigate before proceeding.

### 6b. Monitor query performance

```bash
# Check slow queries in canonical DB
psql $DATABASE_URL -c "SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;"
```

Add indexes if needed:

```bash
npm run db:generate  # Auto-suggests missing indexes
```

## Step 7: Remove Supabase Dependency

Once confident (after 1-2 days in production):

### 7a. Disable fallback

Update environment:

```env
COMPAT_MODE=canonical
COMPAT_FALLBACK=false
```

Restart server. Supabase is no longer used.

### 7b. Remove Supabase code (optional)

Delete Supabase-specific imports:

```bash
# Remove Supabase hook files
rm src/db/hooks.supabase.ts
rm src/db/supabase.ts

# Remove Supabase config
rm .env.supabase
```

Update imports:

```typescript
// Before
import { useAgents } from '@/db/hooks.supabase'

// After (compat client now built-in)
import { useAgents } from '@/db/hooks'
```

### 7c. Commit & release

```bash
git commit -m "Migration: drop Supabase dependency"
git push
npm run release:publish 2026.318.0 --channel stable
```

## Rollback Procedure

### If something goes wrong, revert quickly:

```bash
# 1. Switch back to Supabase
COMPAT_MODE=agency-only  # reads from Supabase
npm run dev

# 2. Restart with old environment
export $(cat .env.backup | xargs)
npm run server:start

# 3. Debug canonical database
psql $DATABASE_URL -c "ROLLBACK;"
npm run db:restore <backup-id>  # if data was corrupted
```

**Nothing is lost:**
- Supabase data untouched (read-only)
- Canonical DB can be reset
- Backups available for both

## Performance Considerations

### Before: Supabase RLS queries

- Cold start: 100-200ms (warm: 20-50ms)
- Connection pool: Shared across cloud accounts
- Limits: 100 req/sec per API key

### After: Canonical + API

- Cold start: 30-80ms (warm: 10-30ms)
- Connection pool: Local, dedicated
- Limits: None (your infrastructure)

**Typical improvements:**
- 2-3x faster queries
- Better connection reuse
- Predictable scaling

## Troubleshooting

### Backfill hangs on one table

The script will timeout after 30 min per table. If stuck:

```bash
# Cancel current backfill
Ctrl+C

# Check what table it was on
tail -20 ~/.paperclip/instances/default/logs/backfill.log

# Resume
npm run paperclipai db:backfill-supabase --resume-at=<table>
```

### Data mismatch detected

If validation shows mismatches:

```bash
# Get detailed report
npm run paperclipai db:validate --table=agents --verbose

# Check for recent Supabase changes
npm run paperclipai db:backfill-supabase --delta  # only new/changed rows
```

### Application errors after migration

Check error logs:

```bash
npm run paperclipai logs --tail 200 --follow
```

Common issues:

1. **"Field not found"** — Schema mismatch
   - Verify migration applied: `npm run db:migrate:canonical`
   - Rerun: `npm run db:push`

2. **"Permission denied"** — RLS/auth issue
   - Check BETTER_AUTH_SECRET set
   - Verify principal grants: `psql -c "SELECT * FROM principal_permission_grants;"`

3. **"Connection refused"** — Database down
   - Verify DATABASE_URL
   - Check Postgres is running: `psql $DATABASE_URL -c "SELECT 1"`

## Timeline

| Phase | Duration | Action | Risk |
|-------|----------|--------|------|
| Pre | 10 min | Deploy schema, backups | None |
| Backfill | 5-30 min | Sync data | Low (both DB read) |
| Hybrid | 1-7 days | Run parallel, validate | Low (fallback exists) |
| Canonical | 1+ day | Remove Supabase code | None (no functional change) |

## Success Criteria

✓ All row counts match
✓ No application errors in logs
✓ API response times acceptable (< 200ms p95)
✓ Tests passing
✓ Users report no issues
✓ Queries run 2-3x faster

## Completion

Once all criteria met:

```bash
# Document completion
echo "Migration completed: $(date)" >> CHANGELOG.md
git commit -m "Migration: canonical database live"

# Monitor in production
npm run paperclipai logs --follow
npm run paperclipai health --watch  # every 10 sec
```

## Next Steps

- Read [AGENCY-COMPAT.md](./AGENCY-COMPAT.md) for compatibility details
- Check [DATABASE.md](./DATABASE.md) for schema reference
- Review [DEPLOYMENT-MODES.md](./DEPLOYMENT-MODES.md) for deployment
