/**
 * Onboarding Step 2: CEO Agent Creation
 *
 * Agent name (default 'CEO'), system prompt textarea, goals multi-input,
 * operational parameters (spend limit, budget cap, authority level).
 * Creates agent with role='ceo', reports_to=null.
 * Auto-creates ERC-8004 identity.
 */

import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bot, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { createAgentIdentity, isPlaceholderWallet } from "@/lib/erc8004/identity";
import type { Json } from "@/integrations/supabase/types";

interface CeoAgentCreationProps {
  companyId: string;
  walletAddress: string;
  onComplete: (agentId: string) => void;
}

const AUTHORITY_LEVELS = [
  { value: "autonomous", label: "Autonomous" },
  { value: "approval-required", label: "Approval Required" },
  { value: "human-only", label: "Human Only" },
];

export function CeoAgentCreation({ companyId, walletAddress, onComplete }: CeoAgentCreationProps) {
  const queryClient = useQueryClient();
  const [agentName, setAgentName] = useState("CEO");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [goals, setGoals] = useState<string[]>([]);
  const [goalInput, setGoalInput] = useState("");
  const [spendLimit, setSpendLimit] = useState("");
  const [budgetCap, setBudgetCap] = useState("");
  const [authorityLevel, setAuthorityLevel] = useState("autonomous");

  const addGoal = useCallback(() => {
    const trimmed = goalInput.trim();
    if (trimmed && !goals.includes(trimmed)) {
      setGoals((prev) => [...prev, trimmed]);
      setGoalInput("");
    }
  }, [goalInput, goals]);

  const removeGoal = useCallback((index: number) => {
    setGoals((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleGoalKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addGoal();
      }
    },
    [addGoal],
  );

  const createMutation = useMutation({
    mutationFn: async () => {
      const adapterConfig: Record<string, unknown> = {
        system_prompt: systemPrompt,
        goals,
        operational_parameters: {
          spend_limit_usdc: spendLimit ? parseFloat(spendLimit) : null,
          budget_cap_usdc: budgetCap ? parseFloat(budgetCap) : null,
          authority_level: authorityLevel,
        },
      };

      const { data, error } = await supabase
        .from("agents")
        .insert({
          company_id: companyId,
          name: agentName,
          role: "ceo",
          reports_to: null,
          adapter_type: "claude_local",
          adapter_config: adapterConfig as unknown as Json,
          status: "idle",
          title: "Chief Executive Officer",
        })
        .select("id")
        .single();

      if (error) throw error;
      return data as { id: string };
    },
    onSuccess: async (data) => {
      // Auto-create ERC-8004 identity with the real company wallet
      if (!isPlaceholderWallet(walletAddress)) {
        try {
          await createAgentIdentity(data.id, companyId, walletAddress);
        } catch (err) {
          console.warn(
            "[Onboarding] ERC-8004 identity auto-creation failed; can be retried later.",
            err instanceof Error ? err.message : err,
          );
        }
      } else {
        console.warn(
          "[Onboarding] ERC-8004 identity skipped: wallet address is a placeholder.",
        );
      }

      queryClient.invalidateQueries({ queryKey: ["agents-list"] });
      queryClient.invalidateQueries({ queryKey: ["agents-picker"] });
      queryClient.invalidateQueries({ queryKey: ["agency-snapshot"] });
      queryClient.invalidateQueries({ queryKey: ["sidebar-agents"] });
      toast.success("CEO agent created!");
      onComplete(data.id);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to create agent");
    },
  });

  const canSubmit = agentName.trim().length > 0 && !createMutation.isPending;

  return (
    <Card className="mx-auto w-full max-w-lg border-white/10 bg-[#0d1118]">
      <CardHeader className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-[#080c14]">
          <Bot className="h-6 w-6 text-emerald-400" />
        </div>
        <CardTitle className="text-xl text-zinc-100">Create your CEO agent</CardTitle>
        <CardDescription className="text-zinc-500">
          Your CEO agent oversees all operations. You can customize it or accept defaults.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Agent name */}
        <div className="space-y-2">
          <Label htmlFor="agent-name" className="text-zinc-300">
            Agent Name <span className="text-red-400">*</span>
          </Label>
          <Input
            id="agent-name"
            placeholder="CEO"
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            className="border-white/10 bg-[#080c14] text-zinc-200 placeholder:text-zinc-600"
          />
        </div>

        {/* System prompt */}
        <div className="space-y-2">
          <Label htmlFor="system-prompt" className="text-zinc-300">
            System Prompt
          </Label>
          <Textarea
            id="system-prompt"
            placeholder="You are an autonomous CEO agent responsible for overseeing company operations..."
            rows={3}
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            className="border-white/10 bg-[#080c14] text-zinc-200 placeholder:text-zinc-600"
          />
        </div>

        {/* Goals multi-input */}
        <div className="space-y-2">
          <Label className="text-zinc-300">Goals</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Add a goal and press Enter"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              onKeyDown={handleGoalKeyDown}
              className="border-white/10 bg-[#080c14] text-zinc-200 placeholder:text-zinc-600"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={addGoal}
              className="border-white/10 shrink-0"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {goals.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {goals.map((goal, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-[#080c14] px-3 py-1 text-xs text-zinc-300"
                >
                  {goal}
                  <button
                    type="button"
                    onClick={() => removeGoal(i)}
                    className="ml-1 text-zinc-500 hover:text-zinc-300"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Operational parameters */}
        <div className="space-y-3 rounded-xl border border-white/10 bg-[#080c14] p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-500">
            Operational Parameters
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="spend-limit" className="text-xs text-zinc-400">
                Spend Limit (USDC)
              </Label>
              <Input
                id="spend-limit"
                type="number"
                min="0"
                step="0.01"
                placeholder="100.00"
                value={spendLimit}
                onChange={(e) => setSpendLimit(e.target.value)}
                className="border-white/10 bg-[#0d1118] text-zinc-200 placeholder:text-zinc-600"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="budget-cap" className="text-xs text-zinc-400">
                Budget Cap (USDC)
              </Label>
              <Input
                id="budget-cap"
                type="number"
                min="0"
                step="0.01"
                placeholder="1000.00"
                value={budgetCap}
                onChange={(e) => setBudgetCap(e.target.value)}
                className="border-white/10 bg-[#0d1118] text-zinc-200 placeholder:text-zinc-600"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-400">Authority Level</Label>
            <Select value={authorityLevel} onValueChange={setAuthorityLevel}>
              <SelectTrigger className="border-white/10 bg-[#0d1118] text-zinc-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUTHORITY_LEVELS.map((level) => (
                  <SelectItem key={level.value} value={level.value}>
                    {level.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          onClick={() => createMutation.mutate()}
          disabled={!canSubmit}
          className="w-full"
        >
          {createMutation.isPending ? "Creating Agent…" : "Create CEO Agent"}
        </Button>
      </CardContent>
    </Card>
  );
}
