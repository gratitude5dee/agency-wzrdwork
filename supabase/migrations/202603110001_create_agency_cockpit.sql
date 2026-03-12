create extension if not exists pgcrypto;

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  company_type text not null,
  description text not null default '',
  brief text not null default '',
  brand_color text not null default '#3b82f6',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  role text not null,
  title text,
  adapter_type text not null,
  status text not null default 'idle',
  capabilities text,
  reports_to uuid references public.agents(id) on delete set null,
  seat_index integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  summary text not null default '',
  status text not null default 'planned',
  priority text not null default 'medium',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null,
  summary text not null default '',
  status text not null default 'planned',
  owner_agent_id uuid references public.agents(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.issues (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  assignee_agent_id uuid references public.agents(id) on delete set null,
  identifier text,
  title text not null,
  description text,
  status text not null default 'todo',
  priority text not null default 'medium',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.approvals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  issue_id uuid references public.issues(id) on delete set null,
  requested_by_agent_id uuid references public.agents(id) on delete set null,
  status text not null default 'pending',
  summary text not null default '',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  issue_id uuid references public.issues(id) on delete set null,
  agent_id uuid not null references public.agents(id) on delete cascade,
  status text not null default 'queued',
  summary text,
  stdout_excerpt text,
  stderr_excerpt text,
  error text,
  total_input_tokens integer,
  total_output_tokens integer,
  total_cached_input_tokens integer,
  total_cost_usd numeric(10, 2),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  agent_id uuid references public.agents(id) on delete set null,
  issue_id uuid references public.issues(id) on delete set null,
  action text not null,
  details text,
  created_at timestamptz not null default now()
);

drop trigger if exists set_companies_updated_at on public.companies;
create trigger set_companies_updated_at before update on public.companies for each row execute function public.set_current_timestamp_updated_at();
drop trigger if exists set_agents_updated_at on public.agents;
create trigger set_agents_updated_at before update on public.agents for each row execute function public.set_current_timestamp_updated_at();
drop trigger if exists set_projects_updated_at on public.projects;
create trigger set_projects_updated_at before update on public.projects for each row execute function public.set_current_timestamp_updated_at();
drop trigger if exists set_goals_updated_at on public.goals;
create trigger set_goals_updated_at before update on public.goals for each row execute function public.set_current_timestamp_updated_at();
drop trigger if exists set_issues_updated_at on public.issues;
create trigger set_issues_updated_at before update on public.issues for each row execute function public.set_current_timestamp_updated_at();

alter table public.companies enable row level security;
alter table public.agents enable row level security;
alter table public.projects enable row level security;
alter table public.goals enable row level security;
alter table public.issues enable row level security;
alter table public.approvals enable row level security;
alter table public.runs enable row level security;
alter table public.activity_events enable row level security;

drop policy if exists "public companies access" on public.companies;
create policy "public companies access" on public.companies for all using (true) with check (true);
drop policy if exists "public agents access" on public.agents;
create policy "public agents access" on public.agents for all using (true) with check (true);
drop policy if exists "public projects access" on public.projects;
create policy "public projects access" on public.projects for all using (true) with check (true);
drop policy if exists "public goals access" on public.goals;
create policy "public goals access" on public.goals for all using (true) with check (true);
drop policy if exists "public issues access" on public.issues;
create policy "public issues access" on public.issues for all using (true) with check (true);
drop policy if exists "public approvals access" on public.approvals;
create policy "public approvals access" on public.approvals for all using (true) with check (true);
drop policy if exists "public runs access" on public.runs;
create policy "public runs access" on public.runs for all using (true) with check (true);
drop policy if exists "public activity access" on public.activity_events;
create policy "public activity access" on public.activity_events for all using (true) with check (true);

insert into public.companies (id, slug, name, company_type, description, brief, brand_color)
values (
  '00000000-0000-4000-8000-000000000001',
  'acme-delegation',
  'Acme Delegation',
  'Autonomous product company',
  'A Supabase-backed AI agency cockpit with live operators, issue flows, and approvals.',
  'Coordinate CEO and engineering work, keep approvals visible, and ship through the Delegation office with a dark control-plane shell.',
  '#3b82f6'
) on conflict (slug) do nothing;

insert into public.agents (id, company_id, name, role, title, adapter_type, status, capabilities, reports_to, seat_index)
values
  (
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000001',
    'CEO',
    'ceo',
    'CEO',
    'claude_local',
    'pending_approval',
    'Strategy, planning, delegation, approval routing',
    null,
    1
  ),
  (
    '00000000-0000-4000-8000-000000000102',
    '00000000-0000-4000-8000-000000000001',
    'Founding Engineer',
    'founding_engineer',
    'Founding Engineer',
    'codex_local',
    'running',
    'React, Supabase, Vite, full-stack shipping',
    '00000000-0000-4000-8000-000000000101',
    2
  )
on conflict (id) do nothing;

insert into public.projects (id, company_id, name, summary, status, priority)
values (
  '00000000-0000-4000-8000-000000000201',
  '00000000-0000-4000-8000-000000000001',
  'Agency Cockpit',
  'Merge the Delegation 3D office into a Supabase/Lovable host.',
  'active',
  'high'
) on conflict (id) do nothing;

insert into public.goals (id, company_id, title, summary, status, owner_agent_id)
values (
  '00000000-0000-4000-8000-000000000301',
  '00000000-0000-4000-8000-000000000001',
  'Launch the merged cockpit',
  'Ship the dark cockpit shell, scene runtime, and Supabase-ready data model.',
  'active',
  '00000000-0000-4000-8000-000000000101'
) on conflict (id) do nothing;

insert into public.issues (id, company_id, project_id, assignee_agent_id, identifier, title, description, status, priority)
values
  (
    '00000000-0000-4000-8000-000000000401',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000201',
    '00000000-0000-4000-8000-000000000101',
    'ACM-1',
    'Create your CEO HEARTBEAT.md',
    'Draft the company heartbeat, define priorities, and route the first approval.',
    'blocked',
    'medium'
  ),
  (
    '00000000-0000-4000-8000-000000000402',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000201',
    '00000000-0000-4000-8000-000000000102',
    'ACM-2',
    'Wire the dark shell into Lovable',
    'Bring the cockpit scene and left nav into the existing Vite app without breaking package-lock ownership.',
    'in_progress',
    'high'
  )
on conflict (id) do nothing;

insert into public.approvals (id, company_id, issue_id, requested_by_agent_id, status, summary)
values (
  '00000000-0000-4000-8000-000000000501',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000401',
  '00000000-0000-4000-8000-000000000101',
  'pending',
  'Confirm the CEO heartbeat structure before execution continues.'
) on conflict (id) do nothing;

insert into public.runs (
  id,
  company_id,
  issue_id,
  agent_id,
  status,
  summary,
  stdout_excerpt,
  error,
  total_input_tokens,
  total_output_tokens,
  total_cached_input_tokens,
  total_cost_usd,
  created_at
)
values
  (
    '00000000-0000-4000-8000-000000000601',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000402',
    '00000000-0000-4000-8000-000000000102',
    'running',
    'Applying cockpit shell and scene integration into the Lovable app.',
    'Mapped the Delegation scene runtime, adjusted the dark cockpit shell, and aligned the host routes with the new sidebar.',
    null,
    12800,
    4200,
    3100,
    0.47,
    now() - interval '10 minutes'
  ),
  (
    '00000000-0000-4000-8000-000000000602',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000401',
    '00000000-0000-4000-8000-000000000101',
    'failed',
    'Blocked on approval before continuing the company heartbeat.',
    'Prepared the first heartbeat outline and paused for board approval.',
    'Awaiting approval response.',
    7600,
    1800,
    900,
    0.19,
    now() - interval '31 minutes'
  )
on conflict (id) do nothing;

insert into public.activity_events (id, company_id, agent_id, issue_id, action, details, created_at)
values
  (
    '00000000-0000-4000-8000-000000000701',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000401',
    'approval.requested',
    'Requested approval for the CEO heartbeat outline.',
    now() - interval '29 minutes'
  ),
  (
    '00000000-0000-4000-8000-000000000702',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000102',
    '00000000-0000-4000-8000-000000000402',
    'run.started',
    'Started implementation for the Lovable cockpit shell.',
    now() - interval '10 minutes'
  )
on conflict (id) do nothing;
