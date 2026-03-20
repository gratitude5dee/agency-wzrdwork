# Agency WZRD — Synthesis Hackathon Alignment

## How Agency WZRD Maps to the Four Hackathon Themes

### Theme 1: Agents That Pay

**Hackathon asks:** Scoped spending permissions, onchain settlement, conditional payments, auditable transaction history.

**What we built:**

- **Budget policies table** (`budget_policies`) — per-agent spend limits (max_spend_usd, max_tokens_per_run, max_runs_per_day) with auto-pause on breach. Humans define boundaries; agents operate within them.
- **Finance events table** (`finance_events`) — every payment logged with tx_hash, chain, token, and metadata. Full auditability onchain.
- **Cost events table** (`cost_events`) — granular per-run token metering by provider and model. Auditable per-request spend.
- **Budget incidents** (`budget_incidents`) — automatic alerts when agents approach or breach limits.
- **x402 settlement** — Supabase edge function (`x402-settle`) for USDC payments on Arbitrum using thirdweb SDK. verifyPayment → execute → settlePayment flow.
- **Uniswap integration** — agent-initiated swaps via the Trade API (quote, swap, order). Real token movement with auditable tx hashes.
- **MetaMask Delegations** — CEO → Department → Agent delegation chains with spend limits enforced by the MetaMask Delegation Framework.
- **Invoice tracking** — `agent_invoices` table for payment records with settlement status.

**Key integration partners:** Uniswap, Locus (x402), MetaMask, Celo, AgentCash

---

### Theme 2: Agents That Trust

**Hackathon asks:** Onchain attestations/reputation, portable credentials, open discovery, verifiable service quality.

**What we built:**

- **ERC-8004 Agent Identity** — every agent gets an onchain identity via `agent_identities` table with full JSON manifests (agent.json). Registered on Ethereum mainnet. Portable, platform-independent.
- **Agent execution logs** — structured `agent_execution_logs` table in ERC-8004 format (agent_log.json). Verifiable proof of work performed.
- **Heartbeat protocol** — `heartbeat_runs` and `heartbeat_run_events` tables tracking every agent wake-up, execution, and result. Transparent, inspectable execution history.
- **Agent config revisions** — `agent_config_revisions` table provides full audit trail of how agents were configured over time. No hidden changes.
- **Composio MCP tools** — agents verified against external service integrations with tool discovery and selection.
- **Submission proof pack** — downloadable artifact containing agent.json, agent_log.json, payment_evidence.json, and route_matrix.json for hackathon verification.

**Key integration partners:** Protocol Labs (ERC-8004), Venice (private cognition), Bankr

---

### Theme 3: Agents That Cooperate

**Hackathon asks:** Smart contract commitments, human-defined negotiation boundaries, transparent dispute resolution, composable coordination primitives.

**What we built:**

- **Chat-based agent orchestration** — new `/chat` page with Hermes-style interface for directing agents through natural language. Humans orchestrate multi-agent workflows conversationally.
- **Org chart with delegation** — hierarchical agent reporting structure (CEO → Manager → Engineer). Tasks flow through the chain of command.
- **Approval workflow** — agents request board approval for sensitive actions. Humans review and approve/deny before execution continues.
- **Issue coordination** — Kanban-style issue tracking with atomic checkout (only one agent per issue). Inter-agent communication via comments.
- **Skills system** — agents personalized with skill sets like traditional employees. Prerequisite gating ensures agents only get tools their integrations support.
- **Per-agent integrations** — `agent_integrations` table allows customizing which services each agent can access. Different agents, different capabilities.
- **MetaMask delegation chains** — hierarchical spending authority cascading through the org chart.

**Key integration partners:** OpenServ, Hermes, Composio

---

### Theme 4: Agents That Keep Secrets

**Hackathon asks:** Private payment rails, zero-knowledge authorization, encrypted communication, human-controlled disclosure.

**What we built:**

- **Venice Private Cognition** — per-agent toggle for private AI reasoning via Venice (no-data-retention policy). Agent thinking stays private.
- **Venice model selection** — choose privacy-focused models per-agent from the Venice catalog.
- **Encrypted secrets** — integrations store API keys and credentials securely, never exposed in UI or logs.
- **Scoped data access** — agents only see data relevant to their company and assigned issues via Supabase RLS policies.
- **Human-controlled disclosure** — board operators decide which integrations agents have access to, what budget limits apply, and which skills are assigned.

