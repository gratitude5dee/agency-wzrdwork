-- ============================================================================
-- Paperclip Control-Plane Schema Domains — SQL Snippets
-- Copy-paste ready for Supabase SQL Editor
-- Run AFTER migration-snippets.sql
-- ============================================================================
-- These snippets cover the Paperclip schema tables that the Agency Synthesis
-- control plane needs but that are not yet present in the remote Supabase
-- project. They follow the same pattern as migration-snippets.sql:
--   • IF NOT EXISTS / IF EXISTS guards for idempotency
--   • RLS enabled on every table
--   • company_id present on every row for tenant scoping
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. ALTER TABLE: Additional columns on existing tables to reach Paperclip
--    parity needed by the control plane
-- --------------------------------------------------------------------------

-- companies: budget + issue prefix + status columns from Paperclip
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS issue_prefix text NOT NULL DEFAULT 'AGN',
  ADD COLUMN IF NOT EXISTS issue_counter integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS budget_monthly_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS spent_monthly_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS pause_reason text,
  ADD COLUMN IF NOT EXISTS paused_at timestamptz;

-- agents: runtime_config, budget, permissions, metadata, last_heartbeat_at
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS runtime_config jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS budget_monthly_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS spent_monthly_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pause_reason text,
  ADD COLUMN IF NOT EXISTS paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS last_heartbeat_at timestamptz,
  ADD COLUMN IF NOT EXISTS metadata jsonb,
  ADD COLUMN IF NOT EXISTS icon text;

-- issues: parent_id, issue_number, created_by, started/completed/cancelled timestamps
ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.issues(id),
  ADD COLUMN IF NOT EXISTS issue_number integer,
  ADD COLUMN IF NOT EXISTS created_by_agent_id uuid REFERENCES public.agents(id),
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

-- projects: lead_agent_id, target_date, color, archived_at
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS lead_agent_id uuid REFERENCES public.agents(id),
  ADD COLUMN IF NOT EXISTS target_date date,
  ADD COLUMN IF NOT EXISTS color text,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- goals: level, description, parent_id
ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS level text NOT NULL DEFAULT 'task',
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.goals(id);

-- approvals: richer Paperclip approval fields (type, payload, decision tracking)
ALTER TABLE public.approvals
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS payload jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS decision_note text,
  ADD COLUMN IF NOT EXISTS decided_by_user_id text,
  ADD COLUMN IF NOT EXISTS decided_at timestamptz;

