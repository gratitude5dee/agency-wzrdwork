-- Migration: 202603180001_paperclip_port_schemas.sql
-- Description: Add critical missing tables from paperclip-master 2 repo
-- Date: 2026-03-18

-- ============================================================================
-- 1. HEARTBEAT_RUNS - Agent execution tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.heartbeat_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  trigger_type text NOT NULL DEFAULT 'manual' CHECK (trigger_type IN ('timer', 'assignment', 'manual', 'automation')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  started_at timestamptz,
  finished_at timestamptz,
  summary text,
  error text,
  total_input_tokens integer DEFAULT 0,
  total_output_tokens integer DEFAULT 0,
  total_cost_usd numeric(10, 2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_heartbeat_runs_agent_id ON public.heartbeat_runs(agent_id);
CREATE INDEX IF NOT EXISTS idx_heartbeat_runs_company_id ON public.heartbeat_runs(company_id);
CREATE INDEX IF NOT EXISTS idx_heartbeat_runs_created_at ON public.heartbeat_runs(created_at DESC);

ALTER TABLE public.heartbeat_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "public access" ON public.heartbeat_runs
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 2. HEARTBEAT_RUN_EVENTS - Individual events during a heartbeat run
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.heartbeat_run_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.heartbeat_runs(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_heartbeat_run_events_run_id ON public.heartbeat_run_events(run_id);
CREATE INDEX IF NOT EXISTS idx_heartbeat_run_events_created_at ON public.heartbeat_run_events(created_at DESC);

ALTER TABLE public.heartbeat_run_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "public access" ON public.heartbeat_run_events
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 3. AGENT_CONFIG_REVISIONS - Agent configuration version history
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.agent_config_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  revision_number integer NOT NULL DEFAULT 1,
  adapter_type text,
  adapter_config jsonb,
  prompt_template text,
  changed_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_config_revisions_agent_id ON public.agent_config_revisions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_config_revisions_company_id ON public.agent_config_revisions(company_id);
CREATE INDEX IF NOT EXISTS idx_agent_config_revisions_revision_number ON public.agent_config_revisions(agent_id, revision_number DESC);

ALTER TABLE public.agent_config_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "public access" ON public.agent_config_revisions
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 4. AGENT_RUNTIME_STATE - Persistent state between heartbeat runs
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.agent_runtime_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL UNIQUE REFERENCES public.agents(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  state_data jsonb DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_runtime_state_agent_id ON public.agent_runtime_state(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_runtime_state_company_id ON public.agent_runtime_state(company_id);

ALTER TABLE public.agent_runtime_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "public access" ON public.agent_runtime_state
  FOR ALL USING (true) WITH CHECK (true);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_agent_runtime_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_agent_runtime_state_updated_at ON public.agent_runtime_state;
CREATE TRIGGER trigger_agent_runtime_state_updated_at
  BEFORE UPDATE ON public.agent_runtime_state
  FOR EACH ROW
  EXECUTE FUNCTION public.update_agent_runtime_state_updated_at();

-- ============================================================================
-- 5. COST_EVENTS - Granular token usage per run
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.cost_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  run_id uuid REFERENCES public.runs(id) ON DELETE SET NULL,
  input_tokens integer DEFAULT 0,
  output_tokens integer DEFAULT 0,
  cached_tokens integer DEFAULT 0,
  cost_usd numeric(10, 4) DEFAULT 0,
  provider text,
  model text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cost_events_company_id ON public.cost_events(company_id);
CREATE INDEX IF NOT EXISTS idx_cost_events_agent_id ON public.cost_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_cost_events_run_id ON public.cost_events(run_id);
CREATE INDEX IF NOT EXISTS idx_cost_events_created_at ON public.cost_events(created_at DESC);

ALTER TABLE public.cost_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "public access" ON public.cost_events
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 6. FINANCE_EVENTS - Payment and budget events
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.finance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  amount_usd numeric(10, 4),
  tx_hash text,
  chain text,
  token text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_events_company_id ON public.finance_events(company_id);
CREATE INDEX IF NOT EXISTS idx_finance_events_agent_id ON public.finance_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_finance_events_event_type ON public.finance_events(event_type);
CREATE INDEX IF NOT EXISTS idx_finance_events_created_at ON public.finance_events(created_at DESC);

ALTER TABLE public.finance_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "public access" ON public.finance_events
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 7. BUDGET_POLICIES - Budget rules per agent/company
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.budget_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES public.agents(id) ON DELETE CASCADE,
  max_spend_usd numeric(10, 2),
  max_tokens_per_run integer,
  max_runs_per_day integer,
  auto_pause_on_breach boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_budget_policies_company_id ON public.budget_policies(company_id);
CREATE INDEX IF NOT EXISTS idx_budget_policies_agent_id ON public.budget_policies(agent_id);

ALTER TABLE public.budget_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "public access" ON public.budget_policies
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 8. BUDGET_INCIDENTS - Budget threshold alerts
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.budget_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  policy_id uuid REFERENCES public.budget_policies(id) ON DELETE SET NULL,
  incident_type text NOT NULL,
  details text,
  resolved boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_budget_incidents_company_id ON public.budget_incidents(company_id);
CREATE INDEX IF NOT EXISTS idx_budget_incidents_agent_id ON public.budget_incidents(agent_id);
CREATE INDEX IF NOT EXISTS idx_budget_incidents_policy_id ON public.budget_incidents(policy_id);
CREATE INDEX IF NOT EXISTS idx_budget_incidents_resolved ON public.budget_incidents(resolved);

ALTER TABLE public.budget_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "public access" ON public.budget_incidents
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 9. ISSUE_COMMENTS - Discussion threads on issues
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.issue_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  author_agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  author_type text DEFAULT 'agent',
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_issue_comments_issue_id ON public.issue_comments(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_comments_company_id ON public.issue_comments(company_id);
CREATE INDEX IF NOT EXISTS idx_issue_comments_author_agent_id ON public.issue_comments(author_agent_id);
CREATE INDEX IF NOT EXISTS idx_issue_comments_created_at ON public.issue_comments(created_at DESC);

ALTER TABLE public.issue_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "public access" ON public.issue_comments
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 10. DOCUMENTS - Knowledge base articles
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text DEFAULT '',
  created_by_agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_company_id ON public.documents(company_id);
CREATE INDEX IF NOT EXISTS idx_documents_created_by_agent_id ON public.documents(created_by_agent_id);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON public.documents(created_at DESC);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "public access" ON public.documents
  FOR ALL USING (true) WITH CHECK (true);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_documents_updated_at ON public.documents;
CREATE TRIGGER trigger_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_documents_updated_at();

-- ============================================================================
-- 11. CHAT_SESSIONS - Chat sessions for agent orchestration
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title text,
  agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  model text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'archived', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_company_id ON public.chat_sessions(company_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_agent_id ON public.chat_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_status ON public.chat_sessions(status);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_created_at ON public.chat_sessions(created_at DESC);

ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "public access" ON public.chat_sessions
  FOR ALL USING (true) WITH CHECK (true);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_chat_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_chat_sessions_updated_at ON public.chat_sessions;
CREATE TRIGGER trigger_chat_sessions_updated_at
  BEFORE UPDATE ON public.chat_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_chat_sessions_updated_at();

-- ============================================================================
-- 12. CHAT_MESSAGES - Messages within chat sessions
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content text,
  content_blocks jsonb,
  tool_calls jsonb,
  tool_results jsonb,
  tokens_used integer,
  model text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON public.chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_role ON public.chat_messages(role);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages(created_at DESC);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "public access" ON public.chat_messages
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 13. AGENT_INTEGRATIONS - Per-agent integration overrides
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.agent_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  integration_key text NOT NULL,
  enabled boolean DEFAULT true,
  config jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(agent_id, integration_key)
);

CREATE INDEX IF NOT EXISTS idx_agent_integrations_agent_id ON public.agent_integrations(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_integrations_company_id ON public.agent_integrations(company_id);
CREATE INDEX IF NOT EXISTS idx_agent_integrations_integration_key ON public.agent_integrations(integration_key);

ALTER TABLE public.agent_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "public access" ON public.agent_integrations
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- Add missing columns to existing tables
-- ============================================================================

-- Add columns to agents table
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS wallet_address text,
  ADD COLUMN IF NOT EXISTS budget_usd numeric(10, 2),
  ADD COLUMN IF NOT EXISTS prompt_template text;

-- Add column to companies table
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS wallet_address text;

-- ============================================================================
-- End of migration
-- ============================================================================
