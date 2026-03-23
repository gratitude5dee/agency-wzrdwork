import { useEffect, useState } from "react";
import { Link, useParams } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import {
  ExternalLink,
  GitBranch,
  Code2,
  Terminal,
  FolderTree,
  Activity,
  Cpu,
  AlertCircle,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  Loader2,
  MoreHorizontal,
  ArrowUpRight,
  Zap,
  Download,
} from "lucide-react";
import { executionWorkspacesApi } from "../api/execution-workspaces";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { cn, formatCents, formatTokens, relativeTime } from "../lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import type { ExecutionWorkspace } from "@paperclipai/shared";

interface WorkspaceRun {
  id: string;
  agentId: string;
  agentName: string;
  status: "running" | "completed" | "failed" | "cancelled";
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  tokensUsed?: number;
  costCents?: number;
  exitCode?: number;
  summary?: string;
}

interface WorkspaceOperation {
  id: string;
  type: "git_clone" | "npm_install" | "setup" | "cleanup" | "build";
  status: "running" | "success" | "failure";
  startedAt: string;
  durationMs?: number;
  output?: string;
}

interface FileNode {
  id: string;
  name: string;
  type: "file" | "directory";
  children?: FileNode[];
  size?: number;
}

function isSafeExternalUrl(value: string | null | undefined) {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { bg: string; text: string; icon: any }> = {
    running: { bg: "bg-blue-500/10", text: "text-blue-700 dark:text-blue-400", icon: Loader2 },
    completed: { bg: "bg-green-500/10", text: "text-green-700 dark:text-green-400", icon: CheckCircle2 },
    failed: { bg: "bg-red-500/10", text: "text-red-700 dark:text-red-400", icon: AlertCircle },
    cancelled: { bg: "bg-slate-500/10", text: "text-slate-700 dark:text-slate-400", icon: Clock },
    active: { bg: "bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-400", icon: Zap },
    idle: { bg: "bg-slate-500/10", text: "text-slate-700 dark:text-slate-400", icon: AlertCircle },
    error: { bg: "bg-red-500/10", text: "text-red-700 dark:text-red-400", icon: AlertCircle },
  };

  const variant = variants[status] || variants.idle;
  const Icon = variant.icon;

  return (
    <div className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium", variant.bg, variant.text)}>
      <Icon className={cn("h-3 w-3", status === "running" && "animate-spin")} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </div>
  );
}

