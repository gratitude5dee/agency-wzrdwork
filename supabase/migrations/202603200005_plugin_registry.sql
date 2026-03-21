CREATE TABLE IF NOT EXISTS public.plugins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  version text NOT NULL,
  description text,
  package_name text,
  entrypoint text,
  manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.company_plugins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  plugin_id uuid NOT NULL REFERENCES public.plugins(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'installed',
  enabled boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  installed_by_user_id uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_plugins_company_plugin_unique UNIQUE (company_id, plugin_id),
  CONSTRAINT company_plugins_status_check CHECK (status IN ('installed', 'enabled', 'disabled', 'error', 'uninstalled'))
);

CREATE INDEX IF NOT EXISTS idx_company_plugins_company_id
  ON public.company_plugins(company_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_company_plugins_plugin_id
  ON public.company_plugins(plugin_id);

DROP TRIGGER IF EXISTS set_plugins_updated_at ON public.plugins;
CREATE TRIGGER set_plugins_updated_at
BEFORE UPDATE ON public.plugins
FOR EACH ROW
EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS set_company_plugins_updated_at ON public.company_plugins;
CREATE TRIGGER set_company_plugins_updated_at
BEFORE UPDATE ON public.company_plugins
FOR EACH ROW
EXECUTE FUNCTION public.set_current_timestamp_updated_at();

ALTER TABLE public.plugins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_plugins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS deny_plugins_all ON public.plugins;
CREATE POLICY deny_plugins_all ON public.plugins
FOR ALL
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS deny_company_plugins_all ON public.company_plugins;
CREATE POLICY deny_company_plugins_all ON public.company_plugins
FOR ALL
USING (false)
WITH CHECK (false);
