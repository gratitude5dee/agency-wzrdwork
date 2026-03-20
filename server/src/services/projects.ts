import type { ParameterOrJSON, Sql } from "postgres";
import { HttpError } from "../http.js";
import type { JsonObject } from "../types.js";

interface ProjectRow {
  id: string;
  company_id: string;
  name: string;
  summary: string | null;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
}

interface ProjectWorkspaceRow {
  id: string;
  company_id: string;
  project_id: string;
  name: string;
  source_type: string;
  cwd: string | null;
  repo_url: string | null;
  repo_ref: string | null;
  default_ref: string | null;
  visibility: string;
  setup_command: string | null;
  cleanup_command: string | null;
  remote_provider: string | null;
  remote_workspace_ref: string | null;
  shared_workspace_key: string | null;
  metadata: JsonObject | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export async function listProjects(sql: Sql, companyId: string) {
  return await sql<ProjectRow[]>`
    SELECT id, company_id, name, summary, status, priority, created_at, updated_at
    FROM public.projects
    WHERE company_id = ${companyId}::uuid
    ORDER BY updated_at DESC, created_at DESC
  `;
}

export async function getProject(sql: Sql, projectId: string) {
  const rows = await sql<ProjectRow[]>`
    SELECT id, company_id, name, summary, status, priority, created_at, updated_at
    FROM public.projects
    WHERE id = ${projectId}::uuid
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function createProject(
  sql: Sql,
  input: {
    companyId: string;
    name: string;
    summary?: string | null;
    status?: string | null;
    priority?: string | null;
  },
) {
  const rows = await sql<ProjectRow[]>`
    INSERT INTO public.projects (
      company_id,
      name,
      summary,
      status,
      priority
    )
    VALUES (
      ${input.companyId}::uuid,
      ${input.name},
      ${input.summary ?? ""},
      ${input.status ?? "planned"},
      ${input.priority ?? "medium"}
    )
    RETURNING id, company_id, name, summary, status, priority, created_at, updated_at
  `;
  return rows[0];
}

export async function updateProject(
  sql: Sql,
  projectId: string,
  input: {
    name?: string;
    summary?: string | null;
    status?: string | null;
    priority?: string | null;
  },
) {
  const updates: string[] = [];
  const values: ParameterOrJSON<never>[] = [];

  if (input.name !== undefined) {
    values.push(input.name);
    updates.push(`name = $${values.length}`);
  }
  if (input.summary !== undefined) {
    values.push(input.summary ?? "");
    updates.push(`summary = $${values.length}`);
  }
  if (input.status !== undefined) {
    values.push(input.status);
    updates.push(`status = $${values.length}`);
  }
  if (input.priority !== undefined) {
    values.push(input.priority ?? "medium");
    updates.push(`priority = $${values.length}`);
  }

  if (updates.length === 0) {
    return await getProject(sql, projectId);
  }

  values.push(projectId);
  const rows = await sql.unsafe<ProjectRow[]>(
    `UPDATE public.projects
     SET ${updates.join(", ")}, updated_at = now()
     WHERE id = $${values.length}::uuid
     RETURNING id, company_id, name, summary, status, priority, created_at, updated_at`,
    values,
  );
  return rows[0] ?? null;
}

export async function deleteProject(sql: Sql, projectId: string) {
  const rows = await sql<ProjectRow[]>`
    DELETE FROM public.projects
    WHERE id = ${projectId}::uuid
    RETURNING id, company_id, name, summary, status, priority, created_at, updated_at
  `;
  return rows[0] ?? null;
}

export async function listProjectWorkspaces(sql: Sql, projectId: string) {
  return await sql<ProjectWorkspaceRow[]>`
    SELECT
      id,
      company_id,
      project_id,
      name,
      source_type,
      cwd,
      repo_url,
      repo_ref,
      default_ref,
      visibility,
      setup_command,
      cleanup_command,
      remote_provider,
      remote_workspace_ref,
      shared_workspace_key,
      metadata,
      is_primary,
      created_at,
      updated_at
    FROM public.project_workspaces
    WHERE project_id = ${projectId}::uuid
    ORDER BY is_primary DESC, created_at ASC
  `;
}

export async function createProjectWorkspace(
  sql: Sql,
  input: {
    companyId: string;
    projectId: string;
    name: string;
    sourceType?: string | null;
    cwd?: string | null;
    repoUrl?: string | null;
    repoRef?: string | null;
    defaultRef?: string | null;
    visibility?: string | null;
    setupCommand?: string | null;
    cleanupCommand?: string | null;
    remoteProvider?: string | null;
    remoteWorkspaceRef?: string | null;
    sharedWorkspaceKey?: string | null;
    metadata?: JsonObject | null;
    isPrimary?: boolean;
  },
) {
  const rows = await sql<ProjectWorkspaceRow[]>`
    INSERT INTO public.project_workspaces (
      company_id,
      project_id,
      name,
      source_type,
      cwd,
      repo_url,
      repo_ref,
      default_ref,
      visibility,
      setup_command,
      cleanup_command,
      remote_provider,
      remote_workspace_ref,
      shared_workspace_key,
      metadata,
      is_primary
    )
    VALUES (
      ${input.companyId}::uuid,
      ${input.projectId}::uuid,
      ${input.name},
      ${input.sourceType ?? "local_path"},
      ${input.cwd ?? null},
      ${input.repoUrl ?? null},
      ${input.repoRef ?? null},
      ${input.defaultRef ?? null},
      ${input.visibility ?? "default"},
      ${input.setupCommand ?? null},
      ${input.cleanupCommand ?? null},
      ${input.remoteProvider ?? null},
      ${input.remoteWorkspaceRef ?? null},
      ${input.sharedWorkspaceKey ?? null},
      ${JSON.stringify(input.metadata ?? {})}::jsonb,
      ${input.isPrimary ?? false}
    )
    RETURNING
      id,
      company_id,
      project_id,
      name,
      source_type,
      cwd,
      repo_url,
      repo_ref,
      default_ref,
      visibility,
      setup_command,
      cleanup_command,
      remote_provider,
      remote_workspace_ref,
      shared_workspace_key,
      metadata,
      is_primary,
      created_at,
      updated_at
  `;
  return rows[0];
}

export async function updateProjectWorkspace(
  sql: Sql,
  projectId: string,
  workspaceId: string,
  input: {
    name?: string;
    sourceType?: string | null;
    cwd?: string | null;
    repoUrl?: string | null;
    repoRef?: string | null;
    defaultRef?: string | null;
    visibility?: string | null;
    setupCommand?: string | null;
    cleanupCommand?: string | null;
    remoteProvider?: string | null;
    remoteWorkspaceRef?: string | null;
    sharedWorkspaceKey?: string | null;
    metadata?: JsonObject | null;
    isPrimary?: boolean;
  },
) {
  const updates: string[] = [];
  const values: ParameterOrJSON<never>[] = [];

  const fields: Array<[string | null | undefined, string]> = [
    [input.name, "name"],
    [input.sourceType, "source_type"],
    [input.cwd, "cwd"],
    [input.repoUrl, "repo_url"],
    [input.repoRef, "repo_ref"],
    [input.defaultRef, "default_ref"],
    [input.visibility, "visibility"],
    [input.setupCommand, "setup_command"],
    [input.cleanupCommand, "cleanup_command"],
    [input.remoteProvider, "remote_provider"],
    [input.remoteWorkspaceRef, "remote_workspace_ref"],
    [input.sharedWorkspaceKey, "shared_workspace_key"],
  ];

  for (const [rawValue, column] of fields) {
    if (rawValue === undefined) continue;
    values.push(rawValue);
    updates.push(`${column} = $${values.length}`);
  }

  if (input.metadata !== undefined) {
    values.push(JSON.stringify(input.metadata ?? {}));
    updates.push(`metadata = $${values.length}::jsonb`);
  }

  if (input.isPrimary !== undefined) {
    values.push(input.isPrimary);
    updates.push(`is_primary = $${values.length}`);
  }

  if (updates.length === 0) {
    return (await listProjectWorkspaces(sql, projectId)).find((workspace) => workspace.id === workspaceId) ?? null;
  }

  values.push(projectId, workspaceId);
  const rows = await sql.unsafe<ProjectWorkspaceRow[]>(
    `UPDATE public.project_workspaces
     SET ${updates.join(", ")}, updated_at = now()
     WHERE project_id = $${values.length - 1}::uuid
       AND id = $${values.length}::uuid
     RETURNING
       id,
       company_id,
       project_id,
       name,
       source_type,
       cwd,
       repo_url,
       repo_ref,
       default_ref,
       visibility,
       setup_command,
       cleanup_command,
       remote_provider,
       remote_workspace_ref,
       shared_workspace_key,
       metadata,
       is_primary,
       created_at,
       updated_at`,
    values,
  );
  return rows[0] ?? null;
}

export async function deleteProjectWorkspace(sql: Sql, projectId: string, workspaceId: string) {
  const rows = await sql<ProjectWorkspaceRow[]>`
    DELETE FROM public.project_workspaces
    WHERE project_id = ${projectId}::uuid
      AND id = ${workspaceId}::uuid
    RETURNING
      id,
      company_id,
      project_id,
      name,
      source_type,
      cwd,
      repo_url,
      repo_ref,
      default_ref,
      visibility,
      setup_command,
      cleanup_command,
      remote_provider,
      remote_workspace_ref,
      shared_workspace_key,
      metadata,
      is_primary,
      created_at,
      updated_at
  `;
  return rows[0] ?? null;
}

export async function requireProject(sql: Sql, projectId: string) {
  const project = await getProject(sql, projectId);
  if (!project) {
    throw new HttpError(404, "Project not found");
  }
  return project;
}
