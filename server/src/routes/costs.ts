import { HttpError, asOptionalString, asString, json, readJson } from "../http.js";
import { authenticateRequest } from "../services/auth.js";
import { requireCompanyAccess, requireCompanyPermission } from "../services/access.js";
import { recordActivity } from "../services/activity-log.js";
import {
  createCostEvent,
  createFinanceEvent,
  getBudgetOverview,
  getCostsByAgent,
  getCostsByProvider,
  getCostSummary,
  getFinanceByKind,
  getFinanceSummary,
  listFinanceEvents,
  resolveBudgetIncident,
  upsertBudgetPolicy,
} from "../services/costs.js";
import type { JsonObject, RouteContext, RouteResult } from "../types.js";

function matchCompanyCosts(pathname: string) {
  return {
    costEvents: pathname.match(/^\/api\/companies\/([^/]+)\/cost-events$/),
    financeEvents: pathname.match(/^\/api\/companies\/([^/]+)\/finance-events$/),
    summary: pathname.match(/^\/api\/companies\/([^/]+)\/costs\/summary$/),
    byAgent: pathname.match(/^\/api\/companies\/([^/]+)\/costs\/by-agent$/),
    byProvider: pathname.match(/^\/api\/companies\/([^/]+)\/costs\/by-provider$/),
    financeSummary: pathname.match(/^\/api\/companies\/([^/]+)\/costs\/finance-summary$/),
    financeByKind: pathname.match(/^\/api\/companies\/([^/]+)\/costs\/finance-by-kind$/),
    financeList: pathname.match(/^\/api\/companies\/([^/]+)\/costs\/finance-events$/),
    budgetOverview: pathname.match(/^\/api\/companies\/([^/]+)\/budgets\/overview$/),
    budgetPolicies: pathname.match(/^\/api\/companies\/([^/]+)\/budgets\/policies$/),
    budgetResolve: pathname.match(/^\/api\/companies\/([^/]+)\/budget-incidents\/([^/]+)\/resolve$/),
  };
}

