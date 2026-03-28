# API Reference Overview

Complete reference for the Agency Synthesis REST API, covering all 22+ API surface areas, authentication patterns, and usage examples.

## Base URL

```
http://localhost:3100  # Development
https://agency.example.com  # Production
```

## Authentication Patterns

The system supports three authentication methods depending on deployment mode:

### 1. Better Auth Sessions (Multi-User)

For authenticated mode deployments:

```bash
curl -X POST http://localhost:3100/auth/signin/email \
  -H "Content-Type: application/json" \
  -d {
    "email": "user@example.com",
    "password": "password"
  }

# Response includes session cookie
# Subsequent requests use cookie automatically
```

**Session storage:**
- Client: HTTP-only cookie (`better-auth`)
- Server: `user_sessions` table
- TTL: Configurable (default 7 days)

### 2. Agent JWT (Agent-to-Agent)

For agent execution and inter-agent communication:

```bash
curl -X GET http://localhost:3100/api/agents \
  -H "Authorization: Bearer eyJhbGc..."
```

**JWT claims:**
```json
{
  "sub": "agent_abc123",
  "agent_id": "agent_abc123",
  "company_id": "co_xyz789",
  "role": "admin|member|viewer"
}
```

**Generate JWT:**
```bash
npm run paperclipai jwt:generate --agent-id agent_abc123
```

### 3. Board Tokens (Shared Access)

For sharing boards/projects with external users:

```bash
curl -X GET http://localhost:3100/api/boards/board_123 \
  -H "X-Board-Token: board_token_xyz"
```

**Token format:**
- Scoped to specific board
- Read-only or read-write
- Expiring or permanent
- Created via: `POST /api/boards/{id}/tokens`

## API Surface Areas (22+)

### 1. Authentication (`/auth`)

User sign-up, sign-in, sessions

```typescript
POST   /auth/signin/email         // Email login
POST   /auth/signup/email         // Email registration
POST   /auth/signin/google        // Google OAuth
POST   /auth/signin/wallet        // Wallet auth
POST   /auth/signout              // Logout
GET    /auth/session              // Current user
POST   /auth/change-password      // Password change
```

### 2. Companies (`/api/companies`)

Workspace management

```typescript
GET    /api/companies             // List (paginated)
GET    /api/companies/current     // Current workspace
GET    /api/companies/:id         // Details
POST   /api/companies             // Create
PATCH  /api/companies/:id         // Update
DELETE /api/companies/:id         // Archive
```

**Example request:**
```bash
curl http://localhost:3100/api/companies/current \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "id": "co_abc123",
  "name": "Acme Corp",
  "x402_payment_channel": "0x123...",
  "brand_color": "#FF6B6B",
  "created_at": "2026-03-01T00:00:00Z"
}
```

### 3. Agents (`/api/agents`)

AI agent management

```typescript
GET    /api/agents                // List agents
GET    /api/agents/:id            // Agent details
POST   /api/agents                // Create agent
PATCH  /api/agents/:id            // Update config
DELETE /api/agents/:id            // Archive agent
POST   /api/agents/:id/execute    // Trigger execution
```

**Create agent:**
```bash
curl -X POST http://localhost:3100/api/agents \
  -H "Content-Type: application/json" \
  -d {
    "name": "Research Agent",
    "company_id": "co_abc123",
    "primary_adapter": "claude",
    "model": "claude-3-5-sonnet",
    "system_prompt": "You are a research assistant..."
  }
```

### 4. Issues (`/api/issues`)

Tasks, bugs, feature requests

```typescript
GET    /api/issues                // List with filters
GET    /api/issues/:id            // Details + comments
POST   /api/issues                // Create
PATCH  /api/issues/:id            // Update
DELETE /api/issues/:id            // Archive

// Comments
POST   /api/issues/:id/comments   // Add comment
PATCH  /api/issues/:id/comments/:comment_id
DELETE /api/issues/:id/comments/:comment_id

// Labels
POST   /api/issues/:id/labels     // Add label
DELETE /api/issues/:id/labels/:label_id
```

**Query filters:**
```bash
GET /api/issues?project_id=proj_123
GET /api/issues?assigned_to=user_456
GET /api/issues?status=open&priority=high
GET /api/issues?search=bug%20in%20login
```

### 5. Projects (`/api/projects`)

Project/sprint grouping

```typescript
GET    /api/projects
GET    /api/projects/:id
POST   /api/projects
PATCH  /api/projects/:id
DELETE /api/projects/:id
```

