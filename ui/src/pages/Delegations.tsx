import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { agentsApi } from "../api/agents";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { cn, formatCents, formatDate } from "../lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ChevronDown,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import { PageSkeleton } from "../components/PageSkeleton";
import { EmptyState } from "../components/EmptyState";

interface Delegation {
  id: string;
  delegatorId: string;
  delegatorName: string;
  delegateeId: string;
  delegateeName: string;
  spendLimitUSDC: number;
  expiryDate: string;
  status: "active" | "revoked" | "expired";
  createdAt: string;
}

// Mock data - in production this would come from an API
const MOCK_DELEGATIONS: Delegation[] = [
  {
    id: "del-1",
    delegatorId: "agent-1",
    delegatorName: "CEO Agent",
    delegateeId: "agent-2",
    delegateeName: "Finance Lead",
    spendLimitUSDC: 50000,
    expiryDate: "2026-06-22",
    status: "active",
    createdAt: "2026-03-01",
  },
  {
    id: "del-2",
    delegatorId: "agent-2",
    delegatorName: "Finance Lead",
    delegateeId: "agent-3",
    delegateeName: "Budget Manager",
    spendLimitUSDC: 25000,
    expiryDate: "2026-05-22",
    status: "active",
    createdAt: "2026-03-10",
  },
  {
    id: "del-3",
    delegatorId: "agent-1",
    delegatorName: "CEO Agent",
    delegateeId: "agent-4",
    delegateeName: "Operations Manager",
    spendLimitUSDC: 30000,
    expiryDate: "2026-04-22",
    status: "active",
    createdAt: "2026-02-15",
  },
];

