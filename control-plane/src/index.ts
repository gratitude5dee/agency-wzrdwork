import { loadConfig } from "./config.js";
import { closeDatabase, createDatabase } from "./repository.js";
import { ControlPlaneService } from "./service.js";
import { sleep, toErrorMessage } from "./utils.js";

async function main() {
  const config = loadConfig(process.env);
  const sql = createDatabase(config.databaseUrl, {
    prepare: !config.disablePreparedStatements,
  });
  const service = new ControlPlaneService(sql, config);

  let stopped = false;

  const stop = async (signal: string) => {
    if (stopped) return;
    stopped = true;
    console.log(`[control-plane] received ${signal}, shutting down`);
    await closeDatabase(sql);
    process.exit(0);
  };

  process.on("SIGINT", () => void stop("SIGINT"));
  process.on("SIGTERM", () => void stop("SIGTERM"));

  console.log(
    `[control-plane] worker ${config.workerId} started (poll=${config.pollIntervalMs}ms scheduler=${config.schedulerIntervalMs}ms)`,
  );

  let nextSchedulerAt = 0;
  while (!stopped) {
    const now = Date.now();
    try {
      if (now >= nextSchedulerAt) {
        await service.schedulerTick(new Date(now));
        nextSchedulerAt = now + config.schedulerIntervalMs;
      }
      await service.workerTick();
    } catch (error) {
      console.error(`[control-plane] ${toErrorMessage(error)}`);
    }

    await sleep(config.pollIntervalMs);
  }
}

void main().catch((error) => {
  console.error(`[control-plane] fatal: ${toErrorMessage(error)}`);
  process.exit(1);
});
