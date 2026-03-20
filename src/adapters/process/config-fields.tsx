import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AdapterConfigFieldsProps } from "../types";

function formatArgList(value: unknown): string {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string").join(", ");
  }
  return typeof value === "string" ? value : "";
}

export function ProcessConfigFields({
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
        <Label htmlFor="command">Command</Label>
        <Input
          id="command"
          value={
            isCreate
              ? values?.command ?? ""
              : eff("adapterConfig", "command", String(config.command ?? ""))
          }
          onChange={(e) =>
            isCreate
              ? set?.({ command: e.target.value })
              : mark("adapterConfig", "command", e.target.value || undefined)
          }
          placeholder="e.g. node, python"
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">The command to execute.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="args">Args (comma-separated)</Label>
        <Input
          id="args"
          value={
            isCreate
              ? values?.args ?? ""
              : eff("adapterConfig", "args", formatArgList(config.args))
          }
          onChange={(e) => {
            if (isCreate) {
              set?.({ args: e.target.value });
            } else {
              const parsed = e.target.value
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean);
              mark("adapterConfig", "args", parsed.length > 0 ? parsed : undefined);
            }
          }}
          placeholder="e.g. script.js, --flag"
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">Command-line arguments, comma-separated.</p>
      </div>
    </div>
  );
}
