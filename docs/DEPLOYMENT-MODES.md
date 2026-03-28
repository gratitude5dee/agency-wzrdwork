# Deployment Modes

The Agency Synthesis system supports multiple deployment modes optimized for different use cases.

## Mode Comparison

| Mode | Auth | Users | Ideal For | Setup |
|------|------|-------|-----------|-------|
| `local_trusted` | None | Single | Development, demos | No config needed |
| `authenticated` | Better Auth | Multi-user | Production, teams | Requires secrets |
| `docker` | Configurable | Any | Containerized deploy | Docker Compose |

## Local Trusted Mode

**Best for:** Development, single-operator demos, internal testing

### Features

- No authentication required
- Single operator can access all data
- All agent runs execute automatically
- Database: embedded postgres

### Environment Setup

```bash
# .env or environment variables
MODE=local_trusted
PORT=3100
SERVE_UI=true
DATABASE_URL=  # Optional; defaults to embedded

# Not required in this mode:
# - API keys
# - Authentication secrets
# - User management
```

### Start

```bash
npm run dev
```

Opens automatically at `http://localhost:5173`

### Features Enabled

- Full Cockpit UI (3D delegation office)
- Kanban boards
- Agent execution
- All integrations available

### Limitations

- Only one user (no multi-tenant isolation)
- No audit trail
- All operations trusted
- Not suitable for production

## Authenticated Mode

**Best for:** Production deployments, multi-user teams, enterprise

### Features

- Better Auth for user/role management
- Email, Google, passkey, wallet auth
- Per-user data isolation
- Audit logging
- Fine-grained permissions (principals/grants)

### Environment Setup

```bash
# .env
MODE=authenticated
PORT=3100
SERVE_UI=true

# Database (required)
DATABASE_URL=postgresql://user:pass@postgres:5432/agency

# Better Auth secrets (required)
BETTER_AUTH_SECRET=your-secret-key
BETTER_AUTH_SESSION_TOKEN_EXPIRES_IN=7d

# Optional: Email provider
EMAIL_FROM=noreply@company.com
SENDGRID_API_KEY=your-key

# Control Plane (agent execution)
CONTROL_PLANE_ENCRYPTION_KEY=your-base64-32-byte-key
CONTROL_PLANE_POLL_INTERVAL_MS=1500
```

### Start

```bash
npm run dev
# or in production
npm run server:start
```

Opens at `http://localhost:5173`

### First User Setup

1. Navigate to sign-up page
2. Create account (email, Google, passkey, etc.)
3. First user automatically becomes admin
4. Invite additional team members via invite links

### Features Enabled

- Multi-user isolation
- Role-based access control
- Better Auth dashboard
- Session management
- Audit logs

### Permissions System

Fine-grained access via `principal_permission_grants`:

- Read/write/admin on agents, issues, projects
- Board-level access tokens
- Role inheritance (admin > member > viewer)

## Docker Deployment

**Best for:** Containerized infrastructure, Kubernetes, cloud platforms

### Quick Start

```bash
# Start with docker-compose
docker-compose up -d

# Or with quickstart config
docker-compose -f docker-compose.quickstart.yml up -d
```

### docker-compose.yml

Key services:

- **agency** — Main application (Express + React)
- **postgres** — Canonical database
- **redis** — Optional caching/queue (PgBoss)

### Environment Configuration

Create `.env` for Docker:

```env
# Server
PORT=3100
SERVE_UI=true
NODE_ENV=production

# Database
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/agency
POSTGRES_PASSWORD=postgres

# Auth (choose one mode)
MODE=authenticated  # or local_trusted
BETTER_AUTH_SECRET=docker-secret-key

# LLM adapters
ANTHROPIC_API_KEY=your-key
OPENAI_API_KEY=your-key
```

### Volumes & Persistence

```yaml
volumes:
  postgres_data:   # Database persistence
  backup_data:     # Database backups
  instance_data:   # Instance-specific configs
```

### Build Custom Image

