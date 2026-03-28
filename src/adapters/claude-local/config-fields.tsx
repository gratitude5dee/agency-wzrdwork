import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { AdapterConfigFieldsProps } from "../types";

export function ClaudeLocalConfigFields({
  isCreate,
  values,
  set,
  config,
  eff,
  mark,
}: AdapterConfigFieldsProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="instructionsFilePath">Agent instructions file</Label>
        <Input
          id="instructionsFilePath"
          value={
            isCreate
              ? values?.instructionsFilePath ?? ""
              : eff("adapterConfig", "instructionsFilePath", String(config.instructionsFilePath ?? ""))
          }
          onChange={(e) =>
            isCreate
              ? set?.({ instructionsFilePath: e.target.value })
              : mark("adapterConfig", "instructionsFilePath", e.target.value || undefined)
          }
          placeholder="/absolute/path/to/AGENTS.md"
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Absolute path to a markdown file that defines this agent's behavior.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>Enable Chrome</Label>
          <p className="text-xs text-muted-foreground">Pass --chrome when running Claude</p>
        </div>
        <Switch
          checked={
            isCreate
              ? values?.chrome ?? false
              : eff("adapterConfig", "chrome", config.chrome === true)
          }
          onCheckedChange={(v) =>
            isCreate ? set?.({ chrome: v }) : mark("adapterConfig", "chrome", v)
          }
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>Skip permissions</Label>
          <p className="text-xs text-muted-foreground">
            Pass --dangerously-skip-permissions to Claude
          </p>
        </div>
        <Switch
          checked={
            isCreate
              ? values?.dangerouslySkipPermissions ?? false
              : eff("adapterConfig", "dangerouslySkipPermissions", config.dangerouslySkipPermissions !== false)
          }
          onCheckedChange={(v) =>
            isCreate
              ? set?.({ dangerouslySkipPermissions: v })
              : mark("adapterConfig", "dangerouslySkipPermissions", v)
          }
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="maxTurnsPerRun">Max turns per run</Label>
        <Input
          id="maxTurnsPerRun"
          type="number"
          value={
            isCreate
              ? values?.maxTurnsPerRun ?? 300
              : eff("adapterConfig", "maxTurnsPerRun", Number(config.maxTurnsPerRun ?? 300))
          }
          onChange={(e) =>
            isCreate
              ? set?.({ maxTurnsPerRun: Number(e.target.value) })
              : mark("adapterConfig", "maxTurnsPerRun", Number(e.target.value) || 300)
          }
          className="font-mono text-sm"
        />
      </div>
    </div>
  );
}
