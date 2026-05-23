import { Router } from "express";
import type { Db } from "@paperclipai/db";
import type { Sql } from "postgres";
import {
  companyPortabilityExportSchema,
  companyPortabilityImportSchema,
  companyPortabilityPreviewSchema,
  createCompanySchema,
  updateCompanySchema,
} from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import {
  accessService,
  budgetService,
  companyPortabilityService,
  companyService,
  logActivity,
} from "../services/index.js";
import { recordActivity } from "../services/activity-log.js";
import { assertBoard, assertCompanyAccess, getActorInfo } from "./authz.js";
import { logger } from "../middleware/logger.js";

interface CompanyRouteOptions {
  walletSessionSql?: Sql;
}

interface CompanyColumnInfo {
  column_name: string;
  is_nullable: "YES" | "NO";
  column_default: string | null;
}

type RawCompanyRow = Record<string, unknown>;
type CompanySqlValue = string | number | boolean | null;

interface CompanyInput {
  name?: string;
  description?: string | null;
  walletAddress?: string | null;
  budgetMonthlyCents?: number;
}

function readString(row: RawCompanyRow, key: string): string | null {
  const value = row[key];
  return typeof value === "string" ? value : null;
}

function readNumber(row: RawCompanyRow, key: string, fallback = 0): number {
  const value = row[key];
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function readBoolean(row: RawCompanyRow, key: string, fallback = true): boolean {
  const value = row[key];
  return typeof value === "boolean" ? value : fallback;
}

function readDate(row: RawCompanyRow, key: string, fallback: Date): Date {
  const value = row[key];
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return fallback;
}

function deriveSlug(name: string, attempt: number) {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "company";
  return attempt <= 1 ? base : `${base}-${attempt}`;
}

function deriveIssuePrefix(name: string, attempt: number) {
  const base = name.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) || "CMP";
  return attempt <= 1 ? base : `${base}${attempt}`;
}

function toApiCompany(row: RawCompanyRow) {
  const now = new Date();
  const createdAt = readDate(row, "created_at", now);
  const updatedAt = readDate(row, "updated_at", createdAt);
  const walletAddress = readString(row, "wallet_address");
  const description = readString(row, "description") ?? readString(row, "brief");
  const slug = readString(row, "slug") ?? deriveSlug(readString(row, "name") ?? "company", 1);

  return {
    id: readString(row, "id") ?? "",
    name: readString(row, "name") ?? "Untitled Company",
    slug,
    description,
    status: readString(row, "status") ?? "active",
    pauseReason: readString(row, "pause_reason"),
    pausedAt: row.paused_at ? readDate(row, "paused_at", now) : null,
    issuePrefix: readString(row, "issue_prefix") ?? "CMP",
    issueCounter: readNumber(row, "issue_counter"),
    walletAddress,
    wallet_address: walletAddress,
    budgetMonthlyCents: readNumber(row, "budget_monthly_cents"),
    spentMonthlyCents: readNumber(row, "spent_monthly_cents"),
    requireBoardApprovalForNewAgents: readBoolean(row, "require_board_approval_for_new_agents"),
    brandColor: readString(row, "brand_color"),
    logoAssetId: null,
    logoUrl: null,
    createdAt,
    updatedAt,
  };
}

async function getCompanyColumns(sql: Sql) {
  const rows = await sql<CompanyColumnInfo[]>`
    SELECT column_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'companies'
  `;
  return new Map(rows.map((row) => [row.column_name, row]));
}

function putColumn(
  values: Record<string, CompanySqlValue>,
  columns: Map<string, CompanyColumnInfo>,
  column: string,
  value: CompanySqlValue,
) {
  if (!columns.has(column)) return;
  values[column] = value;
}

function nullableFallback(columns: Map<string, CompanyColumnInfo>, column: string, fallback: string | null) {
  return columns.get(column)?.is_nullable === "YES" ? null : fallback;
}

function isUniqueViolation(error: unknown) {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code?: string }).code === "23505";
}

function buildWalletCompatibleCompanyInsert(
  columns: Map<string, CompanyColumnInfo>,
  data: CompanyInput,
  attempt: number,
) {
  const values: Record<string, CompanySqlValue> = {};
  const name = data.name?.trim() || "Untitled Company";
  const description = data.description?.trim() || "";
  const walletAddress = data.walletAddress?.trim().toLowerCase() || null;
  const now = new Date().toISOString();

  putColumn(values, columns, "name", name);
  putColumn(values, columns, "description", description || nullableFallback(columns, "description", ""));
  putColumn(values, columns, "brief", description || nullableFallback(columns, "brief", ""));
  putColumn(values, columns, "company_type", "agency");
  putColumn(values, columns, "slug", deriveSlug(name, attempt));
  putColumn(values, columns, "wallet_address", walletAddress);
  putColumn(values, columns, "status", "active");
  putColumn(values, columns, "issue_prefix", deriveIssuePrefix(name, attempt));
  putColumn(values, columns, "issue_counter", 0);
  putColumn(values, columns, "budget_monthly_cents", data.budgetMonthlyCents ?? 0);
  putColumn(values, columns, "spent_monthly_cents", 0);
  putColumn(values, columns, "require_board_approval_for_new_agents", true);
  putColumn(values, columns, "brand_color", "#f97316");
  putColumn(values, columns, "created_at", now);
  putColumn(values, columns, "updated_at", now);

  return values;
}

