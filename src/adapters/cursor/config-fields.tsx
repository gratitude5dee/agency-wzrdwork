import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AdapterConfigFieldsProps } from "../types";

export function CursorLocalConfigFields({
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
    </div>
  );
}
