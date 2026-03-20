import { createServer } from "node:http";
import { createDatabase } from "./db.js";
import { loadConfig } from "./config.js";
import { createLiveEventHub } from "./services/live-events.js";
import { createApp } from "./app.js";

async function main() {
  const config = loadConfig(process.env);
  const sql = createDatabase(config.databaseUrl);
  const liveEvents = createLiveEventHub();
  const app = createApp({
    config,
    sql,
    liveEvents,
  });

  const server = createServer(app);
  liveEvents.attach(server, sql, config);

  server.listen(config.port, config.host, () => {
    console.log(
      `[agency-server] listening on http://${config.host}:${config.port} (ws ${config.websocketPath})`,
    );
  });

  const stop = async (signal: string) => {
    console.log(`[agency-server] shutting down on ${signal}`);
    liveEvents.close();
    server.close();
    await sql.end({ timeout: 5 });
    process.exit(0);
  };

  process.on("SIGINT", () => void stop("SIGINT"));
  process.on("SIGTERM", () => void stop("SIGTERM"));
}

void main().catch((error) => {
  console.error("[agency-server] fatal error", error);
  process.exit(1);
});
