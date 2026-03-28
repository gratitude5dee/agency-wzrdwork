import { createDb } from "@paperclipai/db";
import type { Sql } from "postgres";

export type Db = Sql;

/**
 * Create the canonical Paperclip DB client and return its underlying postgres.js handle.
 * The Agency server still uses tagged-template SQL while the route layer is being ported.
 */
export function createDatabase(databaseUrl: string): Db {
  return createDb(databaseUrl).$client;
}