### 6. Goals (`/api/goals`)

Strategic goals and key results

```typescript
GET    /api/goals
GET    /api/goals/:id
POST   /api/goals
PATCH  /api/goals/:id
DELETE /api/goals/:id
```

### 7. Delegations (`/api/delegations`)

Authority chains (CEO → Dept → Agent)

```typescript
GET    /api/delegations
GET    /api/delegations/:id
POST   /api/delegations          // CEO delegates to dept
PATCH  /api/delegations/:id
DELETE /api/delegations/:id

// Delegation authority
GET    /api/delegations/:id/authority
```

**Example delegation:**
```json
{
  "delegator_id": "user_ceo",
  "delegatee_id": "agent_research",
  "authority_level": "execute_all",
  "budget_tokens_per_month": 100000,
  "expires_at": "2026-12-31T23:59:59Z"
}
```

### 8. Approvals (`/api/approvals`)

Approval workflows for high-risk operations

```typescript
GET    /api/approvals
GET    /api/approvals/:id
POST   /api/approvals            // Create approval request
PATCH  /api/approvals/:id        // Approve or reject
```

### 9. Executions (`/api/executions`)

Agent execution and job management

```typescript
GET    /api/executions           // Job queue
GET    /api/executions/:id       // Job status
POST   /api/executions           // Submit job
GET    /api/executions/:id/logs  // Streaming logs
POST   /api/executions/:id/cancel // Cancel job
```

**Stream execution logs:**
```bash
curl -N http://localhost:3100/api/executions/run_123/logs
# Returns streaming newline-delimited JSON
```

### 10. Agent Runs (`/api/runs`)

Historical execution records

```typescript
GET    /api/runs                 // Agent execution history
GET    /api/runs/:id             // Run details
GET    /api/runs/:id/entries     // Structured entries
GET    /api/runs/:id/log         // Download agent_log.json
```

**Response:**
```json
{
  "id": "run_abc123",
  "agent_id": "agent_456",
  "status": "completed",
  "input": {
    "prompt": "Write a function to..."
  },
  "output": {
    "text": "Here's the function...",
    "tool_calls": [...]
  },
  "cost_usd": 0.045,
  "duration_ms": 3200,
  "created_at": "2026-03-21T15:30:00Z"
}
```

### 11. Chat (`/api/chat`)

Real-time agent chat interface

```typescript
POST   /api/chat                 // Send message
GET    /api/chat/:session_id     // Fetch history
WS     /api/chat/stream          // WebSocket streaming
```

**WebSocket example:**
```javascript
const ws = new WebSocket('ws://localhost:3100/api/chat/stream')

ws.onmessage = (event) => {
  const entry = JSON.parse(event.data)
  console.log(entry.text)  // Agent response chunk
}

ws.send(JSON.stringify({
  session_id: 'session_123',
  message: 'What is 2+2?'
}))
```

### 12. Costs (`/api/costs`)

Token and financial tracking

```typescript
GET    /api/costs/summary        // Monthly summary
GET    /api/costs/events         // Detailed events
GET    /api/costs/agents         // By agent
GET    /api/costs/models         // By model
```

**Response:**
```json
{
  "period": "2026-03",
  "total_tokens": 1234567,
  "total_cost_usd": 12.34,
  "by_agent": [
    {
      "agent_id": "agent_1",
      "name": "Research Agent",
      "tokens": 500000,
      "cost_usd": 5.00
    }
  ]
}
```

### 13. Integrations (`/api/integrations`)

Third-party service connections

```typescript
GET    /api/integrations         // List all
GET    /api/integrations/:id     // Details
POST   /api/integrations/:type/connect
DELETE /api/integrations/:id/disconnect

// Available integrations:
// - slack, github, linear, jira, notion, stripe, ...
```

### 14. LLMs (`/api/llms`)

Available language models

```typescript
GET    /api/llms                 // List available models
GET    /api/llms/:name           // Model details

// Response includes:
// - context_window
// - input_cost_per_token
// - output_cost_per_token
// - capabilities (vision, tool_use, streaming)
```

### 15. Permissions (`/api/permissions`)

Fine-grained access control

```typescript
GET    /api/permissions/principals
GET    /api/permissions/grants
POST   /api/permissions/grants   // Grant access
DELETE /api/permissions/grants/:id

// Permissions are on:
// - agents (read, write, admin)
// - issues (read, write, admin)
// - projects (read, write, admin)
// - delegations (read, write, admin)
```