function FileTreeItem({ node, level = 0 }: { node: FileNode; level?: number }) {
  const [isOpen, setIsOpen] = useState(level < 2);
  const hasChildren = node.type === "directory" && node.children && node.children.length > 0;

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-2 py-1 hover:bg-muted rounded text-sm text-foreground"
      >
        {hasChildren && (
          <span className="text-muted-foreground text-xs">
            {isOpen ? "▼" : "▶"}
          </span>
        )}
        {!hasChildren && <span className="w-3" />}

        {node.type === "directory" ? (
          <Code2 className="h-4 w-4 text-blue-500" />
        ) : (
          <span className="h-4 w-4 text-slate-500">📄</span>
        )}
        <span className="truncate">{node.name}</span>
        {node.size && (
          <span className="text-xs text-muted-foreground ml-auto shrink-0">
            {(node.size / 1024).toFixed(1)}KB
          </span>
        )}
      </button>

      {hasChildren && isOpen && (
        <div className="pl-2 border-l border-border">
          {node.children!.map((child) => (
            <FileTreeItem key={child.id} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

const MOCK_FILE_TREE: FileNode = {
  id: "root",
  name: "project-root",
  type: "directory",
  children: [
    {
      id: "src",
      name: "src",
      type: "directory",
      children: [
        { id: "src-main", name: "main.tsx", type: "file", size: 2048 },
        { id: "src-app", name: "App.tsx", type: "file", size: 5120 },
        { id: "src-components", name: "components", type: "directory", children: [
          { id: "src-comp-button", name: "Button.tsx", type: "file", size: 1024 },
          { id: "src-comp-header", name: "Header.tsx", type: "file", size: 3072 },
        ]},
      ],
    },
    { id: "public", name: "public", type: "directory", children: [
      { id: "pub-index", name: "index.html", type: "file", size: 512 },
    ]},
    { id: "package", name: "package.json", type: "file", size: 1536 },
    { id: "tsconfig", name: "tsconfig.json", type: "file", size: 1024 },
    { id: "vite", name: "vite.config.ts", type: "file", size: 512 },
  ],
};

const MOCK_RUNS: WorkspaceRun[] = [
  {
    id: "run-1",
    agentId: "agent-1",
    agentName: "DevOps AI",
    status: "completed",
    startedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    endedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    durationMs: 900000,
    tokensUsed: 5420,
    costCents: 54,
    exitCode: 0,
    summary: "Deployed v1.2.3 to production",
  },
  {
    id: "run-2",
    agentId: "agent-2",
    agentName: "Code Inspector",
    status: "completed",
    startedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    endedAt: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
    durationMs: 300000,
    tokensUsed: 3150,
    costCents: 32,
    exitCode: 0,
    summary: "Ran linting and tests",
  },
  {
    id: "run-3",
    agentId: "agent-1",
    agentName: "DevOps AI",
    status: "failed",
    startedAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
    endedAt: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
    durationMs: 300000,
    tokensUsed: 2100,
    costCents: 21,
    exitCode: 1,
    summary: "Build failed: dependency resolution error",
  },
];

const MOCK_OPERATIONS: WorkspaceOperation[] = [
  {
    id: "op-1",
    type: "git_clone",
    status: "success",
    startedAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    durationMs: 45000,
    output: "Repository cloned successfully from GitHub",
  },
  {
    id: "op-2",
    type: "npm_install",
    status: "success",
    startedAt: new Date(Date.now() - 1000 * 60 * 75).toISOString(),
    durationMs: 120000,
    output: "Installed 245 packages",
  },
  {
    id: "op-3",
    type: "build",
    status: "success",
    startedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    durationMs: 45000,
    output: "Build completed in 45s",
  },
];

const MOCK_TERMINAL_OUTPUT = `> npm run build
npm notice created a lockfile as package-lock.json. You should commit this file.
npm notice found 0 vulnerabilities

> vite build

vite v5.0.0 building for production...
✓ 127 modules transformed.
dist/index.html          0.48 kB │ gzip: 0.31 kB
dist/index-abc123.js   145.23 kB │ gzip: 45.21 kB
dist/style-xyz789.css   23.12 kB │ gzip: 5.42 kB

✓ built in 45.23s
`;

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="w-32 shrink-0 text-xs font-medium text-muted-foreground">{label}</div>
      <div className="min-w-0 flex-1 text-sm">{children}</div>
    </div>
  );
}

export function ExecutionWorkspaceDetail() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { setBreadcrumbs } = useBreadcrumbs();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState("overview");

  const { data: workspace, isLoading, error } = useQuery({
    queryKey: queryKeys.executionWorkspaces.detail(workspaceId!),
    queryFn: () => executionWorkspacesApi.get(workspaceId!),
    enabled: Boolean(workspaceId),
  });

  useEffect(() => {
    if (workspace) {
      setBreadcrumbs([
        { label: "Workspaces", href: "/execution-workspaces" },
        { label: workspace.name },
      ]);
    }
  }, [workspace, setBreadcrumbs]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900 dark:text-red-200">
              Failed to load workspace
            </h3>
            <p className="text-sm text-red-800 dark:text-red-300 mt-1">
              {error instanceof Error ? error.message : "An unexpected error occurred"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!workspace) return null;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold">{workspace.name}</h1>
              <StatusBadge status={workspace.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {workspace.mode} · {workspace.providerType}
            </p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Terminal className="h-4 w-4 mr-2" />
                Open in Terminal
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Code2 className="h-4 w-4 mr-2" />
                View Diff
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive">
                <Loader2 className="h-4 w-4 mr-2" />
                Clean Workspace
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="runs">Runs</TabsTrigger>
          <TabsTrigger value="terminal">Terminal</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="operations">Operations</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Git Info */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <GitBranch className="h-5 w-5" />
                Git Information
              </h2>
              <div className="space-y-3">
                <DetailRow label="Branch">
                  <div className="flex items-center gap-2">
                    <code className="bg-muted px-2 py-1 rounded text-xs font-mono">
                      {workspace.branchName || "None"}
                    </code>
                  </div>
                </DetailRow>
                <DetailRow label="Base ref">
                  <code className="bg-muted px-2 py-1 rounded text-xs font-mono">
                    {workspace.baseRef || "None"}
                  </code>
                </DetailRow>
                <DetailRow label="Repo URL">
                  {workspace.repoUrl && isSafeExternalUrl(workspace.repoUrl) ? (
                    <a
                      href={workspace.repoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      {workspace.repoUrl}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <code className="text-xs">{workspace.repoUrl || "None"}</code>
                  )}
                </DetailRow>
                <Separator />
                <DetailRow label="Working dir">
                  <div className="flex items-center gap-2">
                    <code className="bg-muted px-2 py-1 rounded text-xs font-mono flex-1 truncate">
                      {workspace.cwd || "None"}
                    </code>
                    <button
                      onClick={() => copyToClipboard(workspace.cwd || "", "cwd")}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {copiedId === "cwd" ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </DetailRow>
              </div>
            </Card>

            {/* Status & References */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Workspace Details
              </h2>
              <div className="space-y-3">
                <DetailRow label="Provider ref">
                  <code className="text-xs">{workspace.providerRef || "None"}</code>
                </DetailRow>
                <DetailRow label="Project">
                  {workspace.projectId ? (
                    <Link
                      to={`/projects/${workspace.projectId}`}
                      className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    >
                      {workspace.projectId}
                    </Link>
                  ) : (
                    "None"
                  )}
                </DetailRow>
                <DetailRow label="Source issue">
                  {workspace.sourceIssueId ? (
                    <Link
                      to={`/issues/${workspace.sourceIssueId}`}
                      className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    >
                      {workspace.sourceIssueId}
                    </Link>
                  ) : (
                    "None"
                  )}
                </DetailRow>
                <Separator />
                <DetailRow label="Opened">
                  {new Date(workspace.openedAt).toLocaleString()}
                </DetailRow>
                <DetailRow label="Last used">
                  {new Date(workspace.lastUsedAt).toLocaleString()}
                </DetailRow>
              </div>
            </Card>
          </div>

          {/* Resource Usage */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Cpu className="h-5 w-5" />
              Resource Usage
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">CPU Usage</div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500" style={{ width: "45%" }} />
                </div>
                <div className="text-sm font-semibold">45%</div>
              </div>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Memory Usage</div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-green-500" style={{ width: "62%" }} />
                </div>
                <div className="text-sm font-semibold">2.48 GB / 4 GB</div>
              </div>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Disk Usage</div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500" style={{ width: "78%" }} />
                </div>
                <div className="text-sm font-semibold">3.12 GB / 4 GB</div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Runs Tab */}
        <TabsContent value="runs" className="space-y-4">
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 text-sm font-semibold text-muted-foreground">
                      Run ID
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-muted-foreground">
                      Agent
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-muted-foreground">
                      Status
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-muted-foreground">
                      Duration
                    </th>
                    <th className="text-right px-4 py-3 text-sm font-semibold text-muted-foreground">
                      Tokens
                    </th>
                    <th className="text-right px-4 py-3 text-sm font-semibold text-muted-foreground">
                      Cost
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_RUNS.map((run) => (
                    <tr key={run.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3 text-sm font-mono text-muted-foreground">
                        {run.id.slice(0, 12)}
                      </td>
                      <td className="px-4 py-3 text-sm">{run.agentName}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={run.status} />
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {run.durationMs
                          ? `${(run.durationMs / 1000).toFixed(1)}s`
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        {run.tokensUsed ? formatTokens(run.tokensUsed) : "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold">
                        {run.costCents ? formatCents(run.costCents) : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Terminal Tab */}
        <TabsContent value="terminal" className="space-y-4">
          <Card className="bg-black">
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white">Live Output</h3>
                <Button variant="ghost" size="sm" className="text-white hover:bg-white/10">
                  <Download className="h-4 w-4" />
                </Button>
              </div>
              <ScrollArea className="h-96 rounded bg-black">
                <pre className="p-4 text-xs font-mono text-green-400 whitespace-pre-wrap break-words">
                  {MOCK_TERMINAL_OUTPUT}
                </pre>
              </ScrollArea>
            </div>
          </Card>
        </TabsContent>

        {/* Files Tab */}
        <TabsContent value="files" className="space-y-4">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FolderTree className="h-5 w-5" />
              Project Structure
            </h2>
            <ScrollArea className="h-96 border border-border rounded-lg p-4">
              <FileTreeItem node={MOCK_FILE_TREE} />
            </ScrollArea>
          </Card>
        </TabsContent>

        {/* Operations Tab */}
        <TabsContent value="operations" className="space-y-4">
          <div className="space-y-3">
            {MOCK_OPERATIONS.map((op) => (
              <Card key={op.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-sm font-semibold capitalize">
                        {op.type.replace(/_/g, " ")}
                      </h3>
                      {op.status === "success" && (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      )}
                      {op.status === "failure" && (
                        <AlertCircle className="h-4 w-4 text-red-600" />
                      )}
                      {op.status === "running" && (
                        <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Started {relativeTime(op.startedAt)}
                      {op.durationMs && ` · ${(op.durationMs / 1000).toFixed(1)}s`}
                    </p>
                    {op.output && (
                      <p className="text-xs text-muted-foreground mt-2 italic">
                        {op.output}
                      </p>
                    )}
                  </div>
                  <Badge
                    variant={
                      op.status === "success"
                        ? "default"
                        : op.status === "failure"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {op.status.charAt(0).toUpperCase() + op.status.slice(1)}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
