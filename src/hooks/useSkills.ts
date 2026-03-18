/**
 * useSkills — company-scoped skill registry hooks.
 *
 * Provides CRUD operations for the skills table and agent_skills
 * assignment join table. Uses the existing Supabase client with
 * company scoping from useActiveCompany.
 *
 * The skills and agent_skills tables are not yet in the auto-generated
 * Supabase types, so we use `supabase.from(tableName)` with explicit
 * result type annotations. The `.from()` overloads accept any string
 * at runtime; TypeScript inference is bypassed via intermediate casts.
 *
 * Schema readiness: if the `skills` or `agent_skills` tables have not
 * been created (error code 42P01), the hooks surface a clear
 * `schemaMissing` state instead of throwing raw Supabase errors.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/useActiveCompany";

// ---------------------------------------------------------------------------
// Untyped Supabase table accessor
// ---------------------------------------------------------------------------

/**
 * Access a Supabase table that isn't in the generated types yet.
 * The Supabase JS client's `.from(tableName)` works at runtime for
 * any existing table; we just need to bypass the TS overload.
 */
function fromTable(tableName: string) {
  return (supabase as unknown as { from: (t: string) => ReturnType<typeof supabase.from> }).from(tableName);
}

// ---------------------------------------------------------------------------
// Schema readiness helpers
// ---------------------------------------------------------------------------

/**
 * Detect the Postgres "relation does not exist" error (42P01).
 * Matches the pattern used in useDashboardMetrics and other hooks.
 */
function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42P01" || (error.message ?? "").includes("does not exist");
}

/** Path to the SQL snippet file that creates the skills and agent_skills tables. */
export const SKILLS_SQL_SNIPPET_PATH = "src/db/migration-snippets.sql";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Skill {
  id: string;
  company_id: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  prerequisite_integration: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AgentSkill {
  id: string;
  agent_id: string;
  skill_id: string;
  company_id: string;
  created_at: string;
}

export interface CreateSkillInput {
  name: string;
  description: string;
  category?: string;
  enabled?: boolean;
  prerequisite_integration?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UpdateSkillInput {
  id: string;
  name?: string;
  description?: string;
  category?: string;
  enabled?: boolean;
  prerequisite_integration?: string | null;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Reference skill templates for import
// ---------------------------------------------------------------------------

export const REFERENCE_SKILLS: Omit<CreateSkillInput, "enabled">[] = [
  {
    name: "Code Generation",
    description: "Generate, edit, and refactor code across multiple languages and frameworks.",
    category: "engineering",
  },
  {
    name: "Code Review",
    description: "Review pull requests and provide structured feedback on code quality.",
    category: "engineering",
  },
  {
    name: "Research & Analysis",
    description: "Gather information, analyze data, and synthesize findings into reports.",
    category: "research",
  },
  {
    name: "Web Browsing",
    description: "Navigate websites, extract data, and interact with web applications.",
    category: "tooling",
    prerequisite_integration: "composio",
  },
  {
    name: "Email Management",
    description: "Read, compose, and manage email communications.",
    category: "communication",
    prerequisite_integration: "composio",
  },
  {
    name: "Slack Integration",
    description: "Send messages, read channels, and manage Slack workspace communications.",
    category: "communication",
    prerequisite_integration: "composio",
  },
  {
    name: "Private Reasoning",
    description: "Use Venice private AI for confidential inference without data retention.",
    category: "ai",
    prerequisite_integration: "venice",
  },
  {
    name: "Token Trading",
    description: "Execute token swaps and manage DeFi positions via Uniswap.",
    category: "finance",
    prerequisite_integration: "uniswap",
  },
  {
    name: "Treasury Management",
    description: "Monitor and manage stETH treasury positions via Lido.",
    category: "finance",
    prerequisite_integration: "lido",
  },
  {
    name: "Task Planning",
    description: "Break down complex objectives into actionable tasks and milestones.",
    category: "operations",
  },
  {
    name: "Report Writing",
    description: "Create structured reports, documentation, and summaries.",
    category: "operations",
  },
  {
    name: "Payment Processing",
    description: "Handle x402 invoice creation, settlement, and payment verification.",
    category: "finance",
    prerequisite_integration: "agentcash",
  },
];

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Lightweight schema readiness probe for the `skills` table.
 * Issues a `select count(*)` with `limit(0)` to avoid fetching data.
 * If the table doesn't exist (42P01), returns `{ ready: false }`.
 *
 * Other hooks in this module use the result to short-circuit instead of
 * throwing raw Supabase errors at the UI layer.
 */
export function useSkillsSchemaReady() {
  return useQuery<{ ready: boolean }>({
    queryKey: ["skills-schema-ready"],
    staleTime: 60_000, // re-check at most once per minute
    queryFn: async () => {
      const { error } = await fromTable("skills")
        .select("id", { count: "exact", head: true })
        .limit(0);

      if (error && isMissingTable(error)) return { ready: false };
      if (error) throw error; // unexpected error — let React Query handle
      return { ready: true };
    },
  });
}

/** Fetch all skills for the active company. */
export function useCompanySkills() {
  const { companyId } = useActiveCompany();
  const { data: schemaState } = useSkillsSchemaReady();

  return useQuery<Skill[]>({
    queryKey: ["skills", companyId],
    enabled: !!companyId && schemaState?.ready !== false,
    queryFn: async () => {
      const { data, error } = await fromTable("skills")
        .select("*")
        .eq("company_id", companyId!)
        .order("name", { ascending: true });

      if (error) {
        if (isMissingTable(error)) return [];
        throw error;
      }
      return (data ?? []) as Skill[];
    },
  });
}

/** Fetch skills assigned to a specific agent. */
export function useAgentSkills(agentId: string | undefined) {
  const { companyId } = useActiveCompany();
  const { data: schemaState } = useSkillsSchemaReady();

  return useQuery<AgentSkill[]>({
    queryKey: ["agent-skills", agentId],
    enabled: !!agentId && !!companyId && schemaState?.ready !== false,
    queryFn: async () => {
      const { data, error } = await fromTable("agent_skills")
        .select("*")
        .eq("agent_id", agentId!)
        .order("created_at", { ascending: true });

      if (error) {
        if (isMissingTable(error)) return [];
        throw error;
      }
      return (data ?? []) as AgentSkill[];
    },
  });
}

/** Create a new skill for the active company. */
export function useCreateSkill() {
  const { companyId } = useActiveCompany();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateSkillInput) => {
      if (!companyId) throw new Error("No active company");

      const { data, error } = await fromTable("skills")
        .insert({
          company_id: companyId,
          name: input.name,
          description: input.description,
          category: input.category ?? "general",
          enabled: input.enabled ?? true,
          prerequisite_integration: input.prerequisite_integration ?? null,
          metadata: input.metadata ?? {},
        })
        .select("*")
        .single();

      if (error) {
        if (isMissingTable(error)) {
          throw new Error(
            "Skills table not found. Apply the SQL snippet from " +
            SKILLS_SQL_SNIPPET_PATH +
            " in the Supabase SQL Editor first."
          );
        }
        throw error;
      }
      return data as Skill;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills", companyId] });
    },
  });
}