```bash
docker build -f Dockerfile -t agency:latest .
docker run -p 3100:3100 -e DATABASE_URL=... agency:latest
```

**Dockerfile:** `/sessions/festive-nice-shannon/agency-wzrdwork-main-work/Dockerfile`

### Production Checklist

- [ ] Use external Postgres (not embedded)
- [ ] Set MODE=authenticated
- [ ] Configure BETTER_AUTH_SECRET securely
- [ ] Enable HTTPS/TLS
- [ ] Set up log aggregation
- [ ] Configure backups (daily snapshots)
- [ ] Set resource limits (CPU, memory)
- [ ] Enable health checks
- [ ] Configure auto-restart policy

## Environment Variables Reference

### Universal

| Var | Required | Default | Purpose |
|-----|----------|---------|---------|
| `PORT` | No | 3100 | Server port |
| `NODE_ENV` | No | development | Environment |
| `SERVE_UI` | No | true | Serve React frontend |
| `MODE` | No | local_trusted | Auth mode |
| `DATABASE_URL` | No | embedded | Postgres connection |

### Authentication (Mode=authenticated)

| Var | Required | Purpose |
|-----|----------|---------|
| `BETTER_AUTH_SECRET` | Yes | Session signing key |
| `BETTER_AUTH_URL` | No | Auth service URL (defaults to `/auth`) |

### LLM Adapters

| Var | Adapter | Purpose |
|-----|---------|---------|
| `ANTHROPIC_API_KEY` | Claude | LLM API key |
| `OPENAI_API_KEY` | Codex, Cursor | LLM API key |
| `GOOGLE_API_KEY` | Gemini | LLM API key |

### Control Plane (Execution)

| Var | Default | Purpose |
|-----|---------|---------|
| `CONTROL_PLANE_ENCRYPTION_KEY` | None | AES-256 encryption for secrets |
| `CONTROL_PLANE_POLL_INTERVAL_MS` | 1500 | Job polling frequency |
| `CONTROL_PLANE_SCHEDULER_INTERVAL_MS` | 10000 | Scheduler check frequency |
| `CONTROL_PLANE_STALE_CLAIM_MS` | 300000 | Stale job timeout (5 min) |

## Mode Switching

To change modes:

1. Update `.env` `MODE=` variable
2. Restart server
3. No database migration needed (modes share schema)

**Example: Dev to Prod**

```bash
# Development
MODE=local_trusted npm run dev

# Production
MODE=authenticated DATABASE_URL=prod-db npm run server:start
```

## Database Selection by Mode

| Mode | Database Type | Startup Time | Persistence |
|------|---------------|--------------|-------------|
| `local_trusted` | Embedded postgres | 2-3 sec | ~/.paperclip/instances/ |
| `authenticated` | External postgres | N/A | On configured server |
| `docker` | Container postgres | 5-10 sec | Docker volume |

## Scaling

### Horizontal Scaling (Multiple Servers)

All servers must use same external `DATABASE_URL`:

```bash
# Server A
DATABASE_URL=postgresql://shared-db:5432/agency npm run server:start

# Server B
DATABASE_URL=postgresql://shared-db:5432/agency npm run server:start

# Load balancer routes to both
```

### Vertical Scaling (Single Server)

- Increase NODE_MEMORY: `NODE_OPTIONS=--max-old-space-size=4096`
- Configure Postgres connection pooling
- Use external cache (Redis)

## Monitoring & Logs

### Local Development

```bash
DEBUG=paperclip:* npm run dev
```

### Docker Logs

```bash
docker-compose logs -f agency
```

### Production Logging

Configure log forwarding:

```env
LOG_LEVEL=info
LOG_TRANSPORT=syslog  # or stackdriver, datadog
```

## Next Steps

- See [DOCKER.md](./DOCKER.md) for Docker specifics
- Check [DEVELOPING.md](./DEVELOPING.md) for local dev
- Review [MIGRATION-GUIDE.md](./MIGRATION-GUIDE.md) for Supabase → canonical migration