async function createWalletCompatibleCompany(sql: Sql, data: CompanyInput) {
  const columns = await getCompanyColumns(sql);

  for (let attempt = 1; attempt <= 100; attempt += 1) {
    const values = buildWalletCompatibleCompanyInsert(columns, data, attempt);
    const insertColumns = Object.keys(values) as (keyof typeof values & string)[];
    try {
      const rows = await sql<RawCompanyRow[]>`
        INSERT INTO public.companies ${sql(values, insertColumns)}
        RETURNING *
      `;
      const row = rows[0];
      if (!row) throw new Error("Company not found after compatible creation");
      return toApiCompany(row);
    } catch (err) {
      if (isUniqueViolation(err) && (columns.has("slug") || columns.has("issue_prefix"))) {
        continue;
      }
      throw err;
    }
  }

  throw new Error("Unable to allocate unique company identifiers");
}

async function listWalletCompatibleCompanies(sql: Sql, companyIds: string[] | null) {
  if (companyIds !== null && companyIds.length === 0) return [];
  const rows = companyIds === null
    ? await sql<RawCompanyRow[]>`
        SELECT *
        FROM public.companies
        ORDER BY created_at ASC
      `
    : await sql<RawCompanyRow[]>`
        SELECT *
        FROM public.companies
        WHERE id IN ${sql(companyIds)}
        ORDER BY created_at ASC
      `;
  return rows.map((row) => toApiCompany(row));
}

async function getWalletCompatibleCompany(sql: Sql, companyId: string) {
  const rows = await sql<RawCompanyRow[]>`
    SELECT *
    FROM public.companies
    WHERE id = ${companyId}::uuid
    LIMIT 1
  `;
  return rows[0] ? toApiCompany(rows[0]) : null;
}

async function updateWalletCompatibleCompany(sql: Sql, companyId: string, data: CompanyInput) {
  const columns = await getCompanyColumns(sql);
  const values: Record<string, CompanySqlValue> = {};
  const now = new Date().toISOString();

  if (data.name !== undefined) {
    const name = data.name.trim() || "Untitled Company";
    putColumn(values, columns, "name", name);
    putColumn(values, columns, "slug", deriveSlug(name, 1));
  }
  if (data.description !== undefined) {
    const description = data.description?.trim() || "";
    putColumn(values, columns, "description", description || nullableFallback(columns, "description", ""));
    putColumn(values, columns, "brief", description || nullableFallback(columns, "brief", ""));
  }
  if (data.walletAddress !== undefined) {
    putColumn(values, columns, "wallet_address", data.walletAddress?.trim().toLowerCase() || null);
  }
  if (data.budgetMonthlyCents !== undefined) {
    putColumn(values, columns, "budget_monthly_cents", data.budgetMonthlyCents);
  }
  putColumn(values, columns, "updated_at", now);

  const updateColumns = Object.keys(values) as (keyof typeof values & string)[];
  if (updateColumns.length === 0) return getWalletCompatibleCompany(sql, companyId);

  const rows = await sql<RawCompanyRow[]>`
    UPDATE public.companies
    SET ${sql(values, updateColumns)}
    WHERE id = ${companyId}::uuid
    RETURNING *
  `;
  return rows[0] ? toApiCompany(rows[0]) : null;
}

async function removeWalletCompatibleCompany(sql: Sql, companyId: string) {
  const existing = await getWalletCompatibleCompany(sql, companyId);
  if (!existing) return null;

  await sql`DELETE FROM public.activity_events WHERE company_id = ${companyId}::uuid`.catch((err) => {
    logger.warn({ err, companyId }, "Failed to delete wallet activity events during compatible removal");
  });
  await sql`DELETE FROM public.activity_log WHERE company_id = ${companyId}::uuid`.catch((err) => {
    logger.warn({ err, companyId }, "Failed to delete wallet activity log during compatible removal");
  });
  await sql`DELETE FROM public.company_memberships WHERE company_id = ${companyId}::uuid`.catch((err) => {
    logger.warn({ err, companyId }, "Failed to delete wallet company memberships during compatible removal");
  });
  await sql`DELETE FROM public.user_onboarding WHERE company_id = ${companyId}::uuid`.catch((err) => {
    logger.warn({ err, companyId }, "Failed to delete wallet onboarding row during compatible removal");
  });
  await sql`
    DELETE FROM public.companies
    WHERE id = ${companyId}::uuid
  `;

  return existing;
}

