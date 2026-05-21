import { pgTable, uuid, text, boolean, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

export const agentIntegrations = pgTable(
  "agent_integrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    integrationKey: text("integration_key").notNull(),
    enabled: boolean("enabled").default(true),
    config: jsonb("config").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    agentIdx: index("idx_agent_integrations_agent_id").on(table.agentId),
    companyIdx: index("idx_agent_integrations_company_id").on(table.companyId),
    integrationKeyIdx: index("idx_agent_integrations_integration_key").on(table.integrationKey),
    agentIntegrationUniqueIdx: uniqueIndex("agent_integrations_agent_id_integration_key_idx").on(
      table.agentId,
      table.integrationKey,
    ),
  }),
);
