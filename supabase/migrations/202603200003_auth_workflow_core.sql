-- Migration: 202603200003_auth_workflow_core.sql
-- Description: Signed auth sessions, approval detail columns, and deny-by-default RLS for orchestration core
-- Date: 2026-03-20

CREATE TABLE IF NOT EXISTS public.auth_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  nonce text NOT NULL,
  message text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_challenges_nonce
  ON public.auth_challenges(nonce);

CREATE INDEX IF NOT EXISTS idx_auth_challenges_wallet_active
  ON public.auth_challenges(wallet_address, expires_at DESC)
  WHERE consumed_at IS NULL;

CREATE TABLE IF NOT EXISTS public.auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  wallet_address text NOT NULL,
  session_token_sha256 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_sessions_token
  ON public.auth_sessions(session_token_sha256);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_active
  ON public.auth_sessions(user_id, expires_at DESC)
  WHERE revoked_at IS NULL;

ALTER TABLE public.approvals
  ADD COLUMN IF NOT EXISTS details text,
  ADD COLUMN IF NOT EXISTS resolution_note text;

DO $$
DECLARE
  target text;
  policy_row record;
  targets text[] := ARRAY[
    'auth_challenges',
    'auth_sessions',
    'companies',
    'company_memberships',
    'instance_user_roles',
    'agents',
    'issues',
    'approvals',
    'runs',
    'activity_events',
    'integrations',
    'company_secrets',
    'company_secret_versions',
    'heartbeat_runs',
    'heartbeat_run_events',
    'agent_wakeup_requests',
    'agent_runtime_state'
  ];
BEGIN
  FOREACH target IN ARRAY targets LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target);

    FOR policy_row IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = target
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_row.policyname, target);
    END LOOP;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
      'deny browser access',
      target
    );
  END LOOP;
END;
$$;