async function logCompanyCreated(
  db: Db,
  walletSql: Sql | undefined,
  input: {
    companyId: string;
    actorId: string;
    name: string;
  },
) {
  try {
    await logActivity(db, {
      companyId: input.companyId,
      actorType: "user",
      actorId: input.actorId,
      action: "company.created",
      entityType: "company",
      entityId: input.companyId,
      details: { name: input.name },
    });
    return;
  } catch (err) {
    if (!walletSql) throw err;
    logger.warn(
      { err, companyId: input.companyId },
      "Company activity_log write failed; trying legacy activity_events table",
    );
  }

  try {
    await recordActivity(walletSql, {
      companyId: input.companyId,
      action: "company.created",
      details: { name: input.name, actorId: input.actorId },
    });
  } catch (err) {
    logger.warn({ err, companyId: input.companyId }, "Legacy company activity event write failed");
  }
}

async function ensureWalletOwnerMembership(sql: Sql, companyId: string, userId: string) {
  const ownerPermissions = {
    manage_company: true,
    manage_agents: true,
    manage_issues: true,
    manage_secrets: true,
    manage_integrations: true,
  };

  try {
    await sql`
      INSERT INTO public.company_memberships (
        company_id,
        user_id,
        role,
        permissions,
        status
      )
      VALUES (
        ${companyId}::uuid,
        ${userId}::uuid,
        'owner',
        ${JSON.stringify(ownerPermissions)}::jsonb,
        'active'
      )
      ON CONFLICT (company_id, user_id) DO UPDATE
        SET role = 'owner',
            permissions = EXCLUDED.permissions,
            status = 'active',
            updated_at = now()
    `;
    return;
  } catch (err) {
    logger.warn(
      { err, companyId, userId },
      "Wallet owner membership insert using user_id schema failed; trying principal membership schema",
    );
  }

  await sql`
    INSERT INTO public.company_memberships (
      company_id,
      principal_type,
      principal_id,
      status,
      membership_role
    )
    VALUES (
      ${companyId}::uuid,
      'user',
      ${userId},
      'active',
      'owner'
    )
    ON CONFLICT (company_id, principal_type, principal_id) DO UPDATE
      SET status = 'active',
          membership_role = 'owner',
          updated_at = now()
  `;
}

