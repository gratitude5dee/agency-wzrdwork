"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLUGIN_LAUNCHER_PLACEMENT_ZONES = exports.PLUGIN_RESERVED_COMPANY_ROUTE_SEGMENTS = exports.PLUGIN_UI_SLOT_TYPES = exports.PLUGIN_CAPABILITIES = exports.PLUGIN_CATEGORIES = exports.PLUGIN_STATUSES = exports.PLUGIN_API_VERSION = exports.PERMISSION_KEYS = exports.JOIN_REQUEST_STATUSES = exports.JOIN_REQUEST_TYPES = exports.INVITE_JOIN_TYPES = exports.INVITE_TYPES = exports.INSTANCE_USER_ROLES = exports.MEMBERSHIP_STATUSES = exports.PRINCIPAL_TYPES = exports.LIVE_EVENT_TYPES = exports.HEARTBEAT_RUN_STATUSES = exports.WAKEUP_REQUEST_STATUSES = exports.WAKEUP_TRIGGER_DETAILS = exports.HEARTBEAT_INVOCATION_SOURCES = exports.BUDGET_INCIDENT_RESOLUTION_ACTIONS = exports.BUDGET_INCIDENT_STATUSES = exports.BUDGET_THRESHOLD_TYPES = exports.BUDGET_WINDOW_KINDS = exports.BUDGET_METRICS = exports.BUDGET_SCOPE_TYPES = exports.FINANCE_UNITS = exports.FINANCE_DIRECTIONS = exports.FINANCE_EVENT_KINDS = exports.BILLING_TYPES = exports.STORAGE_PROVIDERS = exports.SECRET_PROVIDERS = exports.APPROVAL_STATUSES = exports.APPROVAL_TYPES = exports.PROJECT_COLORS = exports.PAUSE_REASONS = exports.PROJECT_STATUSES = exports.GOAL_STATUSES = exports.GOAL_LEVELS = exports.ISSUE_PRIORITIES = exports.ISSUE_STATUSES = exports.AGENT_ICON_NAMES = exports.AGENT_ROLE_LABELS = exports.AGENT_ROLES = exports.AGENT_ADAPTER_TYPES = exports.AGENT_STATUSES = exports.AUTH_BASE_URL_MODES = exports.DEPLOYMENT_EXPOSURES = exports.DEPLOYMENT_MODES = exports.COMPANY_STATUSES = void 0;
exports.PLUGIN_BRIDGE_ERROR_CODES = exports.PLUGIN_EVENT_TYPES = exports.PLUGIN_WEBHOOK_DELIVERY_STATUSES = exports.PLUGIN_JOB_RUN_TRIGGERS = exports.PLUGIN_JOB_RUN_STATUSES = exports.PLUGIN_JOB_STATUSES = exports.PLUGIN_STATE_SCOPE_KINDS = exports.PLUGIN_UI_SLOT_ENTITY_TYPES = exports.PLUGIN_LAUNCHER_RENDER_ENVIRONMENTS = exports.PLUGIN_LAUNCHER_BOUNDS = exports.PLUGIN_LAUNCHER_ACTIONS = void 0;
exports.COMPANY_STATUSES = ["active", "paused", "archived"];
exports.DEPLOYMENT_MODES = ["local_trusted", "authenticated"];
exports.DEPLOYMENT_EXPOSURES = ["private", "public"];
exports.AUTH_BASE_URL_MODES = ["auto", "explicit"];
exports.AGENT_STATUSES = [
    "active",
    "paused",
    "idle",
    "running",
    "error",
    "pending_approval",
    "terminated",
];
exports.AGENT_ADAPTER_TYPES = [
    "process",
    "http",
    "claude_local",
    "codex_local",
    "opencode_local",
    "pi_local",
    "cursor",
    "openclaw_gateway",
    "hermes_local",
];
exports.AGENT_ROLES = [
    "ceo",
    "cto",
    "cmo",
    "cfo",
    "engineer",
    "designer",
    "pm",
    "qa",
    "devops",
    "researcher",
    "general",
];
exports.AGENT_ROLE_LABELS = {
    ceo: "CEO",
    cto: "CTO",
    cmo: "CMO",
    cfo: "CFO",
    engineer: "Engineer",
    designer: "Designer",
    pm: "PM",
    qa: "QA",
    devops: "DevOps",
    researcher: "Researcher",
    general: "General",
};
exports.AGENT_ICON_NAMES = [
    "bot",
    "cpu",
    "brain",
    "zap",
    "rocket",
    "code",
    "terminal",
    "shield",
    "eye",
    "search",
    "wrench",
    "hammer",
    "lightbulb",
    "sparkles",
    "star",
    "heart",
    "flame",
    "bug",
    "cog",
    "database",
    "globe",
    "lock",
    "mail",
    "message-square",
    "file-code",
    "git-branch",
    "package",
    "puzzle",
    "target",
    "wand",
    "atom",
    "circuit-board",
    "radar",
    "swords",
    "telescope",
    "microscope",
    "crown",
    "gem",
    "hexagon",
    "pentagon",
    "fingerprint",
];
exports.ISSUE_STATUSES = [
    "backlog",
    "todo",
    "in_progress",
    "in_review",
    "done",
    "blocked",
    "cancelled",
];
exports.ISSUE_PRIORITIES = ["critical", "high", "medium", "low"];
exports.GOAL_LEVELS = ["company", "team", "agent", "task"];
exports.GOAL_STATUSES = ["planned", "active", "achieved", "cancelled"];
exports.PROJECT_STATUSES = [
    "backlog",
    "planned",
    "in_progress",
    "completed",
    "cancelled",
];
exports.PAUSE_REASONS = ["manual", "budget", "system"];
exports.PROJECT_COLORS = [
    "#6366f1", // indigo
    "#8b5cf6", // violet
    "#ec4899", // pink
    "#ef4444", // red
    "#f97316", // orange
    "#eab308", // yellow
    "#22c55e", // green
    "#14b8a6", // teal
    "#06b6d4", // cyan
    "#3b82f6", // blue
];
exports.APPROVAL_TYPES = ["hire_agent", "approve_ceo_strategy", "budget_override_required"];
exports.APPROVAL_STATUSES = [
    "pending",
    "revision_requested",
    "approved",
    "rejected",
    "cancelled",
];
exports.SECRET_PROVIDERS = [
    "local_encrypted",
    "aws_secrets_manager",
    "gcp_secret_manager",
    "vault",
];
exports.STORAGE_PROVIDERS = ["local_disk", "s3"];
exports.BILLING_TYPES = [
    "metered_api",
    "subscription_included",
    "subscription_overage",
    "credits",
    "fixed",
    "unknown",
];
exports.FINANCE_EVENT_KINDS = [
    "inference_charge",
    "platform_fee",
    "credit_purchase",
    "credit_refund",
    "credit_expiry",
    "byok_fee",
    "gateway_overhead",
    "log_storage_charge",
    "logpush_charge",
    "provisioned_capacity_charge",
    "training_charge",
    "custom_model_import_charge",
    "custom_model_storage_charge",
    "manual_adjustment",
];
exports.FINANCE_DIRECTIONS = ["debit", "credit"];
exports.FINANCE_UNITS = [
    "input_token",
    "output_token",
    "cached_input_token",
    "request",
    "credit_usd",
    "credit_unit",
    "model_unit_minute",
    "model_unit_hour",
    "gb_month",
    "train_token",
    "unknown",
];
exports.BUDGET_SCOPE_TYPES = ["company", "agent", "project"];
exports.BUDGET_METRICS = ["billed_cents"];
exports.BUDGET_WINDOW_KINDS = ["calendar_month_utc", "lifetime"];
exports.BUDGET_THRESHOLD_TYPES = ["soft", "hard"];
exports.BUDGET_INCIDENT_STATUSES = ["open", "resolved", "dismissed"];
exports.BUDGET_INCIDENT_RESOLUTION_ACTIONS = [
    "keep_paused",
    "raise_budget_and_resume",
];
exports.HEARTBEAT_INVOCATION_SOURCES = [
    "timer",
    "assignment",
    "on_demand",
    "automation",
];
exports.WAKEUP_TRIGGER_DETAILS = ["manual", "ping", "callback", "system"];
exports.WAKEUP_REQUEST_STATUSES = [
    "queued",
    "deferred_issue_execution",
    "claimed",
    "coalesced",
    "skipped",
    "completed",
    "failed",
    "cancelled",
];
exports.HEARTBEAT_RUN_STATUSES = [
    "queued",
    "running",
    "succeeded",
    "failed",
    "cancelled",
    "timed_out",
];
exports.LIVE_EVENT_TYPES = [
    "heartbeat.run.queued",
    "heartbeat.run.status",
    "heartbeat.run.event",
    "heartbeat.run.log",
    "agent.status",
    "activity.logged",
    "plugin.ui.updated",
    "plugin.worker.crashed",
    "plugin.worker.restarted",
];
exports.PRINCIPAL_TYPES = ["user", "agent"];
exports.MEMBERSHIP_STATUSES = ["pending", "active", "suspended"];
exports.INSTANCE_USER_ROLES = ["instance_admin"];
exports.INVITE_TYPES = ["company_join", "bootstrap_ceo"];
exports.INVITE_JOIN_TYPES = ["human", "agent", "both"];
exports.JOIN_REQUEST_TYPES = ["human", "agent"];
exports.JOIN_REQUEST_STATUSES = ["pending_approval", "approved", "rejected"];
exports.PERMISSION_KEYS = [
    "agents:create",
    "users:invite",
    "users:manage_permissions",
    "tasks:assign",
    "tasks:assign_scope",
    "joins:approve",
];
// ---------------------------------------------------------------------------
// Plugin System — see doc/plugins/PLUGIN_SPEC.md for the full specification
// ---------------------------------------------------------------------------
/**
 * The current version of the Plugin API contract.
 *
 * Increment this value whenever a breaking change is made to the plugin API
 * so that the host can reject incompatible plugin manifests.
 *
 * @see PLUGIN_SPEC.md §4 — Versioning
 */
