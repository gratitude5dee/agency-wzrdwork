import { useState } from "react";
import { LoaderCircle, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAgencyData } from "../lib/useAgencyData";
import type { IssuePriority } from "../lib/domain";

export function NewIssueDialog() {
  const { snapshot, createIssue, isCreatingIssue } = useAgencyData();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeAgentId, setAssigneeAgentId] = useState<string>("unassigned");
  const [projectId, setProjectId] = useState<string>("none");
  const [priority, setPriority] = useState<IssuePriority>("medium");

  async function handleSubmit() {
    if (!title.trim()) {
      toast({
        title: "Issue title required",
        description: "Add a short title before creating a new issue.",
      });
      return;
    }

    await createIssue({
      title: title.trim(),
      description: description.trim(),
      assigneeAgentId: assigneeAgentId === "unassigned" ? null : assigneeAgentId,
      projectId: projectId === "none" ? null : projectId,
      priority,
    });

      toast({
        title: "Issue created",
        description:
          snapshot.source === "server"
            ? "The new issue has been saved."
            : "The new issue was added to the local demo snapshot.",
      });

    setTitle("");
    setDescription("");
    setAssigneeAgentId("unassigned");
    setProjectId("none");
    setPriority("medium");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full justify-start gap-2 rounded-xl bg-white text-black hover:bg-zinc-100">
          <Plus className="h-4 w-4" />
          New Issue
        </Button>
      </DialogTrigger>
      <DialogContent className="border-white/10 bg-[#0a0f18] text-zinc-100 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Create Issue</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Add a new work item for the team.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="issue-title">Title</Label>
            <Input
              id="issue-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="border-white/10 bg-[#101722]"
              placeholder="Wire the cockpit shell into the app"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="issue-description">Description</Label>
            <Textarea
              id="issue-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="min-h-28 border-white/10 bg-[#101722]"
              placeholder="Describe the expected outcome, edge cases, or approval needs."
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="grid gap-2">
              <Label>Assignee</Label>
              <Select value={assigneeAgentId} onValueChange={setAssigneeAgentId}>
                <SelectTrigger className="border-white/10 bg-[#101722]">
                  <SelectValue placeholder="Select agent" />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-[#0f141d] text-zinc-100">
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {snapshot.agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="border-white/10 bg-[#101722]">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-[#0f141d] text-zinc-100">
                  <SelectItem value="none">No project</SelectItem>
                  {snapshot.projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(value) => setPriority(value as IssuePriority)}>
                <SelectTrigger className="border-white/10 bg-[#101722]">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-[#0f141d] text-zinc-100">
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} className="text-zinc-400 hover:text-zinc-100">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isCreatingIssue} className="gap-2 bg-blue-500 text-white hover:bg-blue-400">
            {isCreatingIssue && <LoaderCircle className="h-4 w-4 animate-spin" />}
            Create issue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
