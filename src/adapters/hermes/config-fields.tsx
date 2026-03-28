import { useCallback } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AdapterConfigFieldsProps } from "../types";
import {
  HERMES_MODELS,
  HERMES_PROVIDERS,
  HERMES_TOOLSETS,
  HERMES_MEMORY_MODES,
  getHermesExtras,
  setHermesExtras,
  type McpServerEntry,
} from "./build-config";

export function HermesConfigFields({
  isCreate,
  values,
  set,
  config,
  eff,
  mark,
}: AdapterConfigFieldsProps) {
  // ── Create mode helpers ──
  const extras = values ? getHermesExtras(values) : null;

  const updateExtras = useCallback(
    (patch: Record<string, unknown>) => {
      if (isCreate && set && values) {
        setHermesExtras(set, values, patch);
      }
    },
    [isCreate, set, values],
  );

  // ── Read helpers (edit mode) ──
  const readModel = () =>
    isCreate
      ? extras?.hermesModel ?? ""
      : eff("adapterConfig", "model", String(config.model ?? ""));

  const readProvider = () =>
    isCreate
      ? extras?.hermesProvider ?? "auto"
      : eff("adapterConfig", "provider", String(config.provider ?? "auto"));

  const readToolsets = (): string[] =>
    isCreate
      ? extras?.enabledToolsets ?? []
      : (() => {
          const val = eff("adapterConfig", "enabled_toolsets", config.enabled_toolsets);
          return Array.isArray(val) ? (val as string[]) : [];
        })();

  const readMemoryMode = () =>
    isCreate
      ? extras?.memoryMode ?? "local"
      : eff("adapterConfig", "memory_mode", String(config.memory_mode ?? "local"));

  const readMcpServers = (): McpServerEntry[] =>
    isCreate
      ? extras?.mcpServers ?? []
      : (() => {
          const val = eff("adapterConfig", "mcp_servers", config.mcp_servers);
          return Array.isArray(val) ? (val as McpServerEntry[]) : [];
        })();

  // ── Toolset toggle ──
  const toggleToolset = (toolset: string, checked: boolean) => {
    const current = readToolsets();
    const next = checked
      ? [...current, toolset]
      : current.filter((t) => t !== toolset);

    if (isCreate) {
      updateExtras({ enabledToolsets: next });
    } else {
      mark("adapterConfig", "enabled_toolsets", next);
    }
  };

  // ── MCP servers ──
  const addMcpServer = () => {
    const current = readMcpServers();
    const next = [...current, { name: "", url: "" }];
    if (isCreate) {
      updateExtras({ mcpServers: next });
    } else {
      mark("adapterConfig", "mcp_servers", next);
    }
  };

  const updateMcpServer = (index: number, field: "name" | "url", value: string) => {
    const current = readMcpServers();
    const next = current.map((s, i) => (i === index ? { ...s, [field]: value } : s));
    if (isCreate) {
      updateExtras({ mcpServers: next });
    } else {
      mark("adapterConfig", "mcp_servers", next);
    }
  };

  const removeMcpServer = (index: number) => {
    const current = readMcpServers();
    const next = current.filter((_, i) => i !== index);
    if (isCreate) {
      updateExtras({ mcpServers: next });
    } else {
      mark("adapterConfig", "mcp_servers", next);
    }
  };

  return (
    <div className="space-y-5">
      {/* ── Model selector ── */}
      <div className="space-y-2">
        <Label htmlFor="hermes-model">Model</Label>
        <Select
          value={readModel()}
          onValueChange={(v) =>
            isCreate ? updateExtras({ hermesModel: v }) : mark("adapterConfig", "model", v)
          }
        >
          <SelectTrigger id="hermes-model">
            <SelectValue placeholder="Select a model" />
          </SelectTrigger>
          <SelectContent>
            {HERMES_MODELS.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Primary LLM model used by the Hermes agent.
        </p>
      </div>

      {/* ── Provider dropdown ── */}
      <div className="space-y-2">
        <Label htmlFor="hermes-provider">Provider</Label>
        <Select
          value={readProvider()}
          onValueChange={(v) =>
            isCreate ? updateExtras({ hermesProvider: v }) : mark("adapterConfig", "provider", v)
          }
        >
          <SelectTrigger id="hermes-provider">
            <SelectValue placeholder="Select a provider" />
          </SelectTrigger>
          <SelectContent>
            {HERMES_PROVIDERS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          API provider for model inference routing.
        </p>
      </div>

      {/* ── Toolsets multi-select checkboxes ── */}
      <div className="space-y-2">
        <Label>Enabled Toolsets</Label>
        <div className="grid grid-cols-2 gap-2">
          {HERMES_TOOLSETS.map((ts) => {
            const checked = readToolsets().includes(ts.value);
            return (
              <label
                key={ts.value}
                className="flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm hover:bg-white/5 cursor-pointer"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(c) => toggleToolset(ts.value, c === true)}
                />
                <span>{ts.label}</span>
              </label>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Tool categories available to the Hermes agent.
        </p>
      </div>

      {/* ── Memory mode dropdown ── */}
      <div className="space-y-2">
        <Label htmlFor="hermes-memory">Memory Mode</Label>
        <Select
          value={readMemoryMode()}
          onValueChange={(v) =>
            isCreate ? updateExtras({ memoryMode: v }) : mark("adapterConfig", "memory_mode", v)
          }
        >
          <SelectTrigger id="hermes-memory">
            <SelectValue placeholder="Select memory mode" />
          </SelectTrigger>
          <SelectContent>
            {HERMES_MEMORY_MODES.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          How the agent persists memory across sessions.
        </p>
      </div>

      {/* ── MCP servers configuration ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>MCP Servers</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs border-white/10"
            onClick={addMcpServer}
          >
            <Plus className="h-3 w-3" />
            Add Server
          </Button>
        </div>

        {readMcpServers().length === 0 && (
          <p className="text-xs text-muted-foreground">
            No MCP servers configured. Add external tool servers for extended capabilities.
          </p>
        )}

        <div className="space-y-2">
          {readMcpServers().map((server, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input
                placeholder="Server name"
                value={server.name}
                onChange={(e) => updateMcpServer(idx, "name", e.target.value)}
                className="flex-1 text-sm"
              />
              <Input
                placeholder="https://server-url.example.com"
                value={server.url}
                onChange={(e) => updateMcpServer(idx, "url", e.target.value)}
                className="flex-[2] text-sm font-mono"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-zinc-500 hover:text-red-400"
                onClick={() => removeMcpServer(idx)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Max turns ── */}
      <div className="space-y-2">
        <Label htmlFor="hermes-max-turns">Max Turns per Run</Label>
        <Input
          id="hermes-max-turns"
          type="number"
          value={
            isCreate
              ? values?.maxTurnsPerRun ?? 90
              : eff("adapterConfig", "max_turns", Number(config.max_turns ?? 90))
          }
          onChange={(e) =>
            isCreate
              ? set?.({ maxTurnsPerRun: Number(e.target.value) })
              : mark("adapterConfig", "max_turns", Number(e.target.value) || 90)
          }
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Maximum tool-calling iterations per conversation (default: 90).
        </p>
      </div>
    </div>
  );
}
