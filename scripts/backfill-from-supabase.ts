#!/usr/bin/env node
/**
 * Idempotent Backfill Script: Agency Supabase → Canonical Paperclip
 *
 * Migrates data from Agency's Supabase instance into canonical Paperclip PostgreSQL tables.
 * Uses upserts (ON CONFLICT DO UPDATE) for idempotency — safe to run multiple times.
 *
 * Usage:
 *   npx tsx scripts/backfill-from-supabase.ts
 *
 * Environment Variables:
 *   SUPABASE_DB_URL  - PostgreSQL connection string for Agency Supabase
 *   CANONICAL_DB_URL - PostgreSQL connection string for Canonical Paperclip
 */

import postgres from "postgres";

// ============================================================================
// Configuration
// ============================================================================

const SUPABASE_DB_URL = process.env.SUPABASE_DB_URL;
const CANONICAL_DB_URL = process.env.CANONICAL_DB_URL;

if (!SUPABASE_DB_URL) {
  console.error("ERROR: SUPABASE_DB_URL environment variable not set");
  process.exit(1);
}

if (!CANONICAL_DB_URL) {
  console.error("ERROR: CANONICAL_DB_URL environment variable not set");
  process.exit(1);
}

// ============================================================================
// Database Connections
// ============================================================================

const sourceDb = postgres(SUPABASE_DB_URL, {
  max: 10,
  idle_timeout: 30,
  query_timeout: 60000,
});

const targetDb = postgres(CANONICAL_DB_URL, {
  max: 10,
  idle_timeout: 30,
  query_timeout: 60000,
});

// ============================================================================
// Logging & Metrics
// ============================================================================

interface BackfillStats {
  [tableName: string]: {
    rowsRead: number;
    rowsUpserted: number;
    duration: number;
  };
}

const stats: BackfillStats = {};

function log(stage: string, message: string): void {
  console.log(`[${new Date().toISOString()}] [${stage}] ${message}`);
}

function logError(stage: string, error: string): void {
  console.error(`[${new Date().toISOString()}] [${stage}] ERROR: ${error}`);
}

