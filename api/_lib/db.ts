/**
 * Serverless-optimized Drizzle ORM connection for Vercel.
 *
 * Key adaptations for serverless:
 * - Uses Supabase connection pooler (port 6543) to avoid exhausting connections
 * - Disables prepared statements when using pgBouncer/Supavisor pooler
 * - Caches the db instance across warm invocations (module-level singleton)
 * - Limits max connections to 1 per serverless function instance
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../packages/db/dist/schema/index.js";

let cachedDb: ReturnType<typeof drizzle> | null = null;
let cachedSql: ReturnType<typeof postgres> | null = null;

function getConnectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL environment variable is required. " +
      "Use your Supabase connection pooler URL (port 6543) for serverless."
    );
  }
  return url;
}

function shouldDisablePreparedStatements(connectionString: string): boolean {
  const hostname = new URL(connectionString).hostname;
  return (
    process.env.AGENCY_DB_DISABLE_PREPARED_STATEMENTS === "true" ||
    process.env.PAPERCLIP_DB_DISABLE_PREPARED_STATEMENTS === "true" ||
    hostname.includes("pooler.supabase.com") ||
    hostname.includes("supavisor")
  );
}

export function getDb() {
  if (cachedDb) return cachedDb;

  const connectionString = getConnectionString();
  const disablePrepare = shouldDisablePreparedStatements(connectionString);

  cachedSql = postgres(connectionString, {
    // Serverless: keep pool small — each function instance gets its own
    max: 1,
    // Idle timeout: close connections after 20s of inactivity
    idle_timeout: 20,
    // Connection timeout: fail fast if pool is exhausted
    connect_timeout: 10,
    // Disable prepared statements when using connection pooler
    prepare: !disablePrepare,
    // Supabase pooler compatibility
    connection: {
      application_name: "agency-vercel-serverless",
    },
  });

  cachedDb = drizzle(cachedSql, { schema });
  return cachedDb;
}

/**
 * Get a raw postgres.js SQL instance for non-ORM queries.
 * Used by the control plane cron functions.
 */
export function getRawSql() {
  if (cachedSql) return cachedSql;
  // Calling getDb() will initialize cachedSql as a side effect
  getDb();
  return cachedSql!;
}

export type Db = ReturnType<typeof getDb>;
