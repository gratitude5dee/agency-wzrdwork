import "dotenv/config";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

function normalizeDatabaseUrl(connectionString: string): string {
  const url = new URL(connectionString);

  if (url.hostname.startsWith("supabase_db_")) {
    const segments = url.hostname.split("_");
    url.hostname = segments[segments.length - 1] ?? url.hostname;
  }

  return url.toString();
}

function shouldDisablePreparedStatements(connectionString: string): boolean {
  const hostname = new URL(connectionString).hostname;
  return (
    process.env.PAPERCLIP_DB_DISABLE_PREPARED_STATEMENTS === "true" ||
    hostname.includes("pooler.supabase.com")
  );
}

const rawConnectionString = process.env.DATABASE_URL;

if (!rawConnectionString) {
  throw new Error("DATABASE_URL is required for Drizzle.");
}

const connectionString = normalizeDatabaseUrl(rawConnectionString);
const client = postgres(connectionString, {
  prepare: !shouldDisablePreparedStatements(connectionString),
});

export const db = drizzle(client, { schema });
export { client };
