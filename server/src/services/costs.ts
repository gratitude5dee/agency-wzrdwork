import { and, desc, eq, gte, isNotNull, lt, lte, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { activityLog, agents, companies, costEvents, issues, projects } from "@paperclipai/db";
import type { Sql } from "postgres";
import { HttpError } from "../http.js";
import { notFound, unprocessable } from "../errors.js";
import { budgetService, type BudgetServiceHooks } from "./budgets.js";
import type { JsonObject } from "../types.js";

interface CostEventRow {
  id: string;
  company_id: string;
  agent_id: string | null;
  run_id: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cached_tokens: number | null;
  cost_usd: string | number | null;
  provider: string | null;
  model: string | null;
  created_at: string;
}

interface FinanceEventRow {
  id: string;
  company_id: string;
  agent_id: string | null;
  event_type: string;
  amount_usd: string | number | null;
  tx_hash: string | null;
  chain: string | null;
  token: string | null;
  metadata: JsonObject | null;
  created_at: string;
}

interface BudgetPolicyRow {
  id: string;
  company_id: string;
  agent_id: string | null;
  max_spend_usd: string | number | null;
  max_tokens_per_run: number | null;
  max_runs_per_day: number | null;
  auto_pause_on_breach: boolean | null;
  created_at: string;
}

interface BudgetIncidentRow {
  id: string;
  company_id: string;
  agent_id: string | null;
  policy_id: string | null;
  incident_type: string;
  details: string | null;
  resolved: boolean | null;
  created_at: string;
}

function toNumber(value: string | number | null | undefined) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value !== "") return Number(value);
  return 0;
}

export interface CostDateRange {
  from?: Date;
  to?: Date;
}

const METERED_BILLING_TYPE = "metered_api";
const SUBSCRIPTION_BILLING_TYPES = ["subscription_included", "subscription_overage"] as const;

function currentUtcMonthWindow(now = new Date()) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  return {
    start: new Date(Date.UTC(year, month, 1, 0, 0, 0, 0)),
    end: new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0)),
  };
}

async function getMonthlySpendTotal(
  db: Db,
  scope: { companyId: string; agentId?: string | null },
) {
  const { start, end } = currentUtcMonthWindow();
  const conditions = [
    eq(costEvents.companyId, scope.companyId),
    gte(costEvents.occurredAt, start),
    lt(costEvents.occurredAt, end),
  ];
  if (scope.agentId) {
    conditions.push(eq(costEvents.agentId, scope.agentId));
  }
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
    })
    .from(costEvents)
    .where(and(...conditions));
  return Number(row?.total ?? 0);
}