exports.PLUGIN_API_VERSION = 1;
/**
 * Lifecycle statuses for an installed plugin.
 *
 * State machine: installed → ready | error, ready → disabled | error | upgrade_pending | uninstalled,
 * disabled → ready | uninstalled, error → ready | uninstalled,
 * upgrade_pending → ready | error | uninstalled, uninstalled → installed (reinstall).
 *
 * @see {@link PluginStatus} — inferred union type
 * @see PLUGIN_SPEC.md §21.3 `plugins.status`
 */
exports.PLUGIN_STATUSES = [
    "installed",
    "ready",
    "disabled",
    "error",
    "upgrade_pending",
    "uninstalled",
];
/**
 * Plugin classification categories. A plugin declares one or more categories
 * in its manifest to describe its primary purpose.
 *
 * @see PLUGIN_SPEC.md §6.2
 */
exports.PLUGIN_CATEGORIES = [
    "connector",
    "workspace",
    "automation",
    "ui",
];
/**
 * Named permissions the host grants to a plugin. Plugins declare required
 * capabilities in their manifest; the host enforces them at runtime via the
 * plugin capability validator.
 *
 * Grouped into: Data Read, Data Write, Plugin State, Runtime/Integration,
 * Agent Tools, and UI.
 *
 * @see PLUGIN_SPEC.md §15 — Capability Model
 */
