import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAgencyData } from "../lib/useAgencyData";
import { formatTokens, formatUsd, relativeTime } from "../lib/format";
import { getRunLogJson, triggerJsonDownload } from "@/lib/erc8004/download";

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
        </CardContent>
      </Card>
    </div>
  );
}