export async function handleCostsRoute(context: RouteContext): Promise<RouteResult> {
  const matches = matchCompanyCosts(context.url.pathname);
  const companyId =
    matches.costEvents?.[1] ??
    matches.financeEvents?.[1] ??
    matches.summary?.[1] ??
    matches.byAgent?.[1] ??
    matches.byProvider?.[1] ??
    matches.financeSummary?.[1] ??
    matches.financeByKind?.[1] ??
    matches.financeList?.[1] ??
    matches.budgetOverview?.[1] ??
    matches.budgetPolicies?.[1] ??
    matches.budgetResolve?.[1] ??
    null;

  if (!companyId) {
    return { handled: false };
  }

  const { actor } = await authenticateRequest(context.sql, context.config, context.request);
  requireCompanyAccess(actor, companyId);

  if (matches.costEvents && context.request.method === "POST") {
    const body = await readJson(context.request);
    const event = await createCostEvent(context.sql, {
      companyId,
      agentId: asOptionalString(body.agentId),
      runId: asOptionalString(body.runId),
      inputTokens: Number(body.inputTokens ?? 0),
      outputTokens: Number(body.outputTokens ?? 0),
      cachedTokens: Number(body.cachedTokens ?? 0),
      costUsd: Number(body.costUsd ?? 0),
      provider: asOptionalString(body.provider),
      model: asOptionalString(body.model),
    });
    await recordActivity(context.sql, {
      companyId,
      action: "cost.reported",
      details: { costEventId: event.id, provider: event.provider, model: event.model },
    });
    context.liveEvents.publish({
      type: "dashboard.updated",
      companyId,
      payload: { reason: "cost.reported" },
    });
    json(context.response, 201, event);
    return { handled: true };
  }

  if (matches.financeEvents && context.request.method === "POST") {
    requireCompanyPermission(actor, companyId, "manage_company");
    const body = await readJson(context.request);
    const eventType = asString(body.eventType);
    if (!eventType) throw new HttpError(400, "eventType is required");
    const event = await createFinanceEvent(context.sql, {
      companyId,
      agentId: asOptionalString(body.agentId),
      eventType,
      amountUsd:
        body.amountUsd === undefined || body.amountUsd === null ? null : Number(body.amountUsd),
      txHash: asOptionalString(body.txHash),
      chain: asOptionalString(body.chain),
      token: asOptionalString(body.token),
      metadata:
        body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
          ? (body.metadata as JsonObject)
          : null,
    });
    await recordActivity(context.sql, {
      companyId,
      action: "finance_event.reported",
      details: { financeEventId: event.id, eventType: event.event_type },
    });
    context.liveEvents.publish({
      type: "dashboard.updated",
      companyId,
      payload: { reason: "finance_event.reported" },
    });
    json(context.response, 201, event);
    return { handled: true };
  }

  if (matches.summary && context.request.method === "GET") {
    json(context.response, 200, await getCostSummary(context.sql, companyId));
    return { handled: true };
  }

  if (matches.byAgent && context.request.method === "GET") {
    json(context.response, 200, await getCostsByAgent(context.sql, companyId));
    return { handled: true };
  }

  if (matches.byProvider && context.request.method === "GET") {
    json(context.response, 200, await getCostsByProvider(context.sql, companyId));
    return { handled: true };
  }

  if (matches.financeSummary && context.request.method === "GET") {
    json(context.response, 200, await getFinanceSummary(context.sql, companyId));
    return { handled: true };
  }

  if (matches.financeByKind && context.request.method === "GET") {
    json(context.response, 200, await getFinanceByKind(context.sql, companyId));
    return { handled: true };
  }

  if (matches.financeList && context.request.method === "GET") {
    const limit = Number(context.url.searchParams.get("limit") ?? 100);
    json(context.response, 200, await listFinanceEvents(context.sql, companyId, Math.max(1, Math.min(limit, 500))));
    return { handled: true };
  }

  if (matches.budgetOverview && context.request.method === "GET") {
    json(context.response, 200, await getBudgetOverview(context.sql, companyId));
    return { handled: true };
  }

  if (matches.budgetPolicies && context.request.method === "POST") {
    requireCompanyPermission(actor, companyId, "manage_company");
    const body = await readJson(context.request);
    const policy = await upsertBudgetPolicy(context.sql, {
      companyId,
      policyId: asOptionalString(body.policyId),
      agentId: asOptionalString(body.agentId),
      maxSpendUsd:
        body.maxSpendUsd === undefined || body.maxSpendUsd === null
          ? null
          : Number(body.maxSpendUsd),
      maxTokensPerRun:
        body.maxTokensPerRun === undefined || body.maxTokensPerRun === null
          ? null
          : Number(body.maxTokensPerRun),
      maxRunsPerDay:
        body.maxRunsPerDay === undefined || body.maxRunsPerDay === null
          ? null
          : Number(body.maxRunsPerDay),
      autoPauseOnBreach:
        body.autoPauseOnBreach === undefined ? null : body.autoPauseOnBreach === true,
    });
    await recordActivity(context.sql, {
      companyId,
      action: "budget.policy_upserted",
      details: { policyId: policy.id, agentId: policy.agent_id },
    });
    context.liveEvents.publish({
      type: "dashboard.updated",
      companyId,
      payload: { reason: "budget.policy_upserted" },
    });
    json(context.response, 200, policy);
    return { handled: true };
  }

  if (matches.budgetResolve && context.request.method === "POST") {
    requireCompanyPermission(actor, companyId, "manage_company");
    const body = await readJson(context.request);
    const incident = await resolveBudgetIncident(
      context.sql,
      companyId,
      matches.budgetResolve[2],
      asOptionalString(body.note),
    );
    await recordActivity(context.sql, {
      companyId,
      action: "budget.incident_resolved",
      details: { incidentId: incident.id },
    });
    context.liveEvents.publish({
      type: "budget.incident",
      companyId,
      payload: { incidentId: incident.id, resolved: true },
    });
    json(context.response, 200, incident);
    return { handled: true };
  }

  return { handled: false };
}
