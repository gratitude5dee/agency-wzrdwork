import type { Sql } from "postgres";
import { HttpError } from "../http.js";
import type { AccessibleCompany, Actor, AppUserRow, JsonObject, MembershipRow, RequestActorInput } from "../types.js";

function normalizeWalletAddress(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.trim().toLowerCase();
}

export async function ensureUserForWallet(sql: Sql, walletAddress: string): Promise<AppUserRow> {
  const normalized = normalizeWalletAddress(walletAddress);
  if (!normalized) {
    throw new HttpError(401, "Wallet address is required");
  }

  const rows = await sql<AppUserRow[]>`
    INSERT INTO public.app_users (wallet_address)
    VALUES (${normalized})
    ON CONFLICT (wallet_address) DO UPDATE
      SET updated_at = now()
    RETURNING id, wallet_address, display_name
  `;

  const row = rows[0];
  if (!row) {
    throw new HttpError(500, "Failed to resolve user principal");
  }
  return row;
}

export async function bootstrapMemberships(sql: Sql, userId: string, walletAddress: string): Promise<void> {
  const normalized = normalizeWalletAddress(walletAddress);
  if (!normalized) return;

  await sql`
    INSERT INTO public.company_memberships (company_id, user_id, role, permissions, status)
    SELECT DISTINCT
      c.id,
      ${userId}::uuid,
      'owner',
      '{"manage_company": true, "manage_agents": true, "manage_issues": true, "manage_secrets": true, "manage_integrations": true}'::jsonb,
      'active'
    FROM public.companies c
    WHERE lower(c.wallet_address) = ${normalized}
    ON CONFLICT (company_id, user_id) DO NOTHING
  `;

  await sql`
    INSERT INTO public.company_memberships (company_id, user_id, role, permissions, status)
    SELECT DISTINCT
      uo.company_id,
      ${userId}::uuid,
      'owner',
      '{"manage_company": true, "manage_agents": true, "manage_issues": true, "manage_secrets": true, "manage_integrations": true}'::jsonb,
      'active'
    FROM public.user_onboarding uo
    WHERE lower(uo.wallet_address) = ${normalized}
      AND uo.company_id IS NOT NULL
    ON CONFLICT (company_id, user_id) DO NOTHING
  `;
}

export async function syncWalletAddressToCompany(sql: Sql, walletAddress: string): Promise<void> {
  const normalized = normalizeWalletAddress(walletAddress);
  if (!normalized) return;

  await sql`
    UPDATE public.companies
    SET wallet_address = ${normalized}
    WHERE id IN (
      SELECT company_id
      FROM public.user_onboarding
      WHERE lower(wallet_address) = ${normalized}
        AND company_id IS NOT NULL
    )
  `;
}

export async function resolveActor(sql: Sql, input: RequestActorInput): Promise<Actor> {
  const normalized = normalizeWalletAddress(input.walletAddress);
  if (!normalized) {
    throw new HttpError(401, "Wallet address is required");
  }

  const user = await ensureUserForWallet(sql, normalized);
  await bootstrapMemberships(sql, user.id, normalized);

  const memberships = await sql<MembershipRow[]>`
    SELECT company_id, role, permissions, status
    FROM public.company_memberships
    WHERE user_id = ${user.id}::uuid
      AND status = 'active'
    ORDER BY created_at ASC
  `;

  const instanceRoles = await sql<{ role: string }[]>`
    SELECT role
    FROM public.instance_user_roles
    WHERE user_id = ${user.id}::uuid
    ORDER BY role ASC
  `;

  return {
    user,
    memberships: memberships.map((membership) => ({
      ...membership,
      permissions: (membership.permissions ?? {}) as JsonObject,
    })),
    instanceRoles: instanceRoles.map((row) => row.role),
  };
}

export function requireCompanyAccess(actor: Actor, companyId: string) {
  if (actor.instanceRoles.includes("admin")) return;
  if (actor.memberships.some((membership) => membership.company_id === companyId)) return;
  throw new HttpError(403, "You do not have access to this company");
}

export async function listAccessibleCompanies(sql: Sql, actor: Actor): Promise<AccessibleCompany[]> {
  const ids = actor.memberships.map((membership) => membership.company_id);
  if (ids.length === 0 && !actor.instanceRoles.includes("admin")) {
    return [];
  }

  if (actor.instanceRoles.includes("admin") && ids.length === 0) {
    return await sql<AccessibleCompany[]>`
      SELECT id, name, slug, wallet_address
      FROM public.companies
      ORDER BY created_at ASC
    `;
  }

  return await sql<AccessibleCompany[]>`
    SELECT id, name, slug, wallet_address
    FROM public.companies
    WHERE id IN ${sql(ids)}
    ORDER BY created_at ASC
  `;
}

export function selectActiveCompany(
  companies: AccessibleCompany[],
  preferredCompanyId: string | null,
): AccessibleCompany | null {
  if (preferredCompanyId) {
    const preferred = companies.find((company) => company.id === preferredCompanyId);
    if (preferred) return preferred;
  }

  return companies[0] ?? null;
}

export function hasCompanyPermission(actor: Actor, companyId: string, permission: string): boolean {
  if (actor.instanceRoles.includes("admin")) return true;

  const membership = actor.memberships.find((item) => item.company_id === companyId);
  if (!membership) return false;
  if (membership.role === "owner" || membership.role === "admin") return true;

  return membership.permissions[permission] === true;
}

export function requireCompanyPermission(actor: Actor, companyId: string, permission: string) {
  if (hasCompanyPermission(actor, companyId, permission)) return;
  throw new HttpError(403, `Missing required permission: ${permission}`);
}

export function isInstanceAdmin(actor: Actor): boolean {
  return actor.instanceRoles.includes("admin");
}

export function requireInstanceAdmin(actor: Actor) {
  if (isInstanceAdmin(actor)) return;
  throw new HttpError(403, "Instance admin access required");
}
