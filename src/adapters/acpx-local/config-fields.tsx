import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { AdapterConfigFieldsProps } from "../types";

export function AcpxLocalConfigFields({ isCreate, values, set, config, eff, mark }: AdapterConfigFieldsProps) {
  const schema = values?.adapterSchemaValues ?? {};
  const readSchema = (field: string, fallback = "") =>
    isCreate ? String(schema[field] ?? fallback) : eff("adapterConfig", field, String(config[field] ?? fallback));
  const writeSchema = (field: string, value: unknown) =>
    isCreate ? set?.({ adapterSchemaValues: { ...schema, [field]: value } }) : mark("adapterConfig", field, value || undefined);
  const readTop = (field: string, fallback = "") =>
    isCreate ? String(values?.[field as keyof typeof values] ?? fallback) : eff("adapterConfig", field, String(config[field] ?? fallback));
  const writeTop = (field: string, value: string) =>
    isCreate ? set?.({ [field]: value } as Record<string, string>) : mark("adapterConfig", field, value || undefined);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label>ACP agent</Label>
          <Select value={readSchema("agent", "claude")} onValueChange={(v) => writeSchema("agent", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="claude">Claude via ACPX</SelectItem>
              <SelectItem value="codex">Codex via ACPX</SelectItem>
              <SelectItem value="custom">Custom ACP command</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Mode</Label>
          <Select value={readSchema("mode", "persistent")} onValueChange={(v) => writeSchema("mode", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="persistent">persistent</SelectItem>
              <SelectItem value="oneshot">oneshot</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Permissions</Label>
          <Select value={readSchema("permissionMode", "approve-all")} onValueChange={(v) => writeSchema("permissionMode", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="approve-all">approve-all</SelectItem>
              <SelectItem value="ask">ask</SelectItem>
              <SelectItem value="deny-all">deny-all</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="acpx-command">Agent command</Label>
          <Input id="acpx-command" value={readSchema("agentCommand")} onChange={(e) => writeSchema("agentCommand", e.target.value)} placeholder="custom ACP command" className="font-mono text-sm" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="acpx-state">State directory</Label>
          <Input id="acpx-state" value={readSchema("stateDir")} onChange={(e) => writeSchema("stateDir", e.target.value)} placeholder="Paperclip-managed by default" className="font-mono text-sm" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="acpx-instructions">Instructions file</Label>
          <Input id="acpx-instructions" value={readTop("instructionsFilePath")} onChange={(e) => writeTop("instructionsFilePath", e.target.value)} placeholder="/absolute/path/to/AGENTS.md" className="font-mono text-sm" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="acpx-model">Model</Label>
          <Input id="acpx-model" value={readTop("model")} onChange={(e) => writeTop("model", e.target.value)} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="acpx-effort">Effort</Label>
          <Input id="acpx-effort" value={readTop("thinkingEffort", "medium")} onChange={(e) => writeTop("thinkingEffort", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="acpx-timeout">Timeout seconds</Label>
          <Input id="acpx-timeout" type="number" min={0} value={readSchema("timeoutSec", "0")} onChange={(e) => writeSchema("timeoutSec", e.target.value)} />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 p-3">
          <Label>Fast mode</Label>
          <Switch checked={readSchema("fastMode") === "true"} onCheckedChange={(v) => writeSchema("fastMode", v)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="acpx-env">Environment variables</Label>
        <Textarea id="acpx-env" value={readTop("envVars")} onChange={(e) => writeTop("envVars", e.target.value)} placeholder="ANTHROPIC_API_KEY=..." className="min-h-20 font-mono text-sm" />
      </div>
    </div>
  );
}
