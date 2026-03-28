import { requestServerJson, requestServerVoid, type ServerActorContext } from "./http";

export async function createIssueRecord(input: ServerActorContext & {
  companyId: string;
  projectId?: string | null;
  assigneeAgentId?: string | null;
  title: string;
  description?: string | null;
  priority: string;
}): Promise<{ id: string; identifier: string }> {
  return requestServerJson<{ id: string; identifier: string }>("/api/issues", {
    method: "POST",
    actor: input,
    body: {
      companyId: input.companyId,
      projectId: input.projectId ?? null,
      assigneeAgentId: input.assigneeAgentId ?? null,
      title: input.title,
      description: input.description ?? null,
      priority: input.priority,
    },
  });
}

export async function updateIssueStatusRecord(input: ServerActorContext & {
  issueId: string;
  status: string;
}): Promise<void> {
  await requestServerVoid(`/api/issues/${input.issueId}/status`, {
    method: "PATCH",
    actor: input,
    body: {
      status: input.status,
    },
  });
}
