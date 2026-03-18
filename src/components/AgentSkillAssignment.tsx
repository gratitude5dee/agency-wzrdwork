/**
 * AgentSkillAssignment — skill assignment UI for agent detail and creation flows.
 *
 * Shows assigned skills, allows adding/removing, and enforces prerequisite gating.
 * Used in AgentDetailPage and onboarding skill selection.
 *
 * VAL-SKILLS-002: Skills can be assigned to agents and persist across reloads
 * VAL-SKILLS-003: Skill prerequisites are clearly gated by connector availability
 */

import { useMemo, useCallback } from "react";
import { AlertTriangle, Plus, X, Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useCompanySkills,
  useAgentSkills,
  useAssignSkill,
  useUnassignSkill,
  useIntegrationStatuses,
  type Skill,
} from "@/hooks/useSkills";
import { toast } from "sonner";

interface AgentSkillAssignmentProps {
  agentId: string;
}

export function AgentSkillAssignment({ agentId }: AgentSkillAssignmentProps) {
  const { data: companySkills = [] } = useCompanySkills();
  const { data: agentSkillRows = [] } = useAgentSkills(agentId);
  const { data: integrationStatuses = {} } = useIntegrationStatuses();
  const assignSkill = useAssignSkill();
  const unassignSkill = useUnassignSkill();

  // Set of skill IDs currently assigned to this agent
  const assignedSkillIds = useMemo(
    () => new Set(agentSkillRows.map((as) => as.skill_id)),
    [agentSkillRows],
  );

  // Skills grouped into assigned and available
  const assignedSkills = useMemo(
    () => companySkills.filter((s) => assignedSkillIds.has(s.id)),
    [companySkills, assignedSkillIds],
  );

  const availableSkills = useMemo(
    () => companySkills.filter((s) => !assignedSkillIds.has(s.id) && s.enabled),
    [companySkills, assignedSkillIds],
  );

  const isPrerequisiteMet = useCallback(
    (skill: Skill): boolean => {
      if (!skill.prerequisite_integration) return true;
      return !!integrationStatuses[skill.prerequisite_integration];
    },
    [integrationStatuses],
  );

  const handleAssign = useCallback(
    (skill: Skill) => {
      if (!isPrerequisiteMet(skill)) {
        toast.error(
          `Cannot assign "${skill.name}": requires ${skill.prerequisite_integration} integration to be configured first.`,
        );
        return;
      }
      assignSkill.mutate(
        { agentId, skillId: skill.id },
        {
          onSuccess: () => toast.success(`Assigned "${skill.name}"`),
          onError: (err) =>
            toast.error(err instanceof Error ? err.message : "Failed to assign skill"),
        },
      );
    },
    [agentId, assignSkill, isPrerequisiteMet],
  );

  const handleUnassign = useCallback(
    (skill: Skill) => {
      unassignSkill.mutate(
        { agentId, skillId: skill.id },
        {
          onSuccess: () => toast.success(`Removed "${skill.name}"`),
          onError: (err) =>
            toast.error(err instanceof Error ? err.message : "Failed to remove skill"),
        },
      );
    },
    [agentId, unassignSkill],
  );

  return (
    <Card className="border-white/10 bg-[#0d1118]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-zinc-100">
          <Zap className="h-4 w-4" />
          Skills
        </CardTitle>
        <CardDescription className="text-zinc-500">
          Assign skills to this agent. Connector-dependent skills require the integration to be
          configured first.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Assigned skills */}
        {assignedSkills.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-500">
              Assigned ({assignedSkills.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {assignedSkills.map((skill) => (
                <Badge
                  key={skill.id}
                  variant="outline"
                  className="border-blue-500/20 bg-blue-500/5 text-blue-300 gap-1.5 pl-2.5 pr-1"
                >
                  {skill.name}
                  <button
                    type="button"
                    onClick={() => handleUnassign(skill)}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-blue-500/20"
                    aria-label={`Remove ${skill.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">No skills assigned yet.</p>
        )}

        {/* Available skills */}
        {availableSkills.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-500">
              Available
            </p>
            <div className="flex flex-wrap gap-2">
              {availableSkills.map((skill) => {
                const prereqMet = isPrerequisiteMet(skill);
                return (
                  <Button
                    key={skill.id}
                    variant="outline"
                    size="sm"
                    disabled={!prereqMet || assignSkill.isPending}
                    onClick={() => handleAssign(skill)}
                    className={`gap-1.5 border-white/10 text-zinc-300 ${
                      !prereqMet ? "opacity-50 cursor-not-allowed" : "hover:border-blue-500/30"
                    }`}
                    title={
                      prereqMet
                        ? `Assign ${skill.name}`
                        : `Requires ${skill.prerequisite_integration} integration`
                    }
                  >
                    {!prereqMet ? (
                      <AlertTriangle className="h-3 w-3 text-yellow-400" />
                    ) : (
                      <Plus className="h-3 w-3" />
                    )}
                    {skill.name}
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        {companySkills.length === 0 && (
          <p className="text-sm text-zinc-500">
            No skills configured yet. Visit the{" "}
            <a href="/skills" className="text-blue-400 underline">
              Skills page
            </a>{" "}
            to create or import skills.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
