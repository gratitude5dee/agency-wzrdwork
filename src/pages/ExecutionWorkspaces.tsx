import { Plus, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * ExecutionWorkspaces page — manages execution environments and workspaces for agent runs.
 * TODO (M4.2.3): Integrate with compat-client for workspace data.
 */
export function ExecutionWorkspacesPage() {
  // TODO: Load workspaces from compat-client
  const workspaces: Array<{ id: string; name: string; status: string }> = [];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-100">Execution Workspaces</h1>
          <p className="mt-1 text-sm text-zinc-500">Configure and monitor execution environments.</p>
        </div>
        <Button className="gap-2 w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          New Workspace
        </Button>
      </div>

      {/* Workspaces List */}
      {workspaces.length === 0 ? (
        <Card className="border-white/10 bg-[#0d1118]">
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center">
              <Zap className="mx-auto mb-2 h-8 w-8 text-zinc-600" />
              <p className="text-sm text-zinc-400">No execution workspaces configured.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {workspaces.map((workspace) => (
            <div key={workspace.id} className="flex items-center justify-between px-4 py-2 rounded-lg border border-white/10 hover:bg-white/5">
              <div>
                <p className="font-medium text-zinc-200">{workspace.name}</p>
                <p className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  {workspace.status}
                </p>
              </div>
              <Button variant="ghost" size="sm" className="text-xs">View</Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
