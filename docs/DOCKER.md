# Docker Deployment Guide

Complete instructions for deploying Agency Synthesis using Docker and Docker Compose.

## Quick Start

### Prerequisites

- Docker 20.10+ (with Buildkit support)
- Docker Compose 2.0+
- 4GB RAM minimum (8GB recommended)

### One-Command Deploy

```bash
docker-compose up -d
```

Opens at `http://localhost:3100` (or 5173 for Vite dev)

## Available Configurations

### 1. Production (docker-compose.yml)

Full-featured deployment with Postgres and Redis.

```bash
docker-compose up -d
```

**Services:**
- agency (port 3100, 5173)
- postgres (port 5432)
- redis (port 6379)

**Mode:** Authenticated (requires user login)

### 2. Quickstart (docker-compose.quickstart.yml)

Minimal setup for demos and testing.

```bash
docker-compose -f docker-compose.quickstart.yml up -d
```

**Services:**
- agency only (embedded postgres)
- Single operator, no auth

**Mode:** local_trusted

### 3. Untrusted Review (docker-compose.untrusted-review.yml)

Isolated environment for code review and testing.

```bash
docker-compose -f docker-compose.untrusted-review.yml up -d
```

## Configuration

### Environment File

Create `.env` in repository root:

```env
# Server
PORT=3100
NODE_ENV=production
SERVE_UI=true
MODE=authenticated

# Database
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/agency
POSTGRES_PASSWORD=postgres
POSTGRES_USER=postgres
POSTGRES_DB=agency

# Auth
BETTER_AUTH_SECRET=your-secure-random-key-min-32-chars
BETTER_AUTH_URL=http://localhost:3100/auth

# LLM Adapters (optional)
ANTHROPIC_API_KEY=sk-...
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...

# Control Plane
CONTROL_PLANE_ENCRYPTION_KEY=your-base64-encoded-32-byte-key
CONTROL_PLANE_POLL_INTERVAL_MS=1500
CONTROL_PLANE_SCHEDULER_INTERVAL_MS=10000

# Logging
LOG_LEVEL=info
DEBUG=paperclip:*
```

### Volume Mounts

```yaml
volumes:
  agency_postgres_data:    # /var/lib/postgresql/data
  agency_redis_data:       # /data (Redis)
  agency_backups:          # Database backups
  agency_instance_config:  # ~/.paperclip/instances/
```

### Port Mapping

| Service | Internal | External | Purpose |
|---------|----------|----------|---------|
| agency | 3100 | 3100 | API server |
| agency | 5173 | 5173 | Vite dev UI |
| postgres | 5432 | 5432 | Database |
| redis | 6379 | 6379 | Cache/queue |

## Building the Image

### Standard Build

```bash
docker build -f Dockerfile -t agency:latest .
```

**Build args:**
```bash
docker build \
  --build-arg NODE_VERSION=20 \
  --build-arg VITE_API_BASE=/api \
  -f Dockerfile \
  -t agency:latest .
```

### Multi-stage Build

Dockerfile uses multi-stage:

1. **builder** — Node + pnpm, compiles TypeScript
2. **runtime** — Slim base, runs compiled app

Result: ~500MB image (vs 1GB+ with all deps)

### Smoke Test Image

For CI/CD validation:

```bash
docker build -f Dockerfile.onboard-smoke -t agency-smoke:latest .
docker run --rm -e DATABASE_URL=... agency-smoke:latest
```

## Running Containers

### Start Services

```bash
docker-compose up -d
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f agency
docker-compose logs -f postgres
```

### Execute Commands

```bash
# Run migration
docker-compose exec agency npm run db:migrate:canonical

# Create backup
docker-compose exec agency npm run db:backup

# Access postgres
docker-compose exec postgres psql -U postgres -d agency
```

### Stop Services

```bash
docker-compose down          # Stop and remove containers
docker-compose down -v       # Also remove volumes (⚠️ deletes data)
```

## Data Persistence

### Postgres Volume

By default, data persists in Docker volume `agency_postgres_data`.