/** Update an existing skill. */
export function useUpdateSkill() {
  const { companyId } = useActiveCompany();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateSkillInput) => {
      const { id, ...updates } = input;
      const { error } = await fromTable("skills")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills", companyId] });
    },
  });
}

/** Toggle a skill's enabled state. */
export function useToggleSkill() {
  const { companyId } = useActiveCompany();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await fromTable("skills")
        .update({ enabled })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills", companyId] });
    },
  });
}

/** Assign a skill to an agent. */
export function useAssignSkill() {
  const { companyId } = useActiveCompany();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ agentId, skillId }: { agentId: string; skillId: string }) => {
      if (!companyId) throw new Error("No active company");

      const { error } = await fromTable("agent_skills")
        .insert({
          agent_id: agentId,
          skill_id: skillId,
          company_id: companyId,
        });

      if (error) {
        if (isMissingTable(error)) {
          throw new Error(
            "Agent skills table not found. Apply the SQL snippet from " +
            SKILLS_SQL_SNIPPET_PATH +
            " in the Supabase SQL Editor first."
          );
        }
        throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["agent-skills", variables.agentId] });
    },
  });
}

/** Remove a skill assignment from an agent. */
export function useUnassignSkill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ agentId, skillId }: { agentId: string; skillId: string }) => {
      const { error } = await fromTable("agent_skills")
        .delete()
        .eq("agent_id", agentId)
        .eq("skill_id", skillId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["agent-skills", variables.agentId] });
    },
  });
}

/** Bulk-assign skills to an agent (used by onboarding). */
export function useBulkAssignSkills() {
  const { companyId } = useActiveCompany();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ agentId, skillIds }: { agentId: string; skillIds: string[] }) => {
      if (!companyId) throw new Error("No active company");
      if (skillIds.length === 0) return;

      const rows = skillIds.map((skillId) => ({
        agent_id: agentId,
        skill_id: skillId,
        company_id: companyId,
      }));

      const { error } = await fromTable("agent_skills")
        .insert(rows);

      if (error) {
        if (isMissingTable(error)) {
          throw new Error(
            "Agent skills table not found. Apply the SQL snippet from " +
            SKILLS_SQL_SNIPPET_PATH +
            " in the Supabase SQL Editor first."
          );
        }
        throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["agent-skills", variables.agentId] });
    },
  });
}

/**
 * Check whether a skill's prerequisite integration is configured.
 * Returns true if the skill has no prerequisite or the integration is enabled.
 */
export function useSkillPrerequisiteCheck(prerequisiteIntegration: string | null) {
  const { companyId } = useActiveCompany();

  return useQuery<boolean>({
    queryKey: ["skill-prereq", companyId, prerequisiteIntegration],
    enabled: !!companyId && !!prerequisiteIntegration,
    queryFn: async () => {
      if (!prerequisiteIntegration) return true;

      const { data, error } = await supabase
        .from("integrations")
        .select("id, enabled, config")
        .eq("company_id", companyId!)
        .eq("integration_key", prerequisiteIntegration)
        .maybeSingle();

      if (error) return false;
      if (!data || !data.enabled) return false;

      // For Composio-like integrations, also check for a credential
      const config = data.config as Record<string, unknown> | null;
      if (config && typeof config === "object") {
        if (config.api_key || config.consumer_key) return true;
      }
      // If enabled but no credential needed (some integrations just need the toggle)
      return data.enabled;
    },
  });
}

/** Batch-check all integration prerequisites for a list of skills. */
export function useIntegrationStatuses() {
  const { companyId } = useActiveCompany();

  return useQuery<Record<string, boolean>>({
    queryKey: ["integration-statuses", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integrations")
        .select("integration_key, enabled, config")
        .eq("company_id", companyId!);

      if (error) return {};

      const statuses: Record<string, boolean> = {};
      for (const row of data ?? []) {
        const config = row.config as Record<string, unknown> | null;
        const hasCredential =
          config && typeof config === "object"
            ? !!(config.api_key || config.consumer_key)
            : false;
        statuses[row.integration_key] = row.enabled && hasCredential;
      }
      return statuses;
    },
  });
}
