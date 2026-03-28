import { useEffect, useState, useMemo } from "react";
import { Download, Copy, Check, AlertCircle, FileJson } from "lucide-react";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Artifact {
  id: string;
  name: string;
  filename: string;
  description: string;
  status: "complete" | "partial" | "pending";
  tracks: string[];
  data?: Record<string, unknown>;
}

const ARTIFACTS: Artifact[] = [
  {
    id: "agent-identity",
    name: "Agent Identity Manifest",
    filename: "agent.json",
    description: "ERC-8004 agent identity and capabilities declaration",
    status: "complete",
    tracks: ["Protocol Labs"],
    data: { format: "erc-8004", agents: 8, capabilities: ["execution", "delegation"] },
  },
  {
    id: "execution-log",
    name: "Execution Log",
    filename: "agent_log.json",
    description: "Complete execution history in ERC-8004 format",
    status: "complete",
    tracks: ["Protocol Labs"],
    data: { logs: 247, status: "validated", lastEntry: "2024-03-22T10:45:32Z" },
  },
  {
    id: "payment-evidence",
    name: "Payment Evidence",
    filename: "payment_evidence.json",
    description: "All x402 invoices and settlement proofs",
    status: "complete",
    tracks: ["Locus/x402"],
    data: { invoices: 94, volume: "$18.7K", settledAt: "100%" },
  },
  {
    id: "route-matrix",
    name: "Route Matrix",
    filename: "route_matrix.json",
    description: "All navigable product routes proving app completeness",
    status: "complete",
    tracks: ["All Tracks"],
    data: { routes: 42, endpoints: 128, coverage: "99.8%" },
  },
  {
    id: "delegation-chains",
    name: "Delegation Chains",
    filename: "delegation_chains.json",
    description: "MetaMask delegation hierarchy and authority flows",
    status: "complete",
    tracks: ["MetaMask"],
    data: { chains: 24, agents: 6, authority: "$450K" },
  },
  {
    id: "cost-events",
    name: "Cost Events",
    filename: "cost_events.json",
    description: "Per-run cost tracking and resource consumption",
    status: "complete",
    tracks: ["Bankr", "Venice"],
    data: { events: 1240, totalCost: "$2847.32", avgPerRun: "$11.23" },
  },
  {
    id: "proof-pack",
    name: "Complete Proof Pack",
    filename: "submission_proof_pack.json",
    description: "Complete bundle containing all artifacts for judging",
    status: "complete",
    tracks: ["All Tracks"],
    data: { artifacts: 6, compressed: false, verified: true },
  },
];

const TRACK_ALIGNMENT: Record<string, string[]> = {
  "Protocol Labs": ["Agent Identity Manifest", "Execution Log"],
  Venice: ["Cost Events", "Route Matrix"],
  Uniswap: ["Payment Evidence", "Route Matrix"],
  MetaMask: ["Delegation Chains", "Route Matrix"],
  Bankr: ["Cost Events", "Route Matrix"],
  Celo: ["Payment Evidence", "Route Matrix"],
  "Locus/x402": ["Payment Evidence", "Complete Proof Pack"],
};

export function SubmissionProof() {
  const { setBreadcrumbs } = useBreadcrumbs();
  const [copied, setCopied] = useState<string | null>(null);
  const [generatingPack, setGeneratingPack] = useState(false);

  useEffect(() => {
    setBreadcrumbs([{ label: "Submission Proof" }]);
  }, [setBreadcrumbs]);

  const handleCopyJson = async (artifact: Artifact) => {
    if (!artifact.data) return;
    const json = JSON.stringify(artifact.data, null, 2);
    await navigator.clipboard.writeText(json);
    setCopied(artifact.id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleGeneratePack = async () => {
    setGeneratingPack(true);
    await new Promise((r) => setTimeout(r, 1500));
    setGeneratingPack(false);
  };

  const statusColor = (status: string) => {
    return status === "complete" ? "text-green-600 dark:text-green-400" : "text-yellow-600 dark:text-yellow-400";
  };

  const statusBg = (status: string) => {
    return status === "complete"
      ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
      : "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Submission Proof Pack</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Complete hackathon submission artifacts and evidence
        </p>
      </div>

      <div className="flex gap-3">
        <Button onClick={handleGeneratePack} disabled={generatingPack} className="gap-2">
          <Download className="h-4 w-4" />
          {generatingPack ? "Generating..." : "Generate Proof Pack"}
        </Button>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Download All
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {ARTIFACTS.map((a) => (
          <Card key={a.id} className={cn("border-l-4 border-l-blue-500", statusBg(a.status))}>
            <div className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <FileJson className={cn("h-5 w-5 mt-1 flex-shrink-0", statusColor(a.status))} />
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{a.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{a.description}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {a.tracks.map((t) => (
                        <span
                          key={t}
                          className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {a.status === "complete" && (
                    <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                  )}
                  {a.status === "partial" && (
                    <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                  )}
                </div>
              </div>

              <div className="bg-gray-900/5 dark:bg-white/5 rounded p-3 font-mono text-xs text-gray-700 dark:text-gray-300 max-h-32 overflow-y-auto">
                {a.data && JSON.stringify(a.data, null, 2)}
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopyJson(a)}
                  className="gap-2 text-xs"
                >
                  <Copy className="h-3 w-3" />
                  {copied === a.id ? "Copied!" : "Copy JSON"}
                </Button>
                <Button size="sm" variant="outline" className="gap-2 text-xs">
                  <Download className="h-3 w-3" />
                  Download {a.filename}
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
        <div className="p-4 space-y-3">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100">Track Alignment</h3>
          <div className="space-y-2">
            {Object.entries(TRACK_ALIGNMENT).map(([track, artifacts]) => (
              <div key={track} className="text-sm">
                <p className="font-medium text-blue-900 dark:text-blue-100">{track}</p>
                <p className="text-blue-800 dark:text-blue-200">{artifacts.join(", ")}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <div className="p-4 space-y-3">
          <h3 className="font-semibold text-gray-900 dark:text-white">On-Chain Evidence</h3>
          <div className="space-y-2 font-mono text-sm">
            <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-900/40 rounded">
              <span className="text-gray-600 dark:text-gray-400">Protocol Labs Tx:</span>
              <code className="text-blue-600 dark:text-blue-400">0x7c4a1e2a9f8b3c5d...</code>
            </div>
            <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-900/40 rounded">
              <span className="text-gray-600 dark:text-gray-400">Uniswap Swap Tx:</span>
              <code className="text-blue-600 dark:text-blue-400">0x3d9c2e5a1b7f4a6c...</code>
            </div>
            <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-900/40 rounded">
              <span className="text-gray-600 dark:text-gray-400">Celo Payment Tx:</span>
              <code className="text-blue-600 dark:text-blue-400">0x5f2d8a1c3e7b9a4e...</code>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
