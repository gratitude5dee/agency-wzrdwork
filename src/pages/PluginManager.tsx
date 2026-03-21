import { Puzzle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * PluginManager page — manages installed and available plugins for the agency.
 * TODO (M4.2.3): Integrate with compat-client for plugin data.
 */
export function PluginManagerPage() {
  // TODO: Load plugins from compat-client
  const installedPlugins: Array<{ id: string; name: string; version: string; enabled: boolean }> = [];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-100">Plugin Manager</h1>
          <p className="mt-1 text-sm text-zinc-500">Install and manage plugins for your agency.</p>
        </div>
        <Button className="gap-2 w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          Browse Plugins
        </Button>
      </div>

      {/* Installed Plugins List */}
      {installedPlugins.length === 0 ? (
        <Card className="border-white/10 bg-[#0d1118]">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Puzzle className="mb-4 h-12 w-12 text-zinc-600" />
            <p className="text-center text-zinc-400">No plugins installed yet.</p>
            <Button className="mt-4" variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Install Plugin
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {installedPlugins.map((plugin) => (
            <Card key={plugin.id} className="border-white/10 bg-[#0d1118]">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-zinc-100">{plugin.name}</CardTitle>
                    <CardDescription>v{plugin.version}</CardDescription>
                  </div>
                  <div className={`h-2 w-2 rounded-full ${plugin.enabled ? "bg-green-500" : "bg-zinc-600"}`} />
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
