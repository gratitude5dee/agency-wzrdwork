import { useMemo } from "react";
import {
  Activity,
  BadgeDollarSign,
  Bot,
  CheckCircle2,
  ChevronDown,
  Compass,
  FolderOpen,
  Goal,
  Home,
  Inbox,
  LayoutDashboard,
  Palette,
  Search,
  Settings,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { NewIssueDialog } from "./NewIssueDialog";
import { useAgencyData } from "../lib/useAgencyData";

type NavItem = {
  to: string;
  label: string;
  icon: typeof Home;
  badge?: string | number | null;
};

const TOP_ITEMS: NavItem[] = [
  { to: "/cockpit", label: "Cockpit", icon: Workflow },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/inbox", label: "Inbox", icon: Inbox },
];

const WORK_ITEMS: NavItem[] = [
  { to: "/issues", label: "Issues", icon: CheckCircle2 },
  { to: "/goals", label: "Goals", icon: Goal },
  { to: "/approvals", label: "Approvals", icon: ShieldCheck },
  { to: "/projects", label: "Projects", icon: FolderOpen },
];

const COMPANY_ITEMS: NavItem[] = [
  { to: "/org", label: "Org", icon: Bot },
  { to: "/costs", label: "Costs", icon: BadgeDollarSign },
  { to: "/activity", label: "Activity", icon: Activity },
  { to: "/design-guide", label: "Design Guide", icon: Palette },
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
          <item.icon className="h-4 w-4" />
          <span>{item.label}</span>
          {item.badge ? <SidebarMenuBadge>{item.badge}</SidebarMenuBadge> : null}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppShell() {
  const location = useLocation();
  const { snapshot } = useAgencyData();

  const liveRunCount = useMemo(
    () => snapshot.runs.filter((run) => run.status === "running" || run.status === "queued").length,
    [snapshot.runs],
  );
  const pendingApprovals = useMemo(
    () => snapshot.approvals.filter((approval) => approval.status === "pending").length,
    [snapshot.approvals],
  );
  const openIssues = useMemo(
    () => snapshot.issues.filter((issue) => issue.status !== "done" && issue.status !== "cancelled").length,
    [snapshot.issues],
  );
  const pageTitle = useMemo(() => {
    const allItems = [...TOP_ITEMS, ...WORK_ITEMS, ...COMPANY_ITEMS];
    return allItems.find((item) => item.to === location.pathname)?.label ?? "Agency";
  }, [location.pathname]);

  const topItems = TOP_ITEMS.map((item) =>
    item.label === "Cockpit"
      ? { ...item, badge: liveRunCount > 0 ? liveRunCount : null }
      : item.label === "Inbox"
        ? { ...item, badge: pendingApprovals > 0 ? pendingApprovals : null }
        : item,
  );
  const workItems = WORK_ITEMS.map((item) =>
    item.label === "Approvals" ? { ...item, badge: pendingApprovals > 0 ? pendingApprovals : null } : item,
  );

  return (
    <div className="dark min-h-screen bg-black text-zinc-100">
      <SidebarProvider defaultOpen>
        <Sidebar className="border-r border-white/10 bg-black">
          <SidebarContent className="gap-0 bg-black text-white">
            <SidebarGroup className="border-b border-white/10 px-3 py-4">
              <SidebarGroupContent className="space-y-3">
                <div className="flex items-center gap-3 px-2">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 text-sm font-black text-white"
                    style={{ backgroundColor: snapshot.company.brandColor }}
                  >
                    {snapshot.company.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black">{snapshot.company.name}</p>
                    <p className="truncate text-[11px] uppercase tracking-[0.2em] text-zinc-500">
                      {snapshot.company.companyType}
                    </p>
                  </div>
                </div>

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

            <SidebarGroup className="px-3 py-3">
              <SidebarGroupContent>
                <SidebarMenu>
                  {topItems.map((item) => (
                    <NavMenuItem key={item.to} item={item} />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup className="px-3 py-1">
              <SidebarGroupLabel>Work</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {workItems.map((item) => (
                    <NavMenuItem key={item.to} item={item} />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup className="px-3 py-1">
              <SidebarGroupContent>
                <Collapsible defaultOpen>
                  <CollapsibleTrigger className="flex w-full items-center justify-between px-2 py-2 text-[11px] font-black uppercase tracking-[0.24em] text-zinc-500">
                    Projects
                    <ChevronDown className="h-4 w-4" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenu>
                      {snapshot.projects.map((project) => (
                        <SidebarMenuItem key={project.id}>
                          <SidebarMenuButton asChild tooltip={project.name}>
                            <NavLink to={`/projects/${project.id}`}>
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

            <SidebarGroup className="px-3 py-1">
              <SidebarGroupContent>
                <Collapsible defaultOpen>
                  <CollapsibleTrigger className="flex w-full items-center justify-between px-2 py-2 text-[11px] font-black uppercase tracking-[0.24em] text-zinc-500">
                    Agents
                    <ChevronDown className="h-4 w-4" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenu>
                      {snapshot.agents.map((agent) => (
                        <SidebarMenuItem key={agent.id}>
                          <SidebarMenuButton asChild tooltip={agent.name}>
                            <NavLink to={`/agents/${agent.id}`}>
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

            <SidebarGroup className="px-3 py-1">
              <SidebarGroupLabel>Company</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {COMPANY_ITEMS.map((item) => (
                    <NavMenuItem key={item.to} item={item} />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t border-white/10 bg-black p-3">
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#0d1118] px-3 py-2">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500">
                  Backend
                </p>
                <p className="text-xs font-bold text-zinc-200">
                  {snapshot.source === "supabase" ? "Supabase live" : "Demo fallback"}
                </p>
              </div>
              <Badge
                variant="outline"
                className="border-white/10 bg-black text-zinc-300"
              >
                {openIssues} open
              </Badge>
            </div>
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>

        <SidebarInset className="min-h-screen bg-[#020409]">
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-white/10 bg-black/90 px-4 backdrop-blur">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-zinc-300 hover:text-white" />
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-zinc-500">
                  Agency
                </p>
                <h1 className="text-sm font-black uppercase tracking-[0.08em] text-zinc-100">
                  {pageTitle}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-white/10 bg-[#0d1118] text-zinc-300">
                {liveRunCount} live runs
              </Badge>
              <Badge variant="outline" className="border-white/10 bg-[#0d1118] text-zinc-300">
                {pendingApprovals} approvals
              </Badge>
              <Button
                asChild
                variant="ghost"
                className="hidden border border-white/10 bg-[#0d1118] text-zinc-300 hover:bg-[#141b27] hover:text-white md:inline-flex"
              >
                <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">
                  <Compass className="mr-2 h-4 w-4" />
                  Supabase
                </a>
              </Button>
            </div>
          </header>

          <Outlet />
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
