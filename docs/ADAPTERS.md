# Adapter Architecture

Guide to the LLM adapter system that enables agents to integrate with multiple AI models and coding tools.

## Overview

Adapters enable **server-side execution** of code through various LLM and coding platforms. Each adapter is a bridge that translates standardized agent requests into platform-specific API calls.

**Architecture:** Request → Adapter → Platform → Response → Logging

## Adapter Types

### LLM Adapters (Chat/Completion)

- **Claude** — Anthropic's Claude 3 models
- **Codex** — OpenAI's code-specific model (legacy)
- **Cursor** — Cursor IDE integration
- **Gemini** — Google's Gemini models
- **PI** — Scale AI's Pi model
- **OpenCode** — OpenAI's code execution

### Tool Execution Adapters

- **OpenClaw** — OpenClaw gateway for external tools
- **Process** — Local shell command execution
- **HTTP** — Generic HTTP request execution
- **Hermes** — Internal messaging system

## How Adapters Work

### Execution Flow

```
┌──────────────────────────────┐
│ Agent triggers execution     │
│ (e.g., "write code")         │
└────────────┬─────────────────┘
             │
             v
┌──────────────────────────────────────┐
│ Control Plane (execution scheduler)  │
│ - Validates budget/permissions       │
│ - Selects adapter based on request   │
└────────────┬───────────────────────┘
             │
             v
┌──────────────────────────────────────┐
│ Adapter Handler                      │
│ - packages-adapters/*                │
│ - Translates to platform API         │
│ - Executes via platform              │
└────────────┬───────────────────────┘
             │
             v
┌──────────────────────────────────────┐
│ External Platform                    │
│ (Anthropic, OpenAI, Google, etc.)    │
└────────────┬───────────────────────┘
             │
             v
┌──────────────────────────────────────┐
│ Platform Response                    │
│ - Model output, tokens used, etc.    │
└────────────┬───────────────────────┘
             │
             v
┌──────────────────────────────────────┐
│ Adapter Transformer                  │
│ - Normalizes output format           │
│ - Extracts tool calls                │
│ - Maps to canonical run entries      │
└────────────┬───────────────────────┘
             │
             v
┌──────────────────────────────────────┐
│ Storage & Logging                    │
│ - agent_run_entries (execution log)  │
│ - cost_events (token tracking)       │
│ - cost_ledger (budget tracking)      │
└──────────────────────────────────────┘
```

## Adapter Interface

All adapters implement `IAdapter`:

```typescript
interface IAdapter {
  // Metadata
  readonly type: string        // 'claude', 'cursor', etc.
  readonly version: string     // '1.0.0'

  // Capabilities
  canExecute(request: ExecutionRequest): boolean

  // Main entry point
  execute(
    request: ExecutionRequest,
    context: ExecutionContext
  ): Promise<ExecutionResponse>

  // Cleanup (if needed)
  cleanup?(): Promise<void>
}
```

### ExecutionRequest

```typescript
interface ExecutionRequest {
  id: string                    // Unique run ID
  agent_id: string              // Which agent
  company_id: string            // Workspace

  prompt: string                // Instruction
  system_prompt?: string        // System context
  tools?: Tool[]                // Available tools

  messages?: Message[]          // Conversation history
  model?: string                // Model selection
  max_tokens?: number           // Response limit

  budget?: {
    tokens_remaining: number
    cost_remaining_usd: number
  }

  metadata?: Record<string, unknown>
}
```

### ExecutionResponse

```typescript
interface ExecutionResponse {
  status: 'success' | 'error' | 'partial'

  output: {
    text: string                // LLM response
    tool_calls?: ToolCall[]     // Structured tools
  }

  usage: {
    input_tokens: number
    output_tokens: number
    total_cost_usd: number
  }

  execution_time_ms: number
  error?: {
    code: string
    message: string
  }
}
```

## Available Adapters

### Claude (Anthropic)

**Location:** `packages/adapters/claude-local`

```typescript
import { ClaudeAdapter } from '@agency-wzrdwork/adapter-claude'

const adapter = new ClaudeAdapter({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-5-sonnet'
})

const response = await adapter.execute(request, context)
```

**Features:**
- Tool use (structured outputs)
- Vision support
- Extended thinking (beta)
- Prompt caching

**Environment:**
```env
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-3-5-sonnet  # or claude-3-opus
```