### 16. Secrets (`/api/secrets`)

Encrypted credential storage

```typescript
GET    /api/secrets              // List (keys only)
POST   /api/secrets              // Store
DELETE /api/secrets/:name        // Delete

// For agent execution:
// Control Plane decrypts at execution time
// Never exposed in API responses
```

### 17. Activity (`/api/activity`)

Audit logs and event stream

```typescript
GET    /api/activity             // All events
GET    /api/activity/:entity_id  // Events for entity

// Event types:
// - created, updated, deleted
// - executed, approved, rejected
// - accessed, shared, archived
```

### 18. Dashboards (`/api/dashboards`)

Custom dashboard configuration

```typescript
GET    /api/dashboards
GET    /api/dashboards/:id
POST   /api/dashboards
PATCH  /api/dashboards/:id
DELETE /api/dashboards/:id
```

### 19. Instance Settings (`/api/instance-settings`)

System configuration (admin only)

```typescript
GET    /api/instance-settings
PATCH  /api/instance-settings

// Settings:
// - mode (local_trusted, authenticated)
// - llm_defaults
// - cost_budget_monthly
// - feature_flags
```

### 20. Health (`/api/health`)

System status

```typescript
GET    /api/health
GET    /api/health/ready         // Readiness probe
GET    /api/health/live          // Liveness probe
```

**Response:**
```json
{
  "status": "healthy",
  "database": "connected",
  "adapters": {
    "claude": "ready",
    "codex": "ready"
  },
  "uptime_seconds": 3600
}
```

### 21. Workspace Operations (`/api/workspace-operations`)

Long-running async operations

```typescript
GET    /api/workspace-operations
GET    /api/workspace-operations/:id
POST   /api/workspace-operations/:id/cancel
```

### 22. Plugins (`/api/plugins`)

Plugin management and UI serving

```typescript
GET    /api/plugins              // Installed plugins
GET    /api/plugins/:id/ui       // Plugin UI (iframe)
POST   /api/plugins/:id/data     // Plugin data endpoint
```

## Common Patterns

### Pagination

```bash
GET /api/issues?skip=0&limit=20
GET /api/agents?page=1&per_page=50
```

**Response wrapper:**
```json
{
  "data": [...],
  "total": 150,
  "skip": 0,
  "limit": 20,
  "hasMore": true
}
```

### Filtering

```bash
GET /api/issues?status=open&priority=high&assigned_to=user_123
GET /api/agents?company_id=co_123&archived=false
```

### Sorting

```bash
GET /api/issues?sort=created_at:desc
GET /api/agents?sort=name:asc
```

### Error Responses

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request",
    "details": [
      {
        "field": "email",
        "message": "Must be valid email"
      }
    ]
  }
}
```

**HTTP Status Codes:**
- 200 — Success
- 201 — Created
- 400 — Bad request
- 401 — Unauthorized
- 403 — Forbidden
- 404 — Not found
- 429 — Rate limited
- 500 — Server error

## Rate Limiting

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1234567890
```

By default: 1000 req/min per user

## API Client Libraries

### JavaScript/TypeScript

```bash
npm install @agency-wzrdwork/client
```

```typescript
import { AgencyClient } from '@agency-wzrdwork/client'

const client = new AgencyClient({
  baseURL: 'http://localhost:3100',
  // Auth handled automatically via cookies
})

const agents = await client.agents.list()
const result = await client.agents.execute('agent_123', {
  prompt: 'Write a function...'
})
```

### Python

```bash
pip install agency-client
```

```python
from agency import AgencyClient

client = AgencyClient(base_url='http://localhost:3100')

agents = client.agents.list()
result = client.agents.execute('agent_123', prompt='...')
```

## Documentation Files

- **Adapters:** [ADAPTERS.md](./ADAPTERS.md)
- **Database:** [DATABASE.md](./DATABASE.md)
- **Deployment:** [DEPLOYMENT-MODES.md](./DEPLOYMENT-MODES.md)
- **Development:** [DEVELOPING.md](./DEVELOPING.md)

## Next Steps

- Read [ADAPTERS.md](./ADAPTERS.md) for agent execution
- Check [DATABASE.md](./DATABASE.md) for data models
- Review [DEPLOYMENT-MODES.md](./DEPLOYMENT-MODES.md) for hosting
