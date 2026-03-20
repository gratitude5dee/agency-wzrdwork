import { integer, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  companyType: text("company_type").notNull(),
  description: text("description").notNull(),
  brief: text("brief").notNull(),
  brandColor: text("brand_color").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey(),
  companyId: uuid("company_id").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  title: text("title"),
  adapterType: text("adapter_type").notNull(),
  status: text("status").notNull(),
  capabilities: text("capabilities"),
  reportsTo: uuid("reports_to"),
  seatIndex: integer("seat_index").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey(),
  companyId: uuid("company_id").notNull(),
  name: text("name").notNull(),
  summary: text("summary").notNull(),
  status: text("status").notNull(),
  priority: text("priority").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const goals = pgTable("goals", {
  id: uuid("id").primaryKey(),
  companyId: uuid("company_id").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  status: text("status").notNull(),
  ownerAgentId: uuid("owner_agent_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const issues = pgTable("issues", {
  id: uuid("id").primaryKey(),
  companyId: uuid("company_id").notNull(),
  projectId: uuid("project_id"),
  assigneeAgentId: uuid("assignee_agent_id"),
  identifier: text("identifier"),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull(),
  priority: text("priority").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const approvals = pgTable("approvals", {
  id: uuid("id").primaryKey(),
  companyId: uuid("company_id").notNull(),
  issueId: uuid("issue_id"),
  requestedByAgentId: uuid("requested_by_agent_id"),
  status: text("status").notNull(),
  summary: text("summary").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export const runs = pgTable("runs", {
  id: uuid("id").primaryKey(),
  companyId: uuid("company_id").notNull(),
  issueId: uuid("issue_id"),
  agentId: uuid("agent_id").notNull(),
  status: text("status").notNull(),
  summary: text("summary"),
  stdoutExcerpt: text("stdout_excerpt"),
  stderrExcerpt: text("stderr_excerpt"),
  error: text("error"),
  totalInputTokens: integer("total_input_tokens"),
  totalOutputTokens: integer("total_output_tokens"),
  totalCachedInputTokens: integer("total_cached_input_tokens"),
  totalCostUsd: numeric("total_cost_usd", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export const activityEvents = pgTable("activity_events", {
  id: uuid("id").primaryKey(),
  companyId: uuid("company_id").notNull(),
  agentId: uuid("agent_id"),
  issueId: uuid("issue_id"),
  action: text("action").notNull(),
  details: text("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});
