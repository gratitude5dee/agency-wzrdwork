# Source Porting Map

Reference-repo mapping and porting guidance for this mission.

**What belongs here:** read-only source locations, target destinations, and parity expectations.

---

## Read-Only Source Repos

- `paperclip-master 2/`
- `hermes-agent-main/`
- `openclaw-composio-plugin-master/`
- `thirdweb repos/`

Workers must never edit those repos during this mission.

## Paperclip → Agency Synthesis

| Source area | Representative source path | Expected target area |
|---|---|---|
| Dashboard charts and summary panels | `paperclip-master 2/ui/src/pages/Dashboard.tsx` | `src/features/cockpit/pages/SectionPage.tsx`, related chart/panel components |
| Kanban board | `paperclip-master 2/ui/src/components/KanbanBoard.tsx` | `src/features/cockpit/delegation/components/KanbanPanel.tsx` |
| Org chart layout | `paperclip-master 2/ui/src/pages/OrgChart.tsx` | `src/pages/OrgChart.tsx`, cockpit org section |
| Agent config form | `paperclip-master 2/ui/src/components/AgentConfigForm.tsx` | `src/pages/NewAgent.tsx`, `src/pages/AgentDetail.tsx` |
| Sidebar patterns | `paperclip-master 2/ui/src/components/Sidebar*.tsx` | `src/features/cockpit/components/AppShell.tsx` |
| REST client surface | `paperclip-master 2/ui/src/api/*.ts` | `src/api/*.ts` using Supabase client |
| Rich schema domains | `paperclip-master 2/packages/db/src/schema/*` | `src/db/migration-snippets.sql`, Supabase schema snippets |

## Hermes → Agency Synthesis

| Source area | Representative source path | Expected target area |
|---|---|---|
| Tool/runtime capabilities | `hermes-agent-main/tools/registry.py` | Hermes adapter capability metadata in `src/adapters/hermes/**` |
| Runtime config expectations | `hermes-agent-main/run_agent.py` | persisted Hermes `adapter_config` shape and runtime notes |
| Skills patterns | `hermes-agent-main/skills/` | company Skills registry import flows |

## OpenClaw Composio Plugin → Agency Synthesis

| Source area | Representative source path | Expected target area |
|---|---|---|
| Plugin manifest and config | `openclaw-composio-plugin-master/index.ts` | `src/lib/composio/**`, OpenClaw adapter config, Integrations page |
| Example skill docs | `openclaw-composio-plugin-master/skills/composio/SKILL.md` | Composio tool/skill discovery UI and import behavior |

## Thirdweb / x402 → Agency Synthesis

| Source area | Representative source path | Expected target area |
|---|---|---|
| Wallet auth UX | `thirdweb repos/x402-ai-inference-main/components/sign-in-button.tsx` | `src/components/WalletAuth.tsx`, `src/pages/AuthPage.tsx` |
| thirdweb provider setup | `thirdweb repos/ai-wallet-manager-main/components/providers/thirdweb-provider.tsx` | `src/providers/ThirdwebProvider.tsx` |
| x402 settlement patterns | `thirdweb repos/x402-ai-inference-main/app/api/chat/route.ts` | `src/lib/x402/payment.ts`, new edge function surfaces |
| Invoice model | `thirdweb repos/x402-invoice-main 2/lib/invoices.ts` | `src/lib/x402/invoices.ts` |

## Porting Rules

1. Port behaviors and data contracts, not unused internal framework code.
2. Replace source-repo backend dependencies with the existing Supabase client or mission-specific edge functions.
3. Preserve route/nav fit with the target app; if parity would disrupt a working page, add a new left-nav page instead.
4. Keep all new product-facing flows testable from browser or named API/harness evidence.
