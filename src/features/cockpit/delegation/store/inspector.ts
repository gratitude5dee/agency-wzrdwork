import type { AgentVisualState } from "./agencyStore";

export type InspectorTone = 'default' | 'muted' | 'info' | 'success' | 'warning' | 'danger'

export interface InspectorLink {
  label: string
  href: string
}

export interface InspectorStat {
  label: string
  value: string
  tone?: InspectorTone
}

export interface InspectorItem {
  title: string
  subtitle?: string
  meta?: string
  href?: string
  tone?: InspectorTone
}

export interface ProjectInspectorModel {
  companyName: string
  companyType: string
  companyDescription: string
  brief: string
  stats: InspectorStat[]
  urgentIssues: InspectorItem[]
  links: InspectorLink[]
}

export interface AgentInspectorLatestRun {
  label: string
  statusLabel: string
  statusTone: InspectorTone
  summary: string
  meta?: string
  href?: string
  isLive?: boolean
  error?: string | null
}

export interface AgentInspectorApproval {
  label: string
  statusLabel: string
  tone: InspectorTone
  meta?: string
  href?: string
}

export interface AgentInspectorModel {
  agentName: string
  statusLabel: string
  statusTone: InspectorTone
  visualState: AgentVisualState
  visualStateLabel: string
  visualStateTone: InspectorTone
  adapterLabel: string
  manager?: InspectorLink
  activeIssue?: InspectorItem
  recentIssues: InspectorItem[]
  latestRun?: AgentInspectorLatestRun
  pendingApproval?: AgentInspectorApproval
  workProducts: InspectorItem[]
  documents: InspectorItem[]
  governanceItems: InspectorItem[]
  workspaceItems: InspectorItem[]
  environmentItems: InspectorItem[]
  runtimeServices: InspectorItem[]
  routineItems: InspectorItem[]
  pluginResourceItems: InspectorItem[]
  secretItems: InspectorItem[]
  heartbeatItems: InspectorItem[]
  budget?: InspectorStat
  lastHeartbeat?: string
  session?: string
  lastError?: string | null
  tokenStats: InspectorStat[]
  totalCost?: string
  links: InspectorLink[]
}
