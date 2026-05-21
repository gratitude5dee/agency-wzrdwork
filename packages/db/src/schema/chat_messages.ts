import { pgTable, uuid, text, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { chatSessions } from "./chat_sessions.js";

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id").notNull().references(() => chatSessions.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content"),
    contentBlocks: jsonb("content_blocks").$type<unknown>(),
    toolCalls: jsonb("tool_calls").$type<unknown>(),
    toolResults: jsonb("tool_results").$type<unknown>(),
    tokensUsed: integer("tokens_used"),
    model: text("model"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sessionIdx: index("idx_chat_messages_session_id").on(table.sessionId),
    roleIdx: index("idx_chat_messages_role").on(table.role),
    createdAtIdx: index("idx_chat_messages_created_at").on(table.createdAt),
  }),
);
