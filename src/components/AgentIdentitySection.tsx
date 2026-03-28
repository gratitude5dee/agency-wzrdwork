/**
 * ERC-8004 Identity Section
 *
 * Displays the ERC-8004 agent identity information on the agent detail page,
 * including the manifest content (formatted JSON), registration status,
 * operator wallet, and a download button for the agent.json manifest.
 */

import { useState } from "react";
import { Fingerprint, CheckCircle, XCircle, Loader2, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAgentIdentity } from "@/hooks/useAgentIdentity";
import { getAgentManifestJson, triggerJsonDownload } from "@/lib/erc8004/download";
import { toast } from "sonner";
import type { AgentManifest } from "@/lib/erc8004/types";

interface AgentIdentitySectionProps {
  agentId: string;
}

function truncateWallet(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function AgentIdentitySection({ agentId }: AgentIdentitySectionProps) {
  const { data: identity, isLoading } = useAgentIdentity(agentId);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadManifest = async () => {
    setIsDownloading(true);
    try {
      const manifest = await getAgentManifestJson(agentId);
      triggerJsonDownload(manifest, "agent.json");
      toast.success("agent.json downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to download manifest");
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="border-white/10 bg-[#0d1118]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-zinc-100">
            <Fingerprint className="h-4 w-4" />
            ERC-8004 Identity
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
        </CardContent>
      </Card>
    );
  }

  if (!identity) {
    return (
      <Card className="border-white/10 bg-[#0d1118]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-zinc-100">
            <Fingerprint className="h-4 w-4" />
            ERC-8004 Identity
          </CardTitle>
          <CardDescription className="text-zinc-500">
            No identity registered yet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-500">
            An ERC-8004 identity will be auto-generated when the agent is created through the
            standard flow.
          </p>
        </CardContent>
      </Card>
    );
  }

  const manifest = identity.manifest as unknown as AgentManifest | null;

  return (
    <Card className="border-white/10 bg-[#0d1118]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-zinc-100">
          <Fingerprint className="h-4 w-4" />
          ERC-8004 Identity
        </CardTitle>
        <CardDescription className="text-zinc-500">
          On-chain agent identity and manifest.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Registration Status */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-500">
            Registration Status
          </span>
          {identity.registered_on_chain ? (
            <Badge className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
              <CheckCircle className="h-3 w-3" />
              Registered
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 border-yellow-500/30 bg-yellow-500/10 text-yellow-400">
              <XCircle className="h-3 w-3" />
              Pending
            </Badge>
          )}
        </div>

        {/* Operator Wallet */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-500">
            Operator Wallet
          </span>
          <span className="font-mono text-sm text-zinc-300" title={identity.operator_wallet ?? ""}>
            {identity.operator_wallet ? truncateWallet(identity.operator_wallet) : "—"}
          </span>
        </div>

        {/* Chain TX Hash (if registered) */}
        {identity.chain_tx_hash && (
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-500">
              TX Hash
            </span>
            <span className="font-mono text-sm text-zinc-300">
              {truncateWallet(identity.chain_tx_hash)}
            </span>
          </div>
        )}

        {/* Manifest JSON */}
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-500">
              Agent Manifest
            </span>
            {manifest && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadManifest}
                disabled={isDownloading}
                className="h-7 gap-1.5 border-white/10 text-xs text-zinc-300 hover:bg-[#141b27] hover:text-white"
              >
                {isDownloading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Download className="h-3 w-3" />
                )}
                Download agent.json
              </Button>
            )}
          </div>
          <pre className="mt-2 overflow-auto rounded-xl border border-white/10 bg-black/40 p-4 text-xs text-zinc-300">
            {manifest ? JSON.stringify(manifest, null, 2) : "No manifest available."}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}