exports.PLUGIN_CAPABILITIES = [
    // Data Read
    "companies.read",
    "projects.read",
    "project.workspaces.read",
    "issues.read",
    "issue.comments.read",
    "issue.documents.read",
    "agents.read",
    "goals.read",
    "goals.create",
    "goals.update",
    "activity.read",
    "costs.read",
    // Data Write
    "issues.create",
    "issues.update",
    "issue.comments.create",
    "issue.documents.write",
    "agents.pause",
    "agents.resume",
    "agents.invoke",
    "agent.sessions.create",
    "agent.sessions.list",
    "agent.sessions.send",
    "agent.sessions.close",
    "activity.log.write",
    "metrics.write",
    // Plugin State
    "plugin.state.read",
    "plugin.state.write",
    // Runtime / Integration
    "events.subscribe",
    "events.emit",
    "jobs.schedule",
    "webhooks.receive",
    "http.outbound",
    "secrets.read-ref",
    // Agent Tools
    "agent.tools.register",
    // UI
    "instance.settings.register",
    "ui.sidebar.register",
    "ui.page.register",
    "ui.detailTab.register",
    "ui.dashboardWidget.register",
    "ui.commentAnnotation.register",
    "ui.action.register",
];
/**
 * UI extension slot types. Each slot type corresponds to a mount point in the
 * Paperclip UI where plugin components can be rendered.
 *
 * @see PLUGIN_SPEC.md §19 — UI Extension Model
 */
exports.PLUGIN_UI_SLOT_TYPES = [
    "page",
    "detailTab",
    "taskDetailView",
    "dashboardWidget",
    "sidebar",
    "sidebarPanel",
    "projectSidebarItem",
    "globalToolbarButton",
    "toolbarButton",
    "contextMenuItem",
    "commentAnnotation",
    "commentContextMenuItem",
    "settingsPage",
];
/**
 * Reserved company-scoped route segments that plugin page routes may not claim.
 *
 * These map to first-class host pages under `/:companyPrefix/...`.
 */
