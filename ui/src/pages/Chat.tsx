import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Send,
  Loader2,
  Plus,
  MessageSquare,
  Zap,
  Settings,
  ChevronDown,
  Copy,
  Check,
  ChevronRight,
  Clock,
} from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { agentsApi } from "../api/agents";
import { queryKeys } from "../lib/queryKeys";
import { cn, formatCents, relativeTime, formatTokens } from "../lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { Agent } from "@paperclipai/shared";

interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output?: string;
  status: "running" | "success" | "error";
  durationMs?: number;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  timestamp: string;
  agentId?: string;
  agentName?: string;
  toolCalls?: ToolCall[];
  thinking?: string;
  tokenUsage?: { input: number; output: number; cost: number };
}

interface ChatSession {
  id: string;
  title: string;
  agentId: string;
  agentName: string;
  createdAt: string;
  messageCount: number;
  lastMessage?: string;
}

// Mock data for development
const MOCK_SESSIONS: ChatSession[] = [
  {
    id: "session-1",
    title: "Project Setup Help",
    agentId: "agent-1",
    agentName: "DevOps AI",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    messageCount: 12,
    lastMessage: "Here's the Docker configuration...",
  },
  {
    id: "session-2",
    title: "Code Review Discussion",
    agentId: "agent-2",
    agentName: "Code Inspector",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    messageCount: 8,
    lastMessage: "The function complexity looks good.",
  },
  {
    id: "session-3",
    title: "API Design Feedback",
    agentId: "agent-3",
    agentName: "Architecture Guide",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    messageCount: 15,
    lastMessage: "RESTful endpoints should follow...",
  },
];

function StreamingIndicator() {
  return (
    <div className="flex items-center gap-1">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse delay-100" />
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse delay-200" />
    </div>
  );
}

