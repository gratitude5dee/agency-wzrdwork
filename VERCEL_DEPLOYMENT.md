# Agency WzrdWork — Vercel Deployment Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│  LOVABLE / VITE FRONTEND (React SPA)                │
│  - Deployed as static build via Vercel              │
│  - Talks to /api/* serverless functions             │
│  - Subscribes to Supabase Realtime for live events  │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│  VERCEL SERVERLESS FUNCTIONS                        │
│                                                     │
│  /api/server (catch-all)                            │
│    └── Full Express app (50+ routes)                │
│        ├── agents, issues, companies, projects      │
│        ├── goals, approvals, secrets, plugins       │
│        ├── access, activity, assets, llms           │
│        └── health, dashboard, sidebar-badges        │
│                                                     │
│  /api/cron/heartbeat-scheduler  (every 1 min)       │
│    └── Check agent schedules, enqueue wakeups       │
│                                                     │
│  /api/cron/heartbeat-worker     (every 1 min)       │
│    └── Claim & process pending wakeups              │
│                                                     │
│  /api/cron/reap-orphans         (every 5 min)       │
│    └── Clean up stale/timed-out runs                │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│  SUPABASE (PostgreSQL + Realtime + Auth + Storage)  │
│  - Drizzle ORM via connection pooler (port 6543)    │
│  - Realtime Broadcast replaces WebSocket            │
│  - Edge Functions for Venice/Bankr/x402 proxies     │
└─────────────────────────────────────────────────────┘
```

## Prerequisites

1. Vercel account (Pro recommended for 60s function timeout + cron jobs)
2. Supabase project with PostgreSQL database
3. Vercel CLI installed: `npm i -g vercel`

## Step-by-Step Deployment

### 1. Link the project to Vercel

```bash
cd agency-wzrdwork-main
vercel link --yes --project agency-wzrdwork --scope 5dee-studios
```

### 2. Set environment variables

Copy values from `.env.example` / your secret manager to Vercel project settings. Do not commit real secret values.

```bash
# Or set them via CLI:
vercel env add DATABASE_URL production
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add BETTER_AUTH_SECRET production
vercel env add PAPERCLIP_PUBLIC_URL production
vercel env add CRON_SECRET production
vercel env add CONTROL_PLANE_ENCRYPTION_KEY production
vercel env add PAPERCLIP_SECRETS_MASTER_KEY production
vercel env add PAPERCLIP_DEPLOYMENT_MODE production
vercel env add PAPERCLIP_DEPLOYMENT_EXPOSURE production
vercel env add PAPERCLIP_ALLOWED_HOSTNAMES production
vercel env add PAPERCLIP_STORAGE_PROVIDER production
vercel env add PAPERCLIP_STORAGE_S3_BUCKET production
vercel env add PAPERCLIP_STORAGE_S3_REGION production
vercel env add PAPERCLIP_STORAGE_S3_ENDPOINT production
vercel env add PAPERCLIP_STORAGE_S3_PREFIX production
vercel env add PAPERCLIP_STORAGE_S3_FORCE_PATH_STYLE production
vercel env add AWS_ACCESS_KEY_ID production
vercel env add AWS_SECRET_ACCESS_KEY production
```

**CRITICAL**: Use the Supabase **Connection Pooler** URL (port 6543), NOT the direct connection (port 5432). Serverless functions open/close connections rapidly and will exhaust direct connections.

Current linked project status (2026-05-20):

- Vercel project: `5dee-studios/agency-wzrdwork`
- Production env currently present: `DATABASE_URL`
- Production env still required before deploy/smoke: all other values listed above
- `CRON_SECRET` is not auto-created by Vercel; set it manually.
- Thirdweb remains enabled. Set `VITE_THIRDWEB_CLIENT_ID` as a Supabase Edge Function secret for `thirdweb-config`, not as a public browser secret.

### 3. Run database migrations

Before first deploy, ensure your schema is up to date:

```bash
# Set DATABASE_URL locally to your Supabase direct connection (port 5432)
# Migrations use a single long-lived connection, so direct is fine here
export DATABASE_URL="postgresql://postgres:PASSWORD@db.YOURREF.supabase.co:5432/postgres"

pnpm --filter @paperclipai/db build
pnpm db:migrate
```

### 4. Deploy

```bash
# Preview deployment
vercel

# Production deployment
vercel --prod
```

### 5. Verify

After deployment:
- Check health: `curl https://your-project.vercel.app/api/health`
- Check cron logs: Vercel Dashboard → Cron Jobs tab
- Check function logs: Vercel Dashboard → Logs tab

## Key Differences from Self-Hosted

| Feature | Self-Hosted (Paperclip) | Vercel Serverless |
|---------|------------------------|-------------------|
| API Server | Express on port 3100 | Serverless functions (auto-scaled) |
| Database | Embedded or external PG | Supabase PG via connection pooler |
| Heartbeat | Long-running polling loop | Vercel Cron (1-min intervals) |
| WebSocket | Custom ws server | Supabase Realtime Broadcast |
| Plugin Workers | Child processes | Inline execution in serverless |
| Storage | Local disk | Supabase Storage or S3 |
| Cold Starts | None (always running) | ~500ms-2s for first request |

## Cron Jobs

Three cron jobs replicate the control plane's background work:

| Cron | Schedule | Purpose |
|------|----------|---------|
| `heartbeat-scheduler` | Every minute | Checks agent schedules, enqueues wakeups |
| `heartbeat-worker` | Every minute | Claims and processes pending wakeups |
| `reap-orphans` | Every 5 minutes | Cleans up stale runs from timed-out functions |

Cron jobs are secured with `CRON_SECRET`. Vercel sends `Authorization: Bearer <CRON_SECRET>` only when the variable exists, so this must be manually configured in the Production environment.

## Frontend Changes

The only frontend change is swapping the WebSocket connection for Supabase Realtime:

```tsx
// Before (WebSocket):
// const ws = new WebSocket(`/api/companies/${companyId}/events/ws`);

// After (Supabase Realtime):
import { useCompanyRealtimeEvents } from "@/hooks/useSupabaseRealtime";

function MyComponent({ companyId }) {
  const { isConnected, lastEvent } = useCompanyRealtimeEvents(
    companyId,
    (event) => {
      // Handle live event — same shape as before
      console.log(event.type, event.payload);
    }
  );
}
```

## Troubleshooting

**"Connection terminated unexpectedly"**
→ You're using the direct connection URL instead of the connection pooler. Switch to port 6543.

**Cron jobs returning 401**
→ `CRON_SECRET` not set. Go to Vercel Dashboard → Settings → Cron Jobs to verify.

**Cold start timeouts**
→ The Express app takes ~1-2s to initialize on cold start. If you're on Hobby plan (10s timeout), this leaves 8s for the actual request. Upgrade to Pro for 60s timeout.

**Plugin workers failing**
→ Plugins that spawn child processes won't work in serverless. They need to be adapted to run inline or moved to Supabase Edge Functions.

**Document or asset routes fail with "Storage not configured for serverless"**
→ Set `PAPERCLIP_STORAGE_PROVIDER=s3` plus the S3-compatible storage variables above. Supabase Storage can be used through its S3-compatible endpoint if the bucket and credentials are configured.