async function trackStage<T>(
  tableName: string,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  try {
    const result = await fn();
    stats[tableName] = {
      rowsRead: 0,
      rowsUpserted: 0,
      duration: Date.now() - startTime,
    };
    return result;
  } catch (error) {
    logError(tableName, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

// ============================================================================
// Backfill Stages
// ============================================================================

/**
 * Stage 1: Users
 * Extract distinct wallet addresses from agents/companies and upsert to users table
 */
async function backfillUsers(): Promise<void> {
  log("USERS", "Starting users backfill...");

  const startTime = Date.now();

  // Get distinct wallet addresses from agents and companies in source
  const wallets = await sourceDb<{ wallet_address: string | null }[]>`
    SELECT DISTINCT COALESCE(a.wallet_address, c.wallet_address) as wallet_address
    FROM agents a
    FULL OUTER JOIN companies c ON true
    WHERE a.wallet_address IS NOT NULL OR c.wallet_address IS NOT NULL
  `;

  log("USERS", `Found ${wallets.length} distinct wallet addresses`);

  // Upsert each wallet as a user (use wallet as both id and email placeholder)
  let upserted = 0;
  for (const row of wallets) {
    if (row.wallet_address) {
      const result = await targetDb`
        INSERT INTO public.user (
          id,
          name,
          email,
          email_verified,
          created_at,
          updated_at
        ) VALUES (
          ${row.wallet_address},
          ${row.wallet_address.substring(0, 10)},
          ${row.wallet_address}@wallet.local,
          false,
          NOW(),
          NOW()
        )
        ON CONFLICT (id) DO UPDATE
        SET updated_at = NOW()
      `;
      if (result.count > 0) upserted++;
    }
  }

  const duration = Date.now() - startTime;
  stats["users"] = {
    rowsRead: wallets.length,
    rowsUpserted: upserted,
    duration,
  };

  log("USERS", `✓ Completed in ${duration}ms. Read: ${wallets.length}, Upserted: ${upserted}`);
}

/**
 * Stage 2: Companies
 * Copy companies with wallet_address extension
 */
async function backfillCompanies(): Promise<void> {
  log("COMPANIES", "Starting companies backfill...");

  const startTime = Date.now();

  const companies = await sourceDb<any[]>`
    SELECT
      id, name, description, status, pause_reason, paused_at,
      issue_prefix, issue_counter, budget_monthly_cents, spent_monthly_cents,
      require_board_approval_for_new_agents, brand_color,
      created_at, updated_at, wallet_address
    FROM companies
  `;

  log("COMPANIES", `Read ${companies.length} companies`);

  let upserted = 0;
  for (const c of companies) {
    const result = await targetDb`
      INSERT INTO public.companies (
        id, name, description, status, pause_reason, paused_at,
        issue_prefix, issue_counter, budget_monthly_cents, spent_monthly_cents,
        require_board_approval_for_new_agents, brand_color,
        created_at, updated_at
      ) VALUES (
        ${c.id}, ${c.name}, ${c.description}, ${c.status}, ${c.pause_reason},
        ${c.paused_at}, ${c.issue_prefix}, ${c.issue_counter},
        ${c.budget_monthly_cents}, ${c.spent_monthly_cents},
        ${c.require_board_approval_for_new_agents}, ${c.brand_color},
        ${c.created_at}, ${c.updated_at}
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        status = EXCLUDED.status,
        pause_reason = EXCLUDED.pause_reason,
        paused_at = EXCLUDED.paused_at,
        issue_prefix = EXCLUDED.issue_prefix,
        issue_counter = EXCLUDED.issue_counter,
        budget_monthly_cents = EXCLUDED.budget_monthly_cents,
        spent_monthly_cents = EXCLUDED.spent_monthly_cents,
        require_board_approval_for_new_agents = EXCLUDED.require_board_approval_for_new_agents,
        brand_color = EXCLUDED.brand_color,
        updated_at = EXCLUDED.updated_at
    `;
    if (result.count > 0) upserted++;

    // Also update wallet_address in the extension if present
    if (c.wallet_address) {
      await targetDb`
        UPDATE public.companies
        SET wallet_address = ${c.wallet_address}
        WHERE id = ${c.id}
      `;
    }
  }

  const duration = Date.now() - startTime;
  stats["companies"] = {
    rowsRead: companies.length,
    rowsUpserted: upserted,
    duration,
  };

  log("COMPANIES", `✓ Completed in ${duration}ms. Read: ${companies.length}, Upserted: ${upserted}`);
}

/**
 * Stage 3: Company Memberships
 * Create user→company relationships with 'member' role
 */
async function backfillCompanyMemberships(): Promise<void> {
  log("COMPANY_MEMBERSHIPS", "Starting company memberships backfill...");

  const startTime = Date.now();

  // Get all agents with wallet_address and their companies
  const agents = await sourceDb<
    any[]
  >`
    SELECT DISTINCT a.id, a.company_id, a.wallet_address
    FROM agents a
    WHERE a.wallet_address IS NOT NULL
  `;

  log("COMPANY_MEMBERSHIPS", `Found ${agents.length} agents with wallet addresses`);

  let upserted = 0;
  const seen = new Set<string>();

  for (const agent of agents) {
    const key = `${agent.company_id}:${agent.wallet_address}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const result = await targetDb`
      INSERT INTO public.company_memberships (
        id, company_id, principal_type, principal_id, status, membership_role,
        created_at, updated_at
      ) VALUES (
        gen_random_uuid(),
        ${agent.company_id},
        'user',
        ${agent.wallet_address},
        'active',
        'member',
        NOW(),
        NOW()
      )
      ON CONFLICT (company_id, principal_type, principal_id) DO UPDATE SET
        status = EXCLUDED.status,
        membership_role = EXCLUDED.membership_role,
        updated_at = NOW()
    `;
    if (result.count > 0) upserted++;
  }

  const duration = Date.now() - startTime;
  stats["company_memberships"] = {
    rowsRead: agents.length,
    rowsUpserted: upserted,
    duration,
  };

  log(
    "COMPANY_MEMBERSHIPS",
    `✓ Completed in ${duration}ms. Read: ${agents.length}, Upserted: ${upserted}`
  );
}

/**
 * Stage 4: Instance User Roles
 * Grant instance_admin to first user
 */
async function backfillInstanceUserRoles(): Promise<void> {
  log("INSTANCE_USER_ROLES", "Starting instance user roles backfill...");

  const startTime = Date.now();

  // Get the first user (by creation time)
  const firstUser = await targetDb<{ id: string }[]>`
    SELECT id FROM public.user ORDER BY created_at ASC LIMIT 1
  `;

  let upserted = 0;
  if (firstUser.length > 0) {
    const result = await targetDb`
      INSERT INTO public.instance_user_roles (
        id, user_id, role, created_at, updated_at
      ) VALUES (
        gen_random_uuid(),
        ${firstUser[0].id},
        'instance_admin',
        NOW(),
        NOW()
      )
      ON CONFLICT (user_id, role) DO NOTHING
    `;
    if (result.count > 0) upserted++;
    log("INSTANCE_USER_ROLES", `Granted instance_admin to user: ${firstUser[0].id}`);
  }

  const duration = Date.now() - startTime;
  stats["instance_user_roles"] = {
    rowsRead: firstUser.length,
    rowsUpserted: upserted,
    duration,
  };

  log("INSTANCE_USER_ROLES", `✓ Completed in ${duration}ms. Upserted: ${upserted}`);
}

/**
 * Stage 5: Agents
 * Copy agents with all extensions (wallet_address, budget_usd, prompt_template)
 */
async function backfillAgents(): Promise<void> {
  log("AGENTS", "Starting agents backfill...");

  const startTime = Date.now();

  const agents = await sourceDb<any[]>`
    SELECT
      id, company_id, name, role, title, icon, status, reports_to,
      capabilities, adapter_type, adapter_config, runtime_config,
      budget_monthly_cents, spent_monthly_cents, pause_reason, paused_at,
      permissions, last_heartbeat_at, metadata, created_at, updated_at,
      wallet_address, budget_usd, prompt_template
    FROM agents
  `;

  log("AGENTS", `Read ${agents.length} agents`);

  let upserted = 0;
  for (const a of agents) {
    const result = await targetDb`
      INSERT INTO public.agents (
        id, company_id, name, role, title, icon, status, reports_to,
        capabilities, adapter_type, adapter_config, runtime_config,
        budget_monthly_cents, spent_monthly_cents, pause_reason, paused_at,
        permissions, last_heartbeat_at, metadata, created_at, updated_at
      ) VALUES (
        ${a.id}, ${a.company_id}, ${a.name}, ${a.role}, ${a.title}, ${a.icon},
        ${a.status}, ${a.reports_to}, ${a.capabilities}, ${a.adapter_type},
        ${JSON.stringify(a.adapter_config || {})}, ${JSON.stringify(a.runtime_config || {})},
        ${a.budget_monthly_cents}, ${a.spent_monthly_cents}, ${a.pause_reason},
        ${a.paused_at}, ${JSON.stringify(a.permissions || {})}, ${a.last_heartbeat_at},
        ${a.metadata ? JSON.stringify(a.metadata) : null}, ${a.created_at}, ${a.updated_at}
      )
      ON CONFLICT (id) DO UPDATE SET
        company_id = EXCLUDED.company_id,
        name = EXCLUDED.name,
        role = EXCLUDED.role,
        title = EXCLUDED.title,
        icon = EXCLUDED.icon,
        status = EXCLUDED.status,
        reports_to = EXCLUDED.reports_to,
        capabilities = EXCLUDED.capabilities,
        adapter_type = EXCLUDED.adapter_type,
        adapter_config = EXCLUDED.adapter_config,
        runtime_config = EXCLUDED.runtime_config,
        budget_monthly_cents = EXCLUDED.budget_monthly_cents,
        spent_monthly_cents = EXCLUDED.spent_monthly_cents,
        pause_reason = EXCLUDED.pause_reason,
        paused_at = EXCLUDED.paused_at,
        permissions = EXCLUDED.permissions,
        last_heartbeat_at = EXCLUDED.last_heartbeat_at,
        metadata = EXCLUDED.metadata,
        updated_at = EXCLUDED.updated_at
    `;
    if (result.count > 0) upserted++;

    // Update extensions
    if (a.wallet_address || a.budget_usd || a.prompt_template) {
      await targetDb`
        UPDATE public.agents
        SET
          wallet_address = ${a.wallet_address || null},
          budget_usd = ${a.budget_usd || null},
          prompt_template = ${a.prompt_template || null}
        WHERE id = ${a.id}
      `;
    }
  }

  const duration = Date.now() - startTime;
  stats["agents"] = {
    rowsRead: agents.length,
    rowsUpserted: upserted,
    duration,
  };

  log("AGENTS", `✓ Completed in ${duration}ms. Read: ${agents.length}, Upserted: ${upserted}`);
}

/**
 * Stage 6: Projects
 */
async function backfillProjects(): Promise<void> {
  log("PROJECTS", "Starting projects backfill...");

  const startTime = Date.now();

  const projects = await sourceDb<any[]>`
    SELECT
      id, company_id, goal_id, name, description, status, lead_agent_id,
      target_date, color, pause_reason, paused_at, execution_workspace_policy,
      archived_at, created_at, updated_at
    FROM projects
  `;

  log("PROJECTS", `Read ${projects.length} projects`);

  let upserted = 0;
  for (const p of projects) {
    const result = await targetDb`
      INSERT INTO public.projects (
        id, company_id, goal_id, name, description, status, lead_agent_id,
        target_date, color, pause_reason, paused_at, execution_workspace_policy,
        archived_at, created_at, updated_at
      ) VALUES (
        ${p.id}, ${p.company_id}, ${p.goal_id}, ${p.name}, ${p.description},
        ${p.status}, ${p.lead_agent_id}, ${p.target_date}, ${p.color},
        ${p.pause_reason}, ${p.paused_at},
        ${p.execution_workspace_policy ? JSON.stringify(p.execution_workspace_policy) : null},
        ${p.archived_at}, ${p.created_at}, ${p.updated_at}
      )
      ON CONFLICT (id) DO UPDATE SET
        company_id = EXCLUDED.company_id,
        goal_id = EXCLUDED.goal_id,
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        status = EXCLUDED.status,
        lead_agent_id = EXCLUDED.lead_agent_id,
        target_date = EXCLUDED.target_date,
        color = EXCLUDED.color,
        pause_reason = EXCLUDED.pause_reason,
        paused_at = EXCLUDED.paused_at,
        execution_workspace_policy = EXCLUDED.execution_workspace_policy,
        archived_at = EXCLUDED.archived_at,
        updated_at = EXCLUDED.updated_at
    `;
    if (result.count > 0) upserted++;
  }

  const duration = Date.now() - startTime;
  stats["projects"] = {
    rowsRead: projects.length,
    rowsUpserted: upserted,
    duration,
  };

  log("PROJECTS", `✓ Completed in ${duration}ms. Read: ${projects.length}, Upserted: ${upserted}`);
}

/**
 * Stage 7: Issues
 */
async function backfillIssues(): Promise<void> {
  log("ISSUES", "Starting issues backfill...");

  const startTime = Date.now();

  const issues = await sourceDb<any[]>`
    SELECT
      id, company_id, project_id, number, title, description, status,
      priority, assignee_agent_id, created_by_user_id, created_by_agent_id,
      estimated_effort_hours, actual_effort_hours, resolved_at, archived_at,
      created_at, updated_at
    FROM issues
  `;

  log("ISSUES", `Read ${issues.length} issues`);

  let upserted = 0;
  for (const i of issues) {
    const result = await targetDb`
      INSERT INTO public.issues (
        id, company_id, project_id, number, title, description, status,
        priority, assignee_agent_id, created_by_user_id, created_by_agent_id,
        estimated_effort_hours, actual_effort_hours, resolved_at, archived_at,
        created_at, updated_at
      ) VALUES (
        ${i.id}, ${i.company_id}, ${i.project_id}, ${i.number}, ${i.title},
        ${i.description}, ${i.status}, ${i.priority}, ${i.assignee_agent_id},
        ${i.created_by_user_id}, ${i.created_by_agent_id},
        ${i.estimated_effort_hours}, ${i.actual_effort_hours},
        ${i.resolved_at}, ${i.archived_at}, ${i.created_at}, ${i.updated_at}
      )
      ON CONFLICT (id) DO UPDATE SET
        company_id = EXCLUDED.company_id,
        project_id = EXCLUDED.project_id,
        number = EXCLUDED.number,
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        status = EXCLUDED.status,
        priority = EXCLUDED.priority,
        assignee_agent_id = EXCLUDED.assignee_agent_id,
        created_by_user_id = EXCLUDED.created_by_user_id,
        created_by_agent_id = EXCLUDED.created_by_agent_id,
        estimated_effort_hours = EXCLUDED.estimated_effort_hours,
        actual_effort_hours = EXCLUDED.actual_effort_hours,
        resolved_at = EXCLUDED.resolved_at,
        archived_at = EXCLUDED.archived_at,
        updated_at = EXCLUDED.updated_at
    `;
    if (result.count > 0) upserted++;
  }

  const duration = Date.now() - startTime;
  stats["issues"] = {
    rowsRead: issues.length,
    rowsUpserted: upserted,
    duration,
  };

  log("ISSUES", `✓ Completed in ${duration}ms. Read: ${issues.length}, Upserted: ${upserted}`);
}

/**
 * Stage 8: Goals
 */
async function backfillGoals(): Promise<void> {
  log("GOALS", "Starting goals backfill...");

  const startTime = Date.now();

  const goals = await sourceDb<any[]>`
    SELECT
      id, company_id, title, description, level, status, parent_id,
      owner_agent_id, created_at, updated_at
    FROM goals
  `;

  log("GOALS", `Read ${goals.length} goals`);

  let upserted = 0;
  for (const g of goals) {
    const result = await targetDb`
      INSERT INTO public.goals (
        id, company_id, title, description, level, status, parent_id,
        owner_agent_id, created_at, updated_at
      ) VALUES (
        ${g.id}, ${g.company_id}, ${g.title}, ${g.description}, ${g.level},
        ${g.status}, ${g.parent_id}, ${g.owner_agent_id}, ${g.created_at},
        ${g.updated_at}
      )
      ON CONFLICT (id) DO UPDATE SET
        company_id = EXCLUDED.company_id,
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        level = EXCLUDED.level,
        status = EXCLUDED.status,
        parent_id = EXCLUDED.parent_id,
        owner_agent_id = EXCLUDED.owner_agent_id,
        updated_at = EXCLUDED.updated_at
    `;
    if (result.count > 0) upserted++;
  }

  const duration = Date.now() - startTime;
  stats["goals"] = {
    rowsRead: goals.length,
    rowsUpserted: upserted,
    duration,
  };

  log("GOALS", `✓ Completed in ${duration}ms. Read: ${goals.length}, Upserted: ${upserted}`);
}

/**
 * Stage 9: Approvals
 */
async function backfillApprovals(): Promise<void> {
  log("APPROVALS", "Starting approvals backfill...");

  const startTime = Date.now();

  const approvals = await sourceDb<any[]>`
    SELECT
      id, company_id, type, requested_by_agent_id, requested_by_user_id,
      status, payload, decision_note, decided_by_user_id, decided_at,
      created_at, updated_at
    FROM approvals
  `;

  log("APPROVALS", `Read ${approvals.length} approvals`);

  let upserted = 0;
  for (const a of approvals) {
    const result = await targetDb`
      INSERT INTO public.approvals (
        id, company_id, type, requested_by_agent_id, requested_by_user_id,
        status, payload, decision_note, decided_by_user_id, decided_at,
        created_at, updated_at
      ) VALUES (
        ${a.id}, ${a.company_id}, ${a.type}, ${a.requested_by_agent_id},
        ${a.requested_by_user_id}, ${a.status},
        ${a.payload ? JSON.stringify(a.payload) : null},
        ${a.decision_note}, ${a.decided_by_user_id}, ${a.decided_at},
        ${a.created_at}, ${a.updated_at}
      )
      ON CONFLICT (id) DO UPDATE SET
        company_id = EXCLUDED.company_id,
        type = EXCLUDED.type,
        requested_by_agent_id = EXCLUDED.requested_by_agent_id,
        requested_by_user_id = EXCLUDED.requested_by_user_id,
        status = EXCLUDED.status,
        payload = EXCLUDED.payload,
        decision_note = EXCLUDED.decision_note,
        decided_by_user_id = EXCLUDED.decided_by_user_id,
        decided_at = EXCLUDED.decided_at,
        updated_at = EXCLUDED.updated_at
    `;
    if (result.count > 0) upserted++;
  }

  const duration = Date.now() - startTime;
  stats["approvals"] = {
    rowsRead: approvals.length,
    rowsUpserted: upserted,
    duration,
  };

  log("APPROVALS", `✓ Completed in ${duration}ms. Read: ${approvals.length}, Upserted: ${upserted}`);
}

/**
 * Stage 10: Activity Events (activity_log)
 */
async function backfillActivityEvents(): Promise<void> {
  log("ACTIVITY_LOG", "Starting activity events backfill...");

  const startTime = Date.now();

  const events = await sourceDb<any[]>`
    SELECT
      id, company_id, actor_type, actor_id, action, entity_type, entity_id,
      agent_id, run_id, details, created_at
    FROM activity_log
  `;

  log("ACTIVITY_LOG", `Read ${events.length} activity events`);

  let upserted = 0;
  for (const e of events) {
    const result = await targetDb`
      INSERT INTO public.activity_log (
        id, company_id, actor_type, actor_id, action, entity_type, entity_id,
        agent_id, run_id, details, created_at
      ) VALUES (
        ${e.id}, ${e.company_id}, ${e.actor_type}, ${e.actor_id}, ${e.action},
        ${e.entity_type}, ${e.entity_id}, ${e.agent_id}, ${e.run_id},
        ${e.details ? JSON.stringify(e.details) : null}, ${e.created_at}
      )
      ON CONFLICT (id) DO NOTHING
    `;
    if (result.count > 0) upserted++;
  }

  const duration = Date.now() - startTime;
  stats["activity_log"] = {
    rowsRead: events.length,
    rowsUpserted: upserted,
    duration,
  };

  log("ACTIVITY_LOG", `✓ Completed in ${duration}ms. Read: ${events.length}, Upserted: ${upserted}`);
}

/**
 * Stage 11: Heartbeat Runs
 */
async function backfillHeartbeatRuns(): Promise<void> {
  log("HEARTBEAT_RUNS", "Starting heartbeat runs backfill...");

  const startTime = Date.now();

  const runs = await sourceDb<any[]>`
    SELECT
      id, company_id, agent_id, invocation_source, trigger_detail, status,
      started_at, finished_at, error, wakeup_request_id, exit_code, signal,
      usage_json, result_json, session_id_before, session_id_after,
      log_store, log_ref, log_bytes, log_sha256, log_compressed,
      stdout_excerpt, stderr_excerpt, error_code, external_run_id,
      context_snapshot, created_at, updated_at
    FROM heartbeat_runs
  `;

  log("HEARTBEAT_RUNS", `Read ${runs.length} runs`);

  let upserted = 0;
  for (const r of runs) {
    const result = await targetDb`
      INSERT INTO public.heartbeat_runs (
        id, company_id, agent_id, invocation_source, trigger_detail, status,
        started_at, finished_at, error, wakeup_request_id, exit_code, signal,
        usage_json, result_json, session_id_before, session_id_after,
        log_store, log_ref, log_bytes, log_sha256, log_compressed,
        stdout_excerpt, stderr_excerpt, error_code, external_run_id,
        context_snapshot, created_at, updated_at
      ) VALUES (
        ${r.id}, ${r.company_id}, ${r.agent_id}, ${r.invocation_source},
        ${r.trigger_detail}, ${r.status}, ${r.started_at}, ${r.finished_at},
        ${r.error}, ${r.wakeup_request_id}, ${r.exit_code}, ${r.signal},
        ${r.usage_json ? JSON.stringify(r.usage_json) : null},
        ${r.result_json ? JSON.stringify(r.result_json) : null},
        ${r.session_id_before}, ${r.session_id_after},
        ${r.log_store}, ${r.log_ref}, ${r.log_bytes}, ${r.log_sha256},
        ${r.log_compressed}, ${r.stdout_excerpt}, ${r.stderr_excerpt},
        ${r.error_code}, ${r.external_run_id},
        ${r.context_snapshot ? JSON.stringify(r.context_snapshot) : null},
        ${r.created_at}, ${r.updated_at}
      )
      ON CONFLICT (id) DO UPDATE SET
        company_id = EXCLUDED.company_id,
        agent_id = EXCLUDED.agent_id,
        invocation_source = EXCLUDED.invocation_source,
        trigger_detail = EXCLUDED.trigger_detail,
        status = EXCLUDED.status,
        started_at = EXCLUDED.started_at,
        finished_at = EXCLUDED.finished_at,
        error = EXCLUDED.error,
        wakeup_request_id = EXCLUDED.wakeup_request_id,
        exit_code = EXCLUDED.exit_code,
        signal = EXCLUDED.signal,
        usage_json = EXCLUDED.usage_json,
        result_json = EXCLUDED.result_json,
        session_id_before = EXCLUDED.session_id_before,
        session_id_after = EXCLUDED.session_id_after,
        log_store = EXCLUDED.log_store,
        log_ref = EXCLUDED.log_ref,
        log_bytes = EXCLUDED.log_bytes,
        log_sha256 = EXCLUDED.log_sha256,
        log_compressed = EXCLUDED.log_compressed,
        stdout_excerpt = EXCLUDED.stdout_excerpt,
        stderr_excerpt = EXCLUDED.stderr_excerpt,
        error_code = EXCLUDED.error_code,
        external_run_id = EXCLUDED.external_run_id,
        context_snapshot = EXCLUDED.context_snapshot,
        updated_at = EXCLUDED.updated_at
    `;
    if (result.count > 0) upserted++;
  }

  const duration = Date.now() - startTime;
  stats["heartbeat_runs"] = {
    rowsRead: runs.length,
    rowsUpserted: upserted,
    duration,
  };

  log(
    "HEARTBEAT_RUNS",
    `✓ Completed in ${duration}ms. Read: ${runs.length}, Upserted: ${upserted}`
  );
}

/**
 * Stage 12: Chat Sessions (Agency-specific)
 */
async function backfillChatSessions(): Promise<void> {
  log("CHAT_SESSIONS", "Starting chat sessions backfill...");

  const startTime = Date.now();

  const sessions = await sourceDb<any[]>`
    SELECT
      id, company_id, agent_id, user_id, title, created_at, updated_at
    FROM chat_sessions
  `;

  log("CHAT_SESSIONS", `Read ${sessions.length} chat sessions`);

  let upserted = 0;
  for (const s of sessions) {
    const result = await targetDb`
      INSERT INTO public.chat_sessions (
        id, company_id, agent_id, user_id, title, created_at, updated_at
      ) VALUES (
        ${s.id}, ${s.company_id}, ${s.agent_id}, ${s.user_id}, ${s.title},
        ${s.created_at}, ${s.updated_at}
      )
      ON CONFLICT (id) DO UPDATE SET
        company_id = EXCLUDED.company_id,
        agent_id = EXCLUDED.agent_id,
        user_id = EXCLUDED.user_id,
        title = EXCLUDED.title,
        updated_at = EXCLUDED.updated_at
    `;
    if (result.count > 0) upserted++;
  }

  const duration = Date.now() - startTime;
  stats["chat_sessions"] = {
    rowsRead: sessions.length,
    rowsUpserted: upserted,
    duration,
  };

  log(
    "CHAT_SESSIONS",
    `✓ Completed in ${duration}ms. Read: ${sessions.length}, Upserted: ${upserted}`
  );
}

/**
 * Stage 13: Chat Messages (Agency-specific)
 */
async function backfillChatMessages(): Promise<void> {
  log("CHAT_MESSAGES", "Starting chat messages backfill...");

  const startTime = Date.now();

  const messages = await sourceDb<any[]>`
    SELECT
      id, session_id, role, content, metadata, created_at
    FROM chat_messages
  `;

  log("CHAT_MESSAGES", `Read ${messages.length} chat messages`);

  let upserted = 0;
  for (const m of messages) {
    const result = await targetDb`
      INSERT INTO public.chat_messages (
        id, session_id, role, content, metadata, created_at
      ) VALUES (
        ${m.id}, ${m.session_id}, ${m.role}, ${m.content},
        ${m.metadata ? JSON.stringify(m.metadata) : null}, ${m.created_at}
      )
      ON CONFLICT (id) DO NOTHING
    `;
    if (result.count > 0) upserted++;
  }

  const duration = Date.now() - startTime;
  stats["chat_messages"] = {
    rowsRead: messages.length,
    rowsUpserted: upserted,
    duration,
  };

  log(
    "CHAT_MESSAGES",
    `✓ Completed in ${duration}ms. Read: ${messages.length}, Upserted: ${upserted}`
  );
}

/**
 * Stage 14: Agent Integrations (Agency-specific)
 */
async function backfillAgentIntegrations(): Promise<void> {
  log("AGENT_INTEGRATIONS", "Starting agent integrations backfill...");

  const startTime = Date.now();

  const integrations = await sourceDb<any[]>`
    SELECT
      id, agent_id, integration_type, config, enabled, created_at
    FROM agent_integrations
  `;

  log("AGENT_INTEGRATIONS", `Read ${integrations.length} agent integrations`);

  let upserted = 0;
  for (const i of integrations) {
    const result = await targetDb`
      INSERT INTO public.agent_integrations (
        id, agent_id, integration_type, config, enabled, created_at
      ) VALUES (
        ${i.id}, ${i.agent_id}, ${i.integration_type},
        ${i.config ? JSON.stringify(i.config) : null}, ${i.enabled},
        ${i.created_at}
      )
      ON CONFLICT (id) DO UPDATE SET
        agent_id = EXCLUDED.agent_id,
        integration_type = EXCLUDED.integration_type,
        config = EXCLUDED.config,
        enabled = EXCLUDED.enabled
    `;
    if (result.count > 0) upserted++;
  }

  const duration = Date.now() - startTime;
  stats["agent_integrations"] = {
    rowsRead: integrations.length,
    rowsUpserted: upserted,
    duration,
  };

  log(
    "AGENT_INTEGRATIONS",
    `✓ Completed in ${duration}ms. Read: ${integrations.length}, Upserted: ${upserted}`
  );
}

/**
 * Stage 15: Finance Events
 * Transform invoices into finance events if available, otherwise insert directly
 */
async function backfillFinanceEvents(): Promise<void> {
  log("FINANCE_EVENTS", "Starting finance events backfill...");

  const startTime = Date.now();

  // Try to read from agent_invoices table (if it exists in Agency schema)
  let invoices: any[] = [];
  try {
    invoices = await sourceDb<any[]>`
      SELECT id, agent_id, company_id, amount_cents, description,
             invoice_date, created_at
      FROM agent_invoices
    `;
  } catch {
    log("FINANCE_EVENTS", "Note: agent_invoices table not found in source");
  }

  log("FINANCE_EVENTS", `Read ${invoices.length} invoices to transform`);

  let upserted = 0;
  for (const inv of invoices) {
    const result = await targetDb`
      INSERT INTO public.finance_events (
        id, company_id, agent_id, billing_code, description,
        event_kind, direction, biller, amount_cents, currency,
        occurred_at, created_at
      ) VALUES (
        gen_random_uuid(), ${inv.company_id}, ${inv.agent_id},
        ${"invoice-" + inv.id}, ${inv.description}, 'invoice', 'debit',
        'agent', ${inv.amount_cents}, 'USD', ${inv.invoice_date || inv.created_at},
        ${inv.created_at}
      )
      ON CONFLICT DO NOTHING
    `;
    if (result.count > 0) upserted++;
  }

  const duration = Date.now() - startTime;
  stats["finance_events"] = {
    rowsRead: invoices.length,
    rowsUpserted: upserted,
    duration,
  };

  log(
    "FINANCE_EVENTS",
    `✓ Completed in ${duration}ms. Read: ${invoices.length}, Upserted: ${upserted}`
  );
}

// ============================================================================
// Main Execution
// ============================================================================

async function main(): Promise<void> {
  console.log("\n" + "=".repeat(80));
  console.log("AGENCY SUPABASE → CANONICAL PAPERCLIP BACKFILL");
  console.log("=".repeat(80) + "\n");

  try {
    // Execute stages in order
    await backfillUsers();
    await backfillCompanies();
    await backfillCompanyMemberships();
    await backfillInstanceUserRoles();
    await backfillAgents();
    await backfillProjects();
    await backfillIssues();
    await backfillGoals();
    await backfillApprovals();
    await backfillActivityEvents();
    await backfillHeartbeatRuns();
    await backfillChatSessions();
    await backfillChatMessages();
    await backfillAgentIntegrations();
    await backfillFinanceEvents();

    // Print summary
    console.log("\n" + "=".repeat(80));
    console.log("BACKFILL SUMMARY");
    console.log("=".repeat(80) + "\n");

    console.log(
      `${"Table".padEnd(30)} | ${"Rows Read".padEnd(12)} | ${"Rows Upserted".padEnd(15)} | Duration (ms)`
    );
    console.log("-".repeat(80));

    let totalRead = 0;
    let totalUpserted = 0;
    let totalDuration = 0;

    for (const [table, data] of Object.entries(stats)) {
      console.log(
        `${table.padEnd(30)} | ${String(data.rowsRead).padEnd(12)} | ${String(
          data.rowsUpserted
        ).padEnd(15)} | ${data.duration}`
      );
      totalRead += data.rowsRead;
      totalUpserted += data.rowsUpserted;
      totalDuration += data.duration;
    }

    console.log("-".repeat(80));
    console.log(
      `${"TOTAL".padEnd(30)} | ${String(totalRead).padEnd(12)} | ${String(
        totalUpserted
      ).padEnd(15)} | ${totalDuration}`
    );
    console.log("\n" + "=".repeat(80));
    console.log("✓ BACKFILL COMPLETED SUCCESSFULLY");
    console.log("=".repeat(80) + "\n");
  } catch (error) {
    logError("MAIN", error instanceof Error ? error.message : String(error));
    console.error("\n" + "=".repeat(80));
    console.error("✗ BACKFILL FAILED");
    console.error("=".repeat(80) + "\n");
    process.exit(1);
  } finally {
    // Close database connections
    await sourceDb.end();
    await targetDb.end();
  }
}

// Execute
main();
