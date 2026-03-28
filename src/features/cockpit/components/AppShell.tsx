import { useMemo, useCallback } from "react";
import wzrdLogo from "@/assets/wzrdtechlogo.png";
import {
  Activity,
  BadgeDollarSign,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  FileText,
  FolderOpen,
  Goal,
  Home,
  Inbox,
  LayoutDashboard,
  Link2,
  LogOut,
  MessageSquare,
  Monitor,
  Network,
  Package,
  Plug,
  PuzzleIcon,
  Search,
  Settings,
  ShieldCheck,
  UserPlus,
  Wallet,
  Workflow,
  Zap,
} from "lucide-react";
import { useTruncatedAddress, useStoredWalletAddress } from "@/hooks/useWalletAddressSync";
import { useLiveRunCount } from "@/hooks/useLiveRunCount";
import { useSidebarBadges } from "@/hooks/useSidebarBadges";
import { useSidebarAgents } from "@/hooks/useSidebarAgents";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useActiveAccount, useDisconnect, useActiveWallet } from "thirdweb/react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NewIssueDialog } from "./NewIssueDialog";
import { useAgencyData } from "../lib/useAgencyData";

type NavItem = {
  to: string;
  label: string;
  icon: typeof Home;
  badge?: string | number | null;
};

const TOP_ITEMS: NavItem[] = [
  { to: "/cockpit", label: "Sandbox", icon: Workflow },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/inbox", label: "Inbox", icon: Inbox },
  { to: "/chat", label: "Chat", icon: MessageSquare },
];

const WORK_ITEMS: NavItem[] = [
  { to: "/issues", label: "Issues", icon: CheckCircle2 },
  { to: "/goals", label: "Goals", icon: Goal },
  { to: "/approvals", label: "Approvals", icon: ShieldCheck },
  { to: "/projects", label: "Projects", icon: FolderOpen },
];

export const COMPANY_ITEMS: NavItem[] = [
  { to: "/org-chart", label: "Org Chart", icon: Network },
  { to: "/skills", label: "Skills", icon: Zap },
  { to: "/delegations", label: "Delegations", icon: Link2 },
  { to: "/costs", label: "Costs", icon: BadgeDollarSign },
  { to: "/budgets", label: "Budgets & Quotas", icon: ShieldCheck },
  { to: "/activity", label: "Activity", icon: Activity },
  { to: "/integrations", label: "Integrations", icon: Plug },
  { to: "/plugins", label: "Plugins", icon: PuzzleIcon },
  { to: "/documents", label: "Documents", icon: FileText },
  { to: "/workspaces", label: "Workspaces", icon: Monitor },
  { to: "/submission-proof", label: "Submission Proof", icon: Package },
  { to: "/invites", label: "Invites & Settings", icon: UserPlus },
  { to: "/settings", label: "Settings", icon: Settings },
];

function NavMenuItem({ item }: { item: NavItem }) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip={item.label}>
        <NavLink
          to={item.to}
          className={({ isActive }) =>
            isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : ""
          }
        >
          <item.icon className="h-4 w-4 shrink-0" />
          <span>{item.label}</span>
          {item.badge ? <SidebarMenuBadge>{item.badge}</SidebarMenuBadge> : null}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

/** Sidebar header with logo + collapse toggle */
function SidebarHeaderContent() {
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <SidebarHeader className="border-b border-white/10 px-3 py-3">
      <div className="flex items-center justify-between">
        {/* Logo area */}
        <div className="flex items-center gap-2.5 min-w-0 overflow-hidden">
          <img
            src={wzrdLogo}
            alt="WZRD.tech"
            className="h-7 w-7 shrink-0 object-contain"
          />
          {!isCollapsed && (
            <div className="min-w-0">
              <p className="truncate text-[11px] font-black uppercase tracking-[0.22em] text-zinc-200">
                Agency
              </p>
            </div>
          )}
        </div>

        {/* Collapse toggle */}
        {!isCollapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="h-7 w-7 shrink-0 text-zinc-500 hover:text-white hover:bg-white/5"
          >
            <ChevronsLeft className="h-4 w-4" />
            <span className="sr-only">Collapse sidebar</span>
          </Button>
        )}
      </div>

      {/* Collapsed: show expand button centered */}
      {isCollapsed && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="h-7 w-7 mx-auto text-zinc-500 hover:text-white hover:bg-white/5"
            >
              <ChevronsRight className="h-4 w-4" />
              <span className="sr-only">Expand sidebar</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Expand sidebar</TooltipContent>
        </Tooltip>
      )}
    </SidebarHeader>
  );
}

