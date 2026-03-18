/**
 * Skills Registry Page
 *
 * Company-scoped skill management: list, import reference skills,
 * create custom skills, edit, and toggle enabled state.
 * Enforces prerequisite gating for connector-dependent skills.
 *
 * VAL-SKILLS-001: Skills registry supports listing, import, creation, editing, and enable toggles
 */

import { useState, useCallback, useMemo } from "react";
import {
  BookOpen,
  Download,
  Edit2,
  Loader2,
  Plus,
  Search,
  Zap,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  useCompanySkills,
  useCreateSkill,
  useUpdateSkill,
  useToggleSkill,
  useIntegrationStatuses,
  REFERENCE_SKILLS,
  type Skill,
  type CreateSkillInput,
} from "@/hooks/useSkills";

// ---------------------------------------------------------------------------
// Category metadata
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { value: "general", label: "General" },
  { value: "engineering", label: "Engineering" },
  { value: "research", label: "Research" },
  { value: "tooling", label: "Tooling" },
  { value: "communication", label: "Communication" },
  { value: "ai", label: "AI" },
  { value: "finance", label: "Finance" },
  { value: "operations", label: "Operations" },
];

const CATEGORY_COLORS: Record<string, string> = {
  general: "border-zinc-500/20 text-zinc-400",
  engineering: "border-blue-500/20 text-blue-400",
  research: "border-purple-500/20 text-purple-400",
  tooling: "border-orange-500/20 text-orange-400",
  communication: "border-green-500/20 text-green-400",
  ai: "border-cyan-500/20 text-cyan-400",
  finance: "border-yellow-500/20 text-yellow-400",
  operations: "border-pink-500/20 text-pink-400",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SkillsPage() {
  const { data: skills = [], isLoading } = useCompanySkills();
  const { data: integrationStatuses = {} } = useIntegrationStatuses();
  const createSkill = useCreateSkill();
  const updateSkill = useUpdateSkill();
  const toggleSkill = useToggleSkill();

  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);

  // Form state for create/edit
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState("general");
  const [formPrerequisite, setFormPrerequisite] = useState("");

  // Import state
  const [selectedImports, setSelectedImports] = useState<Set<number>>(new Set());

  // Filter skills by search
  const filteredSkills = useMemo(() => {
    if (!searchQuery.trim()) return skills;
    const q = searchQuery.toLowerCase();
    return skills.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q),
    );
  }, [skills, searchQuery]);

  // Existing skill names (for dedup during import)
  const existingNames = useMemo(
    () => new Set(skills.map((s) => s.name.toLowerCase())),
    [skills],
  );

  // Check if a prerequisite is satisfied
  const isPrerequisiteMet = useCallback(
    (prereq: string | null): boolean => {
      if (!prereq) return true;
      return !!integrationStatuses[prereq];
    },
    [integrationStatuses],
  );

  // ---- Create dialog ----
  const openCreateDialog = useCallback(() => {
    setFormName("");
    setFormDescription("");
    setFormCategory("general");
    setFormPrerequisite("");
    setShowCreateDialog(true);
  }, []);

  const handleCreate = useCallback(() => {
    if (!formName.trim()) return;
    const input: CreateSkillInput = {
      name: formName.trim(),
      description: formDescription.trim(),
      category: formCategory,
      prerequisite_integration: formPrerequisite || null,
    };
    createSkill.mutate(input, {
      onSuccess: () => {
        toast.success(`Skill "${input.name}" created`);
        setShowCreateDialog(false);
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : "Failed to create skill");
      },
    });
  }, [formName, formDescription, formCategory, formPrerequisite, createSkill]);

  // ---- Edit dialog ----
  const openEditDialog = useCallback((skill: Skill) => {
    setEditingSkill(skill);
    setFormName(skill.name);
    setFormDescription(skill.description);
    setFormCategory(skill.category);
    setFormPrerequisite(skill.prerequisite_integration ?? "");
  }, []);

  const handleUpdate = useCallback(() => {
    if (!editingSkill || !formName.trim()) return;
    updateSkill.mutate(
      {
        id: editingSkill.id,
        name: formName.trim(),
        description: formDescription.trim(),
        category: formCategory,
        prerequisite_integration: formPrerequisite || null,
      },
      {
        onSuccess: () => {
          toast.success(`Skill "${formName}" updated`);
          setEditingSkill(null);
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Failed to update skill");
        },
      },
    );
  }, [editingSkill, formName, formDescription, formCategory, formPrerequisite, updateSkill]);

  // ---- Import dialog ----
  const openImportDialog = useCallback(() => {
    setSelectedImports(new Set());
    setShowImportDialog(true);
  }, []);

  const toggleImportSelection = useCallback((index: number) => {
    setSelectedImports((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const handleImport = useCallback(async () => {
    const toImport = Array.from(selectedImports)
      .map((i) => REFERENCE_SKILLS[i])
      .filter((ref) => !existingNames.has(ref.name.toLowerCase()));

    if (toImport.length === 0) {
      toast.info("All selected skills already exist");
      setShowImportDialog(false);
      return;
    }

    let imported = 0;
    for (const ref of toImport) {
      try {
        await createSkill.mutateAsync({
          name: ref.name,
          description: ref.description,
          category: ref.category,
          prerequisite_integration: ref.prerequisite_integration ?? null,
        });
        imported++;
      } catch {
        // Skip duplicates silently
      }
    }
    toast.success(`Imported ${imported} skill${imported === 1 ? "" : "s"}`);
    setShowImportDialog(false);
  }, [selectedImports, existingNames, createSkill]);

  // ---- Toggle handler ----
  const handleToggle = useCallback(
    (skill: Skill, enabled: boolean) => {
      toggleSkill.mutate(
        { id: skill.id, enabled },
        {
          onError: (err) => {
            toast.error(err instanceof Error ? err.message : "Failed to toggle skill");
          },
        },
      );
    },
    [toggleSkill],
  );

  // ---- Form fields shared between create and edit ----
  const renderFormFields = () => (
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <Label htmlFor="skill-name" className="text-zinc-300">
          Name <span className="text-red-400">*</span>
        </Label>
        <Input
          id="skill-name"
          placeholder="e.g. Code Generation"
          value={formName}
          onChange={(e) => setFormName(e.target.value)}
          className="border-white/10 bg-black text-zinc-100 placeholder:text-zinc-600"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="skill-description" className="text-zinc-300">
          Description
        </Label>
        <Textarea
          id="skill-description"
          placeholder="What this skill enables an agent to do…"
          rows={3}
          value={formDescription}
          onChange={(e) => setFormDescription(e.target.value)}
          className="border-white/10 bg-black text-zinc-100 placeholder:text-zinc-600"
        />
      </div>
      <div className="space-y-2">
        <Label className="text-zinc-300">Category</Label>
        <Select value={formCategory} onValueChange={setFormCategory}>
          <SelectTrigger className="border-white/10 bg-black text-zinc-100">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label className="text-zinc-300">Prerequisite Integration</Label>
        <Select value={formPrerequisite} onValueChange={setFormPrerequisite}>
          <SelectTrigger className="border-white/10 bg-black text-zinc-100">
            <SelectValue placeholder="None" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="composio">Composio</SelectItem>
            <SelectItem value="venice">Venice</SelectItem>
            <SelectItem value="uniswap">Uniswap</SelectItem>
            <SelectItem value="lido">Lido</SelectItem>
            <SelectItem value="agentcash">AgentCash</SelectItem>
            <SelectItem value="bankr">Bankr</SelectItem>
            <SelectItem value="celo">Celo</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen className="h-6 w-6 text-zinc-400" />
          <div>
            <h1 className="text-2xl font-black tracking-tight text-zinc-100">Skills</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Manage skills that can be assigned to your agents.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="border-white/10 text-zinc-300 gap-2"
            onClick={openImportDialog}
          >
            <Download className="h-4 w-4" />
            Import
          </Button>
          <Button className="gap-2" onClick={openCreateDialog}>
            <Plus className="h-4 w-4" />
            New Skill
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <Input
          placeholder="Search skills…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="border-white/10 bg-[#0d1118] pl-9 text-zinc-200 placeholder:text-zinc-600"
        />
      </div>

      {/* Skills list */}
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse border-white/10 bg-[#0d1118]">
              <CardContent className="p-4">
                <div className="h-5 w-36 rounded bg-zinc-800" />
                <div className="mt-2 h-4 w-full rounded bg-zinc-800" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredSkills.length === 0 ? (
        <Card className="border-white/10 bg-[#0d1118]">
          <CardContent className="flex flex-col items-center gap-4 p-12">
            <Zap className="h-12 w-12 text-zinc-600" />
            <div className="text-center">
              <p className="font-bold text-zinc-300">
                {skills.length === 0 ? "No skills yet" : "No matching skills"}
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                {skills.length === 0
                  ? "Import reference skills or create your own to get started."
                  : "Try a different search term."}
              </p>
            </div>
            {skills.length === 0 && (
              <div className="flex gap-2">
                <Button variant="outline" className="border-white/10" onClick={openImportDialog}>
                  <Download className="mr-2 h-4 w-4" />
                  Import Reference Skills
                </Button>
                <Button onClick={openCreateDialog}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Skill
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSkills.map((skill) => {
            const prereqMet = isPrerequisiteMet(skill.prerequisite_integration);
            return (
              <Card
                key={skill.id}
                className="border-white/10 bg-[#0d1118] transition-colors hover:border-blue-500/20"
              >
                <CardContent className="flex flex-col gap-3 p-4">
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-zinc-100 truncate">{skill.name}</p>
                      <p className="mt-0.5 text-xs text-zinc-500 line-clamp-2">
                        {skill.description || "No description"}
                      </p>
                    </div>
                    <Switch
                      checked={skill.enabled}
                      onCheckedChange={(checked) => handleToggle(skill, checked)}
                      aria-label={`Toggle ${skill.name}`}
                    />
                  </div>

                  {/* Category + prereq badges */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={CATEGORY_COLORS[skill.category] ?? CATEGORY_COLORS.general}
                    >
                      {skill.category}
                    </Badge>
                    {skill.prerequisite_integration && (
                      <Badge
                        variant="outline"
                        className={
                          prereqMet
                            ? "border-emerald-500/20 text-emerald-400"
                            : "border-red-500/20 text-red-400"
                        }
                      >
                        {prereqMet ? "✓" : "⚠"} {skill.prerequisite_integration}
                      </Badge>
                    )}
                  </div>

                  {/* Prerequisite warning */}
                  {skill.prerequisite_integration && !prereqMet && (
                    <div className="flex items-start gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-400 mt-0.5" />
                      <p className="text-xs text-yellow-300">
                        Requires <strong>{skill.prerequisite_integration}</strong> integration to be
                        configured before this skill can be assigned to agents.
                      </p>
                    </div>
                  )}

                  {/* Edit button */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-white/10 text-zinc-300 hover:border-blue-500/30"
                    onClick={() => openEditDialog(skill)}
                  >
                    <Edit2 className="mr-2 h-3.5 w-3.5" />
                    Edit
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="border-white/10 bg-[#0d1118] text-zinc-100">
          <DialogHeader>
            <DialogTitle>Create New Skill</DialogTitle>
            <DialogDescription className="text-zinc-500">
              Define a new skill that can be assigned to agents.
            </DialogDescription>
          </DialogHeader>
          {renderFormFields()}
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setShowCreateDialog(false)}
              className="text-zinc-400"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!formName.trim() || createSkill.isPending}
            >
              {createSkill.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating…
                </>
              ) : (
                "Create Skill"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editingSkill} onOpenChange={(open) => !open && setEditingSkill(null)}>
        <DialogContent className="border-white/10 bg-[#0d1118] text-zinc-100">
          <DialogHeader>
            <DialogTitle>Edit Skill</DialogTitle>
            <DialogDescription className="text-zinc-500">
              Update the skill definition.
            </DialogDescription>
          </DialogHeader>
          {renderFormFields()}
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setEditingSkill(null)}
              className="text-zinc-400"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={!formName.trim() || updateSkill.isPending}
            >
              {updateSkill.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-2xl border-white/10 bg-[#0d1118] text-zinc-100">
          <DialogHeader>
            <DialogTitle>Import Reference Skills</DialogTitle>
            <DialogDescription className="text-zinc-500">
              Select skills from the reference catalog to add to your company.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] space-y-2 overflow-y-auto py-2">
            {REFERENCE_SKILLS.map((ref, index) => {
              const alreadyExists = existingNames.has(ref.name.toLowerCase());
              return (
                <button
                  key={ref.name}
                  type="button"
                  disabled={alreadyExists}
                  onClick={() => toggleImportSelection(index)}
                  className={`w-full rounded-xl border p-3 text-left transition-colors ${
                    alreadyExists
                      ? "cursor-not-allowed border-white/5 bg-zinc-900/30 opacity-50"
                      : selectedImports.has(index)
                        ? "border-blue-500/40 bg-blue-500/5"
                        : "border-white/10 bg-[#080c14] hover:border-white/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-zinc-100">
                        {ref.name}
                        {alreadyExists && (
                          <span className="ml-2 text-xs font-normal text-zinc-500">
                            (already imported)
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-400">{ref.description}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <Badge
                          variant="outline"
                          className={
                            CATEGORY_COLORS[ref.category ?? "general"] ?? CATEGORY_COLORS.general
                          }
                        >
                          {ref.category ?? "general"}
                        </Badge>
                        {ref.prerequisite_integration && (
                          <Badge variant="outline" className="border-yellow-500/20 text-yellow-400">
                            Requires {ref.prerequisite_integration}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {!alreadyExists && (
                      <div
                        className={`mt-1 h-5 w-5 shrink-0 rounded border ${
                          selectedImports.has(index)
                            ? "border-blue-500 bg-blue-500"
                            : "border-white/20"
                        }`}
                      >
                        {selectedImports.has(index) && (
                          <svg viewBox="0 0 20 20" className="h-5 w-5 text-white">
                            <path
                              fill="currentColor"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            />
                          </svg>
                        )}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setShowImportDialog(false)}
              className="text-zinc-400"
            >
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={selectedImports.size === 0 || createSkill.isPending}
            >
              {createSkill.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing…
                </>
              ) : (
                `Import ${selectedImports.size} Skill${selectedImports.size === 1 ? "" : "s"}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
