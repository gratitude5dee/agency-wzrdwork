-- Migration: 202603200001_control_plane_execution_spine.sql
-- Description: Thin control-plane execution spine for queue claiming, heartbeat linkage, and encrypted adapter secrets
-- Date: 2026-03-20

-- ============================================================================
-- 1. agent_wakeup_requests: queue claiming, retries, trigger metadata
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.agent_wakeup_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  reason text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE public.agent_wakeup_requests
  ADD COLUMN IF NOT EXISTS trigger_type text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS claimed_by text,
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS run_id uuid REFERENCES public.runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS heartbeat_run_id uuid REFERENCES public.heartbeat_runs(id) ON DELETE SET NULL;

ALTER TABLE public.agent_wakeup_requests
  DROP CONSTRAINT IF EXISTS agent_wakeup_requests_trigger_type_check;

ALTER TABLE public.agent_wakeup_requests
  ADD CONSTRAINT agent_wakeup_requests_trigger_type_check
  CHECK (trigger_type IN ('manual', 'timer'));

ALTER TABLE public.agent_wakeup_requests
  DROP CONSTRAINT IF EXISTS agent_wakeup_requests_status_check;

ALTER TABLE public.agent_wakeup_requests
  ADD CONSTRAINT agent_wakeup_requests_status_check
  CHECK (status IN ('pending', 'claimed', 'completed', 'failed'));

CREATE INDEX IF NOT EXISTS idx_agent_wakeup_requests_status_created
  ON public.agent_wakeup_requests(status, created_at);