/** Search + New Issue (hidden when collapsed) */
function SidebarSearchArea() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  if (isCollapsed) return null;

  return (
    <SidebarGroup className="border-b border-white/10 px-3 py-3">
      <SidebarGroupContent className="space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            placeholder="Search"
            className="border-white/10 bg-[#0d1118] pl-9 text-zinc-200 placeholder:text-zinc-600"
          />
        </div>
        <NewIssueDialog />
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function AccountFooter() {
  const account = useActiveAccount();
  const wallet = useActiveWallet();
  const { disconnect } = useDisconnect();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const address = account?.address;
  const truncated = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Not connected";

  const handleSignOut = useCallback(() => {
    if (wallet) disconnect(wallet);
    navigate("/");
  }, [wallet, disconnect, navigate]);

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSignOut}
            className="h-8 w-8 mx-auto text-zinc-400 hover:text-white hover:bg-white/5"
          >
            <LogOut className="h-4 w-4" />
            <span className="sr-only">Sign out</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p className="font-medium">{truncated}</p>
          <p className="text-xs text-zinc-400">Sign out</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="flex items-center justify-between glass-card px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500">
          Account
        </p>
        <p className="truncate text-xs font-bold text-zinc-200" title={address}>
          {truncated}
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleSignOut}
        className="ml-2 shrink-0 text-[10px] uppercase tracking-wider text-zinc-400 hover:text-white hover:bg-white/5"
      >
        Sign out
      </Button>
    </div>
  );
}