export function companyRoutes(db: Db, opts: CompanyRouteOptions = {}) {
  const router = Router();
  const svc = companyService(db);
  const portability = companyPortabilityService(db);
  const access = accessService(db);
  const budgets = budgetService(db);

  router.get("/", async (req, res) => {
    assertBoard(req);
    if (req.actor.source === "wallet_session" && opts.walletSessionSql) {
      const result = await listWalletCompatibleCompanies(
        opts.walletSessionSql,
        req.actor.isInstanceAdmin ? null : req.actor.companyIds ?? [],
      );
      res.json(result);
      return;
    }

    const result = await svc.list();
    if (req.actor.source === "local_implicit" || req.actor.isInstanceAdmin) {
      res.json(result);
      return;
    }
    const allowed = new Set(req.actor.companyIds ?? []);
    res.json(result.filter((company) => allowed.has(company.id)));
  });

  router.get("/stats", async (req, res) => {
    assertBoard(req);
    const allowed = req.actor.source === "local_implicit" || req.actor.isInstanceAdmin
      ? null
      : new Set(req.actor.companyIds ?? []);
    const stats = await svc.stats();
    if (!allowed) {
      res.json(stats);
      return;
    }
    const filtered = Object.fromEntries(Object.entries(stats).filter(([companyId]) => allowed.has(companyId)));
    res.json(filtered);
  });

  // Common malformed path when companyId is empty in "/api/companies/{companyId}/issues".
  router.get("/issues", (_req, res) => {
    res.status(400).json({
      error: "Missing companyId in path. Use /api/companies/{companyId}/issues.",
    });
  });

  router.get("/:companyId", async (req, res) => {
    assertBoard(req);
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    let company;
    try {
      company = await svc.getById(companyId);
    } catch (err) {
      if (req.actor.source !== "wallet_session" || !opts.walletSessionSql) throw err;
      logger.warn({ err, companyId }, "Company lookup failed; trying wallet-compatible company lookup");
      company = await getWalletCompatibleCompany(opts.walletSessionSql, companyId);
    }
    if (!company) {
      res.status(404).json({ error: "Company not found" });
      return;
    }
    res.json(company);
  });

  router.post("/:companyId/export", validate(companyPortabilityExportSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const result = await portability.exportBundle(companyId, req.body);
    res.json(result);
  });

  router.post("/import/preview", validate(companyPortabilityPreviewSchema), async (req, res) => {
    if (req.body.target.mode === "existing_company") {
      assertCompanyAccess(req, req.body.target.companyId);
    } else {
      assertBoard(req);
    }
    const preview = await portability.previewImport(req.body);
    res.json(preview);
  });

  router.post("/import", validate(companyPortabilityImportSchema), async (req, res) => {
    if (req.body.target.mode === "existing_company") {
      assertCompanyAccess(req, req.body.target.companyId);
    } else {
      assertBoard(req);
    }
    const actor = getActorInfo(req);
    const result = await portability.importBundle(req.body, req.actor.type === "board" ? req.actor.userId : null);
    await logActivity(db, {
      companyId: result.company.id,
      actorType: actor.actorType,
      actorId: actor.actorId,
      action: "company.imported",
      entityType: "company",
      entityId: result.company.id,
      agentId: actor.agentId,
      runId: actor.runId,
      details: {
        include: req.body.include ?? null,
        agentCount: result.agents.length,
        warningCount: result.warnings.length,
        companyAction: result.company.action,
      },
    });
    res.json(result);
  });

  router.post("/", validate(createCompanySchema), async (req, res) => {
    assertBoard(req);
    let company;
    try {
      company = await svc.create(req.body);
    } catch (err) {
      if (req.actor.source !== "wallet_session" || !opts.walletSessionSql) throw err;
      logger.warn({ err }, "Company creation failed; trying wallet-compatible company creation");
      company = await createWalletCompatibleCompany(opts.walletSessionSql, req.body);
    }
    if (req.actor.source === "wallet_session" && req.actor.userId && opts.walletSessionSql) {
      await ensureWalletOwnerMembership(opts.walletSessionSql, company.id, req.actor.userId);
      req.actor.companyIds = Array.from(new Set([...(req.actor.companyIds ?? []), company.id]));
    } else {
      await access.ensureMembership(company.id, "user", req.actor.userId ?? "local-board", "owner", "active");
    }
    await logCompanyCreated(db, req.actor.source === "wallet_session" ? opts.walletSessionSql : undefined, {
      companyId: company.id,
      actorId: req.actor.userId ?? "board",
      name: company.name,
    });
    if (company.budgetMonthlyCents > 0) {
      await budgets.upsertPolicy(
        company.id,
        {
          scopeType: "company",
          scopeId: company.id,
          amount: company.budgetMonthlyCents,
          windowKind: "calendar_month_utc",
        },
        req.actor.userId ?? "board",
      );
    }
    res.status(201).json(company);
  });

  router.patch("/:companyId", validate(updateCompanySchema), async (req, res) => {
    assertBoard(req);
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    let company;
    try {
      company = await svc.update(companyId, req.body);
    } catch (err) {
      if (req.actor.source !== "wallet_session" || !opts.walletSessionSql) throw err;
      logger.warn({ err, companyId }, "Company update failed; trying wallet-compatible company update");
      company = await updateWalletCompatibleCompany(opts.walletSessionSql, companyId, req.body);
    }
    if (!company) {
      res.status(404).json({ error: "Company not found" });
      return;
    }
    await logActivity(db, {
      companyId,
      actorType: "user",
      actorId: req.actor.userId ?? "board",
      action: "company.updated",
      entityType: "company",
      entityId: companyId,
      details: req.body,
    });
    res.json(company);
  });

  router.post("/:companyId/archive", async (req, res) => {
    assertBoard(req);
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const company = await svc.archive(companyId);
    if (!company) {
      res.status(404).json({ error: "Company not found" });
      return;
    }
    await logActivity(db, {
      companyId,
      actorType: "user",
      actorId: req.actor.userId ?? "board",
      action: "company.archived",
      entityType: "company",
      entityId: companyId,
    });
    res.json(company);
  });

  router.delete("/:companyId", async (req, res) => {
    assertBoard(req);
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    let company;
    try {
      company = await svc.remove(companyId);
    } catch (err) {
      if (req.actor.source !== "wallet_session" || !opts.walletSessionSql) throw err;
      logger.warn({ err, companyId }, "Company removal failed; trying wallet-compatible company removal");
      company = await removeWalletCompatibleCompany(opts.walletSessionSql, companyId);
    }
    if (!company) {
      res.status(404).json({ error: "Company not found" });
      return;
    }
    res.json({ ok: true });
  });

  return router;
}
