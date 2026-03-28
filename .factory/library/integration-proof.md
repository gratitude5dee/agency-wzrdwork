# Integration Proof Expectations

Core integration expectations and the product surfaces that must prove them.

**What belongs here:** which integrations are core, what counts as load-bearing proof, and what surfaces should expose that proof.

---

## Core Integrations

- thirdweb / wallet auth
- x402 / invoices / settlement
- ERC-8004 manifests and execution logs
- Hermes
- Composio / OpenClaw
- Venice
- Uniswap
- MetaMask delegations
- Bankr
- Celo
- Lido
- OpenServ
- AgentCash

## Stretch Integrations

- SuperRare / Rare Protocol
- bond.credit
- ENS
- Self
- Arkhai

Stretch integrations are not on the critical validation path unless the mission scope changes.

## Proof Rules

### Config-only is not enough

For core integrations, a saved row on `/integrations` is insufficient. Each core integration should have at least one downstream proof surface:

- product UI state tied to that integration
- named tool or agent action
- edge/API call trace
- retrievable artifact or finance/log evidence

### Shared identifiers are required

Integration proof should tie back to one or more of:

- `company_id`
- `agent_id`
- `run_id`
- `invoice_id`
- tx hash / order id

### Company scoping is required

Integrations config and downstream usage must be scoped to the authenticated company. Do not read or write global “first row” integration state.

## Expected Proof Surfaces by Integration

| Integration | Minimum downstream proof |
|---|---|
| thirdweb | real-wallet auth + synced company wallet |
| x402 | server-side settlement path + invoice/payment evidence |
| ERC-8004 | retrievable `agent.json` + run-scoped `agent_log.json` |
| Hermes | adapter registry resolution + Hermes run/transcript path |
| Composio | tool discovery visible in product + selected tools available downstream |
| Venice | product- or agent-triggered run routed through Venice path with redacted operator-visible logs |
| Uniswap | quote/swap or approval-needed flow plus finance/runtime trace |
| MetaMask delegations | scoped chain creation/review/revoke plus readable rejection reasons |
| Bankr | product/agent flow that records model + spend trace |
| Celo | product/agent flow that demonstrates configured chain use |
| Lido | treasury/monitor/MCP dry-run or position evidence |
| OpenServ | workflow/x402 service registration tied to agent identity |
| AgentCash | wallet/payment evidence tied to x402 usage |