-- --------------------------------------------------------------------------
-- 2. CREATE TABLE: labels (company-scoped label taxonomy)
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_labels_company ON public.labels(company_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_labels_company_name ON public.labels(company_id, name);

DROP TRIGGER IF EXISTS set_labels_updated_at ON public.labels;
CREATE TRIGGER set_labels_updated_at
  BEFORE UPDATE ON public.labels
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

ALTER TABLE public.labels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public labels access" ON public.labels;
CREATE POLICY "public labels access"
  ON public.labels FOR ALL USING (true) WITH CHECK (true);

-- --------------------------------------------------------------------------
-- 3. CREATE TABLE: issue_labels (many-to-many issue ↔ label)
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.issue_labels (
  issue_id uuid NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  label_id uuid NOT NULL REFERENCES public.labels(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (issue_id, label_id)
);

CREATE INDEX IF NOT EXISTS idx_issue_labels_issue ON public.issue_labels(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_labels_label ON public.issue_labels(label_id);
CREATE INDEX IF NOT EXISTS idx_issue_labels_company ON public.issue_labels(company_id);

ALTER TABLE public.issue_labels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public issue_labels access" ON public.issue_labels;
CREATE POLICY "public issue_labels access"
  ON public.issue_labels FOR ALL USING (true) WITH CHECK (true);

-- --------------------------------------------------------------------------
-- 4. CREATE TABLE: issue_approvals (link issues to approval records)
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.issue_approvals (
  company_id uuid NOT NULL REFERENCES public.companies(id),
  issue_id uuid NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  approval_id uuid NOT NULL REFERENCES public.approvals(id) ON DELETE CASCADE,
  linked_by_agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  linked_by_user_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (issue_id, approval_id)
);

CREATE INDEX IF NOT EXISTS idx_issue_approvals_issue ON public.issue_approvals(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_approvals_approval ON public.issue_approvals(approval_id);
CREATE INDEX IF NOT EXISTS idx_issue_approvals_company ON public.issue_approvals(company_id);

ALTER TABLE public.issue_approvals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public issue_approvals access" ON public.issue_approvals;
CREATE POLICY "public issue_approvals access"
  ON public.issue_approvals FOR ALL USING (true) WITH CHECK (true);

-- --------------------------------------------------------------------------
-- 5. CREATE TABLE: finance_events (granular billing/spend tracking)
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.finance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  agent_id uuid REFERENCES public.agents(id),
  issue_id uuid REFERENCES public.issues(id),
  project_id uuid REFERENCES public.projects(id),
  goal_id uuid REFERENCES public.goals(id),
  run_id uuid REFERENCES public.runs(id),
  cost_event_id uuid REFERENCES public.cost_events(id),
  billing_code text,
  description text,
  event_kind text NOT NULL,
  direction text NOT NULL DEFAULT 'debit',
  biller text NOT NULL,
  provider text,
  model text,
  quantity integer,
  unit text,
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  estimated boolean NOT NULL DEFAULT false,
  external_invoice_id text,
  metadata_json jsonb,
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_events_company_occurred
  ON public.finance_events(company_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_finance_events_company_kind
  ON public.finance_events(company_id, event_kind, occurred_at);
CREATE INDEX IF NOT EXISTS idx_finance_events_company_run
  ON public.finance_events(company_id, run_id);

ALTER TABLE public.finance_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public finance_events access" ON public.finance_events;
CREATE POLICY "public finance_events access"
  ON public.finance_events FOR ALL USING (true) WITH CHECK (true);

-- --------------------------------------------------------------------------
-- 6. CREATE TABLE: budget_policies (per-scope spending limits)
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.budget_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  scope_type text NOT NULL,
  scope_id uuid NOT NULL,
  metric text NOT NULL DEFAULT 'billed_cents',
  window_kind text NOT NULL,
  amount integer NOT NULL DEFAULT 0,
  warn_percent integer NOT NULL DEFAULT 80,
  hard_stop_enabled boolean NOT NULL DEFAULT true,
  notify_enabled boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_by_user_id text,
  updated_by_user_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_budget_policies_company_scope
  ON public.budget_policies(company_id, scope_type, scope_id, is_active);
CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_policies_unique
  ON public.budget_policies(company_id, scope_type, scope_id, metric, window_kind);

DROP TRIGGER IF EXISTS set_budget_policies_updated_at ON public.budget_policies;
CREATE TRIGGER set_budget_policies_updated_at
  BEFORE UPDATE ON public.budget_policies
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

ALTER TABLE public.budget_policies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public budget_policies access" ON public.budget_policies;
CREATE POLICY "public budget_policies access"
  ON public.budget_policies FOR ALL USING (true) WITH CHECK (true);

-- --------------------------------------------------------------------------
-- 7. CREATE TABLE: budget_incidents (threshold breach records)
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.budget_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  policy_id uuid NOT NULL REFERENCES public.budget_policies(id),
  scope_type text NOT NULL,
  scope_id uuid NOT NULL,
  metric text NOT NULL,
  window_kind text NOT NULL,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  threshold_type text NOT NULL,
  amount_limit integer NOT NULL,
  amount_observed integer NOT NULL,
  status text NOT NULL DEFAULT 'open',
  approval_id uuid REFERENCES public.approvals(id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_budget_incidents_company_status
  ON public.budget_incidents(company_id, status);

DROP TRIGGER IF EXISTS set_budget_incidents_updated_at ON public.budget_incidents;
CREATE TRIGGER set_budget_incidents_updated_at
  BEFORE UPDATE ON public.budget_incidents
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

ALTER TABLE public.budget_incidents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public budget_incidents access" ON public.budget_incidents;
CREATE POLICY "public budget_incidents access"
  ON public.budget_incidents FOR ALL USING (true) WITH CHECK (true);

-- --------------------------------------------------------------------------
-- 8. CREATE TABLE: agent_runtime_state (per-agent live runtime snapshot)
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.agent_runtime_state (
  agent_id uuid PRIMARY KEY REFERENCES public.agents(id),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  adapter_type text NOT NULL,
  session_id text,
  state_json jsonb NOT NULL DEFAULT '{}',
  last_run_id uuid,
  last_run_status text,
  total_input_tokens bigint NOT NULL DEFAULT 0,
  total_output_tokens bigint NOT NULL DEFAULT 0,
  total_cached_input_tokens bigint NOT NULL DEFAULT 0,
  total_cost_cents bigint NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_runtime_state_company
  ON public.agent_runtime_state(company_id, agent_id);

DROP TRIGGER IF EXISTS set_agent_runtime_state_updated_at ON public.agent_runtime_state;
CREATE TRIGGER set_agent_runtime_state_updated_at
  BEFORE UPDATE ON public.agent_runtime_state
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

ALTER TABLE public.agent_runtime_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public agent_runtime_state access" ON public.agent_runtime_state;
CREATE POLICY "public agent_runtime_state access"
  ON public.agent_runtime_state FOR ALL USING (true) WITH CHECK (true);

-- --------------------------------------------------------------------------
-- 9. CREATE TABLE: activity_log (richer Paperclip activity log alongside
--    the existing activity_events table)
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  actor_type text NOT NULL DEFAULT 'system',
  actor_id text NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  agent_id uuid REFERENCES public.agents(id),
  run_id uuid REFERENCES public.runs(id),
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_company_created
  ON public.activity_log(company_id, created_at);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity
  ON public.activity_log(entity_type, entity_id);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public activity_log access" ON public.activity_log;
CREATE POLICY "public activity_log access"
  ON public.activity_log FOR ALL USING (true) WITH CHECK (true);
