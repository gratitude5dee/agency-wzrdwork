/**
 * Submission Proof Pack Page
 *
 * Self-contained page that aggregates all hackathon submission artifacts:
 * - Agent manifest (agent.json) — ERC-8004 identity
 * - Run log (agent_log.json) — Protocol Labs execution evidence
 * - Payment evidence — x402 invoice/settlement proof
 * - Route matrix — navigable product routes
 *
 * This page fulfils VAL-CROSS-006 by providing README-backed retrieval
 * instructions for every proof artifact without unpublished operator knowledge.
 */

import { useState, useMemo, useCallback } from "react";
import {
  Download,
  FileJson,
  Loader2,
  MapPin,
  Receipt,
  Route,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Package,
  ExternalLink,
} from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { triggerJsonDownload } from "@/lib/erc8004/download";
import { toast } from "sonner";

import {
  assembleProofPack,
  ROUTE_MATRIX,
  type ProofPack,
} from "@/lib/proof-pack";
import { supabase } from "@/integrations/supabase/client";

/* ================================================================
   Hook: load first agent and first run for the active company
   ================================================================ */

function useCompanyProofContext(companyId: string | null) {
  const [agents, setAgents] = useState<Array<{ id: string; name: string; role: string }>>([]);
  const [runs, setRuns] = useState<Array<{ id: string; agent_id: string; status: string; summary: string | null; created_at: string }>>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoaded(false);

    const [agentRes, runRes] = await Promise.all([
      supabase
        .from("agents")
        .select("id, name, role")
        .eq("company_id", companyId)
        .order("created_at", { ascending: true })
        .limit(20),
      supabase
        .from("runs")
        .select("id, agent_id, status, summary, created_at")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    setAgents(agentRes.data ?? []);
    setRuns(runRes.data ?? []);
    setLoaded(true);
  }, [companyId]);

  return { agents, runs, loaded, load };
}

/* ================================================================
   Main Page Component
   ================================================================ */

