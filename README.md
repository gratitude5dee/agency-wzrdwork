# Agency Synthesis — Autonomous Agent OS

A unified autonomous agent operating system built for the **Synthesis hackathon**, combining 5 codebases into a single platform for managing AI agent companies with wallet-based auth, ERC-8004 on-chain identity, x402 payments, and integrations across 7+ hackathon prize tracks.

## What Was Built

- **Cockpit UI** — 3D delegation office (Three.js WebGPU), drag-drop Kanban board, SVG OrgChart
- **Thirdweb wallet authentication** — Google, email, passkey, MetaMask, Coinbase, Rainbow, Rabby
- **10 agent harness adapters** — Claude, Codex, Cursor, Gemini, OpenCode, Pi, OpenClaw, Process, HTTP, Hermes
- **ERC-8004 agent identity** — auto-generated `agent.json` manifests for on-chain agent registration
- **Structured execution logging** — `agent_log.json` format with run metadata
- **x402 payment infrastructure** — USDC on Arbitrum
- **Protocol Labs autonomous execution loop** — safety guardrails, budget tracking, multi-step plans
- **Venice private cognition** — private AI inference integration
- **Uniswap Trade API** — agentic token swap integration
- **MetaMask Delegation Framework** — CEO → department → task agent delegation chains
- **Bankr LLM Gateway + Celo multi-chain** — cross-chain agent operations
- **4-step user onboarding wizard** — with interactive feature tour (Joyride)
- **Integrations management page** — 17 integrations with connect/disconnect UI
- **918 unit & component tests** across 52 test suites

## Tech Stack

React 18 · TypeScript · Vite · Supabase · Three.js · thirdweb · TanStack React Query · Zustand · Shadcn/UI · Tailwind CSS

## Setup

```sh
npm install
# Copy .env.example or create .env with required variables
npm run dev          # starts on http://localhost:5173 by default
```

The app runs in demo mode if the Supabase schema hasn't been applied yet.

## SQL Setup

Run the SQL files in the Supabase SQL Editor (in order):

1. `supabase/migrations/202603110001_create_agency_cockpit.sql` — base tables + seed data
2. `src/db/migration-snippets.sql` — additional tables for Agency Synthesis features

## Verification

```sh
npm test                                    # 918 tests across 52 suites
npx tsc -p tsconfig.app.json --noEmit       # clean typecheck
npm run build                               # production build, zero errors
```

## Hackathon Tracks Targeted

| # | Track | Prize | Integration |
|---|-------|-------|-------------|
| 1 | **Protocol Labs** | $16K | ERC-8004 identity + autonomous agent execution loop |
| 2 | **Venice** | $11.5K | Private AI cognition |
| 3 | **Uniswap** | $5K | Agentic token trading |
| 4 | **MetaMask** | $5K | Delegation framework (CEO → dept → agent) |
| 5 | **Bankr** | $5K | LLM gateway |
| 6 | **Celo** | $5K | Multi-chain agent operations |
| 7 | **OpenServ / Synthesis** | Open | Full autonomous agent OS |

## Submission Proof Pack

All hackathon submission artifacts are retrievable through the self-contained **Submission Proof** page.

### How to Retrieve the Proof Pack

1. **Start the app:**
   ```sh
   npm run dev -- --host 127.0.0.1 --port 3101
   ```
2. **Navigate to** `/submission-proof` from the left-nav sidebar under **Company → Submission Proof**.
3. **Load context:** Click "Load agents and runs" to populate the agent and run selectors.
4. **Select an agent** from the dropdown to enable `agent.json` (ERC-8004 manifest) retrieval.
5. **Select a run** from the dropdown to enable `agent_log.json` (Protocol Labs execution log) retrieval.
6. **Click "Assemble Proof Pack"** to retrieve all artifacts at once.
7. **Download** individual artifacts or click "Download Full Pack" for the complete JSON bundle.

### Artifact Reference

| Artifact | Description | Retrieval Path |
|----------|-------------|----------------|
| `agent.json` | ERC-8004 agent manifest with identity, tools, and capabilities | `/submission-proof` → Assemble → Download, or `/agents/:id` → ERC-8004 Identity → Download |
| `agent_log.json` | Run-scoped Protocol Labs execution log with entries and usage | `/submission-proof` → Assemble → Download, or `/runs/:id` → Download agent_log.json |
| `payment_evidence.json` | x402 invoice and settlement records for the company | `/submission-proof` → Assemble → Download |
| `route_matrix.json` | All navigable product routes reachable from the sidebar | `/submission-proof` → Download route_matrix.json |
| `submission_proof_pack.json` | Complete bundle of all above artifacts | `/submission-proof` → Download Full Pack |

### Route Matrix

All product routes are reachable from the left-nav sidebar:

| Section | Routes |
|---------|--------|
| Top | `/cockpit`, `/dashboard`, `/inbox` |
| Work | `/issues`, `/goals`, `/approvals`, `/projects` |
| Agents | `/agents`, `/agents/new`, `/agents/:id` |
| Company | `/org-chart`, `/skills`, `/delegations`, `/costs`, `/activity`, `/integrations`, `/submission-proof`, `/settings` |

## Architecture

```
src/
├── components/       # UI components (cockpit, kanban, org-chart, onboarding, settings)
├── contexts/         # React contexts (auth, wallet, delegation)
├── hooks/            # Custom hooks (agents, projects, wallet)
├── lib/              # Core libraries (adapters, identity, payments, autonomous loop, proof-pack)
├── pages/            # Route pages (Dashboard, Cockpit, Integrations, Settings, SubmissionProof)
├── test/             # Test suites
└── integrations/     # Supabase client & types
```

## Notes

- The 3D cockpit requires **WebGPU**; unsupported browsers receive a fallback overlay.
- Package manager is `npm` — keep `package-lock.json`.
