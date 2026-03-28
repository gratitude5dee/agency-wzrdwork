CREATE TABLE IF NOT EXISTS public.project_workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  source_type text NOT NULL DEFAULT 'local_path',
  cwd text,
  repo_url text,
  repo_ref text,
  default_ref text,
  visibility text NOT NULL DEFAULT 'default',
  setup_command text,
  cleanup_command text,
  remote_provider text,
  remote_workspace_ref text,
  shared_workspace_key text,
  metadata jsonb DEFAULT '{}'::jsonb,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_workspaces_company_project
  ON public.project_workspaces(company_id, project_id);
CREATE INDEX IF NOT EXISTS idx_project_workspaces_project_primary
  ON public.project_workspaces(project_id, is_primary);
CREATE INDEX IF NOT EXISTS idx_project_workspaces_company_shared_key
  ON public.project_workspaces(company_id, shared_workspace_key);
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_workspaces_remote_ref
  ON public.project_workspaces(project_id, remote_provider, remote_workspace_ref);

ALTER TABLE public.project_workspaces ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public project_workspaces access" ON public.project_workspaces;
CREATE POLICY "public project_workspaces access"
  ON public.project_workspaces FOR ALL USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS set_project_workspaces_updated_at ON public.project_workspaces;
CREATE TRIGGER set_project_workspaces_updated_at
  BEFORE UPDATE ON public.project_workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TABLE IF NOT EXISTS public.instance_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton_key text NOT NULL DEFAULT 'default',
  experimental jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_instance_settings_singleton_key
  ON public.instance_settings(singleton_key);

ALTER TABLE public.instance_settings ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_instance_settings_updated_at ON public.instance_settings;
CREATE TRIGGER set_instance_settings_updated_at
  BEFORE UPDATE ON public.instance_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();
