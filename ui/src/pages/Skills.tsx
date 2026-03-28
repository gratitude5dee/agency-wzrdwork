import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { agentsApi } from "../api/agents";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Code2,
  Brain,
  Shield,
  GitBranch,
  CheckCircle2,
  Zap,
  Cpu,
  Plus,
  BookOpen,
  AlertCircle,
} from "lucide-react";
import { PageSkeleton } from "../components/PageSkeleton";
import { EmptyState } from "../components/EmptyState";

interface Skill {
  id: string;
  name: string;
  description: string;
  category: "Development" | "Operations" | "AI" | "Blockchain" | "Management";
  icon: React.ReactNode;
  prerequisites: string[];
  agents: string[];
}

const AVAILABLE_SKILLS: Skill[] = [
  {
    id: "skill-paperclip",
    name: "Paperclip",
    description: "Core paperclip AI reasoning and task execution framework",
    category: "AI",
    icon: <FileText className="h-5 w-5" />,
    prerequisites: [],
    agents: [],
  },
  {
    id: "skill-blockchain",
    name: "Blockchain",
    description: "Smart contract interaction and blockchain transaction handling",
    category: "Blockchain",
    icon: <GitBranch className="h-5 w-5" />,
    prerequisites: [],
    agents: [],
  },
  {
    id: "skill-ai-reasoning",
    name: "AI Reasoning",
    description: "Advanced language model reasoning and decision making",
    category: "AI",
    icon: <Brain className="h-5 w-5" />,
    prerequisites: ["Paperclip"],
    agents: [],
  },
  {
    id: "skill-code-review",
    name: "Code Review",
    description: "Automated code analysis and review capabilities",
    category: "Development",
    icon: <Code2 className="h-5 w-5" />,
    prerequisites: [],
    agents: [],
  },
  {
    id: "skill-deployment",
    name: "Deployment",
    description: "CI/CD pipeline and deployment automation",
    category: "Operations",
    icon: <Zap className="h-5 w-5" />,
    prerequisites: ["Code Review"],
    agents: [],
  },
  {
    id: "skill-testing",
    name: "Testing",
    description: "Automated testing and quality assurance",
    category: "Development",
    icon: <CheckCircle2 className="h-5 w-5" />,
    prerequisites: [],
    agents: [],
  },
  {
    id: "skill-documentation",
    name: "Documentation",
    description: "Documentation generation and management",
    category: "Development",
    icon: <BookOpen className="h-5 w-5" />,
    prerequisites: [],
    agents: [],
  },
  {
    id: "skill-project-mgmt",
    name: "Project Management",
    description: "Task orchestration and project planning",
    category: "Management",
    icon: <Cpu className="h-5 w-5" />,
    prerequisites: [],
    agents: [],
  },
  {
    id: "skill-security-audit",
    name: "Security Audit",
    description: "Security vulnerability scanning and audit",
    category: "Operations",
    icon: <Shield className="h-5 w-5" />,
    prerequisites: [],
    agents: [],
  },
  {
    id: "skill-data-analysis",
    name: "Data Analysis",
    description: "Data processing and analytical insights",
    category: "AI",
    icon: <Brain className="h-5 w-5" />,
    prerequisites: [],
    agents: [],
  },
];

const CATEGORIES = [
  "Development",
  "Operations",
  "AI",
  "Blockchain",
  "Management",
] as const;

