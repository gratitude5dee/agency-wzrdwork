/**
 * SkillsSchemaSetup — setup-required banner shown when the `skills` and
 * `agent_skills` tables have not been created in Supabase yet.
 *
 * Surfaces a clear, actionable message pointing the operator to the approved
 * SQL snippet path instead of raw Supabase errors.
 *
 * Used by: SkillsPage, AgentSkillAssignment, SkillSelection.
 */

import { AlertTriangle, Database } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SKILLS_SQL_SNIPPET_PATH } from "@/hooks/useSkills";

interface SkillsSchemaSetupProps {
  /** Compact variant for embedding inside other cards (e.g. AgentSkillAssignment). */
  compact?: boolean;
}

export function SkillsSchemaSetup({ compact = false }: SkillsSchemaSetupProps) {
  if (compact) {
    return (
      <div
        data-testid="skills-schema-setup"
        className="flex items-start gap-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4"
      >
        <AlertTriangle className="h-5 w-5 shrink-0 text-yellow-400 mt-0.5" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-yellow-300">Skills schema not found</p>
          <p className="mt-1 text-xs text-yellow-300/80">
            The <code className="rounded bg-yellow-500/10 px-1 py-0.5">skills</code> and{" "}
            <code className="rounded bg-yellow-500/10 px-1 py-0.5">agent_skills</code> tables
            need to be created. Run the SQL snippets from{" "}
            <code className="rounded bg-yellow-500/10 px-1 py-0.5">{SKILLS_SQL_SNIPPET_PATH}</code>{" "}
            (sections 12 &amp; 13) in the Supabase SQL Editor, then reload.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Card
      data-testid="skills-schema-setup"
      className="border-yellow-500/20 bg-[#0d1118]"
    >
      <CardContent className="flex flex-col items-center gap-4 p-12">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-yellow-500/20 bg-yellow-500/5">
          <Database className="h-7 w-7 text-yellow-400" />
        </div>
        <div className="text-center max-w-md">
          <p className="text-lg font-bold text-zinc-100">Schema setup required</p>
          <p className="mt-2 text-sm text-zinc-400">
            The <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-yellow-300">skills</code>{" "}
            and{" "}
            <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-yellow-300">agent_skills</code>{" "}
            tables have not been created in Supabase yet.
          </p>
          <p className="mt-3 text-sm text-zinc-500">
            Apply sections <strong>12</strong> and <strong>13</strong> from{" "}
            <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-300">
              {SKILLS_SQL_SNIPPET_PATH}
            </code>{" "}
            in the Supabase SQL Editor, then reload this page.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