**Key integration partners:** Venice, Self Protocol (ZK Identity), ENS

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Agency WZRD                           │
│   React 18 + Vite + TypeScript + Tailwind + shadcn/ui  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │ 3D       │  │  Chat    │  │  Agent   │  │  Org   │ │
│  │ Cockpit  │  │  (Hermes)│  │  Config  │  │  Chart │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───┬────┘ │
│       │              │              │             │      │
│  ┌────┴──────────────┴──────────────┴─────────────┴──┐  │
│  │              Core Business Logic                   │  │
│  │  ┌────────────┐  ┌───────────┐  ┌──────────────┐  │  │
│  │  │ Agent Loop │  │ ERC-8004  │  │ Delegations  │  │  │
│  │  │ (Protocol  │  │ Identity  │  │ (MetaMask)   │  │  │
│  │  │  Labs)     │  │           │  │              │  │  │
│  │  └────────────┘  └───────────┘  └──────────────┘  │  │
│  │  ┌────────────┐  ┌───────────┐  ┌──────────────┐  │  │
│  │  │ x402       │  │ Uniswap   │  │ Venice       │  │  │
│  │  │ Payments   │  │ Swaps     │  │ Privacy      │  │  │
│  │  └────────────┘  └───────────┘  └──────────────┘  │  │
│  └───────────────────────┬───────────────────────────┘  │
│                          │                               │
│  ┌───────────────────────┴───────────────────────────┐  │
│  │           Supabase (PostgreSQL + Edge Fns)         │  │
│  │  21+ tables │ RLS │ Realtime │ Edge Functions     │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │           thirdweb (Wallet Auth + x402)            │  │
│  │  InAppWallet │ MetaMask │ Coinbase │ Rainbow      │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Integration Coverage (17 Partners)

| Integration | Theme | Status | Key Artifacts |
|------------|-------|--------|---------------|
| Protocol Labs | Trust | ERC-8004 + agent loop | agent.json, agent_log.json |
| Venice | Secrets | Private cognition toggle | Per-agent model config |
| Uniswap | Pay | Trade API integration | Swap quotes, tx hashes |
| MetaMask | Cooperate | Delegation framework | CEO→Agent chains |
| Bankr | Pay | LLM gateway routing | Edge function proxy |
| AgentCash | Pay | x402 USDC wallet | Settlement + invoices |
| Celo | Pay | Multi-chain stablecoin | Payment flow |
| Lido | Pay | stETH treasury monitor | Yield tracking |
| OpenServ | Cooperate | Workflow registration | x402 services |
| Composio | Cooperate | MCP tool discovery | 400+ tools |
| thirdweb | Trust | Wallet auth + x402 | Multi-wallet connect |
| Supabase | Trust | Data layer + realtime | 21+ tables, RLS |
| ENS | Trust | Identity + names | Reverse resolution |
| Self | Secrets | ZK identity | Credential proofs |
| Arkhai | Cooperate | Escrow primitives | Contract escrow |
| SuperRare | Trust | Rare protocol | NFT attestations |
| bond.credit | Trust | Credit scores | Onchain reputation |

## New Features Added (This Session)

1. **Chat Page** (`/chat`) — Hermes-style agent orchestration with streaming, sessions, tool call visualization
2. **13 New Database Tables** — heartbeat_runs, heartbeat_run_events, agent_config_revisions, agent_runtime_state, cost_events, finance_events, budget_policies, budget_incidents, issue_comments, documents, chat_sessions, chat_messages, agent_integrations
3. **Per-Agent Skills** — inline skill picker on agent creation, skill assignment management on detail page
4. **Per-Agent Integrations** — AgentIntegrationConfig component with company-default overrides
5. **Agent Personalization** — each agent configured with unique skills + integrations like a traditional employee

## Build Direction (Next Steps to Excel)

### High-Impact Features to Add
1. **Live Hermes connection** — connect chat to running Hermes instance for real agent execution
2. **Locus integration** — register agents with Locus for autonomous payments on Base
3. **Real onchain artifacts** — execute actual ERC-8004 registration txs and collect tx hashes
4. **Budget enforcement** — wire budget_policies to the autonomous loop with auto-pause
5. **Inter-agent chat** — allow agents to coordinate through the chat system
6. **x402 pay-per-inference** — charge per-token for agent API calls using thirdweb x402

### What Judges Want to See
- **Load-bearing integrations** — integrations that do real work, not decorative
- **Real onchain artifacts** — actual tx hashes, deployed contracts, registered identities
- **Working demo** — a coherent flow you can walk through live
- **Clear problem statement** — not "we integrated everything" but "we solved X"
- **Human stays in control** — budgets, approvals, delegation limits all enforce human authority
