

## Build out Inbox, Chat, Issues, Goals, Approvals, and Projects pages

### Current State

All six pages exist as routes but render minimal content:
- **Inbox**: Shows pending approvals + blocked issues in two cards — no notifications, no action buttons
- **Issues**: Flat list of issues — no filters, no status columns, no create button, no inline editing
- **Goals**: Simple card list — no progress tracking, no owner display, no create/edit
- **Approvals**: Flat list with badge — no filter tabs, no inline approve/reject
- **Projects**: Flat list — no issue counts, no progress bar, no create/edit
- **Chat**: Already fully built with Hermes streaming, session management, agent selection — needs no changes

Data comes from `useAgencyData()` which fetches an `AgencySnapshot` from the server API or falls back to demo data.

### Plan

All changes are in **`src/features/cockpit/pages/SectionPage.tsx`** — replace the minimal section blocks with full-featured UI. No new files needed; this keeps the existing architecture.

---

### 1. Inbox Page (section="inbox")

Replace the current two-card layout with a unified notification-style inbox:

- **Tab bar**: "All", "Approvals", "Blocked Issues", "Failed Runs"
- **Approval items**: Show summary, requesting agent name (lookup from `snapshot.agents`), timestamp, and inline Approve/Reject buttons using `decideApprovalRecord`
- **Blocked issue items**: Show identifier, title, assignee name, with "View" link
- **Failed run items**: Filter `snapshot.runs` for `status === "failed"`, show summary + error excerpt
- **Empty states** per tab

### 2. Issues Page (section="issues")

Replace flat list with a filterable, actionable issue manager:

- **Header row**: Page title + "New Issue" button (reuse `NewIssueDialog`)
- **Filter bar**: Status filter (dropdown with all `IssueStatus` values), priority filter, assignee filter (from `snapshot.agents`)
- **Issue table/list**: Each row shows identifier, title, status badge (color-coded), priority badge, assignee avatar/name, relative timestamp
- **Status badge colors**: backlog=zinc, todo=blue, in_progress=amber, in_review=purple, blocked=red, done=emerald, cancelled=zinc
- **Click navigates** to `/issues/:id` detail page
- **Empty state** when no issues match filters

### 3. Goals Page (section="goals")

Replace card list with goal tracking view:

- **Header**: "Goals" title + "New Goal" dialog (inline form: title, summary, status, owner agent)
- **Goal cards**: Show title, summary, status badge (planned=zinc, active=blue, complete=emerald, at_risk=red), owner agent name
- **Progress indicator**: Visual status chip with appropriate color
- **Create goal**: Insert into Supabase `goals` table via `useAgencyData` or direct Supabase call
- **Edit inline**: Click to expand and edit status/summary

### 4. Approvals Page (section="approvals")

Replace flat list with tabbed approval manager:

- **Tab bar**: "Pending", "Approved", "Rejected", "All"
- **Approval cards**: Summary, details excerpt, requesting agent name, timestamp, status badge
- **Pending items**: Inline approve/reject/revision buttons (reuse `decideApprovalRecord` pattern from DetailPage)
- **Resolution note**: Expandable textarea on pending items
- **Resolved items**: Show resolution note and resolved timestamp

### 5. Projects Page (section="projects")

Replace flat list with project overview:

- **Header**: "Projects" title + "New Project" dialog (name, summary, status, priority)
- **Project cards**: Name, summary, status badge, priority badge, issue count (from `snapshot.issues.filter(i => i.projectId === project.id)`)
- **Progress bar**: Based on done/total issues ratio
- **Click navigates** to `/projects/:id`
- **Create project**: Insert into Supabase `projects` table

### 6. Chat Page — No changes needed

Already fully built with session management, streaming, agent selection, and model picker.

---

### Technical Details

**Data source**: All reads come from `useAgencyData().snapshot` which provides `agents`, `issues`, `goals`, `approvals`, `projects`, `runs`, `activity`.

**Writes**: 
- Issue creation: existing `createIssue` from `useAgencyData()`
- Approval decisions: existing `decideApprovalRecord` from `@/lib/server-api/approvals`
- Goal/Project creation: Direct Supabase inserts using `supabase.from("goals").insert(...)` and `supabase.from("projects").insert(...)`, then invalidate `agency-snapshot` query

**Filtering**: All client-side via `useState` filter state + `.filter()` on snapshot arrays

**Components reused**: `Badge`, `Card`, `Button`, `Select`, `Dialog`, `Input`, `Textarea`, `Tabs` (from shadcn), `NewIssueDialog`, status/priority badge color helpers

**File modified**: `src/features/cockpit/pages/SectionPage.tsx` — replace the 5 section blocks (inbox, issues, goals, approvals, projects) with the full implementations described above. Estimated addition: ~600 lines replacing ~80 lines.

