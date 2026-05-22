/**
 * Onboarding Step 1: Company Setup
 *
 * Company name (required), description (optional), auto-filled wallet address.
 * Creates a company through the Paperclip server API on submit.
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Wallet, Globe } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { companiesApi } from "@/api/companies";
import { saveCompanyENSName, preparePrimaryNameTx } from "@/lib/ens";

interface CompanySetupProps {
  walletAddress: string;
  onComplete: (companyId: string) => void;
}

export function CompanySetup({ walletAddress, onComplete }: CompanySetupProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [ensName, setEnsName] = useState("");
  const [showEns, setShowEns] = useState(false);

  const createMutation = useMutation({
    mutationFn: async () => {
      const normalizedWallet = walletAddress.trim().toLowerCase();
      const companies = await companiesApi.list();
      const existing = companies.find((company) => {
        if (!company || typeof company !== "object") return false;
        const record = company as { walletAddress?: unknown; wallet_address?: unknown; id?: unknown };
        const recordWallet = typeof record.walletAddress === "string"
          ? record.walletAddress
          : typeof record.wallet_address === "string"
            ? record.wallet_address
            : null;
        return recordWallet?.trim().toLowerCase() === normalizedWallet && typeof record.id === "string";
      }) as { id: string } | undefined;

      if (existing) {
        const updated = await companiesApi.update(existing.id, {
          name,
          description: description || null,
          walletAddress,
        });
        return updated as { id: string };
      }

      const created = await companiesApi.create({
        name,
        description: description || null,
        walletAddress,
      });
      return created as { id: string };
    },
    onSuccess: async (data) => {
      // Upsert the user_onboarding row — check if one already exists
      const { data: existingOnboarding } = await supabase
        .from("user_onboarding")
        .select("id")
        .eq("wallet_address", walletAddress)
        .maybeSingle();

      if (existingOnboarding) {
        await supabase
          .from("user_onboarding")
          .update({
            company_id: data.id,
            current_step: 1,
            onboarding_completed: false,
            metadata: {},
          })
          .eq("wallet_address", walletAddress);
      } else {
        await supabase.from("user_onboarding").insert({
          wallet_address: walletAddress,
          company_id: data.id,
          current_step: 1,
          onboarding_completed: false,
          metadata: {},
        });
      }
      // Save ENS name if provided
      if (ensName.trim()) {
        try {
          await saveCompanyENSName(data.id, ensName.trim(), "base");
          // Prepare the ENS primary name tx for later signing
          const prepared = preparePrimaryNameTx({
            ensName: ensName.trim(),
            chain: "base",
            walletAddress,
          });
          // Store prepared tx in session for later wallet signing
          sessionStorage.setItem("ens_prepared_tx", JSON.stringify(prepared));
        } catch {
          // ENS save is non-blocking — company creation still succeeds
          console.warn("Failed to save ENS name, continuing with onboarding");
        }
      }
      queryClient.invalidateQueries({ queryKey: ["user-onboarding"] });
      queryClient.invalidateQueries({ queryKey: ["agency-snapshot"] });
      toast.success(ensName.trim() ? "Company created with ENS identity!" : "Company created!");
      onComplete(data.id);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to create company");
    },
  });

  const canSubmit = name.trim().length > 0 && !createMutation.isPending;

  return (
    <Card className="mx-auto w-full max-w-lg border-white/10 bg-[#0d1118]">
      <CardHeader className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-[#080c14]">
          <Building2 className="h-6 w-6 text-blue-400" />
        </div>
        <CardTitle className="text-xl text-zinc-100">Set up your company</CardTitle>
        <CardDescription className="text-zinc-500">
          Create your agent company to get started.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Company name (required) */}
        <div className="space-y-2">
          <Label htmlFor="company-name" className="text-zinc-300">
            Company Name <span className="text-red-400">*</span>
          </Label>
          <Input
            id="company-name"
            required
            placeholder="e.g. Acme AI Labs"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border-white/10 bg-[#080c14] text-zinc-200 placeholder:text-zinc-600"
          />
        </div>

        {/* Description (optional) */}
        <div className="space-y-2">
          <Label htmlFor="company-description" className="text-zinc-300">
            Description
          </Label>
          <Textarea
            id="company-description"
            placeholder="What does your company do?"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="border-white/10 bg-[#080c14] text-zinc-200 placeholder:text-zinc-600"
          />
        </div>

        {/* Auto-filled wallet address */}
        <div className="space-y-2">
          <Label className="text-zinc-300">
            <Wallet className="mr-1 inline h-3 w-3" />
            Wallet Address
          </Label>
          <Input
            readOnly
            value={walletAddress}
            className="border-white/10 bg-[#080c14] text-zinc-500 font-mono text-xs"
          />
          <p className="text-[11px] text-zinc-600">
            Auto-filled from your connected wallet.
          </p>
        </div>

        {/* ENS Name (optional) */}
        <div className="space-y-2">
          {!showEns ? (
            <button
              type="button"
              onClick={() => setShowEns(true)}
              className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              <Globe className="h-3.5 w-3.5" />
              Register company name on ENS
            </button>
          ) : (
            <>
              <Label htmlFor="ens-name" className="text-zinc-300">
                <Globe className="mr-1 inline h-3 w-3" />
                ENS Name (optional)
              </Label>
              <Input
                id="ens-name"
                placeholder="e.g. mycompany.eth"
                value={ensName}
                onChange={(e) => setEnsName(e.target.value)}
                className="border-white/10 bg-[#080c14] text-zinc-200 placeholder:text-zinc-600"
              />
              <p className="text-[11px] text-zinc-600">
                Set your company's ENS primary name on Base. This creates a human-readable
                identity for your agent company onchain. You must already own this name.
              </p>
            </>
          )}
        </div>

        <Button
          onClick={() => createMutation.mutate()}
          disabled={!canSubmit}
          className="w-full"
        >
          {createMutation.isPending ? "Creating…" : "Create Company"}
        </Button>
      </CardContent>
    </Card>
  );
}
