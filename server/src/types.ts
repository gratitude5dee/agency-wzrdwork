import type { IncomingMessage, ServerResponse } from "node:http";
import type { Sql } from "postgres";
import type { WebSocket } from "ws";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue | undefined;
}

export interface ServerConfig {
  host: string;
  port: number;
  databaseUrl: string;
  allowedOrigin: string;
  trustWalletHeader: boolean;
  websocketPath: string;
  audience: string;
  challengeTtlMinutes: number;
  sessionTtlDays: number;
}

export interface AppUserRow {
  id: string;
  wallet_address: string;
  display_name: string | null;
}

export interface MembershipRow {
  company_id: string;
  role: string;
  permissions: JsonObject;
  status: string;
}

export interface Actor {
  user: AppUserRow;
  memberships: MembershipRow[];
  instanceRoles: string[];
}

export interface LiveEvent {
  type: string;
  companyId: string | null;
  payload: JsonObject;
  createdAt: string;
}

export interface LiveSocketSession {
  socket: WebSocket;
  companyId: string | null;
  walletAddress: string;
}

export interface AccessibleCompany {
  id: string;
  name: string;
  slug: string;
  wallet_address: string | null;
}

export interface AppContext {
  config: ServerConfig;
  sql: Sql;
  liveEvents: LiveEventHub;
}

export interface RouteContext extends AppContext {
  request: IncomingMessage;
  response: ServerResponse;
  url: URL;
}

export interface RouteResult {
  handled: boolean;
}

export interface LiveEventHub {
  attach(server: import("node:http").Server, sql: Sql, config: ServerConfig): void;
  publish(event: Omit<LiveEvent, "createdAt">): void;
  close(): void;
}

export interface RequestActorInput {
  companyId?: string | null;
  walletAddress?: string | null;
}