CREATE INDEX IF NOT EXISTS idx_agent_wakeup_requests_claimed
  ON public.agent_wakeup_requests(claimed_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_wakeup_requests_active_timer
  ON public.agent_wakeup_requests(agent_id, trigger_type)
  WHERE trigger_type = 'timer' AND status IN ('pending', 'claimed');

ALTER TABLE public.agent_wakeup_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public agent_wakeup_requests access" ON public.agent_wakeup_requests;
CREATE POLICY "public agent_wakeup_requests access"
  ON public.agent_wakeup_requests FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 2. heartbeat_runs: link wakeups and canonical runs
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

ALTER TABLE public.heartbeat_runs
  ADD COLUMN IF NOT EXISTS wakeup_request_id uuid REFERENCES public.agent_wakeup_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS run_id uuid REFERENCES public.runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS trigger_payload jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_heartbeat_runs_wakeup_request_id
  ON public.heartbeat_runs(wakeup_request_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_heartbeat_runs_run_id
  ON public.heartbeat_runs(run_id)
  WHERE run_id IS NOT NULL;

ALTER TABLE public.heartbeat_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public access" ON public.heartbeat_runs;
CREATE POLICY "public access" ON public.heartbeat_runs
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 3. agent_runtime_state: ensure scheduler state JSON exists
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.agent_runtime_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL UNIQUE REFERENCES public.agents(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  state_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_runtime_state
  ADD COLUMN IF NOT EXISTS state_data jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.agent_runtime_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public access" ON public.agent_runtime_state;
DROP POLICY IF EXISTS "public agent_runtime_state access" ON public.agent_runtime_state;
CREATE POLICY "public agent_runtime_state access"
  ON public.agent_runtime_state FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 4. company_secrets + company_secret_versions: encrypted adapter secrets
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.company_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  latest_version integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_company_secrets_company_name
  ON public.company_secrets(company_id, name);

CREATE INDEX IF NOT EXISTS idx_company_secrets_company
  ON public.company_secrets(company_id);

DROP TRIGGER IF EXISTS set_company_secrets_updated_at ON public.company_secrets;
CREATE TRIGGER set_company_secrets_updated_at
  BEFORE UPDATE ON public.company_secrets
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

ALTER TABLE public.company_secrets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public company_secrets access" ON public.company_secrets;
CREATE POLICY "public company_secrets access"
  ON public.company_secrets FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.company_secret_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_id uuid NOT NULL REFERENCES public.company_secrets(id) ON DELETE CASCADE,
  version integer NOT NULL,
  algorithm text NOT NULL DEFAULT 'aes-256-gcm',
  key_id text,
  iv text NOT NULL,
  auth_tag text NOT NULL,
  ciphertext text NOT NULL,
  value_sha256 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_company_secret_versions_secret_version
  ON public.company_secret_versions(secret_id, version);

CREATE INDEX IF NOT EXISTS idx_company_secret_versions_secret_created
  ON public.company_secret_versions(secret_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_company_secret_versions_value_sha256
  ON public.company_secret_versions(value_sha256);

ALTER TABLE public.company_secret_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public company_secret_versions access" ON public.company_secret_versions;
CREATE POLICY "public company_secret_versions access"
  ON public.company_secret_versions FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 5. RPC helpers for atomic wakeup enqueue and secret rotation
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enqueue_agent_wakeup(
  p_agent_id uuid,
  p_company_id uuid,
  p_reason text DEFAULT '',
  p_trigger_type text DEFAULT 'manual',
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (wakeup_request_id uuid, heartbeat_run_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_wakeup_id uuid;
  existing_heartbeat_id uuid;
  new_wakeup_id uuid;
  new_heartbeat_id uuid;
BEGIN
  IF p_trigger_type NOT IN ('manual', 'timer') THEN
    RAISE EXCEPTION 'Unsupported trigger type: %', p_trigger_type;
  END IF;

  IF p_trigger_type = 'timer' THEN
    SELECT id, heartbeat_run_id
      INTO existing_wakeup_id, existing_heartbeat_id
      FROM public.agent_wakeup_requests
     WHERE agent_id = p_agent_id
       AND trigger_type = 'timer'
       AND status IN ('pending', 'claimed')
     ORDER BY created_at DESC
     LIMIT 1;

    IF existing_wakeup_id IS NOT NULL THEN
      RETURN QUERY SELECT existing_wakeup_id, existing_heartbeat_id;
      RETURN;
    END IF;
  END IF;

  INSERT INTO public.heartbeat_runs (
    agent_id,
    company_id,
    trigger_type,
    status,
    summary,
    trigger_payload
  )
  VALUES (
    p_agent_id,
    p_company_id,
    p_trigger_type,
    'pending',
    NULLIF(p_reason, ''),
    COALESCE(p_payload, '{}'::jsonb)
  )
  RETURNING id INTO new_heartbeat_id;

  INSERT INTO public.agent_wakeup_requests (
    company_id,
    agent_id,
    reason,
    trigger_type,
    status,
    payload,
    heartbeat_run_id
  )
  VALUES (
    p_company_id,
    p_agent_id,
    COALESCE(p_reason, ''),
    p_trigger_type,
    'pending',
    COALESCE(p_payload, '{}'::jsonb),
    new_heartbeat_id
  )
  RETURNING id INTO new_wakeup_id;

  UPDATE public.heartbeat_runs
     SET wakeup_request_id = new_wakeup_id
   WHERE id = new_heartbeat_id;

  RETURN QUERY SELECT new_wakeup_id, new_heartbeat_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.rotate_company_secret(
  p_company_id uuid,
  p_name text,
  p_description text,
  p_algorithm text,
  p_key_id text,
  p_iv text,
  p_auth_tag text,
  p_ciphertext text,
  p_value_sha256 text
)
RETURNS TABLE (secret_id uuid, version integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_secret_id uuid;
  next_version integer;
BEGIN
  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'Secret name is required';
  END IF;

  INSERT INTO public.company_secrets (company_id, name, description, latest_version)
  VALUES (p_company_id, btrim(p_name), COALESCE(p_description, ''), 0)
  ON CONFLICT (company_id, name) DO UPDATE
    SET description = CASE
      WHEN EXCLUDED.description <> '' THEN EXCLUDED.description
      ELSE public.company_secrets.description
    END
  RETURNING id INTO target_secret_id;

  SELECT COALESCE(MAX(csv.version), 0) + 1
    INTO next_version
    FROM public.company_secret_versions csv
   WHERE csv.secret_id = target_secret_id;

  INSERT INTO public.company_secret_versions (
    secret_id,
    version,
    algorithm,
    key_id,
    iv,
    auth_tag,
    ciphertext,
    value_sha256
  )
  VALUES (
    target_secret_id,
    next_version,
    COALESCE(NULLIF(p_algorithm, ''), 'aes-256-gcm'),
    NULLIF(p_key_id, ''),
    p_iv,
    p_auth_tag,
    p_ciphertext,
    p_value_sha256
  );

  UPDATE public.company_secrets
     SET latest_version = next_version,
         updated_at = now()
   WHERE id = target_secret_id;

  RETURN QUERY SELECT target_secret_id, next_version;
END;
$$;
