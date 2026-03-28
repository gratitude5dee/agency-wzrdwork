import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ComposioToolDiscovery } from "@/components/ComposioToolDiscovery";
import { useComposioConfig } from "@/hooks/useComposioConfig";
import type { AdapterConfigFieldsProps } from "../types";

export function OpenClawGatewayConfigFields({
  isCreate,
  values,
  set,
  config,
  eff,
  mark,
}: AdapterConfigFieldsProps) {
  const { config: composioConfig, isLoading: composioLoading } = useComposioConfig();

  // Read composio tools from adapter config (persisted per-agent)
  const composioToolsFromConfig: string[] = isCreate
    ? ((values as unknown as Record<string, unknown> | null)?.composioTools as string[] ?? [])
    : (() => {
        const raw = eff("adapterConfig", "composioTools", config.composioTools);
        return Array.isArray(raw) ? (raw as string[]) : [];
      })();

  const handleComposioToolsChange = (tools: string[]) => {
    if (isCreate) {
      set?.({ composioTools: tools } as unknown as Partial<typeof values & { composioTools: string[] }>);
    } else {
      mark("adapterConfig", "composioTools", tools.length > 0 ? tools : undefined);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="gatewayUrl">Gateway URL</Label>
        <Input
          id="gatewayUrl"
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
          placeholder="ws://127.0.0.1:18789"
          className="font-mono text-sm"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="payloadTemplateJson">Payload template JSON</Label>
        <Textarea
          id="payloadTemplateJson"
          value={
            isCreate
              ? values?.payloadTemplateJson ?? ""
              : (() => {
                  const val = eff("adapterConfig", "payloadTemplate", config.payloadTemplate);
                  if (typeof val === "object" && val !== null) {
                    try {
                      return JSON.stringify(val, null, 2);
                    } catch {
                      return "";
                    }
                  }
                  return "";
                })()
          }
          onChange={(e) => {
            if (isCreate) {
              set?.({ payloadTemplateJson: e.target.value });
            } else {
              const trimmed = e.target.value.trim();
              if (!trimmed) {
                mark("adapterConfig", "payloadTemplate", undefined);
                return;
              }
              try {
                const parsed = JSON.parse(trimmed);
                if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
                  mark("adapterConfig", "payloadTemplate", parsed);
                }
              } catch {
                // Keep draft until JSON is valid
              }
            }
          }}
          placeholder={`{\n  "agentId": "remote-agent-123"\n}`}
          className="font-mono text-sm min-h-[120px]"
        />
      </div>

      {!isCreate && (
        <>
          <div className="space-y-2">
            <Label htmlFor="sessionStrategy">Session strategy</Label>
            <select
              id="sessionStrategy"
              value={eff("adapterConfig", "sessionKeyStrategy", String(config.sessionKeyStrategy ?? "fixed"))}
              onChange={(e) => mark("adapterConfig", "sessionKeyStrategy", e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="fixed">Fixed</option>
              <option value="issue">Per issue</option>
              <option value="run">Per run</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Input
              id="role"
              value={eff("adapterConfig", "role", String(config.role ?? "operator"))}
              onChange={(e) => mark("adapterConfig", "role", e.target.value || undefined)}
              placeholder="operator"
              className="font-mono text-sm"
            />
          </div>
        </>
      )}

      {/* Composio tool selection — shown when Composio is enabled for the company */}
      {!composioLoading && composioConfig.enabled && composioConfig.consumerKey && (
        <div className="mt-2 rounded-xl border border-white/10 bg-black/20 p-3">
          <ComposioToolDiscovery
            consumerKey={composioConfig.consumerKey}
            mcpUrl={composioConfig.mcpUrl}
            selectedTools={composioToolsFromConfig}
            onSelectionChange={handleComposioToolsChange}
            compact
          />
        </div>
      )}

      {!composioLoading && !composioConfig.enabled && (
        <div className="mt-2 rounded-lg border border-white/5 bg-black/20 p-3 text-xs text-zinc-500">
          <span className="font-semibold text-zinc-400">Composio Tools:</span>{" "}
          Enable Composio on the{" "}
          <span className="text-zinc-300">Integrations</span> page to select
          external tools for this agent.
        </div>
      )}
    </div>
  );
}
