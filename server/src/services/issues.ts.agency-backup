import type { Sql } from "postgres";
import { asOptionalString, asString, HttpError } from "../http.js";

export async function createIssue(sql: Sql, input: {
  companyId: string;
  projectId?: string | null;
  assigneeAgentId?: string | null;
  title: string;
  description?: string | null;
  priority: string;
}): Promise<{ id: string; identifier: string }> {
  const companyId = asString(input.companyId);
  const title = asString(input.title);
  const priority = asString(input.priority);
  if (!companyId || !title || !priority) {
    throw new HttpError(400, "companyId, title, and priority are required");
  }

  const companyRows = await sql<{ slug: string }[]>`
    SELECT slug
    FROM public.companies
    WHERE id = ${companyId}::uuid
    LIMIT 1
  `;
  const slug = companyRows[0]?.slug;
  if (!slug) throw new HttpError(404, "Company not found");

  const countRows = await sql<{ total: number }[]>`
    SELECT COUNT(*)::integer AS total
    FROM public.issues
    WHERE company_id = ${companyId}::uuid
  `;
  const nextNumber = Number(countRows[0]?.total ?? 0) + 1;
  const identifier = `${slug.slice(0, 3).toUpperCase()}-${nextNumber}`;

  const rows = await sql<{ id: string }[]>`
    INSERT INTO public.issues (
      company_id,
      project_id,
      assignee_agent_id,
      identifier,
      title,
      description,
      status,
      priority
    )
    VALUES (
      ${companyId}::uuid,
      ${asOptionalString(input.projectId)}::uuid,
      ${asOptionalString(input.assigneeAgentId)}::uuid,
      ${identifier},
      ${title},
      ${asOptionalString(input.description)},
      'todo',
      ${priority}
    )
    RETURNING id
  `;

  const created = rows[0];
  if (!created) {
    throw new HttpError(500, "Failed to create issue");
  }

  await sql`
    INSERT INTO public.activity_events (company_id, agent_id, issue_id, action, details)
    VALUES (
      ${companyId}::uuid,
      ${asOptionalString(input.assigneeAgentId)}::uuid,
      ${created.id}::uuid,
      'issue.created',
      ${`Opened ${identifier}`}
    )
  `;

  return { id: created.id, identifier };
}

export async function loadIssueCompany(sql: Sql, issueId: string): Promise<{ companyId: string; assigneeAgentId: string | null }> {
  const rows = await sql<{ company_id: string; assignee_agent_id: string | null }[]>`
    SELECT company_id, assignee_agent_id
    FROM public.issues
    WHERE id = ${issueId}::uuid
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) throw new HttpError(404, "Issue not found");
  return {
    companyId: row.company_id,
    assigneeAgentId: row.assignee_agent_id,
  };
}

export async function updateIssueStatus(sql: Sql, issueId: string, status: string): Promise<void> {
  const normalized = asString(status);
  if (!normalized) {
    throw new HttpError(400, "Status is required");
  }

  const issue = await loadIssueCompany(sql, issueId);

  await sql`
    UPDATE public.issues
    SET status = ${normalized}, updated_at = now()
    WHERE id = ${issueId}::uuid
  `;

  await sql`
    INSERT INTO public.activity_events (company_id, agent_id, issue_id, action, details)
    VALUES (
      ${issue.companyId}::uuid,
      ${issue.assigneeAgentId}::uuid,
      ${issueId}::uuid,
      'issue.updated',
      ${`Status changed to ${normalized}`}
    )
  `;
}