exports.PLUGIN_RESERVED_COMPANY_ROUTE_SEGMENTS = [
    "dashboard",
    "onboarding",
    "companies",
    "company",
    "settings",
    "plugins",
    "org",
    "agents",
    "projects",
    "issues",
    "goals",
    "approvals",
    "costs",
    "activity",
    "inbox",
    "design-guide",
    "tests",
];
/**
 * Launcher placement zones describe where a plugin-owned launcher can appear
 * in the host UI. These are intentionally aligned with current slot surfaces
 * so manifest authors can describe launch intent without coupling to a single
 * component implementation detail.
 */
exports.PLUGIN_LAUNCHER_PLACEMENT_ZONES = [
    "page",
    "detailTab",
    "taskDetailView",
    "dashboardWidget",
    "sidebar",
    "sidebarPanel",
    "projectSidebarItem",
    "globalToolbarButton",
    "toolbarButton",
    "contextMenuItem",
    "commentAnnotation",
    "commentContextMenuItem",
    "settingsPage",
];
/**
 * Launcher action kinds describe what the launcher does when activated.
 */
exports.PLUGIN_LAUNCHER_ACTIONS = [
    "navigate",
    "openModal",
    "openDrawer",
    "openPopover",
    "performAction",
    "deepLink",
];
/**
 * Optional size hints the host can use when rendering plugin-owned launcher
 * destinations such as overlays, drawers, or full page handoffs.
 */
exports.PLUGIN_LAUNCHER_BOUNDS = [
    "inline",
    "compact",
    "default",
    "wide",
    "full",
];
/**
 * Render environments describe the container a launcher expects after it is
 * activated. The current host may map these to concrete UI primitives.
 */
exports.PLUGIN_LAUNCHER_RENDER_ENVIRONMENTS = [
    "hostInline",
    "hostOverlay",
    "hostRoute",
    "external",
    "iframe",
];
/**
 * Entity types that a `detailTab` UI slot can attach to.
 *
 * @see PLUGIN_SPEC.md §19.3 — Detail Tabs
 */
exports.PLUGIN_UI_SLOT_ENTITY_TYPES = [
    "project",
    "issue",
    "agent",
    "goal",
    "run",
    "comment",
];
/**
 * Scope kinds for plugin state storage. Determines the granularity at which
 * a plugin stores key-value state data.
 *
 * @see PLUGIN_SPEC.md §21.3 `plugin_state.scope_kind`
 */
exports.PLUGIN_STATE_SCOPE_KINDS = [
    "instance",
    "company",
    "project",
    "project_workspace",
    "agent",
    "issue",
    "goal",
    "run",
];
/** Statuses for a plugin's scheduled job definition. */
exports.PLUGIN_JOB_STATUSES = [
    "active",
    "paused",
    "failed",
];
/** Statuses for individual job run executions. */
exports.PLUGIN_JOB_RUN_STATUSES = [
    "pending",
    "queued",
    "running",
    "succeeded",
    "failed",
    "cancelled",
];
/** What triggered a particular job run. */
exports.PLUGIN_JOB_RUN_TRIGGERS = [
    "schedule",
    "manual",
    "retry",
];
/** Statuses for inbound webhook deliveries. */
exports.PLUGIN_WEBHOOK_DELIVERY_STATUSES = [
    "pending",
    "success",
    "failed",
];
/**
 * Core domain event types that plugins can subscribe to via the
 * `events.subscribe` capability.
 *
 * @see PLUGIN_SPEC.md §16 — Event System
 */
exports.PLUGIN_EVENT_TYPES = [
    "company.created",
    "company.updated",
    "project.created",
    "project.updated",
    "project.workspace_created",
    "project.workspace_updated",
    "project.workspace_deleted",
    "issue.created",
    "issue.updated",
    "issue.comment.created",
    "agent.created",
    "agent.updated",
    "agent.status_changed",
    "agent.run.started",
    "agent.run.finished",
    "agent.run.failed",
    "agent.run.cancelled",
    "goal.created",
    "goal.updated",
    "approval.created",
    "approval.decided",
    "cost_event.created",
    "activity.logged",
];
/**
 * Error codes returned by the plugin bridge when a UI → worker call fails.
 *
 * @see PLUGIN_SPEC.md §19.7 — Error Propagation Through The Bridge
 */
exports.PLUGIN_BRIDGE_ERROR_CODES = [
    "WORKER_UNAVAILABLE",
    "CAPABILITY_DENIED",
    "WORKER_ERROR",
    "TIMEOUT",
    "UNKNOWN",
];
