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

# Agency WZRD — Autonomous Agent OS

Agency WZRD is an operating system for AI-native organizations. It gives teams a single control plane for identity, delegation, execution, payments, and observability across autonomous agents.

It unifies agent operations into a single product surface: agents have identity, authority is scoped, work is observable, spend is traceable, and operational evidence is exportable.

## Overview

Agency WZRD combines multiple previously separate systems into one platform for running agent-powered teams. It includes wallet-based authentication, agent identity, delegation controls, orchestration workflows, payment rails, integration management, and a company workspace designed for operating autonomous organizations.

The platform is built around a practical model for agent-native work:

- agents are treated like employees
- permissions are explicit
- execution is logged
- budgets are governed
- outputs are reviewable
- artifacts are portable

## Core capabilities

- **Agent cockpit** with a 3D delegation office, drag-and-drop work management, and org visualization
- **Wallet-based authentication** via thirdweb with Google, email, passkey, MetaMask, Coinbase, Rainbow, and Rabby
- **Multi-agent orchestration** across 10 harness adapters including Claude, Codex, Cursor, Gemini, HTTP, Hermes, and more
- **Agent identity manifests** with auto-generated `agent.json` files for portable identity and registration flows
- **Structured execution logging** through `agent_log.json` run artifacts
- **Payment infrastructure** using x402 flows and USDC on Arbitrum
- **Autonomous execution loop** with safety guardrails, budget tracking, and multi-step planning
- **Private inference support** through Venice
- **Token action workflows** through Uniswap integrations
- **Delegation chains** modeled from leadership to department to task agent
- **Cross-chain operations** through Bankr and Celo-connected surfaces
- **Guided onboarding** with a 4-step setup wizard and feature tour
- **Integrations management** with connect/disconnect controls across 17 integrations
- **Comprehensive test coverage** with 918 unit and component tests across 52 suites

## Product surfaces

### Cockpit

The cockpit is the visual control layer for the system. It combines a 3D delegation office, task surfaces, approval flows, and organizational views to make agent activity legible at a glance.

### Chat orchestration

A streaming chat surface lets operators assign work, coordinate agent execution, and monitor ongoing sessions in real time.

### Delegation framework

Authority can be distributed across the organization through structured delegation chains. This supports inspection, validation, and revocation of permissions across leadership, department, and task layers.

### Agent identity

Each agent can expose a portable identity surface and downloadable manifest describing capabilities, tools, and metadata.

### Payments and settlement

Invoice creation, settlement validation, and downloadable payment evidence are built into the system, making spend and service execution auditable.

### Exportable evidence

Key operational artifacts can be assembled and downloaded in one place for audits, demos, internal review, or system handoff.

## Tech stack

React 18 · TypeScript · Vite · Supabase · Three.js · thirdweb · TanStack React Query · Zustand · shadcn/ui · Tailwind CSS

## Getting started

```sh
npm install
# Copy .env.example or create .env with required variables
npm run dev

By default, the app starts on http://localhost:5173.

The application can run in demo mode if the Supabase schema has not yet been applied.

Database setup

Run the SQL files in Supabase SQL Editor in this order:
	1.	supabase/migrations/202603110001_create_agency_cockpit.sql
	2.	src/db/migration-snippets.sql

Verification

Run the standard repo checks before shipping changes:

npm test
npx tsc -p tsconfig.app.json --noEmit
npm run build

Key artifacts

Agency WZRD can generate and export structured artifacts that describe agent identity, execution, payments, and system routes.

Artifact	Description	Retrieval path
agent.json	Agent manifest with identity, tools, and capabilities	/submission-proof or /agents/:id
agent_log.json	Run-scoped execution log with entries and usage	/submission-proof or /runs/:id
payment_evidence.json	Invoice and settlement records	/submission-proof
route_matrix.json	Reachable product routes	/submission-proof
submission_proof_pack.json	Complete bundled export	/submission-proof

Proof pack flow

To retrieve the full export bundle:
	1.	Start the app:

npm run dev -- --host 127.0.0.1 --port 3101


	2.	Navigate to /submission-proof
	3.	Click Load agents and runs
	4.	Select an agent to enable agent.json
	5.	Select a run to enable agent_log.json
	6.	Click Assemble Proof Pack
	7.	Download individual artifacts or the full bundle

Route map

All major product routes are accessible from the left navigation.

Section	Routes
Top	/cockpit, /dashboard, /inbox
Work	/issues, /goals, /approvals, /projects
Agents	/agents, /agents/new, /agents/:id
Company	/org-chart, /skills, /delegations, /costs, /activity, /integrations, /submission-proof, /settings

Repo entry points

This repository includes multiple entry points depending on what you want to run:

pnpm install

# Public app
pnpm dev

# API server
pnpm dev:server

# Workspace UI
pnpm dev:ui

For deeper setup and deployment guidance, see:
	•	docs/DEVELOPING.md
	•	docs/DATABASE.md
	•	docs/start/architecture.md
	•	docs/start/what-is-paperclip.md

Repository structure

src/                Public app and product-facing surfaces
ui/                 Workspace board UI for the control plane
server/             Express API and orchestration services
packages/db/        Drizzle schema, migrations, and DB runtime
packages/shared/    Shared types, constants, validators, API contracts
docs/               Development, architecture, and deployment docs

Shipped surfaces in this repo
	•	Public app in src/: landing, auth, cockpit, chat, delegations, skills, integrations, proof flow, agent detail, onboarding
	•	Workspace UI in ui/: company-scoped control-plane surfaces and showcase pages
	•	Server/API in server/: routes, services, auth, adapter execution, activity, approvals, costs, workspaces, and orchestration logic
	•	Shared schema and contracts in packages/db/ and packages/shared/
	•	Integration modules in src/lib/ for Venice, Uniswap, x402, Bankr, Celo, MetaMask delegations, OpenServ, and AgentCash

Scaffolded surfaces

The repo also includes routes for budgets, workspaces, documents, plugins, invites, and settings that appear in parts of the UI but are not all fully wired to live or server-backed data yet. These should be treated as scaffolded product surfaces rather than the primary system path.

Recent improvements
	•	Faster landing experience with intro animation and a clearer demo narrative
	•	Lightweight product-theatre preview using the real office.glb and character.glb assets
	•	Expanded proof-pack flow across the public product experience
	•	New workspace surfaces for chat, skills, delegations, proof flow, and execution detail
	•	Documentation refresh aligned to the current repository structure and shipped surfaces

Notes
	•	The 3D cockpit requires WebGPU. Unsupported browsers receive a fallback overlay.
	•	The package manager is npm; keep package-lock.json intact.
	•	This repository includes both the public-facing product experience and the deeper company-scoped workspace UI.
	•	Claims in this README are limited to routes, modules, and surfaces currently present in the repository, with scaffolded areas called out explicitly.



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