```bash
# List volumes
docker volume ls

# Inspect volume
docker volume inspect agency_postgres_data

# Backup volume
docker run --rm -v agency_postgres_data:/data -v $(pwd):/backup \
  ubuntu tar czf /backup/pg_backup.tar.gz /data
```

### Backup Database

```bash
# Inside container
docker-compose exec postgres pg_dump -U postgres agency > backup.sql

# Or via Agency CLI
docker-compose exec agency npm run db:backup
```

### Restore from Backup

```bash
# Restore postgres dump
docker-compose exec -T postgres psql -U postgres agency < backup.sql
```

## Networking

### Container-to-Container

Services can reference each other by name:

```
agency → postgres:5432
agency → redis:6379
```

### External Access

Expose ports in `docker-compose.yml`:

```yaml
ports:
  - "3100:3100"      # API
  - "5432:5432"      # Postgres (optional)
  - "6379:6379"      # Redis (optional)
```

### Environment Variables Inside Container

Automatically set from `.env`:

```bash
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/agency
```

## Health Checks

Add to `docker-compose.yml`:

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3100/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

Check health:

```bash
docker-compose ps
# Shows health status
```

## Production Deployment

### Deploy to Kubernetes

```bash
# Build and push image
docker build -t myregistry/agency:1.0 .
docker push myregistry/agency:1.0

# Create K8s manifests (example)
kubectl create -f k8s/deployment.yaml
kubectl create -f k8s/service.yaml
kubectl create -f k8s/postgres-statefulset.yaml
```

### Deploy to Cloud Platforms

**AWS ECS:**
```bash
aws ecr get-login-password | docker login --username AWS ...
docker build -t agency:latest .
docker tag agency:latest 123456789.dkr.ecr.us-east-1.amazonaws.com/agency:latest
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/agency:latest
```

**Google Cloud Run:**
```bash
gcloud builds submit --tag gcr.io/PROJECT/agency
gcloud run deploy agency --image gcr.io/PROJECT/agency --platform managed
```

**Azure Container Instances:**
```bash
az acr build --registry myregistry --image agency:latest .
az container create --resource-group mygroup --name agency \
  --image myregistry.azurecr.io/agency:latest
```

### Secrets Management

Never commit `.env` file. Use secrets manager:

```bash
# GitHub Actions
gh secret set DATABASE_URL --body "postgresql://..."

# Docker Compose with external secrets
echo "postgres_password" | docker secret create postgres_password -
```

## Troubleshooting

### Container Won't Start

```bash
docker-compose logs agency
# Check for errors in logs
```

Common issues:

- Port already in use: `lsof -i :3100`
- Database not ready: Wait 10s, retry
- Missing environment vars: Check `.env`

### Database Connection Failed

```bash
# Test connection from container
docker-compose exec agency \
  psql $DATABASE_URL -c "SELECT 1"
```

### Out of Memory

```bash
# Increase Docker memory limit
docker update --memory 4g agency_agency_1
```

### Slow Performance

```bash
# Check resource usage
docker stats

# Profile query performance
docker-compose exec postgres \
  psql -U postgres -d agency -c "EXPLAIN ANALYZE ..."
```

## Cleanup

```bash
# Remove stopped containers and volumes
docker system prune -a --volumes

# Remove all Agency resources
docker-compose down -v
docker rmi agency:latest
```

## Reference Files

- **Dockerfile:** `/sessions/festive-nice-shannon/agency-wzrdwork-main-work/Dockerfile`
- **docker-compose.yml:** `/sessions/festive-nice-shannon/agency-wzrdwork-main-work/docker-compose.yml`
- **docker-compose.quickstart.yml:** `/sessions/festive-nice-shannon/agency-wzrdwork-main-work/docker-compose.quickstart.yml`
- **Dockerfile.onboard-smoke:** `/sessions/festive-nice-shannon/agency-wzrdwork-main-work/Dockerfile.onboard-smoke`

## Next Steps

- See [DEPLOYMENT-MODES.md](./DEPLOYMENT-MODES.md) for mode details
- Check [DEVELOPING.md](./DEVELOPING.md) for local development
- Review [DATABASE.md](./DATABASE.md) for database configuration
