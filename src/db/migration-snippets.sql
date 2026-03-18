-- ============================================================================
-- Agency Synthesis — New Tables & ALTER Statements
-- Copy-paste ready for Supabase SQL Editor
-- Run AFTER the base migration (202603110001_create_agency_cockpit.sql)
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. ALTER TABLE: Add new columns to existing tables
-- --------------------------------------------------------------------------

-- companies: add wallet_address for thirdweb auth
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS wallet_address text;

-- agents: add adapter_config, adapter_overrides, private_cognition_enabled, venice_model
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS adapter_config jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS adapter_overrides jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS private_cognition_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS venice_model text;

-- --------------------------------------------------------------------------
-- 2. CREATE TABLE: agent_wakeup_requests
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.agent_wakeup_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  reason text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_agent_wakeup_requests_agent
  ON public.agent_wakeup_requests(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_wakeup_requests_status
  ON public.agent_wakeup_requests(status);

ALTER TABLE public.agent_wakeup_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public agent_wakeup_requests access" ON public.agent_wakeup_requests;
CREATE POLICY "public agent_wakeup_requests access"
  ON public.agent_wakeup_requests FOR ALL USING (true) WITH CHECK (true);

-- --------------------------------------------------------------------------
-- 3. CREATE TABLE: agent_task_sessions
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.agent_task_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  run_id uuid REFERENCES public.runs(id) ON DELETE SET NULL,
  issue_id uuid REFERENCES public.issues(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  metadata jsonb DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_agent_task_sessions_agent
  ON public.agent_task_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_task_sessions_status
  ON public.agent_task_sessions(status);

ALTER TABLE public.agent_task_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public agent_task_sessions access" ON public.agent_task_sessions;
CREATE POLICY "public agent_task_sessions access"
  ON public.agent_task_sessions FOR ALL USING (true) WITH CHECK (true);

-- --------------------------------------------------------------------------
-- 4. CREATE TABLE: issue_documents
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.issue_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  issue_id uuid NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  mime_type text NOT NULL DEFAULT 'text/plain',
  created_by_agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_issue_documents_issue
  ON public.issue_documents(issue_id);

DROP TRIGGER IF EXISTS set_issue_documents_updated_at ON public.issue_documents;
CREATE TRIGGER set_issue_documents_updated_at
  BEFORE UPDATE ON public.issue_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

ALTER TABLE public.issue_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public issue_documents access" ON public.issue_documents;
CREATE POLICY "public issue_documents access"
  ON public.issue_documents FOR ALL USING (true) WITH CHECK (true);

-- --------------------------------------------------------------------------
-- 5. CREATE TABLE: issue_comments
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.issue_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  issue_id uuid NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  author_agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  body text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_issue_comments_issue
  ON public.issue_comments(issue_id);

DROP TRIGGER IF EXISTS set_issue_comments_updated_at ON public.issue_comments;
CREATE TRIGGER set_issue_comments_updated_at
  BEFORE UPDATE ON public.issue_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

ALTER TABLE public.issue_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public issue_comments access" ON public.issue_comments;
CREATE POLICY "public issue_comments access"
  ON public.issue_comments FOR ALL USING (true) WITH CHECK (true);

-- --------------------------------------------------------------------------
-- 6. CREATE TABLE: cost_events
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.cost_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  run_id uuid REFERENCES public.runs(id) ON DELETE SET NULL,
  event_type text NOT NULL DEFAULT 'inference',
  description text NOT NULL DEFAULT '',
  amount_usd numeric(12, 6) NOT NULL DEFAULT 0,
  token_count integer,
  model text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cost_events_company
  ON public.cost_events(company_id);
CREATE INDEX IF NOT EXISTS idx_cost_events_agent
  ON public.cost_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_cost_events_created
  ON public.cost_events(created_at);

ALTER TABLE public.cost_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public cost_events access" ON public.cost_events;
CREATE POLICY "public cost_events access"
  ON public.cost_events FOR ALL USING (true) WITH CHECK (true);

-- --------------------------------------------------------------------------
-- 7. CREATE TABLE: agent_identities (ERC-8004)
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.agent_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  operator_wallet text,
  manifest jsonb NOT NULL DEFAULT '{}',
  registered_on_chain boolean NOT NULL DEFAULT false,
  chain_tx_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_identities_agent
  ON public.agent_identities(agent_id);

DROP TRIGGER IF EXISTS set_agent_identities_updated_at ON public.agent_identities;
CREATE TRIGGER set_agent_identities_updated_at
  BEFORE UPDATE ON public.agent_identities
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

ALTER TABLE public.agent_identities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public agent_identities access" ON public.agent_identities;
CREATE POLICY "public agent_identities access"
  ON public.agent_identities FOR ALL USING (true) WITH CHECK (true);

-- --------------------------------------------------------------------------
-- 8. CREATE TABLE: agent_execution_logs
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.agent_execution_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  run_id uuid REFERENCES public.runs(id) ON DELETE SET NULL,
  log_type text NOT NULL DEFAULT 'output',
  content jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_execution_logs_agent
  ON public.agent_execution_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_execution_logs_run
  ON public.agent_execution_logs(run_id);
CREATE INDEX IF NOT EXISTS idx_agent_execution_logs_type
  ON public.agent_execution_logs(log_type);

ALTER TABLE public.agent_execution_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public agent_execution_logs access" ON public.agent_execution_logs;
CREATE POLICY "public agent_execution_logs access"
  ON public.agent_execution_logs FOR ALL USING (true) WITH CHECK (true);

-- --------------------------------------------------------------------------
-- 9. CREATE TABLE: agent_invoices (x402 payments)
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.agent_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  seller_wallet text NOT NULL,
  buyer_wallet text,
  description text NOT NULL DEFAULT '',
  line_items jsonb NOT NULL DEFAULT '[]',
  amount_usdc numeric(12, 6) NOT NULL DEFAULT 0,
  paid boolean NOT NULL DEFAULT false,
  tx_hash text,
  chain_id integer NOT NULL DEFAULT 42161,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_agent_invoices_company
  ON public.agent_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_agent_invoices_agent
  ON public.agent_invoices(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_invoices_paid
  ON public.agent_invoices(paid);

ALTER TABLE public.agent_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public agent_invoices access" ON public.agent_invoices;
CREATE POLICY "public agent_invoices access"
  ON public.agent_invoices FOR ALL USING (true) WITH CHECK (true);

-- --------------------------------------------------------------------------
-- 10. CREATE TABLE: user_onboarding
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_onboarding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  wallet_address text NOT NULL,
  onboarding_completed boolean NOT NULL DEFAULT false,
  current_step integer NOT NULL DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_onboarding_wallet
  ON public.user_onboarding(wallet_address);

DROP TRIGGER IF EXISTS set_user_onboarding_updated_at ON public.user_onboarding;
CREATE TRIGGER set_user_onboarding_updated_at
  BEFORE UPDATE ON public.user_onboarding
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

ALTER TABLE public.user_onboarding ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public user_onboarding access" ON public.user_onboarding;
CREATE POLICY "public user_onboarding access"
  ON public.user_onboarding FOR ALL USING (true) WITH CHECK (true);

-- --------------------------------------------------------------------------
-- 11. CREATE TABLE: integrations
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  integration_key text NOT NULL,
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  config jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_integrations_company_key
  ON public.integrations(company_id, integration_key);

DROP TRIGGER IF EXISTS set_integrations_updated_at ON public.integrations;
CREATE TRIGGER set_integrations_updated_at
  BEFORE UPDATE ON public.integrations
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public integrations access" ON public.integrations;
CREATE POLICY "public integrations access"
  ON public.integrations FOR ALL USING (true) WITH CHECK (true);

-- --------------------------------------------------------------------------
-- 12. CREATE TABLE: skills (company-scoped skill registry)
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'general',
  enabled boolean NOT NULL DEFAULT true,
  prerequisite_integration text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_skills_company
  ON public.skills(company_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_skills_company_name
  ON public.skills(company_id, name);

DROP TRIGGER IF EXISTS set_skills_updated_at ON public.skills;
CREATE TRIGGER set_skills_updated_at
  BEFORE UPDATE ON public.skills
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public skills access" ON public.skills;
CREATE POLICY "public skills access"
  ON public.skills FOR ALL USING (true) WITH CHECK (true);

-- --------------------------------------------------------------------------
-- 13. CREATE TABLE: agent_skills (many-to-many agent ↔ skill)
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.agent_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_skills_unique
  ON public.agent_skills(agent_id, skill_id);
CREATE INDEX IF NOT EXISTS idx_agent_skills_agent
  ON public.agent_skills(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_skills_skill
  ON public.agent_skills(skill_id);

ALTER TABLE public.agent_skills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public agent_skills access" ON public.agent_skills;
CREATE POLICY "public agent_skills access"
  ON public.agent_skills FOR ALL USING (true) WITH CHECK (true);
