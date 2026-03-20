export type LiveEventName =
  | "activity.created"
  | "agent.created"
  | "agent.updated"
  | "agent.wakeup_enqueued"
  | "approval.created"
  | "approval.updated"
  | "budget.incident"
  | "company.updated"
  | "dashboard.updated"
  | "goal.created"
  | "goal.deleted"
  | "goal.updated"
  | "integration.updated"
  | "issue.created"
  | "issue.updated"
  | "plugin.updated"
  | "project.created"
  | "project.deleted"
  | "project.updated"
  | "project.workspace_created"
  | "project.workspace_deleted"
  | "project.workspace_updated"
  | "run.updated"
  | "secret.deleted"
  | "secret.rotated";

export interface SidebarBadges {
  inbox: number;
  approvals: number;
  failedRuns: number;
  joinRequests: number;
}

export interface InstanceExperimentalSettings {
  enableIsolatedWorkspaces: boolean;
}

export interface ProjectWorkspaceRecord {
  id: string;
  companyId: string;
  projectId: string;
  name: string;
  sourceType: string;
  cwd: string | null;
  repoUrl: string | null;
  repoRef: string | null;
  defaultRef: string | null;
  visibility: string;
  setupCommand: string | null;
  cleanupCommand: string | null;
  remoteProvider: string | null;
  remoteWorkspaceRef: string | null;
  sharedWorkspaceKey: string | null;
  metadata: Record<string, unknown> | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PluginId = string;
export type PluginVersion = `${number}.${number}.${number}`;
export type PluginEntrypoint = string;

export interface PluginWorkerConfig {
  runtime: "node" | "webworker";
  timeoutMs?: number;
}

export interface PluginCommandArgument {
  name: string;
  description?: string;
  required?: boolean;
  defaultValue?: string;
}

export interface PluginCommand {
  name: string;
  description?: string;
  arguments?: PluginCommandArgument[];
}

export interface PluginScaffoldFile {
  path: string;
  content: string;
  executable?: boolean;
}

export interface PluginScaffoldTemplate {
  name: string;
  description?: string;
  files: PluginScaffoldFile[];
}

export interface PluginManifest {
  id: PluginId;
  name: string;
  description?: string;
  version: PluginVersion;
  entrypoint: PluginEntrypoint;
  worker?: PluginWorkerConfig;
  commands?: PluginCommand[];
  scaffold?: PluginScaffoldTemplate[];
  metadata?: Record<string, unknown>;
}

export type PluginRpcMethod = "ping" | "manifest" | "run" | "scaffold";

export type PluginRpcRequestMap = {
  ping: Record<string, never>;
  manifest: Record<string, never>;
  run: {
    input?: unknown;
  };
  scaffold: {
    targetDir: string;
    pluginName?: string;
  };
};

export type PluginRpcResponseMap = {
  ping: {
    ok: true;
    version: PluginVersion;
  };
  manifest: {
    ok: true;
    manifest: PluginManifest;
  };
  run: {
    ok: true;
    output: unknown;
  };
  scaffold: {
    ok: true;
    files: PluginScaffoldFile[];
  };
};

export interface PluginRpcError {
  code: string;
  message: string;
  details?: unknown;
}

export interface PluginRpcRequest<TMethod extends PluginRpcMethod = PluginRpcMethod> {
  id: string;
  method: TMethod;
  params: PluginRpcRequestMap[TMethod];
}

export interface PluginRpcSuccessResponse<
  TMethod extends PluginRpcMethod = PluginRpcMethod,
> {
  id: string;
  method: TMethod;
  result: PluginRpcResponseMap[TMethod];
}

export interface PluginRpcFailureResponse {
  id: string;
  method: PluginRpcMethod;
  error: PluginRpcError;
}

export type PluginRpcMessage = PluginRpcRequest | PluginRpcSuccessResponse | PluginRpcFailureResponse;
