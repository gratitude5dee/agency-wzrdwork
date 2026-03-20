import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { AdapterConfigFieldsProps } from "../types";

export function CodexLocalConfigFields({
  isCreate,
  values,
  set,
  config,
  eff,
  mark,
}: AdapterConfigFieldsProps) {
  const bypassEnabled =
    config.dangerouslyBypassApprovalsAndSandbox === true || config.dangerouslyBypassSandbox === true;

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
          <Label>Bypass sandbox</Label>
          <p className="text-xs text-muted-foreground">
            Run with bypass approvals and sandbox flag
          </p>
        </div>
        <Switch
          checked={
            isCreate
              ? values?.dangerouslyBypassSandbox ?? false
              : eff("adapterConfig", "dangerouslyBypassApprovalsAndSandbox", bypassEnabled)
          }
          onCheckedChange={(v) =>
            isCreate
              ? set?.({ dangerouslyBypassSandbox: v })
              : mark("adapterConfig", "dangerouslyBypassApprovalsAndSandbox", v)
          }
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>Enable search</Label>
          <p className="text-xs text-muted-foreground">Run Codex with --search</p>
        </div>
        <Switch
          checked={
            isCreate ? values?.search ?? false : eff("adapterConfig", "search", !!config.search)
          }
          onCheckedChange={(v) =>
            isCreate ? set?.({ search: v }) : mark("adapterConfig", "search", v)
          }
        />
      </div>
    </div>
  );
}
