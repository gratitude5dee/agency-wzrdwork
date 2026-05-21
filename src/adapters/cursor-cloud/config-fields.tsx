import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { AdapterConfigFieldsProps } from "../types";

const schemaFields = ["repoUrl", "repoStartingRef", "repoPullRequestUrl", "runtimeEnvType", "runtimeEnvName"] as const;

export function CursorCloudConfigFields({ isCreate, values, set, config, eff, mark }: AdapterConfigFieldsProps) {
  const schema = values?.adapterSchemaValues ?? {};
  const read = (field: string, fallback = "") =>
    isCreate
      ? String((schema as Record<string, unknown>)[field] ?? (values?.[field as keyof typeof values] ?? fallback))
      : eff("adapterConfig", field, String(config[field] ?? fallback));
  const writeSchema = (field: string, value: unknown) =>
    isCreate ? set?.({ adapterSchemaValues: { ...schema, [field]: value } }) : mark("adapterConfig", field, value || undefined);
  const writeTop = (field: string, value: string) =>
    isCreate ? set?.({ [field]: value } as Record<string, string>) : mark("adapterConfig", field, value || undefined);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="cursor-cloud-repo">Repository URL</Label>
        <Input id="cursor-cloud-repo" value={read("repoUrl")} onChange={(e) => writeSchema("repoUrl", e.target.value)} placeholder="https://github.com/org/repo" className="font-mono text-sm" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {schemaFields.slice(1).map((field) => (
          <div className="space-y-2" key={field}>
            <Label htmlFor={`cursor-cloud-${field}`}>{field}</Label>
            <Input id={`cursor-cloud-${field}`} value={read(field)} onChange={(e) => writeSchema(field, e.target.value)} className="font-mono text-sm" />
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {(["workOnCurrentBranch", "autoCreatePR", "skipReviewerRequest"] as const).map((field) => (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 p-3" key={field}>
            <Label>{field}</Label>
            <Switch checked={read(field) === "true"} onCheckedChange={(v) => writeSchema(field, v)} />
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="cursor-cloud-instructions">Instructions file</Label>
          <Input id="cursor-cloud-instructions" value={read("instructionsFilePath")} onChange={(e) => writeTop("instructionsFilePath", e.target.value)} placeholder="/absolute/path/to/AGENTS.md" className="font-mono text-sm" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cursor-cloud-model">Model</Label>
          <Input id="cursor-cloud-model" value={read("model")} onChange={(e) => writeTop("model", e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="cursor-cloud-env">Environment variables</Label>
        <Textarea id="cursor-cloud-env" value={read("envVars")} onChange={(e) => writeTop("envVars", e.target.value)} placeholder="CURSOR_API_KEY=..." className="min-h-20 font-mono text-sm" />
      </div>
    </div>
  );
}
