import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAgencyData } from "../lib/useAgencyData";
import { formatTokens, formatUsd, relativeTime } from "../lib/format";
import { getRunLogJson, triggerJsonDownload } from "@/lib/erc8004/download";
import { decideApprovalRecord } from "@/lib/server-api/approvals";

type DetailKind = "agent" | "issue" | "approval" | "run" | "project";

/** Download button for run-scoped agent_log.json */
function RunLogDownload({ runId }: { runId: string }) {
  const [busy, setBusy] = useState(false);

  const handleDownload = async () => {
    setBusy(true);
    try {
      const log = await getRunLogJson(runId);
      triggerJsonDownload(log, "agent_log.json");
      toast.success("agent_log.json downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to download run log");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleDownload}
      disabled={busy}
      className="gap-1.5 border-white/10 text-xs text-zinc-300 hover:bg-[#141b27] hover:text-white"
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
      Download agent_log.json
    </Button>
  );
}

export function DetailPage({ kind }: { kind: DetailKind }) {
  const params = useParams();
  const { snapshot } = useAgencyData();
  const queryClient = useQueryClient();
  const [approvalNote, setApprovalNote] = useState("");

  const record = useMemo(() => {
    switch (kind) {
      case "agent":
        return snapshot.agents.find((item) => item.id === params.agentId);
      case "issue":
        return snapshot.issues.find((item) => item.id === params.issueId);
      case "approval":
        return snapshot.approvals.find((item) => item.id === params.approvalId);
      case "run":
        return snapshot.runs.find((item) => item.id === params.runId);
      case "project":
        return snapshot.projects.find((item) => item.id === params.projectId);
      default:
        return null;
    }
  }, [kind, params, snapshot]);

  const approvalDecision = useMutation({
    mutationFn: async (decision: "approved" | "rejected" | "revision_requested") => {
      if (kind !== "approval" || !params.approvalId) {
        throw new Error("No approval selected");
      }
      return await decideApprovalRecord({
        approvalId: params.approvalId,
        decision,
        note: approvalNote.trim() || null,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["agency-snapshot"] });
      toast.success("Approval updated");
      setApprovalNote("");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to update approval");
    },
  });

  if (!record) {
    return (
      <div className="p-6">
        <Card className="border-white/10 bg-[#0d1118]">
          <CardContent className="p-6 text-zinc-300">No record found.</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-4 p-6 xl:grid-cols-[1.2fr,0.8fr]">
      <Card className="border-white/10 bg-[#0d1118]">
        <CardHeader>
          <CardTitle className="text-zinc-100">
            {"title" in record
              ? record.title
              : "name" in record
                ? record.name
                : "summary" in record
                  ? record.summary
                  : "Record"}
          </CardTitle>
          <CardDescription className="flex items-center justify-between text-zinc-500">
            <span>{kind.toUpperCase()} detail</span>
            {kind === "run" && params.runId && (
              <RunLogDownload runId={params.runId} />
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-auto rounded-xl border border-white/10 bg-black/40 p-4 text-xs text-zinc-300">
            {JSON.stringify(record, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-[#0d1118]">
        <CardHeader>
          <CardTitle className="text-zinc-100">Quick facts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-zinc-300">
          {"createdAt" in record && (
            <p>
              <span className="font-black text-zinc-100">Created:</span> {relativeTime(record.createdAt)}
            </p>
          )}
          {"updatedAt" in record && (
            <p>
              <span className="font-black text-zinc-100">Updated:</span> {relativeTime(record.updatedAt)}
            </p>
          )}
          {"totalInputTokens" in record && (
            <p>
              <span className="font-black text-zinc-100">Tokens:</span>{" "}
              {formatTokens(record.totalInputTokens)} in / {formatTokens(record.totalOutputTokens)} out
            </p>
          )}
          {"totalCostUsd" in record && (
            <p>
              <span className="font-black text-zinc-100">Cost:</span> {formatUsd(record.totalCostUsd)}
            </p>
          )}
          {kind === "approval" && (
            <div className="space-y-3 rounded-xl border border-white/10 bg-black/30 p-4">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-zinc-500">
                Decision
              </p>
              <Textarea
                value={approvalNote}
                onChange={(event) => setApprovalNote(event.target.value)}
                placeholder="Optional note"
                className="min-h-24 border-white/10 bg-black/40 text-zinc-200"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={approvalDecision.isPending}
                  onClick={() => approvalDecision.mutate("approved")}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={approvalDecision.isPending}
                  onClick={() => approvalDecision.mutate("revision_requested")}
                >
                  Request Revision
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={approvalDecision.isPending}
                  onClick={() => approvalDecision.mutate("rejected")}
                >
                  Reject
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
