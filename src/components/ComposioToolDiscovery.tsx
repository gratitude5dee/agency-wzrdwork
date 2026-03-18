/**
 * ComposioToolDiscovery — tool discovery and selection surface for the Composio
 * integration. Fetches available tools from the Composio MCP endpoint and lets
 * the user select which tools to enable for the current company.
 *
 * Used on both the Integrations page config dialog and inside the OpenClaw
 * adapter configuration fields.
 */

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Loader2, AlertCircle, Check, Wrench } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ComposioTool {
  name: string;
  description?: string;
}

interface ComposioToolDiscoveryProps {
  /** Consumer key for MCP auth */
  consumerKey: string;
  /** MCP server URL */
  mcpUrl?: string;
  /** Currently selected tool names */
  selectedTools: string[];
  /** Callback when selection changes */
  onSelectionChange: (tools: string[]) => void;
  /** Compact mode hides the header and reduces spacing */
  compact?: boolean;
}

// ---------------------------------------------------------------------------
// Well-known Composio tools (fallback when MCP fetch unavailable)
// ---------------------------------------------------------------------------

const WELL_KNOWN_TOOLS: ComposioTool[] = [
  { name: "GMAIL_SEND_EMAIL", description: "Send emails via Gmail" },
  { name: "GMAIL_GET_EMAILS", description: "Fetch emails from Gmail" },
  { name: "SLACK_SEND_MESSAGE", description: "Send messages to Slack channels" },
  { name: "SLACK_GET_MESSAGES", description: "Get messages from Slack channels" },
  { name: "GITHUB_CREATE_ISSUE", description: "Create GitHub issues" },
  { name: "GITHUB_GET_REPO", description: "Get GitHub repository info" },
  { name: "GITHUB_CREATE_PR", description: "Create GitHub pull requests" },
  { name: "NOTION_CREATE_PAGE", description: "Create Notion pages" },
  { name: "NOTION_GET_DATABASE", description: "Query Notion databases" },
  { name: "LINEAR_CREATE_ISSUE", description: "Create Linear issues" },
  { name: "LINEAR_GET_ISSUES", description: "Get Linear issues" },
  { name: "JIRA_CREATE_ISSUE", description: "Create Jira issues" },
  { name: "JIRA_GET_ISSUES", description: "Get Jira issues" },
  { name: "GOOGLE_CALENDAR_CREATE_EVENT", description: "Create Google Calendar events" },
  { name: "GOOGLE_CALENDAR_GET_EVENTS", description: "Get Google Calendar events" },
  { name: "GOOGLE_DRIVE_UPLOAD_FILE", description: "Upload files to Google Drive" },
  { name: "HUBSPOT_CREATE_CONTACT", description: "Create HubSpot contacts" },
  { name: "SALESFORCE_CREATE_LEAD", description: "Create Salesforce leads" },
  { name: "TRELLO_CREATE_CARD", description: "Create Trello cards" },
  { name: "DISCORD_SEND_MESSAGE", description: "Send messages to Discord" },
];

// ---------------------------------------------------------------------------
// Fetch tools from Composio MCP
// ---------------------------------------------------------------------------

