/**
 * Onboarding Step: Skill Selection
 *
 * Lets the user select skills during onboarding to assign to their CEO agent.
 * Skills are sourced from the company skills table. If none exist yet,
 * the user can import reference skills inline.
 *
 * VAL-SKILLS-004: Onboarding-selected skills persist onto the created CEO agent
 */

import { useState, useMemo, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Download, Zap, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  useCompanySkills,
  useCreateSkill,
  useIntegrationStatuses,
  useSkillsSchemaReady,
  REFERENCE_SKILLS,
  type Skill,
} from "@/hooks/useSkills";
import { SkillsSchemaSetup } from "@/components/SkillsSchemaSetup";

function fromTable(tableName: string) {
  return (supabase as unknown as { from: (t: string) => ReturnType<typeof supabase.from> }).from(tableName);
}

interface SkillSelectionProps {
  agentId: string;
  companyId: string;
  onComplete: () => void;
}

export function SkillSelection({ agentId, companyId, onComplete }: SkillSelectionProps) {
  const queryClient = useQueryClient();
  const { data: schemaState, isLoading: schemaLoading } = useSkillsSchemaReady();
  const schemaMissing = schemaState?.ready === false;
  const { data: companySkills = [], isLoading } = useCompanySkills();
  const { data: integrationStatuses = {} } = useIntegrationStatuses();
  const createSkill = useCreateSkill();

  const [selectedSkillIds, setSelectedSkillIds] = useState<Set<string>>(new Set());
  const [isImporting, setIsImporting] = useState(false);

  // Enabled skills available for selection
  const enabledSkills = useMemo(
    () => companySkills.filter((s) => s.enabled),
    [companySkills],
  );

  const isPrerequisiteMet = useCallback(
    (skill: Skill): boolean => {
      if (!skill.prerequisite_integration) return true;
      return !!integrationStatuses[skill.prerequisite_integration];
    },
    [integrationStatuses],
  );

  const toggleSelection = useCallback((skillId: string) => {
    setSelectedSkillIds((prev) => {
      const next = new Set(prev);
      if (next.has(skillId)) next.delete(skillId);
      else next.add(skillId);
      return next;
    });
  }, []);

  // Import all reference skills that don't exist yet
  const handleImportAll = useCallback(async () => {
    setIsImporting(true);
    const existingNames = new Set(companySkills.map((s) => s.name.toLowerCase()));
    let imported = 0;

    for (const ref of REFERENCE_SKILLS) {
      if (existingNames.has(ref.name.toLowerCase())) continue;
      try {
        await createSkill.mutateAsync({
          name: ref.name,
          description: ref.description,
          category: ref.category,
          prerequisite_integration: ref.prerequisite_integration ?? null,
        });
        imported++;
      } catch {
        // Skip duplicates
      }
    }

    if (imported > 0) {
      toast.success(`Imported ${imported} reference skill${imported === 1 ? "" : "s"}`);
    }
    setIsImporting(false);
  }, [companySkills, createSkill]);

  // Persist selected skills as agent_skills rows
  const assignMutation = useMutation({
    mutationFn: async () => {
      if (selectedSkillIds.size === 0) return;

      const rows = Array.from(selectedSkillIds).map((skillId) => ({
        agent_id: agentId,
        skill_id: skillId,
        company_id: companyId,
      }));

      const { error } = await fromTable("agent_skills")
        .insert(rows);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-skills", agentId] });
      if (selectedSkillIds.size > 0) {
        toast.success(`Assigned ${selectedSkillIds.size} skill${selectedSkillIds.size === 1 ? "" : "s"} to your CEO agent`);
      }
      onComplete();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to assign skills");
    },
  });

  if (schemaLoading || isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-zinc-500">
        <p className="text-sm uppercase tracking-[0.2em]">Loading skills…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-[#080c14]">
          <Zap className="h-6 w-6 text-yellow-400" />
        </div>
        <h2 className="text-xl font-bold text-zinc-100">Select skills for your CEO agent</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Choose which capabilities your CEO agent should have. You can change this later.
        </p>
      </div>

      {/* Schema setup required — allow skip so onboarding isn't blocked */}
      {schemaMissing && (
        <div className="space-y-4">
          <SkillsSchemaSetup />
          <div className="flex justify-center">
            <Button
              variant="outline"
              className="border-white/10 text-zinc-400"
              onClick={() => onComplete()}
            >
              Skip — continue without skills
            </Button>
          </div>
        </div>
      )}

      {/* Import reference skills if empty */}
      {!schemaMissing && enabledSkills.length === 0 && (
        <Card className="border-white/10 bg-[#0d1118]">
          <CardContent className="flex flex-col items-center gap-4 p-8">
            <p className="text-sm text-zinc-400 text-center">
              No skills configured yet. Import the reference skill catalog to get started.
            </p>
            <Button
              variant="outline"
              className="border-white/10 gap-2"
              onClick={handleImportAll}
              disabled={isImporting}
            >
              <Download className="h-4 w-4" />
              {isImporting ? "Importing…" : "Import Reference Skills"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Skill selection grid */}
      {!schemaMissing && enabledSkills.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {enabledSkills.map((skill) => {
            const prereqMet = isPrerequisiteMet(skill);
            const isSelected = selectedSkillIds.has(skill.id);
            const isDisabled = !prereqMet;

            return (
              <Card
                key={skill.id}
                role="button"
                tabIndex={isDisabled ? -1 : 0}
                onClick={() => !isDisabled && toggleSelection(skill.id)}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === " ") && !isDisabled) {
                    e.preventDefault();
                    toggleSelection(skill.id);
                  }
                }}
                className={cn(
                  "transition-colors",
                  isDisabled
                    ? "cursor-not-allowed border-white/5 bg-zinc-900/30 opacity-60"
                    : "cursor-pointer border-white/10 bg-[#0d1118] hover:border-white/20",
                  isSelected && !isDisabled && "border-blue-500/60 bg-blue-500/5 ring-1 ring-blue-500/30",
                )}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-sm text-zinc-100">{skill.name}</CardTitle>
                    {isSelected && !isDisabled && (
                      <Check className="h-4 w-4 shrink-0 text-blue-400" />
                    )}
                    {isDisabled && (
                      <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-400" />
                    )}
                  </div>
                  <CardDescription className="text-xs text-zinc-500 line-clamp-2">
                    {skill.description || "No description"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex flex-wrap gap-1">
                    <Badge
                      variant="outline"
                      className="text-[10px] border-white/10 text-zinc-400"
                    >
                      {skill.category}
                    </Badge>
                    {skill.prerequisite_integration && !prereqMet && (
                      <Badge
                        variant="outline"
                        className="text-[10px] border-yellow-500/20 text-yellow-400"
                      >
                        Requires {skill.prerequisite_integration}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Action buttons — hidden when schema is missing (skip button is shown above) */}
      {!schemaMissing && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            className="border-white/10 text-zinc-400"
            onClick={() => onComplete()}
            disabled={assignMutation.isPending}
          >
            Skip
          </Button>
          <Button
            onClick={() => assignMutation.mutate()}
            disabled={assignMutation.isPending}
            className="min-w-[200px]"
          >
            {assignMutation.isPending
              ? "Assigning…"
              : selectedSkillIds.size > 0
                ? `Assign ${selectedSkillIds.size} Skill${selectedSkillIds.size === 1 ? "" : "s"}`
                : "Continue Without Skills"}
          </Button>
        </div>
      )}
    </div>
  );
}