export function costService(db: Db, budgetHooks: BudgetServiceHooks = {}) {
  const budgets = budgetService(db, budgetHooks);
  return {
    createEvent: async (companyId: string, data: Omit<typeof costEvents.$inferInsert, "companyId">) => {
      if (!data.agentId) {
        throw unprocessable("Agent is required");
      }

      const agent = await db
        .select()
        .from(agents)
        .where(eq(agents.id, data.agentId))
        .then((rows) => rows[0] ?? null);

      if (!agent) throw notFound("Agent not found");
      if (agent.companyId !== companyId) {
        throw unprocessable("Agent does not belong to company");
      }

      const event = await db
        .insert(costEvents)
        .values({
          ...data,
          companyId,
          biller: data.biller ?? data.provider,
          billingType: data.billingType ?? "unknown",
          cachedInputTokens: data.cachedInputTokens ?? 0,
          occurredAt: data.occurredAt ?? new Date(),
        })
        .returning()
        .then((rows) => rows[0]);

      const [agentMonthSpend, companyMonthSpend] = await Promise.all([
        getMonthlySpendTotal(db, { companyId, agentId: event.agentId }),
        getMonthlySpendTotal(db, { companyId }),
      ]);

      await db
        .update(agents)
        .set({
          spentMonthlyCents: agentMonthSpend,
          updatedAt: new Date(),
        })
        .where(eq(agents.id, event.agentId));

      await db
        .update(companies)
        .set({
          spentMonthlyCents: companyMonthSpend,
          updatedAt: new Date(),
        })
        .where(eq(companies.id, companyId));

      await budgets.evaluateCostEvent(event);

      return event;
    },

    summary: async (companyId: string, range?: CostDateRange) => {
      const company = await db
        .select()
        .from(companies)
        .where(eq(companies.id, companyId))
        .then((rows) => rows[0] ?? null);

      if (!company) throw notFound("Company not found");

      const conditions: ReturnType<typeof eq>[] = [eq(costEvents.companyId, companyId)];
      if (range?.from) conditions.push(gte(costEvents.occurredAt, range.from));
      if (range?.to) conditions.push(lte(costEvents.occurredAt, range.to));

      const [{ total }] = await db
        .select({
          total: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
        })
        .from(costEvents)
        .where(and(...conditions));

      const spendCents = Number(total);
      const utilization =
        company.budgetMonthlyCents > 0
          ? (spendCents / company.budgetMonthlyCents) * 100
          : 0;

      return {
        companyId,
        spendCents,
        budgetCents: company.budgetMonthlyCents,
        utilizationPercent: Number(utilization.toFixed(2)),
      };
    },

    byAgent: async (companyId: string, range?: CostDateRange) => {
      const conditions: ReturnType<typeof eq>[] = [eq(costEvents.companyId, companyId)];
      if (range?.from) conditions.push(gte(costEvents.occurredAt, range.from));
      if (range?.to) conditions.push(lte(costEvents.occurredAt, range.to));

      return db
        .select({
          agentId: costEvents.agentId,
          agentName: agents.name,
          agentStatus: agents.status,
          costCents: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
          inputTokens: sql<number>`coalesce(sum(${costEvents.inputTokens}), 0)::int`,
          cachedInputTokens: sql<number>`coalesce(sum(${costEvents.cachedInputTokens}), 0)::int`,
          outputTokens: sql<number>`coalesce(sum(${costEvents.outputTokens}), 0)::int`,
          apiRunCount:
            sql<number>`count(distinct case when ${costEvents.billingType} = ${METERED_BILLING_TYPE} then ${costEvents.heartbeatRunId} end)::int`,
          subscriptionRunCount:
            sql<number>`count(distinct case when ${costEvents.billingType} in (${sql.join(SUBSCRIPTION_BILLING_TYPES.map((value) => sql`${value}`), sql`, `)}) then ${costEvents.heartbeatRunId} end)::int`,
          subscriptionCachedInputTokens:
            sql<number>`coalesce(sum(case when ${costEvents.billingType} in (${sql.join(SUBSCRIPTION_BILLING_TYPES.map((value) => sql`${value}`), sql`, `)}) then ${costEvents.cachedInputTokens} else 0 end), 0)::int`,
          subscriptionInputTokens:
            sql<number>`coalesce(sum(case when ${costEvents.billingType} in (${sql.join(SUBSCRIPTION_BILLING_TYPES.map((value) => sql`${value}`), sql`, `)}) then ${costEvents.inputTokens} else 0 end), 0)::int`,
          subscriptionOutputTokens:
            sql<number>`coalesce(sum(case when ${costEvents.billingType} in (${sql.join(SUBSCRIPTION_BILLING_TYPES.map((value) => sql`${value}`), sql`, `)}) then ${costEvents.outputTokens} else 0 end), 0)::int`,
        })
        .from(costEvents)
        .leftJoin(agents, eq(costEvents.agentId, agents.id))
        .where(and(...conditions))
        .groupBy(costEvents.agentId, agents.name, agents.status)
        .orderBy(desc(sql`coalesce(sum(${costEvents.costCents}), 0)::int`));
    },

    byProvider: async (companyId: string, range?: CostDateRange) => {
      const conditions: ReturnType<typeof eq>[] = [eq(costEvents.companyId, companyId)];
      if (range?.from) conditions.push(gte(costEvents.occurredAt, range.from));
      if (range?.to) conditions.push(lte(costEvents.occurredAt, range.to));

      return db
        .select({
          provider: costEvents.provider,
          biller: costEvents.biller,
          billingType: costEvents.billingType,
          model: costEvents.model,
          costCents: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
          inputTokens: sql<number>`coalesce(sum(${costEvents.inputTokens}), 0)::int`,
          cachedInputTokens: sql<number>`coalesce(sum(${costEvents.cachedInputTokens}), 0)::int`,
          outputTokens: sql<number>`coalesce(sum(${costEvents.outputTokens}), 0)::int`,
          apiRunCount:
            sql<number>`count(distinct case when ${costEvents.billingType} = ${METERED_BILLING_TYPE} then ${costEvents.heartbeatRunId} end)::int`,
          subscriptionRunCount:
            sql<number>`count(distinct case when ${costEvents.billingType} in (${sql.join(SUBSCRIPTION_BILLING_TYPES.map((value) => sql`${value}`), sql`, `)}) then ${costEvents.heartbeatRunId} end)::int`,
          subscriptionCachedInputTokens:
            sql<number>`coalesce(sum(case when ${costEvents.billingType} in (${sql.join(SUBSCRIPTION_BILLING_TYPES.map((value) => sql`${value}`), sql`, `)}) then ${costEvents.cachedInputTokens} else 0 end), 0)::int`,
          subscriptionInputTokens:
            sql<number>`coalesce(sum(case when ${costEvents.billingType} in (${sql.join(SUBSCRIPTION_BILLING_TYPES.map((value) => sql`${value}`), sql`, `)}) then ${costEvents.inputTokens} else 0 end), 0)::int`,
          subscriptionOutputTokens:
            sql<number>`coalesce(sum(case when ${costEvents.billingType} in (${sql.join(SUBSCRIPTION_BILLING_TYPES.map((value) => sql`${value}`), sql`, `)}) then ${costEvents.outputTokens} else 0 end), 0)::int`,
        })
        .from(costEvents)
        .where(and(...conditions))
        .groupBy(costEvents.provider, costEvents.biller, costEvents.billingType, costEvents.model)
        .orderBy(desc(sql`coalesce(sum(${costEvents.costCents}), 0)::int`));
    },

    byBiller: async (companyId: string, range?: CostDateRange) => {
      const conditions: ReturnType<typeof eq>[] = [eq(costEvents.companyId, companyId)];
      if (range?.from) conditions.push(gte(costEvents.occurredAt, range.from));
      if (range?.to) conditions.push(lte(costEvents.occurredAt, range.to));

      return db
        .select({
          biller: costEvents.biller,
          costCents: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
          inputTokens: sql<number>`coalesce(sum(${costEvents.inputTokens}), 0)::int`,
          cachedInputTokens: sql<number>`coalesce(sum(${costEvents.cachedInputTokens}), 0)::int`,
          outputTokens: sql<number>`coalesce(sum(${costEvents.outputTokens}), 0)::int`,
          apiRunCount:
            sql<number>`count(distinct case when ${costEvents.billingType} = ${METERED_BILLING_TYPE} then ${costEvents.heartbeatRunId} end)::int`,
          subscriptionRunCount:
            sql<number>`count(distinct case when ${costEvents.billingType} in (${sql.join(SUBSCRIPTION_BILLING_TYPES.map((value) => sql`${value}`), sql`, `)}) then ${costEvents.heartbeatRunId} end)::int`,
          subscriptionCachedInputTokens:
            sql<number>`coalesce(sum(case when ${costEvents.billingType} in (${sql.join(SUBSCRIPTION_BILLING_TYPES.map((value) => sql`${value}`), sql`, `)}) then ${costEvents.cachedInputTokens} else 0 end), 0)::int`,
          subscriptionInputTokens:
            sql<number>`coalesce(sum(case when ${costEvents.billingType} in (${sql.join(SUBSCRIPTION_BILLING_TYPES.map((value) => sql`${value}`), sql`, `)}) then ${costEvents.inputTokens} else 0 end), 0)::int`,
          subscriptionOutputTokens:
            sql<number>`coalesce(sum(case when ${costEvents.billingType} in (${sql.join(SUBSCRIPTION_BILLING_TYPES.map((value) => sql`${value}`), sql`, `)}) then ${costEvents.outputTokens} else 0 end), 0)::int`,
          providerCount: sql<number>`count(distinct ${costEvents.provider})::int`,
          modelCount: sql<number>`count(distinct ${costEvents.model})::int`,
        })
        .from(costEvents)
        .where(and(...conditions))
        .groupBy(costEvents.biller)
        .orderBy(desc(sql`coalesce(sum(${costEvents.costCents}), 0)::int`));
    },

    windowSpend: async (companyId: string) => {
      const windows = [
        { label: "5h", hours: 5 },
        { label: "24h", hours: 24 },
        { label: "7d", hours: 168 },
      ] as const;

      const results = await Promise.all(
        windows.map(async ({ label, hours }) => {
          const since = new Date(Date.now() - hours * 60 * 60 * 1000);
          const rows = await db
            .select({
              provider: costEvents.provider,
              biller: sql<string>`case when count(distinct ${costEvents.biller}) = 1 then min(${costEvents.biller}) else 'mixed' end`,
              costCents: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
              inputTokens: sql<number>`coalesce(sum(${costEvents.inputTokens}), 0)::int`,
              cachedInputTokens: sql<number>`coalesce(sum(${costEvents.cachedInputTokens}), 0)::int`,
              outputTokens: sql<number>`coalesce(sum(${costEvents.outputTokens}), 0)::int`,
            })
            .from(costEvents)
            .where(
              and(
                eq(costEvents.companyId, companyId),
                gte(costEvents.occurredAt, since),
              ),
            )
            .groupBy(costEvents.provider)
            .orderBy(desc(sql`coalesce(sum(${costEvents.costCents}), 0)::int`));

          return rows.map((row) => ({
            provider: row.provider,
            biller: row.biller,
            window: label as string,
            windowHours: hours,
            costCents: row.costCents,
            inputTokens: row.inputTokens,
            cachedInputTokens: row.cachedInputTokens,
            outputTokens: row.outputTokens,
          }));
        }),
      );

      return results.flat();
    },

    byAgentModel: async (companyId: string, range?: CostDateRange) => {
      const conditions: ReturnType<typeof eq>[] = [eq(costEvents.companyId, companyId)];
      if (range?.from) conditions.push(gte(costEvents.occurredAt, range.from));
      if (range?.to) conditions.push(lte(costEvents.occurredAt, range.to));

      return db
        .select({
          agentId: costEvents.agentId,
          agentName: agents.name,
          provider: costEvents.provider,
          biller: costEvents.biller,
          billingType: costEvents.billingType,
          model: costEvents.model,
          costCents: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
          inputTokens: sql<number>`coalesce(sum(${costEvents.inputTokens}), 0)::int`,
          cachedInputTokens: sql<number>`coalesce(sum(${costEvents.cachedInputTokens}), 0)::int`,
          outputTokens: sql<number>`coalesce(sum(${costEvents.outputTokens}), 0)::int`,
        })
        .from(costEvents)
        .leftJoin(agents, eq(costEvents.agentId, agents.id))
        .where(and(...conditions))
        .groupBy(
          costEvents.agentId,
          agents.name,
          costEvents.provider,
          costEvents.biller,
          costEvents.billingType,
          costEvents.model,
        )
        .orderBy(costEvents.provider, costEvents.biller, costEvents.billingType, costEvents.model);
    },

    byProject: async (companyId: string, range?: CostDateRange) => {
      const issueIdAsText = sql<string>`${issues.id}::text`;
      const runProjectLinks = db
        .selectDistinctOn([activityLog.runId, issues.projectId], {
          runId: activityLog.runId,
          projectId: issues.projectId,
        })
        .from(activityLog)
        .innerJoin(
          issues,
          and(
            eq(activityLog.entityType, "issue"),
            eq(activityLog.entityId, issueIdAsText),
          ),
        )
        .where(
          and(
            eq(activityLog.companyId, companyId),
            eq(issues.companyId, companyId),
            isNotNull(activityLog.runId),
            isNotNull(issues.projectId),
          ),
        )
        .orderBy(activityLog.runId, issues.projectId, desc(activityLog.createdAt))
        .as("run_project_links");

      const effectiveProjectId = sql<string | null>`coalesce(${costEvents.projectId}, ${runProjectLinks.projectId})`;
      const conditions: ReturnType<typeof eq>[] = [eq(costEvents.companyId, companyId)];
      if (range?.from) conditions.push(gte(costEvents.occurredAt, range.from));
      if (range?.to) conditions.push(lte(costEvents.occurredAt, range.to));

      const costCentsExpr = sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`;

      return db
        .select({
          projectId: effectiveProjectId,
          projectName: projects.name,
          costCents: costCentsExpr,
          inputTokens: sql<number>`coalesce(sum(${costEvents.inputTokens}), 0)::int`,
          cachedInputTokens: sql<number>`coalesce(sum(${costEvents.cachedInputTokens}), 0)::int`,
          outputTokens: sql<number>`coalesce(sum(${costEvents.outputTokens}), 0)::int`,
        })
        .from(costEvents)
        .leftJoin(runProjectLinks, eq(costEvents.heartbeatRunId, runProjectLinks.runId))
        .innerJoin(projects, sql`${projects.id} = ${effectiveProjectId}`)
        .where(and(...conditions, sql`${effectiveProjectId} is not null`))
        .groupBy(effectiveProjectId, projects.name)
        .orderBy(desc(costCentsExpr));
    },
  };
}

export async function createCostEvent(
  sql: Sql,
  input: {
    companyId: string;
    agentId?: string | null;
    runId?: string | null;
    inputTokens?: number;
    outputTokens?: number;
    cachedTokens?: number;
    costUsd?: number;
    provider?: string | null;
    model?: string | null;
  },
) {
  const rows = await sql<CostEventRow[]>`
    INSERT INTO public.cost_events (
      company_id,
      agent_id,
      run_id,
      input_tokens,
      output_tokens,
      cached_tokens,
      cost_usd,
      provider,
      model
    )
    VALUES (
      ${input.companyId}::uuid,
      ${input.agentId ?? null}::uuid,
      ${input.runId ?? null}::uuid,
      ${input.inputTokens ?? 0},
      ${input.outputTokens ?? 0},
      ${input.cachedTokens ?? 0},
      ${input.costUsd ?? 0},
      ${input.provider ?? null},
      ${input.model ?? null}
    )
    RETURNING id, company_id, agent_id, run_id, input_tokens, output_tokens, cached_tokens, cost_usd, provider, model, created_at
  `;
  return rows[0];
}

export async function createFinanceEvent(
  sql: Sql,
  input: {
    companyId: string;
    agentId?: string | null;
    eventType: string;
    amountUsd?: number | null;
    txHash?: string | null;
    chain?: string | null;
    token?: string | null;
    metadata?: JsonObject | null;
  },
) {
  const rows = await sql<FinanceEventRow[]>`
    INSERT INTO public.finance_events (
      company_id,
      agent_id,
      event_type,
      amount_usd,
      tx_hash,
      chain,
      token,
      metadata
    )
    VALUES (
      ${input.companyId}::uuid,
      ${input.agentId ?? null}::uuid,
      ${input.eventType},
      ${input.amountUsd ?? null},
      ${input.txHash ?? null},
      ${input.chain ?? null},
      ${input.token ?? null},
      ${JSON.stringify(input.metadata ?? {})}::jsonb
    )
    RETURNING id, company_id, agent_id, event_type, amount_usd, tx_hash, chain, token, metadata, created_at
  `;
  return rows[0];
}

export async function getCostSummary(sql: Sql, companyId: string) {
  const rows = await sql<Array<{
    total_cost_usd: string | number | null;
    total_input_tokens: number | null;
    total_output_tokens: number | null;
    total_cached_tokens: number | null;
  }>>`
    SELECT
      coalesce(sum(cost_usd), 0) AS total_cost_usd,
      coalesce(sum(input_tokens), 0) AS total_input_tokens,
      coalesce(sum(output_tokens), 0) AS total_output_tokens,
      coalesce(sum(cached_tokens), 0) AS total_cached_tokens
    FROM public.cost_events
    WHERE company_id = ${companyId}::uuid
  `;

  const row = rows[0];
  return {
    companyId,
    totalCostUsd: toNumber(row?.total_cost_usd),
    totalInputTokens: Number(row?.total_input_tokens ?? 0),
    totalOutputTokens: Number(row?.total_output_tokens ?? 0),
    totalCachedTokens: Number(row?.total_cached_tokens ?? 0),
  };
}

export async function getCostsByAgent(sql: Sql, companyId: string) {
  return await sql<Array<{
    agent_id: string | null;
    agent_name: string | null;
    total_cost_usd: string | number | null;
    total_input_tokens: number | null;
    total_output_tokens: number | null;
    total_cached_tokens: number | null;
  }>>`
    SELECT
      ce.agent_id,
      a.name AS agent_name,
      coalesce(sum(ce.cost_usd), 0) AS total_cost_usd,
      coalesce(sum(ce.input_tokens), 0) AS total_input_tokens,
      coalesce(sum(ce.output_tokens), 0) AS total_output_tokens,
      coalesce(sum(ce.cached_tokens), 0) AS total_cached_tokens
    FROM public.cost_events ce
    LEFT JOIN public.agents a ON a.id = ce.agent_id
    WHERE ce.company_id = ${companyId}::uuid
    GROUP BY ce.agent_id, a.name
    ORDER BY coalesce(sum(ce.cost_usd), 0) DESC
  `;
}

export async function getCostsByProvider(sql: Sql, companyId: string) {
  return await sql<Array<{
    provider: string | null;
    model: string | null;
    total_cost_usd: string | number | null;
    total_input_tokens: number | null;
    total_output_tokens: number | null;
    total_cached_tokens: number | null;
  }>>`
    SELECT
      provider,
      model,
      coalesce(sum(cost_usd), 0) AS total_cost_usd,
      coalesce(sum(input_tokens), 0) AS total_input_tokens,
      coalesce(sum(output_tokens), 0) AS total_output_tokens,
      coalesce(sum(cached_tokens), 0) AS total_cached_tokens
    FROM public.cost_events
    WHERE company_id = ${companyId}::uuid
    GROUP BY provider, model
    ORDER BY coalesce(sum(cost_usd), 0) DESC
  `;
}

export async function getFinanceSummary(sql: Sql, companyId: string) {
  const rows = await sql<Array<{
    total_amount_usd: string | number | null;
    event_count: number | null;
  }>>`
    SELECT
      coalesce(sum(amount_usd), 0) AS total_amount_usd,
      count(*)::int AS event_count
    FROM public.finance_events
    WHERE company_id = ${companyId}::uuid
  `;

  const row = rows[0];
  return {
    companyId,
    totalAmountUsd: toNumber(row?.total_amount_usd),
    eventCount: Number(row?.event_count ?? 0),
  };
}

export async function getFinanceByKind(sql: Sql, companyId: string) {
  return await sql<Array<{
    event_type: string;
    total_amount_usd: string | number | null;
    event_count: number | null;
  }>>`
    SELECT
      event_type,
      coalesce(sum(amount_usd), 0) AS total_amount_usd,
      count(*)::int AS event_count
    FROM public.finance_events
    WHERE company_id = ${companyId}::uuid
    GROUP BY event_type
    ORDER BY coalesce(sum(amount_usd), 0) DESC, event_type ASC
  `;
}

export async function listFinanceEvents(sql: Sql, companyId: string, limit: number) {
  return await sql<FinanceEventRow[]>`
    SELECT id, company_id, agent_id, event_type, amount_usd, tx_hash, chain, token, metadata, created_at
    FROM public.finance_events
    WHERE company_id = ${companyId}::uuid
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
}

export async function getBudgetOverview(sql: Sql, companyId: string) {
  const [summary, policies, incidents] = await Promise.all([
    getCostSummary(sql, companyId),
    sql<BudgetPolicyRow[]>`
      SELECT id, company_id, agent_id, max_spend_usd, max_tokens_per_run, max_runs_per_day, auto_pause_on_breach, created_at
      FROM public.budget_policies
      WHERE company_id = ${companyId}::uuid
      ORDER BY created_at DESC
    `,
    sql<BudgetIncidentRow[]>`
      SELECT id, company_id, agent_id, policy_id, incident_type, details, resolved, created_at
      FROM public.budget_incidents
      WHERE company_id = ${companyId}::uuid
      ORDER BY created_at DESC
    `,
  ]);

  return {
    companyId,
    spend: summary,
    policies: policies.map((policy) => ({
      ...policy,
      max_spend_usd: toNumber(policy.max_spend_usd),
    })),
    incidents,
    unresolvedIncidents: incidents.filter((incident) => !incident.resolved).length,
  };
}

export async function upsertBudgetPolicy(
  sql: Sql,
  input: {
    companyId: string;
    policyId?: string | null;
    agentId?: string | null;
    maxSpendUsd?: number | null;
    maxTokensPerRun?: number | null;
    maxRunsPerDay?: number | null;
    autoPauseOnBreach?: boolean | null;
  },
) {
  if (input.policyId) {
    const rows = await sql<BudgetPolicyRow[]>`
      UPDATE public.budget_policies
      SET
        agent_id = ${input.agentId ?? null}::uuid,
        max_spend_usd = ${input.maxSpendUsd ?? null},
        max_tokens_per_run = ${input.maxTokensPerRun ?? null},
        max_runs_per_day = ${input.maxRunsPerDay ?? null},
        auto_pause_on_breach = ${input.autoPauseOnBreach ?? true}
      WHERE id = ${input.policyId}::uuid
        AND company_id = ${input.companyId}::uuid
      RETURNING id, company_id, agent_id, max_spend_usd, max_tokens_per_run, max_runs_per_day, auto_pause_on_breach, created_at
    `;
    if (!rows[0]) {
      throw new HttpError(404, "Budget policy not found");
    }
    return rows[0];
  }

  const rows = await sql<BudgetPolicyRow[]>`
    INSERT INTO public.budget_policies (
      company_id,
      agent_id,
      max_spend_usd,
      max_tokens_per_run,
      max_runs_per_day,
      auto_pause_on_breach
    )
    VALUES (
      ${input.companyId}::uuid,
      ${input.agentId ?? null}::uuid,
      ${input.maxSpendUsd ?? null},
      ${input.maxTokensPerRun ?? null},
      ${input.maxRunsPerDay ?? null},
      ${input.autoPauseOnBreach ?? true}
    )
    RETURNING id, company_id, agent_id, max_spend_usd, max_tokens_per_run, max_runs_per_day, auto_pause_on_breach, created_at
  `;
  return rows[0];
}

export async function resolveBudgetIncident(
  sql: Sql,
  companyId: string,
  incidentId: string,
  note?: string | null,
) {
  const rows = await sql<BudgetIncidentRow[]>`
    UPDATE public.budget_incidents
    SET
      resolved = true,
      details = CASE
        WHEN ${note ?? null}::text IS NULL THEN details
        WHEN details IS NULL OR details = '' THEN ${note ?? null}
        ELSE details || E'\n\nResolved: ' || ${note ?? null}
      END
    WHERE company_id = ${companyId}::uuid
      AND id = ${incidentId}::uuid
    RETURNING id, company_id, agent_id, policy_id, incident_type, details, resolved, created_at
  `;
  if (!rows[0]) {
    throw new HttpError(404, "Budget incident not found");
  }
  return rows[0];
}