**Supported Models:**
- claude-3-5-sonnet (fast, cheap)
- claude-3-opus (most capable)
- claude-3-haiku (ultra-fast)

### OpenAI (Codex/GPT)

**Location:** `packages/adapters/codex-local`

```typescript
import { CodexAdapter } from '@agency-wzrdwork/adapter-codex'

const adapter = new CodexAdapter({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4-turbo'
})
```

**Features:**
- Code completion
- Vision models (GPT-4V)
- Function calling
- Embeddings

**Environment:**
```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-turbo
```

### Cursor

**Location:** `packages/adapters/cursor-local`

IDE-integrated adapter for Cursor editor.

```typescript
import { CursorAdapter } from '@agency-wzrdwork/adapter-cursor'

const adapter = new CursorAdapter({
  workspacePath: '/path/to/project',
  codebaseContext: true  // Include repo context
})
```

**Features:**
- Codebase awareness (AST parsing)
- File editing
- Test generation
- Refactoring suggestions

### Google Gemini

**Location:** `packages/adapters/gemini-local`

```typescript
import { GeminiAdapter } from '@agency-wzrdwork/adapter-gemini'

const adapter = new GeminiAdapter({
  apiKey: process.env.GOOGLE_API_KEY,
  model: 'gemini-pro'
})
```

**Features:**
- Multimodal (text, image, video)
- Long context window
- Fast inference

**Environment:**
```env
GOOGLE_API_KEY=AIzaSy...
GEMINI_MODEL=gemini-pro
```

### Scale AI Pi

**Location:** `packages/adapters/pi-local`

```typescript
import { PiAdapter } from '@agency-wzrdwork/adapter-pi'

const adapter = new PiAdapter({
  apiKey: process.env.SCALE_API_KEY,
  model: 'pi'
})
```

**Features:**
- Cost-effective reasoning
- Long form generation
- Multi-step thinking

### OpenClaw Gateway

**Location:** `packages/adapters/openclaw-gateway`

Gateway for running arbitrary tools and APIs.

```typescript
import { OpenClawAdapter } from '@agency-wzrdwork/adapter-openclaw'

const adapter = new OpenClawAdapter({
  gatewayUrl: 'https://openclaw.example.com',
  apiKey: process.env.OPENCLAW_API_KEY
})
```

### Process Execution

**Location:** `src/adapters/process`

Execute local shell commands with sandboxing.

```typescript
import { ProcessAdapter } from '@agency-wzrdwork/adapter-process'

const adapter = new ProcessAdapter({
  allowedCommands: ['node', 'bash', 'python'],
  timeout: 30000  // 30 seconds
})

// Execute code
const response = await adapter.execute({
  prompt: 'node script.js',
  metadata: { command: 'node script.js' }
}, context)
```

**Security:**
- Whitelist allowed commands
- Timeout protection
- Working directory isolation
- No network access by default

**Environment:**
```env
CONTROL_PLANE_ALLOWED_PROCESS_COMMANDS=node,bash,sh,python,python3
```

### HTTP Adapter

**Location:** `src/adapters/http`

Make HTTP requests from agent execution.

```typescript
const response = await adapter.execute({
  prompt: 'GET https://api.example.com/data',
  metadata: {
    method: 'GET',
    url: 'https://api.example.com/data'
  }
}, context)
```

### Hermes (Internal)

**Location:** `src/adapters/hermes`

Internal messaging system for agent-to-agent communication.

## Adding a New Adapter

### 1. Create adapter package

```bash
mkdir packages/adapters/my-adapter
cd packages/adapters/my-adapter
npm init -y
```

### 2. Implement IAdapter

