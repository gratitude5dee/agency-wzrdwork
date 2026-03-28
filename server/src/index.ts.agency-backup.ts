import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { createDatabase } from "./db.js";
import { loadConfig } from "./config.js";
import { createLiveEventHub } from "./services/live-events.js";
import { createApp } from "./app.js";

export interface StartedServer {
  server: ReturnType<typeof createServer>;
  host: string;
  listenPort: number;
  apiUrl: string;
  databaseUrl: string;
}

export async function startServer(): Promise<StartedServer> {
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

  await new Promise<void>((resolve) => {
    server.listen(config.port, config.host, () => {
      console.log(
        `[agency-server] listening on http://${config.host}:${config.port} (ws ${config.websocketPath})`,
      );
      resolve();
    });
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

  return {
    server,
    host: config.host,
    listenPort: config.port,
    apiUrl: `http://${config.host}:${config.port}`,
    databaseUrl: config.databaseUrl,
  };
}

function isDirectInvocation() {
  return process.argv[1] === fileURLToPath(import.meta.url);
}

if (isDirectInvocation()) {
  void startServer().catch((error) => {
    console.error("[agency-server] fatal error", error);
    process.exit(1);
  });
}
