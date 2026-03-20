import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AdapterConfigFieldsProps } from "../types";

export function HttpConfigFields({
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
        <Label htmlFor="webhookUrl">Webhook URL</Label>
        <Input
          id="webhookUrl"
          value={
            isCreate
              ? values?.url ?? ""
              : eff("adapterConfig", "url", String(config.url ?? ""))
          }
          onChange={(e) =>
            isCreate
              ? set?.({ url: e.target.value })
              : mark("adapterConfig", "url", e.target.value || undefined)
          }
          placeholder="https://..."
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          HTTP endpoint to receive webhook payloads.
        </p>
      </div>
    </div>
  );
}
