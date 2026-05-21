import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AdapterConfigFieldsProps } from "../types";

export function GrokLocalConfigFields({ isCreate, values, set, config, eff, mark }: AdapterConfigFieldsProps) {
  const read = (field: string, fallback = "") =>
    isCreate ? String(values?.[field as keyof typeof values] ?? fallback) : eff("adapterConfig", field, String(config[field] ?? fallback));
  const write = (field: string, value: string) =>
    isCreate ? set?.({ [field]: value } as Record<string, string>) : mark("adapterConfig", field, value || undefined);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="grok-instructions">Agent instructions file</Label>
        <Input id="grok-instructions" value={read("instructionsFilePath")} onChange={(e) => write("instructionsFilePath", e.target.value)} placeholder="/absolute/path/to/AGENTS.md" className="font-mono text-sm" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="grok-model">Model</Label>
          <Input id="grok-model" value={read("model", "grok-build")} onChange={(e) => write("model", e.target.value)} placeholder="grok-build" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="grok-effort">Reasoning effort</Label>
          <Input id="grok-effort" value={read("thinkingEffort", "medium")} onChange={(e) => write("thinkingEffort", e.target.value)} placeholder="medium" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="grok-command">Command override</Label>
          <Input id="grok-command" value={read("command")} onChange={(e) => write("command", e.target.value)} placeholder="grok" className="font-mono text-sm" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="grok-extra-args">Extra args</Label>
          <Input id="grok-extra-args" value={read("extraArgs")} onChange={(e) => write("extraArgs", e.target.value)} placeholder="--flag, value" className="font-mono text-sm" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="grok-env">Environment variables</Label>
        <Textarea id="grok-env" value={read("envVars")} onChange={(e) => write("envVars", e.target.value)} placeholder="GROK_API_KEY=..." className="min-h-20 font-mono text-sm" />
      </div>
    </div>
  );
}