function ToolCallCard({
  tool,
  agentName,
}: {
  tool: ToolCall;
  agentName: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const statusColor = {
    running: "bg-blue-500",
    success: "bg-green-500",
    error: "bg-red-500",
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
      <CollapsibleTrigger asChild>
        <button className="w-full text-left">
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-3 hover:bg-muted transition-colors">
            <div className={cn("h-2 w-2 rounded-full", statusColor[tool.status])} />
            <div className="flex-1 min-w-0">
              <div className="font-mono text-sm font-medium">{tool.name}</div>
              <div className="text-xs text-muted-foreground">
                Tool call {tool.status === "running" ? "in progress" : tool.status}
                {tool.durationMs && ` · ${tool.durationMs}ms`}
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 transition-transform" />
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2 rounded-lg border border-border bg-muted/30 p-3">
        <div>
          <div className="text-xs font-semibold text-muted-foreground mb-2">
            Input
          </div>
          <pre className="bg-black rounded p-2 text-xs text-green-400 overflow-auto max-h-40">
            {JSON.stringify(tool.input, null, 2)}
          </pre>
        </div>
        {tool.output && (
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2">
              Output
            </div>
            <pre className="bg-black rounded p-2 text-xs text-green-400 overflow-auto max-h-40">
              {tool.output}
            </pre>
          </div>
        )}
        {tool.status === "error" && (
          <div className="bg-red-500/10 border border-red-500/20 rounded p-2">
            <div className="text-xs text-red-600">Tool execution failed</div>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

function ThinkingBlock({ thinking }: { thinking: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
      <CollapsibleTrigger asChild>
        <button className="w-full text-left">
          <div className="flex items-center gap-3 rounded-lg border border-border bg-amber-500/10 p-3 hover:bg-amber-500/20 transition-colors">
            <Zap className="h-4 w-4 text-amber-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-amber-900">
                Agent Thinking
              </div>
              <div className="text-xs text-amber-800/70">
                {thinking.length} characters
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 transition-transform" />
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 rounded-lg border border-border bg-muted/30 p-3">
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
          {thinking}
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}

function MessageContent({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="text-sm text-foreground whitespace-pre-wrap break-words">
        {message.content}
      </div>
    );
  }

  if (message.role === "assistant") {
    return (
      <div className="space-y-3">
        <div className="text-sm text-foreground whitespace-pre-wrap break-words">
          {message.content}
        </div>
        {message.thinking && <ThinkingBlock thinking={message.thinking} />}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="space-y-2 pt-2">
            <div className="text-xs font-semibold text-muted-foreground">
              Tool Calls ({message.toolCalls.length})
            </div>
            {message.toolCalls.map((tool) => (
              <ToolCallCard
                key={tool.id}
                tool={tool}
                agentName={message.agentName || "Agent"}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return <div className="text-xs text-muted-foreground">{message.content}</div>;
}

function MessageBubble({ message, agent }: { message: ChatMessage; agent?: Agent }) {
  const isUser = message.role === "user";
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopiedId(message.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div
      className={cn(
        "flex gap-3 animate-in fade-in slide-in-from-bottom-2",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      <div
        className={cn(
          "h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0",
          isUser ? "bg-blue-600" : "bg-slate-700"
        )}
      >
        {isUser ? "You" : (message.agentName || "Agent").charAt(0).toUpperCase()}
      </div>
      <div
        className={cn(
          "flex-1 max-w-2xl rounded-lg p-4",
          isUser
            ? "bg-blue-600 text-white"
            : "bg-muted border border-border text-foreground"
        )}
      >
        <MessageContent message={message} />

        {!isUser && message.tokenUsage && (
          <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
            <div>
              {formatTokens(message.tokenUsage.input)} in ·{" "}
              {formatTokens(message.tokenUsage.output)} out
            </div>
            <div className="font-semibold">
              {formatCents(message.tokenUsage.cost)}
            </div>
          </div>
        )}

        <div className="mt-2 flex items-center justify-between text-xs">
          <div className="text-muted-foreground">
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
          {!isUser && (
            <button
              onClick={handleCopy}
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
              title="Copy message"
            >
              {copiedId === message.id ? (
                <Check className="h-3 w-3" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function HermesInfoPanel({ agentId, sessionId }: { agentId: string; sessionId: string }) {
  return (
    <Card className="p-3 bg-slate-50 dark:bg-slate-900">
      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Adapter</span>
          <span className="font-semibold">Hermes</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Model</span>
          <span className="font-mono">{agentId.slice(0, 8)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Session</span>
          <span className="font-mono truncate">{sessionId.slice(0, 12)}</span>
        </div>
        <Separator className="my-2" />
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Total tokens</span>
          <span className="font-semibold">2,450</span>
        </div>
      </div>
    </Card>
  );
}

function SessionSidebar({
  sessions,
  selectedSessionId,
  onSelectSession,
  onNewSession,
}: {
  sessions: ChatSession[];
  selectedSessionId: string;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
}) {
  return (
    <div className="w-64 border-r border-border flex flex-col bg-muted/30">
      <div className="p-4 border-b border-border">
        <Button
          onClick={onNewSession}
          className="w-full gap-2"
          variant="default"
        >
          <Plus className="h-4 w-4" />
          New Session
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-1 p-2">
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => onSelectSession(session.id)}
              className={cn(
                "w-full text-left px-3 py-2 rounded-lg transition-colors text-sm",
                selectedSessionId === session.id
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-foreground"
              )}
            >
              <div className="font-medium truncate">{session.title}</div>
              <div
                className={cn(
                  "text-xs truncate",
                  selectedSessionId === session.id
                    ? "text-primary-foreground/70"
                    : "text-muted-foreground"
                )}
              >
                {session.agentName}
              </div>
              <div
                className={cn(
                  "text-xs",
                  selectedSessionId === session.id
                    ? "text-primary-foreground/60"
                    : "text-muted-foreground"
                )}
              >
                {relativeTime(session.createdAt)}
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export function Chat() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState(
    MOCK_SESSIONS[0].id
  );
  const [selectedAgentId, setSelectedAgentId] = useState("agent-1");
  const [isLoading, setIsLoading] = useState(false);
  const [sessions, setSessions] = useState(MOCK_SESSIONS);

  const { data: agents = [] } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    setBreadcrumbs([{ label: "Chat" }]);
  }, [setBreadcrumbs]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load mock messages for selected session
  useEffect(() => {
    const mockMessages: ChatMessage[] = [
      {
        id: "msg-1",
        role: "assistant",
        content: "Hello! I'm ready to help you with any questions about your project.",
        timestamp: new Date(Date.now() - 600000).toISOString(),
        agentName: "DevOps AI",
        tokenUsage: { input: 120, output: 45, cost: 12 },
      },
      {
        id: "msg-2",
        role: "user",
        content: "Can you help me set up Docker for my project?",
        timestamp: new Date(Date.now() - 500000).toISOString(),
      },
      {
        id: "msg-3",
        role: "assistant",
        content:
          "Absolutely! I'll help you set up Docker. Let me start by checking your project structure.",
        timestamp: new Date(Date.now() - 450000).toISOString(),
        agentName: "DevOps AI",
        thinking:
          "The user wants Docker setup help. I should start by understanding their project type and structure. Let me gather information about what they're building.",
        toolCalls: [
          {
            id: "tool-1",
            name: "analyze_project",
            input: { directory: "/project", depth: 2 },
            output: "Node.js project detected with package.json, src/, public/ directories",
            status: "success",
            durationMs: 234,
          },
        ],
        tokenUsage: { input: 280, output: 156, cost: 34 },
      },
      {
        id: "msg-4",
        role: "user",
        content: "Great! What's the next step?",
        timestamp: new Date(Date.now() - 300000).toISOString(),
      },
      {
        id: "msg-5",
        role: "assistant",
        content: `Here's a complete Dockerfile for your Node.js project:

\`\`\`dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000
CMD ["npm", "start"]
\`\`\`

And here's the docker-compose.yml:

\`\`\`yaml
version: '3.8'
services:
  web:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
\`\`\``,
        timestamp: new Date(Date.now() - 250000).toISOString(),
        agentName: "DevOps AI",
        toolCalls: [
          {
            id: "tool-2",
            name: "generate_dockerfile",
            input: { projectType: "nodejs", version: 18 },
            output: "Dockerfile generated successfully",
            status: "success",
            durationMs: 145,
          },
          {
            id: "tool-3",
            name: "generate_docker_compose",
            input: { services: ["web"], ports: { "3000": "3000" } },
            output: "docker-compose.yml generated successfully",
            status: "success",
            durationMs: 89,
          },
        ],
        tokenUsage: { input: 350, output: 412, cost: 78 },
      },
    ];
    setMessages(mockMessages);
  }, [selectedSessionId]);

  const handleSendMessage = async () => {
    if (!currentInput.trim() || isLoading) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: currentInput,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setCurrentInput("");
    setIsLoading(true);

    // Simulate streaming response
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const agentMessage: ChatMessage = {
      id: `msg-${Date.now() + 1}`,
      role: "assistant",
      content:
        "I've processed your request. Here are my recommendations based on the analysis.",
      timestamp: new Date().toISOString(),
      agentName: agents.find((a) => a.id === selectedAgentId)?.name || "Agent",
      thinking:
        "The user is asking about the Docker setup. I should provide actionable steps.",
      toolCalls: [
        {
          id: `tool-${Date.now()}`,
          name: "execute_command",
          input: { command: "docker build -t myapp ." },
          output: "Build completed in 45 seconds",
          status: "success",
          durationMs: 45000,
        },
      ],
      tokenUsage: {
        input: 250,
        output: 180,
        cost: 42,
      },
    };

    setMessages((prev) => [...prev, agentMessage]);
    setIsLoading(false);
  };

  const handleNewSession = () => {
    const newSession: ChatSession = {
      id: `session-${Date.now()}`,
      title: "New Conversation",
      agentId: selectedAgentId,
      agentName: agents.find((a) => a.id === selectedAgentId)?.name || "Agent",
      createdAt: new Date().toISOString(),
      messageCount: 0,
    };
    setSessions((prev) => [newSession, ...prev]);
    setSelectedSessionId(newSession.id);
    setMessages([]);
  };

  const currentSession = sessions.find((s) => s.id === selectedSessionId);

  return (
    <div className="flex h-full overflow-hidden bg-background">
      <SessionSidebar
        sessions={sessions}
        selectedSessionId={selectedSessionId}
        onSelectSession={setSelectedSessionId}
        onNewSession={handleNewSession}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-border bg-muted/50 p-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
            <div>
              <h1 className="text-lg font-semibold">
                {currentSession?.title}
              </h1>
              <p className="text-sm text-muted-foreground">
                Chatting with {currentSession?.agentName}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="ghost" size="icon">
                <Settings className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-hidden flex gap-4 p-4">
          {/* Chat area */}
          <div className="flex-1 flex flex-col min-w-0 max-w-3xl mx-auto w-full">
            {/* Messages */}
            <ScrollArea className="flex-1 mb-4">
              <div className="space-y-4 pr-4">
                {messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center">
                    <div>
                      <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                      <h2 className="text-lg font-semibold mb-2">
                        Start a conversation
                      </h2>
                      <p className="text-muted-foreground text-sm max-w-xs">
                        Ask questions or request help with your projects
                      </p>
                    </div>
                  </div>
                ) : (
                  messages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      agent={agents.find((a) => a.id === message.agentId)}
                    />
                  ))
                )}
                {isLoading && (
                  <div className="flex gap-3">
                    <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold text-white bg-slate-700 shrink-0">
                      {agents.find((a) => a.id === selectedAgentId)?.name
                        ?.charAt(0)
                        .toUpperCase()}
                    </div>
                    <div className="flex-1 max-w-2xl rounded-lg p-4 bg-muted border border-border">
                      <StreamingIndicator />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input area */}
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  value={currentInput}
                  onChange={(e) => setCurrentInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      !e.shiftKey &&
                      !isLoading
                    ) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Ask anything... (Shift+Enter for new line)"
                  className="flex-1"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!currentInput.trim() || isLoading}
                  size="icon"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>

              <div className="text-xs text-muted-foreground">
                Press Enter to send, Shift+Enter for new line
              </div>
            </div>
          </div>

          {/* Right sidebar */}
          <div className="w-64 space-y-4 hidden lg:block">
            <HermesInfoPanel
              agentId={selectedAgentId}
              sessionId={selectedSessionId}
            />

            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Session Stats
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Messages</span>
                  <span className="font-semibold">{messages.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tokens</span>
                  <span className="font-semibold">
                    {formatTokens(
                      messages.reduce(
                        (sum, m) => sum + (m.tokenUsage?.input || 0),
                        0
                      )
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Cost</span>
                  <span className="font-semibold">
                    {formatCents(
                      messages.reduce((sum, m) => sum + (m.tokenUsage?.cost || 0), 0)
                    )}
                  </span>
                </div>
              </div>
            </Card>

            <Button variant="outline" className="w-full" size="sm">
              <Copy className="h-4 w-4 mr-2" />
              Export Chat
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