export function SubmissionProofPage() {
  const { company, companyId, isLoading: companyLoading } = useActiveCompany();
  const ctx = useCompanyProofContext(companyId);
  const [proofPack, setProofPack] = useState<ProofPack | null>(null);
  const [assembling, setAssembling] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [selectedRunId, setSelectedRunId] = useState<string>("");

  // Initialize context when company is ready
  const handleLoadContext = useCallback(() => {
    ctx.load();
  }, [ctx]);

  const handleAssemble = async () => {
    if (!companyId) return;
    setAssembling(true);
    try {
      const pack = await assembleProofPack(
        companyId,
        selectedAgentId || null,
        selectedRunId || null,
      );
      setProofPack(pack);
      toast.success("Proof pack assembled");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to assemble proof pack");
    } finally {
      setAssembling(false);
    }
  };

  const handleDownloadManifest = () => {
    if (proofPack?.manifest) {
      triggerJsonDownload(proofPack.manifest, "agent.json");
      toast.success("agent.json downloaded");
    }
  };

  const handleDownloadRunLog = () => {
    if (proofPack?.runLog) {
      triggerJsonDownload(proofPack.runLog, "agent_log.json");
      toast.success("agent_log.json downloaded");
    }
  };

  const handleDownloadPayments = () => {
    if (proofPack?.payments) {
      triggerJsonDownload(proofPack.payments, "payment_evidence.json");
      toast.success("payment_evidence.json downloaded");
    }
  };

  const handleDownloadRouteMatrix = () => {
    triggerJsonDownload(ROUTE_MATRIX, "route_matrix.json");
    toast.success("route_matrix.json downloaded");
  };

  const handleDownloadFullPack = () => {
    if (proofPack) {
      triggerJsonDownload(proofPack, "submission_proof_pack.json");
      toast.success("Full proof pack downloaded");
    }
  };

  // Group routes by section
  const routesBySection = useMemo(() => {
    const map = new Map<string, typeof ROUTE_MATRIX>();
    for (const route of ROUTE_MATRIX) {
      const existing = map.get(route.section) ?? [];
      existing.push(route);
      map.set(route.section, existing);
    }
    return map;
  }, []);

  if (companyLoading) {
    return (
      <div className="flex items-center justify-center p-12" data-testid="proof-loading">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
        <span className="ml-2 text-zinc-500">Loading company context…</span>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="p-6" data-testid="proof-no-company">
        <Card className="border-orange-500/20 bg-[#0d1118]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-300">
              <AlertTriangle className="h-4 w-4" />
              No Active Company
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-400">
              Connect a wallet and complete onboarding to access the submission proof pack.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 overflow-auto h-full" data-testid="proof-pack-page">
      {/* Header */}
      <div>
        <h2 className="text-lg font-black uppercase tracking-wider text-zinc-100">
          Submission Proof Pack
        </h2>
        <p className="mt-1 text-sm text-zinc-400">
          Self-contained retrieval for hackathon submission artifacts. Select an agent and run, then
          assemble and download the full proof pack.
        </p>
      </div>

      {/* Context Selection */}
      <Card className="border-white/10 bg-[#0d1118]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-zinc-100">
            <Package className="h-4 w-4" />
            Proof Context
          </CardTitle>
          <CardDescription className="text-zinc-500">
            Company: <span className="text-zinc-300">{company.name}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!ctx.loaded ? (
            <Button
              onClick={handleLoadContext}
              variant="outline"
              className="border-white/10 text-zinc-200 hover:bg-[#141b27] hover:text-white"
              data-testid="load-context-btn"
            >
              Load agents and runs
            </Button>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-500">
                  Agent (for agent.json)
                </label>
                <select
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                  className="mt-1.5 w-full rounded border border-white/10 bg-[#080c14] px-2 py-1.5 text-sm text-zinc-200 focus:border-blue-500/50 focus:outline-none"
                  data-testid="agent-select"
                >
                  <option value="">— select agent —</option>
                  {ctx.agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.role})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-500">
                  Run (for agent_log.json)
                </label>
                <select
                  value={selectedRunId}
                  onChange={(e) => setSelectedRunId(e.target.value)}
                  className="mt-1.5 w-full rounded border border-white/10 bg-[#080c14] px-2 py-1.5 text-sm text-zinc-200 focus:border-blue-500/50 focus:outline-none"
                  data-testid="run-select"
                >
                  <option value="">— select run —</option>
                  {ctx.runs.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.summary ?? r.id.slice(0, 8)} ({r.status})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleAssemble}
              disabled={assembling || !companyId}
              className="bg-blue-600 text-white hover:bg-blue-700"
              data-testid="assemble-btn"
            >
              {assembling ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Package className="mr-2 h-4 w-4" />
              )}
              {assembling ? "Assembling…" : "Assemble Proof Pack"}
            </Button>
            {proofPack && (
              <Button
                onClick={handleDownloadFullPack}
                variant="outline"
                className="gap-1.5 border-white/10 text-zinc-200 hover:bg-[#141b27] hover:text-white"
                data-testid="download-full-pack-btn"
              >
                <Download className="h-4 w-4" />
                Download Full Pack
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Assembled Proof Pack Results */}
      {proofPack && (
        <div className="grid gap-4 xl:grid-cols-2" data-testid="proof-results">
          {/* Agent Manifest */}
          <Card className="border-white/10 bg-[#0d1118]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-zinc-100">
                <FileJson className="h-4 w-4" />
                Agent Manifest
                <ArtifactStatus ok={!!proofPack.manifest} />
              </CardTitle>
              <CardDescription className="text-zinc-500">
                ERC-8004 agent.json — identity, tools, and capabilities.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {proofPack.manifest ? (
                <>
                  <div className="flex items-center justify-between text-sm text-zinc-300">
                    <span>Agent: {proofPack.manifest.name}</span>
                    <Badge variant="outline" className="border-white/10 text-zinc-400 text-[10px]">
                      {proofPack.manifest.erc8004_identity}
                    </Badge>
                  </div>
                  <pre className="overflow-auto rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-zinc-400 max-h-48" data-testid="manifest-preview">
                    {JSON.stringify(proofPack.manifest, null, 2)}
                  </pre>
                  <Button
                    onClick={handleDownloadManifest}
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-white/10 text-xs text-zinc-300 hover:bg-[#141b27] hover:text-white"
                    data-testid="download-manifest-btn"
                  >
                    <Download className="h-3 w-3" />
                    Download agent.json
                  </Button>
                </>
              ) : (
                <p className="text-sm text-orange-300" data-testid="manifest-error">
                  {proofPack.manifestError}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Run Log */}
          <Card className="border-white/10 bg-[#0d1118]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-zinc-100">
                <FileJson className="h-4 w-4" />
                Run Log
                <ArtifactStatus ok={!!proofPack.runLog} />
              </CardTitle>
              <CardDescription className="text-zinc-500">
                Protocol Labs agent_log.json — run-scoped execution evidence.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {proofPack.runLog ? (
                <>
                  <div className="flex items-center justify-between text-sm text-zinc-300">
                    <span>Run: {proofPack.runLog.run_id.slice(0, 8)}…</span>
                    <Badge variant="outline" className="border-white/10 text-zinc-400 text-[10px]">
                      {proofPack.runLog.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-zinc-400">
                    <div>
                      <span className="text-zinc-600">Entries:</span>{" "}
                      {proofPack.runLog.entries.length}
                    </div>
                    <div>
                      <span className="text-zinc-600">Tokens:</span>{" "}
                      {proofPack.runLog.usage.total_input_tokens + proofPack.runLog.usage.total_output_tokens}
                    </div>
                    <div>
                      <span className="text-zinc-600">Cost:</span>{" "}
                      ${proofPack.runLog.usage.total_cost_usd.toFixed(4)}
                    </div>
                  </div>
                  <pre className="overflow-auto rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-zinc-400 max-h-48" data-testid="runlog-preview">
                    {JSON.stringify(proofPack.runLog, null, 2)}
                  </pre>
                  <Button
                    onClick={handleDownloadRunLog}
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-white/10 text-xs text-zinc-300 hover:bg-[#141b27] hover:text-white"
                    data-testid="download-runlog-btn"
                  >
                    <Download className="h-3 w-3" />
                    Download agent_log.json
                  </Button>
                </>
              ) : (
                <p className="text-sm text-orange-300" data-testid="runlog-error">
                  {proofPack.runLogError}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Payment Evidence */}
          <Card className="border-white/10 bg-[#0d1118]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-zinc-100">
                <Receipt className="h-4 w-4" />
                Payment Evidence
                <ArtifactStatus ok={proofPack.payments.length > 0} />
              </CardTitle>
              <CardDescription className="text-zinc-500">
                x402 invoice and settlement records for the company.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {proofPack.payments.length > 0 ? (
                <>
                  <div className="space-y-2" data-testid="payment-list">
                    {proofPack.payments.map((inv) => (
                      <div
                        key={inv.id}
                        className="flex items-center justify-between rounded-lg border border-white/10 bg-[#080c14] p-2 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-zinc-200">{inv.description ?? inv.id.slice(0, 8)}</p>
                          <p className="text-xs text-zinc-500">
                            ${inv.amount_usdc} USDC · Chain {inv.chain_id}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            inv.paid
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px]"
                              : "border-orange-500/30 bg-orange-500/10 text-orange-400 text-[10px]"
                          }
                        >
                          {inv.paid ? "Paid" : "Unpaid"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                  <Button
                    onClick={handleDownloadPayments}
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-white/10 text-xs text-zinc-300 hover:bg-[#141b27] hover:text-white"
                    data-testid="download-payments-btn"
                  >
                    <Download className="h-3 w-3" />
                    Download payment_evidence.json
                  </Button>
                </>
              ) : (
                <p className="text-sm text-zinc-500" data-testid="no-payments">
                  {proofPack.paymentsError ?? "No payment evidence found for this company."}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Route Matrix */}
          <Card className="border-white/10 bg-[#0d1118]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-zinc-100">
                <Route className="h-4 w-4" />
                Route Matrix
                <ArtifactStatus ok />
              </CardTitle>
              <CardDescription className="text-zinc-500">
                All navigable product routes reachable from the left-nav.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-3" data-testid="route-matrix">
                {Array.from(routesBySection.entries()).map(([section, routes]) => (
                  <div key={section}>
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-600 mb-1">
                      {section}
                    </p>
                    <div className="space-y-1">
                      {routes.map((route) => (
                        <Link
                          key={route.path}
                          to={route.path}
                          className="flex items-center justify-between rounded px-2 py-1 text-sm hover:bg-white/5"
                        >
                          <span className="text-zinc-300">{route.label}</span>
                          <span className="font-mono text-xs text-zinc-600">{route.path}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <Button
                onClick={handleDownloadRouteMatrix}
                variant="outline"
                size="sm"
                className="gap-1.5 border-white/10 text-xs text-zinc-300 hover:bg-[#141b27] hover:text-white"
                data-testid="download-route-matrix-btn"
              >
                <Download className="h-3 w-3" />
                Download route_matrix.json
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Retrieval Instructions */}
      <Card className="border-white/10 bg-[#0d1118]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-zinc-100">
            <MapPin className="h-4 w-4" />
            Retrieval Instructions
          </CardTitle>
          <CardDescription className="text-zinc-500">
            How to retrieve each artifact from a clean start. See README for full instructions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-decimal list-inside space-y-3 text-sm text-zinc-300" data-testid="retrieval-instructions">
            <li>
              <strong>Start the app:</strong>{" "}
              <code className="rounded bg-black/40 px-1 py-0.5 text-xs text-zinc-400">
                npm run dev -- --host 127.0.0.1 --port 3101
              </code>
            </li>
            <li>
              <strong>Navigate to</strong>{" "}
              <code className="rounded bg-black/40 px-1 py-0.5 text-xs text-zinc-400">
                /submission-proof
              </code>{" "}
              from the left-nav sidebar under <em>Company → Submission Proof</em>.
            </li>
            <li>
              <strong>Load context:</strong> Click &quot;Load agents and runs&quot; to populate the agent and run selectors.
            </li>
            <li>
              <strong>Select an agent</strong> from the dropdown to enable <code className="rounded bg-black/40 px-1 py-0.5 text-xs text-zinc-400">agent.json</code> retrieval.
            </li>
            <li>
              <strong>Select a run</strong> from the dropdown to enable <code className="rounded bg-black/40 px-1 py-0.5 text-xs text-zinc-400">agent_log.json</code> retrieval.
            </li>
            <li>
              <strong>Click &quot;Assemble Proof Pack&quot;</strong> to retrieve all artifacts.
            </li>
            <li>
              <strong>Download individual artifacts</strong> or click &quot;Download Full Pack&quot; for the complete bundle.
            </li>
          </ol>

          <Separator className="bg-white/10" />

          <div className="space-y-2 text-sm text-zinc-400">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-600">
              Alternative API Retrieval
            </p>
            <p>
              <strong className="text-zinc-300">agent.json:</strong> Navigate to{" "}
              <code className="rounded bg-black/40 px-1 py-0.5 text-xs">/agents/:id</code> →
              ERC-8004 Identity section → &quot;Download agent.json&quot; button.
            </p>
            <p>
              <strong className="text-zinc-300">agent_log.json:</strong> Navigate to{" "}
              <code className="rounded bg-black/40 px-1 py-0.5 text-xs">/runs/:id</code> →
              &quot;Download agent_log.json&quot; button.
            </p>
            <p>
              <strong className="text-zinc-300">Payment evidence:</strong> Available on this page after assembly, or via the x402 invoice API.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ================================================================
   Helpers
   ================================================================ */

function ArtifactStatus({ ok }: { ok: boolean }) {
  return ok ? (
    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
  ) : (
    <XCircle className="h-3.5 w-3.5 text-zinc-500" />
  );
}
