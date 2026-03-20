export function toTimestamp(value: string | null | undefined): number {
  if (!value) return 0;
  return new Date(value).getTime();
}

export function relativeTime(value: string | null | undefined): string {
  const timestamp = toTimestamp(value);
  if (!timestamp) return "Just now";

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.round(diffMs / 60_000);

  if (diffMinutes <= 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;

  return new Date(timestamp).toLocaleDateString();
}

export function formatUsd(value: number | null | undefined): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

export function formatTokens(value: number | null | undefined): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value ?? 0);
}

export function agentHref(agentId: string): string {
  return `/agents/${agentId}`;
}

export function issueHref(issueId: string): string {
  return `/issues/${issueId}`;
}

export function approvalHref(approvalId: string): string {
  return `/approvals/${approvalId}`;
}

export function runHref(runId: string): string {
  return `/runs/${runId}`;
}

export function projectHref(projectId: string): string {
  return `/projects/${projectId}`;
}
