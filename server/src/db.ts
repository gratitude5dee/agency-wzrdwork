import postgres, { type Sql } from "postgres";

export function createDatabase(databaseUrl: string): Sql {
  return postgres(databaseUrl, {
    max: 5,
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 15,
  });
}
