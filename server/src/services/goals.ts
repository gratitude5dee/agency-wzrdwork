import { and, asc, eq, isNull } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { goals } from "@paperclipai/db";
import type { ParameterOrJSON, Sql } from "postgres";
import { HttpError } from "../http.js";

interface GoalRow {
  id: string;
  company_id: string;
  title: string;
  summary: string | null;
  status: string;
  owner_agent_id: string | null;
  created_at: string;
  updated_at: string;
}

type GoalReader = Pick<Db, "select">;

export async function getDefaultCompanyGoal(db: GoalReader, companyId: string) {
  const activeRootGoal = await db
    .select()
    .from(goals)
    .where(
      and(
        eq(goals.companyId, companyId),
        eq(goals.level, "company"),
        eq(goals.status, "active"),
        isNull(goals.parentId),
      ),
    )
    .orderBy(asc(goals.createdAt))
    .then((rows) => rows[0] ?? null);
  if (activeRootGoal) return activeRootGoal;

  const anyRootGoal = await db
    .select()
    .from(goals)
    .where(
      and(
        eq(goals.companyId, companyId),
        eq(goals.level, "company"),
        isNull(goals.parentId),
      ),
    )
    .orderBy(asc(goals.createdAt))
    .then((rows) => rows[0] ?? null);
  if (anyRootGoal) return anyRootGoal;

  return db
    .select()
    .from(goals)
    .where(and(eq(goals.companyId, companyId), eq(goals.level, "company")))
    .orderBy(asc(goals.createdAt))
    .then((rows) => rows[0] ?? null);
}

export function goalService(db: Db) {
  return {
    list: (companyId: string) => db.select().from(goals).where(eq(goals.companyId, companyId)),

    getById: (id: string) =>
      db
        .select()
        .from(goals)
        .where(eq(goals.id, id))
        .then((rows) => rows[0] ?? null),

    getDefaultCompanyGoal: (companyId: string) => getDefaultCompanyGoal(db, companyId),

    create: (companyId: string, data: Omit<typeof goals.$inferInsert, "companyId">) =>
      db
        .insert(goals)
        .values({ ...data, companyId })
        .returning()
        .then((rows) => rows[0]),

    update: (id: string, data: Partial<typeof goals.$inferInsert>) =>
      db
        .update(goals)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(goals.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),

    remove: (id: string) =>
      db
        .delete(goals)
        .where(eq(goals.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),
  };
}

export async function listGoals(sql: Sql, companyId: string) {
  return await sql<GoalRow[]>`
    SELECT id, company_id, title, summary, status, owner_agent_id, created_at, updated_at
    FROM public.goals
    WHERE company_id = ${companyId}::uuid
    ORDER BY updated_at DESC, created_at DESC
  `;
}

export async function getGoal(sql: Sql, goalId: string) {
  const rows = await sql<GoalRow[]>`
    SELECT id, company_id, title, summary, status, owner_agent_id, created_at, updated_at
    FROM public.goals
    WHERE id = ${goalId}::uuid
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function createGoal(
  sql: Sql,
  input: {
    companyId: string;
    title: string;
    summary?: string | null;
    status?: string | null;
    ownerAgentId?: string | null;
  },
) {
  const rows = await sql<GoalRow[]>`
    INSERT INTO public.goals (
      company_id,
      title,
      summary,
      status,
      owner_agent_id
    )
    VALUES (
      ${input.companyId}::uuid,
      ${input.title},
      ${input.summary ?? ""},
      ${input.status ?? "planned"},
      ${input.ownerAgentId ?? null}::uuid
    )
    RETURNING id, company_id, title, summary, status, owner_agent_id, created_at, updated_at
  `;
  return rows[0];
}

export async function updateGoal(
  sql: Sql,
  goalId: string,
  input: {
    title?: string;
    summary?: string | null;
    status?: string | null;
    ownerAgentId?: string | null;
  },
) {
  const updates: string[] = [];
  const values: ParameterOrJSON<never>[] = [];

  if (input.title !== undefined) {
    values.push(input.title);
    updates.push(`title = $${values.length}`);
  }
  if (input.summary !== undefined) {
    values.push(input.summary ?? "");
    updates.push(`summary = $${values.length}`);
  }
  if (input.status !== undefined) {
    values.push(input.status);
    updates.push(`status = $${values.length}`);
  }
  if (input.ownerAgentId !== undefined) {
    values.push(input.ownerAgentId);
    updates.push(`owner_agent_id = $${values.length}::uuid`);
  }

  if (updates.length === 0) {
    return await getGoal(sql, goalId);
  }

  values.push(goalId);
  const rows = await sql.unsafe<GoalRow[]>(
    `UPDATE public.goals
     SET ${updates.join(", ")}, updated_at = now()
     WHERE id = $${values.length}::uuid
     RETURNING id, company_id, title, summary, status, owner_agent_id, created_at, updated_at`,
    values,
  );
  return rows[0] ?? null;
}

export async function deleteGoal(sql: Sql, goalId: string) {
  const rows = await sql<GoalRow[]>`
    DELETE FROM public.goals
    WHERE id = ${goalId}::uuid
    RETURNING id, company_id, title, summary, status, owner_agent_id, created_at, updated_at
  `;
  return rows[0] ?? null;
}

export async function requireGoal(sql: Sql, goalId: string) {
  const goal = await getGoal(sql, goalId);
  if (!goal) {
    throw new HttpError(404, "Goal not found");
  }
  return goal;
}