export function AppShell() {
  const location = useLocation();
  const { snapshot } = useAgencyData();
  const liveWalletAddress = useTruncatedAddress();
  const { storedAddress } = useStoredWalletAddress();
  const storedTruncated = storedAddress
    ? `${storedAddress.slice(0, 6)}…${storedAddress.slice(-4)}`
    : null;
  const walletAddress = liveWalletAddress ?? storedTruncated;
  const { data: liveRunCount = 0 } = useLiveRunCount();
  const { data: sidebarBadges } = useSidebarBadges();
  const { data: sidebarAgents = [] } = useSidebarAgents();
  const pendingApprovals = sidebarBadges?.approvals ?? 0;
  const inboxCount = sidebarBadges?.inbox ?? pendingApprovals;

  const openIssues = useMemo(
    () => snapshot.issues.filter((issue) => issue.status !== "done" && issue.status !== "cancelled").length,
    [snapshot.issues],
  );
  const pageTitle = useMemo(() => {
    const allItems = [...TOP_ITEMS, ...WORK_ITEMS, ...COMPANY_ITEMS];
    const found = allItems.find((item) => item.to === location.pathname)?.label;
    if (found) return found;
    if (location.pathname === "/agents") return "Agents";
    if (location.pathname === "/agents/new") return "New Agent";
    if (location.pathname.startsWith("/agents/")) return "Agent Detail";
    return "Agency";
  }, [location.pathname]);

  const topItems = TOP_ITEMS.map((item) =>
    item.label === "Sandbox"
      ? { ...item, badge: liveRunCount > 0 ? liveRunCount : null }
      : item.label === "Inbox"
        ? { ...item, badge: inboxCount > 0 ? inboxCount : null }
        : item,
  );
  const workItems = WORK_ITEMS.map((item) =>
    item.label === "Approvals" ? { ...item, badge: pendingApprovals > 0 ? pendingApprovals : null } : item,
  );

  return (
    <div className="dark min-h-screen bg-black text-zinc-100">
      <SidebarProvider defaultOpen>
        <Sidebar collapsible="icon" className="border-r border-white/10 glass-sidebar">
          {/* Header: logo + collapse toggle */}
          <SidebarHeaderContent />

          {/* Search + new issue (expanded only) */}
          <SidebarSearchArea />

          {/* Scrollable navigation content */}
          <SidebarContent className="gap-0 glass-sidebar text-white overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            {/* Top nav items */}
            <SidebarGroup className="px-3 py-3">
              <SidebarGroupContent>
                <SidebarMenu>
                  {topItems.map((item) => (
                    <NavMenuItem key={item.to} item={item} />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Work section */}
            <SidebarGroup className="px-3 py-1">
              <SidebarGroupLabel className="text-[11px] font-black uppercase tracking-[0.24em] text-zinc-500">
                Work
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {workItems.map((item) => (
                    <NavMenuItem key={item.to} item={item} />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Projects collapsible */}
            <SidebarGroup className="px-3 py-1">
              <SidebarGroupContent>
                <Collapsible defaultOpen>
                  <CollapsibleTrigger className="flex w-full items-center justify-between px-2 py-2 text-[11px] font-black uppercase tracking-[0.24em] text-zinc-500 group-data-[collapsible=icon]:hidden">
                    Projects
                    <ChevronDown className="h-4 w-4 transition-transform duration-200" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenu>
                      {snapshot.projects.map((project) => (
                        <SidebarMenuItem key={project.id}>
                          <SidebarMenuButton asChild tooltip={project.name}>
                            <NavLink to={`/projects/${project.id}`}>
                              <FolderOpen className="h-4 w-4 shrink-0" />
                              <span className="truncate">{project.name}</span>
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </CollapsibleContent>
                </Collapsible>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Agents collapsible */}
            <SidebarGroup className="px-3 py-1">
              <SidebarGroupContent>
                <Collapsible defaultOpen>
                  <CollapsibleTrigger className="flex w-full items-center justify-between px-2 py-2 text-[11px] font-black uppercase tracking-[0.24em] text-zinc-500 group-data-[collapsible=icon]:hidden">
                    Agents
                    <ChevronDown className="h-4 w-4 transition-transform duration-200" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenu>
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild tooltip="All Agents">
                          <NavLink
                            to="/agents"
                            end
                            className={({ isActive }) =>
                              isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : ""
                            }
                          >
                            <Bot className="h-4 w-4 shrink-0" />
                            <span>All Agents</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      {sidebarAgents.map((agent) => (
                        <SidebarMenuItem key={agent.id}>
                          <SidebarMenuButton asChild tooltip={agent.name}>
                            <NavLink
                              to={`/agents/${agent.id}`}
                              className={({ isActive }) =>
                                isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : ""
                              }
                            >
                              <Bot className="h-4 w-4 shrink-0 opacity-60" />
                              <span className="truncate">{agent.name}</span>
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </CollapsibleContent>
                </Collapsible>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Company section */}
            <SidebarGroup className="px-3 py-1">
              <SidebarGroupLabel className="text-[11px] font-black uppercase tracking-[0.24em] text-zinc-500">
                Company
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {COMPANY_ITEMS.map((item) => (
                    <NavMenuItem key={item.to} item={item} />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          {/* Footer */}
          <SidebarFooter className="border-t border-white/10 glass-sidebar p-3">
            <AccountFooter />
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="h-screen overflow-hidden flex flex-col bg-[#020409]">
          <header className="shrink-0 z-20 flex h-14 items-center justify-between glass-header px-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-zinc-500 hidden sm:block">
                  Agency
                </p>
                <h1 className="text-sm font-black uppercase tracking-[0.08em] text-zinc-100 truncate">
                  {pageTitle}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {walletAddress && (
                <Badge variant="outline" className="hidden md:flex border-white/10 bg-[#0d1118] text-zinc-300">
                  <Wallet className="mr-1 h-3 w-3" />
                  {walletAddress}
                </Badge>
              )}
              <Badge variant="outline" className="border-white/10 bg-[#0d1118] text-zinc-300 text-[10px] sm:text-xs">
                {liveRunCount} <span className="hidden sm:inline">live </span>runs
              </Badge>
              <Badge variant="outline" className="hidden sm:flex border-white/10 bg-[#0d1118] text-zinc-300">
                {pendingApprovals} approvals
              </Badge>
            </div>
          </header>

          <div className="flex-1 min-h-0 overflow-hidden">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
