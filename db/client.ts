// DEPRECATED: This file re-exports from the canonical location.
// Import from @agency-wzrdwork/db or packages/db/src/client.ts instead.
import "dotenv/config";

import { createDb, schema } from "../packages/db/src/client.js";

const rawConnectionString = process.env.DATABASE_URL;

if (!rawConnectionString) {
  throw new Error("DATABASE_URL is required for Drizzle.");
}

export const db = createDb(rawConnectionString);
export { schema };
