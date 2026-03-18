/**
 * Onboarding Step 3: Agent Harness Selector
 *
 * Cards for each adapter type showing name, description, and strengths.
 * Clicking selects and updates agents.adapter_type for the CEO agent.
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Cpu } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { adapterRegistry } from "@/adapters/registry";
import { buildDefaultConfigValues } from "@/adapters/defaults";
import type { Json } from "@/integrations/supabase/types";

interface AgentHarnessSelectorProps {
  agentId: string;
  onComplete: () => void;
}

interface AdapterOption {
  type: string;
  name: string;
  description: string;
  strengths: string[];
}

const ADAPTER_OPTIONS: AdapterOption[] = [
  {
    type: "claude_local",
    name: "Claude (Local)",
    description: "Anthropic's Claude running as a local code agent via Claude Code CLI.",
    strengths: ["Deep reasoning", "Long context", "Code generation"],
  },
  {
    type: "codex_local",
    name: "Codex (Local)",
    description: "OpenAI Codex agent running locally for code generation and editing.",
    strengths: ["Fast inference", "Code completion", "Multi-file edits"],
  },
  {
    type: "cursor",
    name: "Cursor",
    description: "Cursor IDE agent with integrated AI-powered code editing.",
    strengths: ["IDE integration", "Smart refactoring", "Context awareness"],
  },
  {
    type: "gemini_local",
    name: "Gemini (Local)",
    description: "Google's Gemini model running locally for multi-modal tasks.",
    strengths: ["Multi-modal", "Large context window", "Fast reasoning"],
  },
  {
    type: "opencode_local",
    name: "OpenCode (Local)",
    description: "Open-source code agent with configurable model backends.",
    strengths: ["Open source", "Custom models", "Self-hosted"],
  },
  {
    type: "pi_local",
    name: "Pi (Local)",
    description: "Inflection Pi agent for conversational and task-oriented interactions.",
    strengths: ["Conversational", "Task planning", "Natural language"],
  },
  {
    type: "openclaw_gateway",
    name: "OpenClaw Gateway",
    description: "Gateway adapter routing through OpenClaw's managed inference.",
    strengths: ["Managed service", "Load balancing", "Multiple models"],
  },
  {
    type: "process",
    name: "Process",
    description: "Generic process adapter for running custom CLI-based agents.",
    strengths: ["Flexible", "Any CLI tool", "Custom scripts"],
  },
  {
    type: "http",
    name: "HTTP",
    description: "HTTP adapter for connecting to remote agent APIs.",
    strengths: ["Remote APIs", "Microservices", "Any language"],
  },
  {
    type: "hermes",
    name: "Hermes Agent",
    description: "Hermes multi-tool agent with MCP server support and memory modes.",
    strengths: ["Multi-tool", "MCP support", "Memory modes"],
  },
];

export function AgentHarnessSelector({ agentId, onComplete }: AgentHarnessSelectorProps) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string>("claude_local");

  const updateMutation = useMutation({
    mutationFn: async () => {
      // Build adapter config from the registry so the agent has a valid
      // runtime config for the selected adapter (especially important for
      // adapters like Hermes that carry their own config shape).
      const adapterModule = adapterRegistry.get(selected);
      const defaultValues = buildDefaultConfigValues(selected);
      const adapterConfig = adapterModule
        ? adapterModule.buildAdapterConfig(defaultValues)
        : {};

      const { error } = await supabase
        .from("agents")
        .update({
          adapter_type: selected,
          adapter_config: adapterConfig as unknown as Json,
        })
        .eq("id", agentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents-list"] });
      queryClient.invalidateQueries({ queryKey: ["agency-snapshot"] });
      queryClient.invalidateQueries({ queryKey: ["agent-detail"] });
      toast.success(`Adapter updated to ${ADAPTER_OPTIONS.find((a) => a.type === selected)?.name ?? selected}`);
      onComplete();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to update adapter");
    },
  });

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-[#080c14]">
          <Cpu className="h-6 w-6 text-purple-400" />
        </div>
        <h2 className="text-xl font-bold text-zinc-100">Choose a harness adapter</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Select the AI harness your CEO agent will use. You can change this later.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ADAPTER_OPTIONS.map((adapter) => (
          <Card
            key={adapter.type}
            role="button"
            tabIndex={0}
            onClick={() => setSelected(adapter.type)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setSelected(adapter.type);
              }
            }}
            className={cn(
              "cursor-pointer border-white/10 bg-[#0d1118] transition-colors hover:border-white/20",
              selected === adapter.type && "border-blue-500/60 bg-blue-500/5 ring-1 ring-blue-500/30",
            )}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <CardTitle className="text-sm text-zinc-100">{adapter.name}</CardTitle>
                {selected === adapter.type && (
                  <Check className="h-4 w-4 shrink-0 text-blue-400" />
                )}
              </div>
              <CardDescription className="text-xs text-zinc-500">
                {adapter.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-1">
                {adapter.strengths.map((s) => (
                  <span
                    key={s}
                    className="rounded-full border border-white/10 bg-[#080c14] px-2 py-0.5 text-[10px] text-zinc-400"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-center">
        <Button
          onClick={() => updateMutation.mutate()}
          disabled={updateMutation.isPending}
          className="min-w-[200px]"
        >
          {updateMutation.isPending ? "Updating…" : "Confirm Selection"}
        </Button>
      </div>
    </div>
  );
}