export function Skills() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [skillAssignments, setSkillAssignments] = useState<
    Record<string, string[]>
  >({});

  useEffect(() => {
    setBreadcrumbs([{ label: "Skills" }]);
  }, [setBreadcrumbs]);

  const { data: agents, isLoading } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  // Filter skills by category
  const filteredSkills = useMemo(() => {
    if (!selectedCategory) return AVAILABLE_SKILLS;
    return AVAILABLE_SKILLS.filter((s) => s.category === selectedCategory);
  }, [selectedCategory]);

  const selectedSkill = useMemo(
    () => AVAILABLE_SKILLS.find((s) => s.id === selectedSkillId),
    [selectedSkillId]
  );

  const stats = useMemo(() => {
    const totalAssignments = Object.values(skillAssignments).flat().length;
    const agentsWithSkills = new Set(Object.values(skillAssignments).flat()).size;
    return {
      totalSkills: AVAILABLE_SKILLS.length,
      assignedSkills: Object.keys(skillAssignments).length,
      totalAssignments,
      agentsWithSkills,
    };
  }, [skillAssignments]);

  const handleAssignSkill = () => {
    if (!selectedSkillId || !selectedAgentId) return;

    setSkillAssignments((prev) => {
      const skillAssignments = prev[selectedSkillId] || [];
      if (!skillAssignments.includes(selectedAgentId)) {
        return {
          ...prev,
          [selectedSkillId]: [...skillAssignments, selectedAgentId],
        };
      }
      return prev;
    });

    setAssignOpen(false);
    setSelectedAgentId("");
  };

  const toggleAgentSkill = (skillId: string, agentId: string) => {
    setSkillAssignments((prev) => {
      const assignments = prev[skillId] || [];
      const updated = assignments.includes(agentId)
        ? assignments.filter((id) => id !== agentId)
        : [...assignments, agentId];
      return {
        ...prev,
        [skillId]: updated.length > 0 ? updated : [],
      };
    });
  };

  if (!selectedCompanyId) {
    return (
      <EmptyState
        icon={BookOpen}
        message="Select a company to view skills."
      />
    );
  }

  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground mb-1">
            Total Skills
          </p>
          <p className="text-2xl font-semibold">{stats.totalSkills}</p>
          <p className="text-xs text-muted-foreground mt-1">available</p>
        </Card>

        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground mb-1">
            Assigned Skills
          </p>
          <p className="text-2xl font-semibold">{stats.assignedSkills}</p>
          <p className="text-xs text-muted-foreground mt-1">configured</p>
        </Card>

        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground mb-1">
            Total Assignments
          </p>
          <p className="text-2xl font-semibold">{stats.totalAssignments}</p>
          <p className="text-xs text-muted-foreground mt-1">across agents</p>
        </Card>

        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground mb-1">
            Agents Enabled
          </p>
          <p className="text-2xl font-semibold">{stats.agentsWithSkills}</p>
          <p className="text-xs text-muted-foreground mt-1">with skills</p>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Skills Grid */}
        <div className="lg:col-span-2 space-y-4">
          {/* Category Filter */}
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant={selectedCategory === null ? "default" : "outline"}
              onClick={() => setSelectedCategory(null)}
            >
              All Skills
            </Button>
            {CATEGORIES.map((cat) => (
              <Button
                key={cat}
                size="sm"
                variant={selectedCategory === cat ? "default" : "outline"}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </Button>
            ))}
          </div>

          {/* Skills Grid */}
          {filteredSkills.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              message="No skills in this category."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredSkills.map((skill) => (
                <Card
                  key={skill.id}
                  className={cn(
                    "p-4 cursor-pointer transition-colors hover:bg-accent/50",
                    selectedSkillId === skill.id && "ring-2 ring-primary"
                  )}
                  onClick={() => setSelectedSkillId(skill.id)}
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="text-muted-foreground">
                          {skill.icon}
                        </div>
                        <h3 className="font-semibold text-sm">{skill.name}</h3>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {skill.category}
                      </Badge>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-muted-foreground">
                      {skill.description}
                    </p>

                    {/* Prerequisites */}
                    {skill.prerequisites.length > 0 && (
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-3 w-3 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 text-xs text-amber-700">
                          <p className="font-medium mb-1">Requires:</p>
                          <div className="flex gap-1 flex-wrap">
                            {skill.prerequisites.map((req) => (
                              <Badge
                                key={req}
                                variant="secondary"
                                className="text-[10px]"
                              >
                                {req}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Assignment Count */}
                    <div className="text-xs text-muted-foreground">
                      {skillAssignments[skill.id]?.length || 0} agents assigned
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Skill Detail Panel */}
        {selectedSkill && (
          <Card className="p-5 h-fit sticky top-4 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="text-primary">{selectedSkill.icon}</div>
                <h2 className="font-semibold">{selectedSkill.name}</h2>
              </div>
              <Badge variant="secondary" className="w-fit">
                {selectedSkill.category}
              </Badge>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                Description
              </p>
              <p className="text-sm">{selectedSkill.description}</p>
            </div>

            {selectedSkill.prerequisites.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Prerequisites
                </p>
                <div className="flex flex-wrap gap-1">
                  {selectedSkill.prerequisites.map((req) => (
                    <Badge key={req} variant="outline" className="text-xs">
                      {req}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Assigned to {skillAssignments[selectedSkill.id]?.length || 0}{" "}
                agent(s)
              </p>
              {(skillAssignments[selectedSkill.id] || []).length > 0 ? (
                <div className="space-y-1">
                  {(skillAssignments[selectedSkill.id] || []).map((agentId) => {
                    const agent = (agents ?? []).find((a) => a.id === agentId);
                    return (
                      <div
                        key={agentId}
                        className="text-xs p-2 bg-accent rounded-md"
                      >
                        {agent?.name || agentId}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  No agents assigned yet
                </p>
              )}
            </div>

            <Button
              size="sm"
              className="w-full"
              onClick={() => setAssignOpen(true)}
            >
              <Plus className="h-3 w-3 mr-1" />
              Assign Skill
            </Button>
          </Card>
        )}
      </div>

      {/* Assignment Matrix */}
      <Card className="p-5 space-y-4">
        <h3 className="font-semibold">Assignment Matrix</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2 font-medium text-xs text-muted-foreground w-40">
                  Agent
                </th>
                {AVAILABLE_SKILLS.map((skill) => (
                  <th
                    key={skill.id}
                    className="text-center p-2 font-medium text-xs text-muted-foreground"
                    title={skill.name}
                  >
                    <span className="text-lg">{skill.icon}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(agents ?? []).map((agent) => (
                <tr key={agent.id} className="border-b hover:bg-accent/30">
                  <td className="p-2 font-medium text-xs">{agent.name}</td>
                  {AVAILABLE_SKILLS.map((skill) => (
                    <td key={skill.id} className="text-center p-2">
                      <Checkbox
                        checked={
                          skillAssignments[skill.id]?.includes(agent.id) ?? false
                        }
                        onCheckedChange={() =>
                          toggleAgentSkill(skill.id, agent.id)
                        }
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Assign Skill Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Skill: {selectedSkill?.name}</DialogTitle>
            <DialogDescription>
              Select an agent to assign this skill to.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Agent</label>
              <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an agent..." />
                </SelectTrigger>
                <SelectContent>
                  {(agents ?? [])
                    .filter(
                      (a) =>
                        !skillAssignments[selectedSkillId || ""]?.includes(a.id)
                    )
                    .map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {selectedSkill?.prerequisites.length ? (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs font-medium text-blue-900 mb-2">
                  Prerequisites Required
                </p>
                <div className="flex flex-wrap gap-1">
                  {selectedSkill.prerequisites.map((req) => (
                    <Badge key={req} variant="secondary" className="text-xs">
                      {req}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAssignOpen(false)}
              disabled={!selectedAgentId}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssignSkill}
              disabled={!selectedAgentId}
            >
              Assign Skill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
