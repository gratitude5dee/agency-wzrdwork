/**
 * MetaMask Delegation Surface — Product Page
 *
 * Allows users to create, inspect, and revoke scoped CEO-to-department-to-task
 * delegation chains. Chains are persisted to Supabase (company-scoped) so they
 * survive page reload and can be queried during validation.
 *
 * Exposes guardrail messaging for invalid, expired, or overscoped delegation
 * actions with readable rejection reasons.
 */

import { useState, useCallback, useEffect } from "react";
import {
  Wallet,
  Plus,
  Eye,
  XCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  Zap,
  Link2,
  Loader2,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

import { useActiveCompany } from "@/hooks/useActiveCompany";
import {
  buildDelegationChain,
  revokeDelegation,
  getDelegationStatus,
  validatePermission,
  loadDelegationChains,
  saveDelegationChains,
  rehydrateDelegationStore,
} from "@/lib/delegations";
import type {
  DelegationChain,
  Permission,
  DelegationAction,
  PermissionValidationResult,
} from "@/lib/delegations";

// ---------------------------------------------------------------------------
// Default permission templates
// ---------------------------------------------------------------------------

const DEFAULT_CEO_PERMISSIONS: Permission = {
  spendLimit: { amount: 10000, currency: "USDC", period: "daily" },
  recipientWhitelist: [],
  timeWindow: {
    start: new Date().toISOString(),
    end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  },
  taskPermissions: ["swap", "transfer", "stake", "bridge"],
};

const DEFAULT_DEPT_PERMISSIONS: Permission = {
  spendLimit: { amount: 2000, currency: "USDC", period: "daily" },
  recipientWhitelist: [],
  timeWindow: {
    start: new Date().toISOString(),
    end: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
  },
  taskPermissions: ["swap", "transfer"],
};

// ---------------------------------------------------------------------------
// Status badge helpers
// ---------------------------------------------------------------------------

function statusColor(status: string): string {
  switch (status) {
    case "active":
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    case "revoked":
      return "bg-red-500/20 text-red-400 border-red-500/30";
    case "expired":
      return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    default:
      return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
  }
}

function truncateAddress(addr: string): string {
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

// ---------------------------------------------------------------------------
// Chain card component
// ---------------------------------------------------------------------------

function ChainCard({
  chain,
  onInspect,
  onRevoke,
}: {
  chain: DelegationChain;
  onInspect: (chain: DelegationChain) => void;
  onRevoke: (chain: DelegationChain) => void;
}) {
  // Get the effective status of the chain from the leaf delegation
  const leafDelegation = chain.nodes[chain.nodes.length - 1]?.delegation;
  const leafStatus = leafDelegation
    ? getDelegationStatus(leafDelegation.id) ?? leafDelegation.status ?? "unknown"
    : "root";

  const isRevocable = leafStatus === "active";

  return (
    <Card className="border-white/10 bg-[#0d1118] transition-colors hover:border-blue-500/20">
      <CardContent className="p-4 space-y-3">
        {/* Chain ID + Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-zinc-500" />
            <span className="text-xs font-mono text-zinc-500">{chain.id.slice(0, 16)}…</span>
          </div>
          <Badge variant="outline" className={statusColor(leafStatus)}>
            {leafStatus}
          </Badge>
        </div>

        {/* Chain visualization */}
        <div className="flex items-center gap-1 flex-wrap">
          {chain.nodes.map((node, i) => (
            <div key={`${chain.id}-${node.address}-${i}`} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3 text-zinc-600" />}
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-800/50 border border-white/5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  {node.role}
                </span>
                <span className="text-xs text-zinc-300 font-mono">
                  {truncateAddress(node.address)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 border-white/10 text-zinc-300 hover:border-blue-500/30"
            onClick={() => onInspect(chain)}
            aria-label="Inspect"
          >
            <Eye className="mr-1.5 h-3.5 w-3.5" />
            Inspect
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 border-white/10 text-red-400 hover:border-red-500/30 hover:text-red-300"
            onClick={() => onRevoke(chain)}
            disabled={!isRevocable}
            aria-label="Revoke"
          >
            <XCircle className="mr-1.5 h-3.5 w-3.5" />
            Revoke
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Inspection panel component
// ---------------------------------------------------------------------------

function InspectionPanel({
  chain,
  onClose,
}: {
  chain: DelegationChain;
  onClose: () => void;
}) {
  const [actionType, setActionType] = useState("");
  const [actionAmount, setActionAmount] = useState("");
  const [actionTimestamp, setActionTimestamp] = useState("");
  const [validationResult, setValidationResult] =
    useState<PermissionValidationResult | null>(null);

  // Select the last delegation (task agent) for action testing
  const testDelegation = chain.nodes[chain.nodes.length - 1]?.delegation;

  const handleTestAction = useCallback(() => {
    if (!testDelegation) return;

    const action: DelegationAction = {
      type: actionType || "swap",
    };
    if (actionAmount) {
      action.amount = Number(actionAmount);
    }
    if (actionTimestamp) {
      action.timestamp = actionTimestamp;
    }

    const result = validatePermission(testDelegation, action);
    setValidationResult(result);
  }, [testDelegation, actionType, actionAmount, actionTimestamp]);

  return (
    <div className="space-y-4">
      {/* Node details */}
      {chain.nodes.map((node, i) => (
        <Card
          key={`${chain.id}-inspect-${node.address}-${i}`}
          className="border-white/10 bg-[#0d1118]"
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-400" />
              <span className="uppercase text-zinc-400">{node.role}</span>
              <span className="font-mono text-zinc-300">{truncateAddress(node.address)}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {node.delegation ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-zinc-500">Spend Limit</p>
                    <p className="text-zinc-300">
                      {node.delegation.permissions.spendLimit.amount}{" "}
                      {node.delegation.permissions.spendLimit.currency} /{" "}
                      {node.delegation.permissions.spendLimit.period}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-zinc-500">Status</p>
                    <Badge
                      variant="outline"
                      className={statusColor(
                        getDelegationStatus(node.delegation.id) ?? node.delegation.status ?? "unknown",
                      )}
                    >
                      {getDelegationStatus(node.delegation.id) ?? node.delegation.status ?? "unknown"}
                    </Badge>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-zinc-500">Time Window</p>
                  <p className="text-zinc-300 text-xs">
                    {new Date(node.delegation.permissions.timeWindow.start).toLocaleDateString()} →{" "}
                    {new Date(node.delegation.permissions.timeWindow.end).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-zinc-500">Task Permissions</p>
                  <div className="flex gap-1 flex-wrap mt-1">
                    {node.delegation.permissions.taskPermissions.map((tp) => (
                      <Badge
                        key={tp}
                        variant="outline"
                        className="border-white/10 text-zinc-400 text-xs"
                      >
                        {tp}
                      </Badge>
                    ))}
                    {node.delegation.permissions.taskPermissions.length === 0 && (
                      <span className="text-zinc-600 text-xs italic">none</span>
                    )}
                  </div>
                </div>
                {node.delegation.permissions.recipientWhitelist.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase text-zinc-500">
                      Recipient Whitelist
                    </p>
                    <p className="text-zinc-300 text-xs font-mono">
                      {node.delegation.permissions.recipientWhitelist.join(", ")}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-zinc-600 italic text-xs">Root of trust — no inbound delegation</p>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Action tester */}
      {testDelegation && (
        <Card className="border-blue-500/20 bg-[#0a0e16]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-400" />
              Test Action
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="action-type" className="text-zinc-400 text-xs">
                  Action Type
                </Label>
                <Input
                  id="action-type"
                  placeholder="swap"
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value)}
                  className="border-white/10 bg-black text-zinc-100 placeholder:text-zinc-600"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="action-amount" className="text-zinc-400 text-xs">
                  Amount
                </Label>
                <Input
                  id="action-amount"
                  type="number"
                  placeholder="100"
                  value={actionAmount}
                  onChange={(e) => setActionAmount(e.target.value)}
                  className="border-white/10 bg-black text-zinc-100 placeholder:text-zinc-600"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="action-timestamp" className="text-zinc-400 text-xs">
                  Timestamp
                </Label>
                <Input
                  id="action-timestamp"
                  placeholder="2025-06-15T12:00:00Z"
                  value={actionTimestamp}
                  onChange={(e) => setActionTimestamp(e.target.value)}
                  className="border-white/10 bg-black text-zinc-100 placeholder:text-zinc-600"
                />
              </div>
            </div>

            <Button
              size="sm"
              onClick={handleTestAction}
              className="w-full"
            >
              <Zap className="mr-1.5 h-3.5 w-3.5" />
              Test Action
            </Button>

            {/* Validation result */}
            {validationResult && (
              <div
                className={`rounded-md border p-3 text-sm ${
                  validationResult.allowed
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : "border-red-500/30 bg-red-500/10 text-red-400"
                }`}
              >
                <div className="flex items-start gap-2">
                  {validationResult.allowed ? (
                    <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <p className="font-bold">
                      {validationResult.allowed ? "Action Allowed" : "Action Rejected"}
                    </p>
                    {validationResult.reason && (
                      <p className="mt-1 text-xs opacity-80">{validationResult.reason}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Button variant="ghost" size="sm" onClick={onClose} className="text-zinc-400">
        Close Inspection
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export function DelegationsPage() {
  const { companyId } = useActiveCompany();
  const [chains, setChains] = useState<DelegationChain[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [inspectedChain, setInspectedChain] = useState<DelegationChain | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Create form state
  const [ceoWallet, setCeoWallet] = useState("");
  const [deptAgent, setDeptAgent] = useState("");
  const [taskAgent, setTaskAgent] = useState("");

  // Load persisted chains on mount / company change
  useEffect(() => {
    if (!companyId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const loaded = await loadDelegationChains(companyId!);
        if (!cancelled) {
          // Re-hydrate into in-memory store so getDelegationStatus / validatePermission work
          rehydrateDelegationStore(loaded);
          setChains(loaded);
        }
      } catch {
        // Silently handle — surface will show empty state
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [companyId]);

  // Persist helper — saves current chains to Supabase
  const persistChains = useCallback(
    async (updatedChains: DelegationChain[]) => {
      if (!companyId) return;
      setIsSaving(true);
      try {
        await saveDelegationChains(companyId, updatedChains);
      } catch {
        // Persistence failure is non-blocking for the UI — chains still live in memory
      } finally {
        setIsSaving(false);
      }
    },
    [companyId],
  );

  const handleCreate = useCallback(async () => {
    if (!ceoWallet || !deptAgent || !taskAgent) return;

    const chain = buildDelegationChain(
      ceoWallet,
      deptAgent,
      taskAgent,
      DEFAULT_CEO_PERMISSIONS,
      DEFAULT_DEPT_PERMISSIONS,
    );

    const updatedChains = [...chains, chain];
    setChains(updatedChains);
    setCreateOpen(false);
    setCeoWallet("");
    setDeptAgent("");
    setTaskAgent("");

    // Persist to Supabase
    await persistChains(updatedChains);
  }, [ceoWallet, deptAgent, taskAgent, chains, persistChains]);

  const handleRevoke = useCallback(
    async (chain: DelegationChain) => {
      // Revoke all delegations in the chain (in-memory store)
      for (const node of chain.nodes) {
        if (node.delegation) {
          revokeDelegation(node.delegation.id);
        }
      }

      // Update the chain objects to reflect revoked status for persistence
      const updatedChains = chains.map((c) => {
        if (c.id !== chain.id) return c;
        return {
          ...c,
          nodes: c.nodes.map((node) => ({
            ...node,
            delegation: node.delegation
              ? { ...node.delegation, status: "revoked" as const, updatedAt: new Date().toISOString() }
              : null,
          })),
        };
      });

      setChains(updatedChains);

      // Persist to Supabase
      await persistChains(updatedChains);
    },
    [chains, persistChains],
  );

  const handleInspect = useCallback((chain: DelegationChain) => {
    setInspectedChain(chain);
  }, []);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Wallet className="h-6 w-6 text-zinc-400" />
          <div>
            <h1 className="text-2xl font-black tracking-tight text-zinc-100">Delegations</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Manage scoped delegation chains for CEO-to-department-to-task agent authority.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isSaving && (
            <span className="flex items-center gap-1.5 text-xs text-zinc-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving…
            </span>
          )}
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Create Chain
          </Button>
        </div>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Loader2 className="h-8 w-8 text-zinc-600 animate-spin mb-4" />
          <p className="text-zinc-500 text-sm">Loading delegation chains…</p>
        </div>
      ) : inspectedChain ? (
        <InspectionPanel
          chain={inspectedChain}
          onClose={() => setInspectedChain(null)}
        />
      ) : (
        <>
          {chains.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ShieldCheck className="h-12 w-12 text-zinc-700 mb-4" />
              <p className="text-zinc-400 text-lg font-bold">No delegation chains</p>
              <p className="text-zinc-600 text-sm mt-1">
                Create a delegation chain to scope authority from CEO to department to task agents.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {chains.map((chain) => (
                <ChainCard
                  key={chain.id}
                  chain={chain}
                  onInspect={handleInspect}
                  onRevoke={handleRevoke}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Create Chain Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="border-white/10 bg-[#0d1118] text-zinc-100">
          <DialogHeader>
            <DialogTitle>Create Delegation Chain</DialogTitle>
            <DialogDescription className="text-zinc-500">
              Build a 3-level hierarchy: CEO → Department Agent → Task Agent.
              Each level inherits and further restricts the parent's permissions.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="ceo-wallet" className="text-zinc-300">
                CEO Wallet
              </Label>
              <Input
                id="ceo-wallet"
                placeholder="0x…"
                value={ceoWallet}
                onChange={(e) => setCeoWallet(e.target.value)}
                className="border-white/10 bg-black text-zinc-100 placeholder:text-zinc-600"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dept-agent" className="text-zinc-300">
                Department Agent
              </Label>
              <Input
                id="dept-agent"
                placeholder="0x… or agent ID"
                value={deptAgent}
                onChange={(e) => setDeptAgent(e.target.value)}
                className="border-white/10 bg-black text-zinc-100 placeholder:text-zinc-600"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-agent" className="text-zinc-300">
                Task Agent
              </Label>
              <Input
                id="task-agent"
                placeholder="0x… or agent ID"
                value={taskAgent}
                onChange={(e) => setTaskAgent(e.target.value)}
                className="border-white/10 bg-black text-zinc-100 placeholder:text-zinc-600"
              />
            </div>

            {/* Permission preview */}
            <div className="rounded-md border border-white/10 bg-black/40 p-3 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Default Permission Template
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400">
                <div>
                  <span className="text-zinc-600">CEO Spend:</span>{" "}
                  {DEFAULT_CEO_PERMISSIONS.spendLimit.amount}{" "}
                  {DEFAULT_CEO_PERMISSIONS.spendLimit.currency}/
                  {DEFAULT_CEO_PERMISSIONS.spendLimit.period}
                </div>
                <div>
                  <span className="text-zinc-600">Dept Spend:</span>{" "}
                  {DEFAULT_DEPT_PERMISSIONS.spendLimit.amount}{" "}
                  {DEFAULT_DEPT_PERMISSIONS.spendLimit.currency}/
                  {DEFAULT_DEPT_PERMISSIONS.spendLimit.period}
                </div>
                <div>
                  <span className="text-zinc-600">CEO Tasks:</span>{" "}
                  {DEFAULT_CEO_PERMISSIONS.taskPermissions.join(", ")}
                </div>
                <div>
                  <span className="text-zinc-600">Dept Tasks:</span>{" "}
                  {DEFAULT_DEPT_PERMISSIONS.taskPermissions.join(", ")}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setCreateOpen(false)}
              className="text-zinc-400"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!ceoWallet || !deptAgent || !taskAgent}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
