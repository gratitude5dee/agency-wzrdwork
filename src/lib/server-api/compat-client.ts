/**
 * Agency Compatibility API Client
 *
 * This module provides an async API client that calls the canonical Paperclip/Express backend
 * and returns data in shapes that Agency's existing React hooks expect.
 *
 * It uses the native fetch API and is designed to work from both the UI/browser context
 * (via environment variables) and the server context.
 */

// Local type stubs — the canonical types live in @paperclipai/shared which is
// only available inside the full monorepo.  For the Lovable/Vite build we
// define minimal compatible interfaces here.
interface Agent { id: string; name: string; [k: string]: unknown }
interface Project { id: string; name: string; [k: string]: unknown }
interface Issue { id: string; title: string; [k: string]: unknown }
interface Goal { id: string; title: string; [k: string]: unknown }
interface Approval { id: string; status: string; [k: string]: unknown }
interface DashboardSummary { [k: string]: unknown }
interface ActivityEvent { id: string; action: string; [k: string]: unknown }
interface CompanySecret { id: string; name: string; [k: string]: unknown }

export interface ApiClientConfig {
  baseUrl?: string;
  headers?: Record<string, string>;
}

export class CompatApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "CompatApiError";
    this.status = status;
    this.body = body;
  }
}

/**
 * Get the API base URL from environment or config.
 * Defaults to /api for browser context (which uses vite proxy to localhost:3100)
 */
function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (envUrl) return envUrl.replace(/\/$/, "");
  // Default to /api (which proxies to localhost:3100 in vite dev)
  return "/api";
}

/**
 * Make a request to the API and return JSON
 */
async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${path}`;

  const headers = new Headers(init?.headers ?? undefined);
  const body = init?.body;

  if (!(body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...init,
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    let errorBody: unknown = null;
    try {
      errorBody = await response.json();
    } catch {
      errorBody = null;
    }

    const errorMessage =
      errorBody &&
      typeof errorBody === "object" &&
      "error" in errorBody &&
      typeof (errorBody as { error?: unknown }).error === "string"
        ? (errorBody as { error: string }).error
        : `API request failed: ${response.status}`;

    throw new CompatApiError(errorMessage, response.status, errorBody);
  }

  const text = await response.text();
  return text ? (JSON.parse(text) as T) : ({} as T);
}

/**
 * Fetch all agents for a company
 */
export async function fetchAgents(companyId: string): Promise<Agent[]> {
  const response = await request<{ agents?: Agent[] }>(
    `/agents?companyId=${encodeURIComponent(companyId)}`,
  );
  return response.agents ?? [];
}

/**
 * Fetch a specific agent by ID
 */
export async function fetchAgent(id: string): Promise<Agent> {
  return request<Agent>(`/agents/${encodeURIComponent(id)}`);
}

/**
 * Fetch all projects for a company
 */
export async function fetchProjects(companyId: string): Promise<Project[]> {
  const response = await request<{ projects?: Project[] }>(
    `/companies/${encodeURIComponent(companyId)}/projects`,
  );
  return response.projects ?? [];
}

/**
 * Fetch all issues for a company with optional filters
 */
export async function fetchIssues(
  companyId: string,
  filters?: {
    status?: string;
    projectId?: string;
    assigneeAgentId?: string;
    assigneeUserId?: string;
    touchedByUserId?: string;
    unreadForUserId?: string;
    labelId?: string;
    q?: string;
  },
): Promise<Issue[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.projectId) params.set("projectId", filters.projectId);
  if (filters?.assigneeAgentId) params.set("assigneeAgentId", filters.assigneeAgentId);
  if (filters?.assigneeUserId) params.set("assigneeUserId", filters.assigneeUserId);
  if (filters?.touchedByUserId) params.set("touchedByUserId", filters.touchedByUserId);
  if (filters?.unreadForUserId) params.set("unreadForUserId", filters.unreadForUserId);
  if (filters?.labelId) params.set("labelId", filters.labelId);
  if (filters?.q) params.set("q", filters.q);

  const qs = params.toString();
  const path = `/companies/${encodeURIComponent(companyId)}/issues${qs ? `?${qs}` : ""}`;
  const response = await request<{ issues?: Issue[] }>(path);
  return response.issues ?? [];
}

/**
 * Fetch all goals for a company
 */
export async function fetchGoals(companyId: string): Promise<Goal[]> {
  const response = await request<{ goals?: Goal[] }>(
    `/companies/${encodeURIComponent(companyId)}/goals`,
  );
  return response.goals ?? [];
}

/**
 * Fetch all approvals for a company
 */
export async function fetchApprovals(
  companyId: string,
  status?: string,
): Promise<Approval[]> {
  const params = status ? `?status=${encodeURIComponent(status)}` : "";
  const response = await request<{ approvals?: Approval[] }>(
    `/companies/${encodeURIComponent(companyId)}/approvals${params}`,
  );
  return response.approvals ?? [];
}

/**
 * Fetch dashboard summary for a company
 */
export async function fetchDashboard(companyId: string): Promise<DashboardSummary> {
  return request<DashboardSummary>(
    `/companies/${encodeURIComponent(companyId)}/dashboard`,
  );
}

/**
 * Fetch cost summary for a company
 */
export async function fetchCosts(
  companyId: string,
  from?: string,
  to?: string,
): Promise<Record<string, unknown>> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const qs = params.toString();

  return request<Record<string, unknown>>(
    `/companies/${encodeURIComponent(companyId)}/costs/summary${qs ? `?${qs}` : ""}`,
  );
}

/**
 * Fetch activity events for a company
 */
export async function fetchActivity(companyId: string): Promise<ActivityEvent[]> {
  const response = await request<{ activity?: ActivityEvent[] }>(
    `/companies/${encodeURIComponent(companyId)}/activity`,
  );
  return response.activity ?? [];
}

/**
 * Fetch secrets for a company
 */
export async function fetchSecrets(companyId: string): Promise<CompanySecret[]> {
  const response = await request<{ secrets?: CompanySecret[] }>(
    `/companies/${encodeURIComponent(companyId)}/secrets`,
  );
  return response.secrets ?? [];
}

/**
 * Export all functions as a namespace for convenience
 */
export const compatApi = {
  fetchAgents,
  fetchAgent,
  fetchProjects,
  fetchIssues,
  fetchGoals,
  fetchApprovals,
  fetchDashboard,
  fetchCosts,
  fetchActivity,
  fetchSecrets,
};
