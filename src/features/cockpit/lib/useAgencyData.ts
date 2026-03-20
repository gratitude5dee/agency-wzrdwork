import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { createIssueRecord } from "@/lib/server-api/issues";
import { getAgencySnapshotRecord } from "@/lib/server-api/agency";
import { DEMO_SNAPSHOT } from "./demoData";
import type {
  ActivityRecord,
  AgencySnapshot,
  AgentRecord,
  ApprovalRecord,
  CompanyRecord,
  CreateIssueInput,
  GoalRecord,
  IssueRecord,
  ProjectRecord,
  RunRecord,
} from "./domain";

const SNAPSHOT_QUERY_KEY = ["agency-snapshot"];

function createDemoIssue(snapshot: AgencySnapshot, input: CreateIssueInput): AgencySnapshot {
  const nextIndex = snapshot.issues.length + 1;
  const issueId = `issue-demo-${nextIndex}`;
  const identifier = `ACM-${nextIndex + 2}`;
  const now = new Date().toISOString();

  return {
    ...snapshot,
    issues: [
      {
        id: issueId,
        companyId: snapshot.company.id,
        projectId: input.projectId,
        assigneeAgentId: input.assigneeAgentId,
        identifier,
        title: input.title,
        description: input.description,
        status: "todo",
        priority: input.priority,
        createdAt: now,
        updatedAt: now,
      },
      ...snapshot.issues,
    ],
    activity: [
      {
        id: `activity-demo-${nextIndex}`,
        companyId: snapshot.company.id,
        agentId: input.assigneeAgentId,
        issueId,
        action: "issue.created",
        details: `Opened ${identifier}`,
        createdAt: now,
      },
      ...snapshot.activity,
    ],
  };
}

/**
 * Load the agency snapshot for a specific company.
 * When server access fails or no company is resolved, falls back to demo data.
 */
export async function loadAgencySnapshot(companyId?: string | null): Promise<AgencySnapshot> {
  if (!companyId) {
    return DEMO_SNAPSHOT;
  }

  try {
    return await getAgencySnapshotRecord({ companyId });
  } catch (error) {
    return {
      ...DEMO_SNAPSHOT,
      source: "demo",
      sourceMessage:
        error instanceof Error
          ? error.message
          : "The backend was unavailable, so the sandbox switched to demo data.",
    };
  }
}

export function useAgencyData() {
  const queryClient = useQueryClient();
  const { companyId, isLoading: companyLoading } = useActiveCompany();

  const snapshotQueryKey = [...SNAPSHOT_QUERY_KEY, companyId] as const;

  const snapshotQuery = useQuery({
    queryKey: snapshotQueryKey,
    queryFn: () => loadAgencySnapshot(companyId),
    enabled: !companyLoading,
    refetchInterval: (query) => (query.state.data?.source === "server" ? 10_000 : false),
  });

  const createIssueMutation = useMutation({
    mutationFn: async (input: CreateIssueInput) => {
      const current = (queryClient.getQueryData(snapshotQueryKey) as AgencySnapshot | undefined) ?? DEMO_SNAPSHOT;

      if (current.source !== "server") {
        return createDemoIssue(current, input);
      }

      try {
        await createIssueRecord({
          companyId: current.company.id,
          projectId: input.projectId,
          assigneeAgentId: input.assigneeAgentId,
          title: input.title,
          description: input.description,
          priority: input.priority,
        });
      } catch {
        return createDemoIssue(current, input);
      }

      return await loadAgencySnapshot(companyId);
    },
    onSuccess: (snapshot) => {
      queryClient.setQueryData(snapshotQueryKey, snapshot);
    },
  });

  return {
    ...snapshotQuery,
    snapshot: snapshotQuery.data ?? DEMO_SNAPSHOT,
    createIssue: createIssueMutation.mutateAsync,
    isCreatingIssue: createIssueMutation.isPending,
  };
}
