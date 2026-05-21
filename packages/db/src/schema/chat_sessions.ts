import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

export const chatSessions = pgTable(
  "chat_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    title: text("title"),
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),
    model: text("model"),
    status: text("status").default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("idx_chat_sessions_company_id").on(table.companyId),
    agentIdx: index("idx_chat_sessions_agent_id").on(table.agentId),
    statusIdx: index("idx_chat_sessions_status").on(table.status),
    createdAtIdx: index("idx_chat_sessions_created_at").on(table.createdAt),
  }),
);
