---
name: synthesis-worker
description: Full-stack React/TypeScript worker for porting components, building features, and integrating SDKs with Supabase backend
---

# Synthesis Worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the WORK PROCEDURE.

## When to Use This Skill

All implementation features in the Agency Synthesis mission:
- Porting UI components from Paperclip or Thirdweb reference repos
- Creating new React pages and components
- Building integration libraries (Venice, Uniswap, MetaMask, Bankr, Celo, etc.)
- Wiring data layer to Supabase client
- Setting up auth, identity, and payment infrastructure

## Reference Codebases (Read-Only)

When porting components, read the source from these locations:
- **Paperclip UI**: `/Users/gratitud3/Downloads/Agency-Synthesis/paperclip-master 2/ui/src/`
- **Paperclip Adapters (workspace packages)**: `/Users/gratitud3/Downloads/Agency-Synthesis/paperclip-master 2/packages/`
- **Thirdweb repos**: `/Users/gratitud3/Downloads/Agency-Synthesis/thirdweb repos/`
- **Hermes agent**: `/Users/gratitud3/Downloads/Agency-Synthesis/hermes-agent-main/`

## Work Procedure

### 1. Understand the Feature

Read the feature description, preconditions, expectedBehavior, and verificationSteps carefully.
- If porting: read the source files from the reference codebase FIRST
- If greenfield: review existing patterns in the base app for consistency
- Check `.factory/library/architecture.md` for conventions

### 2. Write Tests First (TDD)

Before implementing, write failing tests in `src/test/` following existing patterns:
- For hooks: test query behavior, data transformation, error states
- For components: test rendering, conditional display, user interactions
- For utility modules: test input/output, edge cases, error handling
- Use `vitest` with `jsdom` environment (already configured)
- Import from `@testing-library/react` and `@testing-library/jest-dom` (already installed)

### 3. Implement

**For porting from Paperclip:**
1. Read the source component/module from the reference codebase
2. Identify data fetching changes: Express API calls → Supabase client queries
3. Identify routing changes: remove company-prefix (`/:companyPrefix/`) patterns
4. Create the new file in the target location within `src/`
5. Use `supabase` from `src/integrations/supabase/client.ts` for all data
6. Use `@tanstack/react-query` useQuery/useMutation for server state
7. Use existing Shadcn components from `src/components/ui/`
8. Use Tailwind classes with existing dark theme CSS variables
9. Use `lucide-react` for icons

**For greenfield features:**
1. Create modules following base app patterns
2. Place library code in `src/lib/{feature}/`
3. Place React hooks in `src/hooks/`
4. Place pages in `src/pages/`
5. Place feature components in `src/features/{feature}/`

**For SDK integrations:**
1. Create client library in `src/lib/{integration}/`
2. Add TypeScript types in the same directory
3. Create React hooks for React Query integration
4. Wire into existing UI components as specified in the feature description

### 4. Wire into App

If the feature adds new routes:
1. Add route in `src/App.tsx` inside the AppShell layout
2. Add sidebar navigation item in `src/features/cockpit/components/AppShell.tsx`
3. Verify the route is reachable via sidebar click

If adding new npm dependencies:
1. Run `npm install {package}` — this is allowed
2. Do NOT modify `package-lock.json` manually

### 5. Verify (ALL of these, in order)

```bash
npm test                                    # All tests pass
npx tsc -p tsconfig.app.json --noEmit      # No type errors
npm run build                               # Build succeeds
npm run lint                                # Lint passes
```

Fix any failures before proceeding. Then manually verify with agent-browser:
1. Start dev server if not running: check `curl -sf http://localhost:8080` first
2. If not running: start with `npm run dev &` and wait for health check
3. Navigate to the relevant page(s) in the browser
4. Verify rendering, interactions, data display
5. Check for console errors
6. Stop any processes you started

### 6. Critical Constraints (NEVER VIOLATE)

- **DO NOT modify:** `vite.config.ts`, `playwright.config.ts`, `package-lock.json`, `bun.lockb`
- **DO NOT modify** the Supabase URL/anon key values in `.env` or `src/integrations/supabase/client.ts`
- **DO NOT touch** lovable-tagger or any lovable-related code
- **Use** the existing Supabase client for ALL backend operations
- **Add new features** as NEW files — minimize modifications to working existing code
- **Use npm** (not bun or pnpm) for package management
- **Do not leave** dev servers or test watchers running after verification

## Example Handoff

```json
{
  "salientSummary": "Ported KanbanBoard from Paperclip with @dnd-kit drag-drop, wired to Supabase issues table. 7 columns render correctly, drag between columns updates issue status via supabase.from('issues').update(). Ran npm test (6 passing), typecheck clean, build succeeds. Verified with agent-browser: dragged issue from 'backlog' to 'in_progress', UI updated immediately.",
  "whatWasImplemented": "Created src/features/cockpit/delegation/components/KanbanPanel.tsx with DndContext, 7 status columns (backlog/todo/in_progress/in_review/blocked/done/cancelled), SortableContext per column. Added useKanbanIssues hook in src/hooks/useKanbanIssues.ts with React Query for Supabase data. Installed @dnd-kit/core@^6.3.1, @dnd-kit/sortable, @dnd-kit/utilities.",
  "whatWasLeftUndone": "",
  "verification": {
    "commandsRun": [
      { "command": "npm test", "exitCode": 0, "observation": "6 tests passing including 2 new KanbanPanel tests" },
      { "command": "npx tsc -p tsconfig.app.json --noEmit", "exitCode": 0, "observation": "No type errors" },
      { "command": "npm run build", "exitCode": 0, "observation": "Build succeeded, 1.7MB bundle" },
      { "command": "npm run lint", "exitCode": 0, "observation": "No lint errors" }
    ],
    "interactiveChecks": [
      { "action": "Navigated to /cockpit, scrolled to Kanban section", "observed": "7 columns rendered with correct headers (backlog, todo, in_progress, in_review, blocked, done, cancelled), 2 issues visible in correct columns matching Supabase data" },
      { "action": "Dragged ACM-1 card from 'blocked' column to 'in_progress'", "observed": "Card moved smoothly with DragOverlay, status badge updated, no console errors. Refreshed page - card still in new column (Supabase persisted)" }
    ]
  },
  "tests": {
    "added": [
      { "file": "src/test/kanban-panel.test.tsx", "cases": [
        { "name": "renders all 7 status columns", "verifies": "Column headers match expected statuses" },
        { "name": "displays issue cards with correct data", "verifies": "Issue title, identifier, priority visible on cards" }
      ]}
    ]
  },
  "discoveredIssues": []
}
```

## When to Return to Orchestrator

- Feature depends on a Supabase table that doesn't exist and no SQL snippet is provided in the feature description
- A reference component uses a dependency not available in the base app and `npm install` fails
- The feature requires modifying off-limits files (vite.config.ts, playwright.config.ts, package-lock.json, bun.lockb)
- Ambiguity in the feature description that could go multiple directions with significantly different outcomes
- Existing code has bugs that block this feature's implementation
- The ported component's architecture is fundamentally incompatible with the base app's patterns