async function fetchComposioTools(
  mcpUrl: string,
  consumerKey: string,
): Promise<ComposioTool[]> {
  const body = JSON.stringify({ jsonrpc: "2.0", id: "1", method: "tools/list" });

  const resp = await fetch(mcpUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "x-consumer-api-key": consumerKey,
    },
    body,
  });

  if (!resp.ok) {
    throw new Error(`MCP server returned ${resp.status}`);
  }

  const raw = await resp.text();

  // Response may be SSE (event: message\ndata: {...}) or plain JSON
  let jsonStr = raw;
  const dataMatch = raw.match(/^data:\s*(.+)$/m);
  if (dataMatch) jsonStr = dataMatch[1];

  const parsed = JSON.parse(jsonStr);
  if (parsed.error) throw new Error(parsed.error.message ?? JSON.stringify(parsed.error));

  return (parsed.result?.tools ?? []).map(
    (t: { name: string; description?: string }) => ({
      name: t.name,
      description: t.description ?? "",
    }),
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ComposioToolDiscovery({
  consumerKey,
  mcpUrl = "https://connect.composio.dev/mcp",
  selectedTools,
  onSelectionChange,
  compact,
}: ComposioToolDiscoveryProps) {
  const [search, setSearch] = useState("");

  // Fetch tools from MCP endpoint
  const {
    data: fetchedTools,
    isLoading,
    error,
  } = useQuery<ComposioTool[]>({
    queryKey: ["composio-tools", consumerKey, mcpUrl],
    enabled: !!consumerKey,
    queryFn: () => fetchComposioTools(mcpUrl, consumerKey),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  // Use fetched tools or fall back to well-known list
  const availableTools = fetchedTools ?? WELL_KNOWN_TOOLS;
  const isUsingFallback = !fetchedTools && !isLoading;

  // Filter tools by search
  const filteredTools = useMemo(() => {
    if (!search.trim()) return availableTools;
    const q = search.toLowerCase();
    return availableTools.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.description ?? "").toLowerCase().includes(q),
    );
  }, [availableTools, search]);

  const selectedSet = useMemo(() => new Set(selectedTools), [selectedTools]);

  const toggleTool = (toolName: string) => {
    const next = new Set(selectedSet);
    if (next.has(toolName)) {
      next.delete(toolName);
    } else {
      next.add(toolName);
    }
    onSelectionChange(Array.from(next));
  };

  const selectAll = () => {
    onSelectionChange(filteredTools.map((t) => t.name));
  };

  const clearAll = () => {
    onSelectionChange([]);
  };

  return (
    <div className={cn("space-y-3", compact && "space-y-2")}>
      {!compact && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-zinc-400" />
            <span className="text-sm font-semibold text-zinc-200">Composio Tools</span>
          </div>
          <Badge variant="secondary" className="text-xs">
            {selectedTools.length} selected
          </Badge>
        </div>
      )}

      {compact && (
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Composio Tools
          </span>
          <Badge variant="secondary" className="text-xs">
            {selectedTools.length} selected
          </Badge>
        </div>
      )}

      {/* No consumer key */}
      {!consumerKey && (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3 text-xs text-yellow-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            Enter a Composio consumer key to discover available tools.
            Get yours from{" "}
            <a
              href="https://dashboard.composio.dev/settings"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              dashboard.composio.dev
            </a>
          </span>
        </div>
      )}

      {/* Loading */}
      {consumerKey && isLoading && (
        <div className="flex items-center gap-2 py-4 text-xs text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Discovering tools…</span>
        </div>
      )}

      {/* Error */}
      {consumerKey && error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            Could not fetch tools from MCP. Using well-known tool catalog.
            {error instanceof Error ? ` (${error.message})` : ""}
          </span>
        </div>
      )}

      {/* Search + actions */}
      {consumerKey && !isLoading && (
        <>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
              <Input
                placeholder="Search tools…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 border-white/10 bg-black pl-8 text-xs text-zinc-100 placeholder:text-zinc-600"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs text-zinc-400 hover:text-zinc-200"
              onClick={selectAll}
            >
              All
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs text-zinc-400 hover:text-zinc-200"
              onClick={clearAll}
            >
              None
            </Button>
          </div>

          {isUsingFallback && (
            <p className="text-[10px] text-zinc-600">
              Showing well-known tools. Connect with a valid consumer key for full discovery.
            </p>
          )}

          {/* Tool list */}
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-white/5 bg-black/40 p-2">
            {filteredTools.length === 0 && (
              <p className="py-4 text-center text-xs text-zinc-600">
                No tools match your search.
              </p>
            )}
            {filteredTools.map((tool) => {
              const isSelected = selectedSet.has(tool.name);
              return (
                <button
                  key={tool.name}
                  type="button"
                  onClick={() => toggleTool(tool.name)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                    isSelected
                      ? "bg-blue-500/10 text-blue-300"
                      : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                      isSelected ? "border-blue-500 bg-blue-500" : "border-white/20",
                    )}
                  >
                    {isSelected && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="font-mono text-[11px]">{tool.name}</span>
                    {tool.description && (
                      <span className="ml-2 text-zinc-600">{tool.description}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