```typescript
// packages/adapters/my-adapter/src/index.ts

import { IAdapter, ExecutionRequest, ExecutionResponse } from '@agency-wzrdwork/adapter-utils'

export class MyAdapter implements IAdapter {
  readonly type = 'my-adapter'
  readonly version = '1.0.0'

  constructor(private config: Config) {}

  canExecute(request: ExecutionRequest): boolean {
    return request.model?.startsWith('my-') ?? false
  }

  async execute(
    request: ExecutionRequest,
    context: ExecutionContext
  ): Promise<ExecutionResponse> {
    const startTime = Date.now()

    try {
      // Call your service
      const result = await this.callMyService(request.prompt)

      return {
        status: 'success',
        output: { text: result.text },
        usage: {
          input_tokens: result.input_tokens,
          output_tokens: result.output_tokens,
          total_cost_usd: result.cost
        },
        execution_time_ms: Date.now() - startTime
      }
    } catch (error) {
      return {
        status: 'error',
        output: { text: '' },
        usage: { input_tokens: 0, output_tokens: 0, total_cost_usd: 0 },
        execution_time_ms: Date.now() - startTime,
        error: {
          code: 'ADAPTER_ERROR',
          message: error.message
        }
      }
    }
  }

  private async callMyService(prompt: string) {
    // Implementation
  }
}
```

### 3. Register adapter

In `server/src/config/adapters.ts`:

```typescript
import { MyAdapter } from '@agency-wzrdwork/adapter-my-adapter'

export function initializeAdapters() {
  return {
    'my-adapter': new MyAdapter({
      apiKey: process.env.MY_API_KEY
    })
  }
}
```

### 4. Add environment variables

```env
MY_API_KEY=your-key
MY_ADAPTER_ENABLED=true
MY_ADAPTER_MAX_TOKENS=4096
```

### 5. Test

```typescript
// test.ts
import { MyAdapter } from './src'

const adapter = new MyAdapter({ apiKey: 'test' })

const response = await adapter.execute({
  id: 'run_123',
  agent_id: 'agent_1',
  company_id: 'co_1',
  prompt: 'Hello!'
}, {})

console.log(response.output.text)
```

## Adapter Configuration

### server/src/index.ts

```typescript
const adapters = {
  'claude': new ClaudeAdapter(...),
  'codex': new CodexAdapter(...),
  'cursor': new CursorAdapter(...),
  'gemini': new GeminiAdapter(...),
  'pi': new PiAdapter(...),
  'openclaw': new OpenClawAdapter(...),
  'process': new ProcessAdapter(...),
  'http': new HttpAdapter(...),
  'hermes': new HermesAdapter(...)
}
```

### Selection Logic

Control Plane selects adapter based on:

1. Agent's configured `primary_adapter`
2. Request's `model` field
3. Tool availability (tool_calls require Claude/Codex)
4. Budget constraints

## Cost Tracking

Each adapter response includes usage:

```typescript
usage: {
  input_tokens: 1024,
  output_tokens: 512,
  total_cost_usd: 0.015
}
```

**Stored in:**
- `cost_events` table — Raw usage
- `cost_ledger` table — Aggregated by agent/company

**Query costs:**

```sql
SELECT
  agent_id,
  SUM(cost_events.cost_usd) as total_cost
FROM agent_runs
JOIN cost_events ON agent_runs.id = cost_events.run_id
WHERE agent_runs.created_at > now() - interval '30 days'
GROUP BY agent_id
ORDER BY total_cost DESC;
```

## Error Handling

Adapters should handle:

- **Rate limits** — Retry with exponential backoff
- **Timeouts** — Return partial response with error
- **Auth errors** — Clear error message
- **Invalid requests** — Validate before sending

## Monitoring

View adapter health:

```bash
# Logs
DEBUG=adapter:* npm run dev

# Metrics endpoint
curl http://localhost:3100/health/adapters
```

**Response:**
```json
{
  "adapters": {
    "claude": {
      "status": "healthy",
      "last_request": "2026-03-21T15:30:00Z",
      "success_rate": 0.99,
      "avg_latency_ms": 450
    },
    ...
  }
}
```

## Files

- **Adapter utils:** `/packages/adapter-utils`
- **Claude adapter:** `/packages/adapters/claude-local`
- **Codex adapter:** `/packages/adapters/codex-local`
- **Cursor adapter:** `/packages/adapters/cursor-local`
- **Gemini adapter:** `/packages/adapters/gemini-local`
- **Pi adapter:** `/packages/adapters/pi-local`
- **OpenClaw adapter:** `/packages/adapters/openclaw-gateway`
- **Process adapter:** `/src/adapters/process`
- **HTTP adapter:** `/src/adapters/http`
- **Hermes adapter:** `/src/adapters/hermes`

## Next Steps

- See [API.md](./API.md) for execution API
- Check [DEVELOPING.md](./DEVELOPING.md) for dev setup
- Review control-plane documentation for scheduling
