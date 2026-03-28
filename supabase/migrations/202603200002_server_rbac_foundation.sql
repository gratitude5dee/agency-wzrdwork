CREATE TABLE IF NOT EXISTS public.app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL UNIQUE,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.company_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  role text NOT NULL,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_company_memberships_company
  ON public.company_memberships(company_id, status);

CREATE INDEX IF NOT EXISTS idx_company_memberships_user
  ON public.company_memberships(user_id, status);

CREATE TABLE IF NOT EXISTS public.instance_user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

CREATE TABLE IF NOT EXISTS public.service_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  token_hash text NOT NULL,
  scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_service_accounts_company_name
  ON public.service_accounts(company_id, name);

INSERT INTO public.app_users (wallet_address)
SELECT DISTINCT lower(wallet_address)
FROM (
  SELECT wallet_address FROM public.user_onboarding WHERE wallet_address IS NOT NULL
  UNION
  SELECT wallet_address FROM public.companies WHERE wallet_address IS NOT NULL
) source
ON CONFLICT (wallet_address) DO NOTHING;

INSERT INTO public.company_memberships (company_id, user_id, role, permissions, status)
SELECT DISTINCT
  uo.company_id,
  u.id,
  'owner',
  '{"manage_company": true, "manage_agents": true, "manage_issues": true, "manage_secrets": true}'::jsonb,
  'active'
FROM public.user_onboarding uo
JOIN public.app_users u
  ON lower(u.wallet_address) = lower(uo.wallet_address)
WHERE uo.company_id IS NOT NULL
ON CONFLICT (company_id, user_id) DO NOTHING;

INSERT INTO public.company_memberships (company_id, user_id, role, permissions, status)
SELECT DISTINCT
  c.id,
  u.id,
  'owner',
  '{"manage_company": true, "manage_agents": true, "manage_issues": true, "manage_secrets": true}'::jsonb,
  'active'
FROM public.companies c
JOIN public.app_users u
  ON lower(u.wallet_address) = lower(c.wallet_address)
WHERE c.wallet_address IS NOT NULL
ON CONFLICT (company_id, user_id) DO NOTHING;