export function Delegations() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [selectedDelegation, setSelectedDelegation] =
    useState<Delegation | null>(null);
  const [formData, setFormData] = useState({
    delegatorId: "",
    delegateeId: "",
    spendLimitUSDC: "",
    expiryDate: "",
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setBreadcrumbs([{ label: "Delegations" }]);
  }, [setBreadcrumbs]);

  const { data: agents, isLoading } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  // Mock delegations data
  const delegations = useMemo(() => {
    return MOCK_DELEGATIONS.filter((d) => {
      const expiry = new Date(d.expiryDate);
      if (d.status === "expired" && expiry < new Date()) {
        return true;
      }
      return true;
    });
  }, []);

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Mock API call
      console.log("Creating delegation:", data);
      return new Promise((resolve) =>
        setTimeout(() => {
          resolve({ id: `del-${Date.now()}`, ...data });
        }, 500)
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.agents.list(selectedCompanyId!),
      });
      setCreateOpen(false);
      setFormData({
        delegatorId: "",
        delegateeId: "",
        spendLimitUSDC: "",
        expiryDate: "",
      });
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to create delegation");
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (delegationId: string) => {
      // Mock API call
      console.log("Revoking delegation:", delegationId);
      return new Promise((resolve) =>
        setTimeout(() => {
          resolve({ success: true });
        }, 300)
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.agents.list(selectedCompanyId!),
      });
      setRevokeOpen(false);
      setSelectedDelegation(null);
    },
  });

  const handleCreateDelegation = () => {
    if (
      !formData.delegatorId ||
      !formData.delegateeId ||
      !formData.spendLimitUSDC ||
      !formData.expiryDate
    ) {
      setError("All fields are required");
      return;
    }

    if (formData.delegatorId === formData.delegateeId) {
      setError("Delegator and delegatee cannot be the same");
      return;
    }

    createMutation.mutate(formData);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "expired":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "revoked":
        return <AlertCircle className="h-4 w-4 text-orange-600" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-50 border-green-200";
      case "expired":
        return "bg-red-50 border-red-200";
      case "revoked":
        return "bg-orange-50 border-orange-200";
      default:
        return "bg-gray-50 border-gray-200";
    }
  };

  const stats = {
    total: delegations.length,
    active: delegations.filter((d) => d.status === "active").length,
    totalSpend: delegations
      .filter((d) => d.status === "active")
      .reduce((sum, d) => sum + d.spendLimitUSDC, 0),
  };

  if (!selectedCompanyId) {
    return (
      <EmptyState
        icon={ChevronDown}
        message="Select a company to view delegations."
      />
    );
  }

  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground mb-1">
            Total Delegations
          </p>
          <p className="text-2xl font-semibold">{stats.total}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {stats.active} active
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground mb-1">
            Active Spend Authority
          </p>
          <p className="text-2xl font-semibold">
            ${(stats.totalSpend / 1000000).toFixed(0)}M
          </p>
          <p className="text-xs text-muted-foreground mt-1">USDC allocated</p>
        </Card>

        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground mb-1">
            Delegation Depth
          </p>
          <p className="text-2xl font-semibold">3</p>
          <p className="text-xs text-muted-foreground mt-1">chain levels</p>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-end">
        <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Create Delegation
        </Button>
      </div>

      {/* Delegations Grid */}
      {delegations.length === 0 ? (
        <EmptyState
          icon={ChevronDown}
          message="No delegations yet."
          action="Create Delegation"
          onAction={() => setCreateOpen(true)}
        />
      ) : (
        <div className="grid gap-3">
          {delegations.map((delegation) => (
            <Card
              key={delegation.id}
              className={cn("p-4 border", getStatusColor(delegation.status))}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-3">
                  {/* Header */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="font-medium text-sm">
                        {delegation.delegatorName}
                      </span>
                      <ChevronDown className="h-3 w-3 text-muted-foreground rotate-90" />
                      <span className="font-medium text-sm">
                        {delegation.delegateeName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(delegation.status)}
                      <Badge variant="secondary" className="capitalize text-xs">
                        {delegation.status}
                      </Badge>
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        Spend Limit
                      </p>
                      <p className="font-semibold">
                        ${(delegation.spendLimitUSDC / 1000000).toFixed(1)}M USDC
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        Expiry
                      </p>
                      <p className="font-semibold">
                        {formatDate(delegation.expiryDate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        Created
                      </p>
                      <p className="font-semibold">
                        {formatDate(delegation.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                {delegation.status === "active" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      setSelectedDelegation(delegation);
                      setRevokeOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Delegation</DialogTitle>
            <DialogDescription>
              Set up a new delegation with spend limits and expiry date.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            {/* Delegator */}
            <div className="space-y-2">
              <Label htmlFor="delegator">Delegator Agent</Label>
              <Select
                value={formData.delegatorId}
                onValueChange={(value: string) =>
                  setFormData({ ...formData, delegatorId: value })
                }
              >
                <SelectTrigger id="delegator">
                  <SelectValue placeholder="Select delegator..." />
                </SelectTrigger>
                <SelectContent>
                  {(agents ?? []).map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Delegatee */}
            <div className="space-y-2">
              <Label htmlFor="delegatee">Delegatee Agent</Label>
              <Select
                value={formData.delegateeId}
                onValueChange={(value: string) =>
                  setFormData({ ...formData, delegateeId: value })
                }
              >
                <SelectTrigger id="delegatee">
                  <SelectValue placeholder="Select delegatee..." />
                </SelectTrigger>
                <SelectContent>
                  {(agents ?? []).map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Spend Limit */}
            <div className="space-y-2">
              <Label htmlFor="spend">Spend Limit (USDC)</Label>
              <Input
                id="spend"
                type="number"
                placeholder="100000"
                value={formData.spendLimitUSDC}
                onChange={(e) =>
                  setFormData({ ...formData, spendLimitUSDC: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Maximum amount this delegation can spend
              </p>
            </div>

            {/* Expiry Date */}
            <div className="space-y-2">
              <Label htmlFor="expiry">Expiry Date</Label>
              <Input
                id="expiry"
                type="date"
                value={formData.expiryDate}
                onChange={(e) =>
                  setFormData({ ...formData, expiryDate: e.target.value })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateDelegation}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Dialog */}
      <Dialog open={revokeOpen} onOpenChange={setRevokeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke Delegation</DialogTitle>
            <DialogDescription>
              This will immediately revoke the delegation from{" "}
              <span className="font-semibold">{selectedDelegation?.delegatorName}</span>{" "}
              to{" "}
              <span className="font-semibold">{selectedDelegation?.delegateeName}</span>
              . This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRevokeOpen(false)}
              disabled={revokeMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                selectedDelegation && revokeMutation.mutate(selectedDelegation.id)
              }
              disabled={revokeMutation.isPending}
            >
              {revokeMutation.isPending ? "Revoking..." : "Revoke"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
