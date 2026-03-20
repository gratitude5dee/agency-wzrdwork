import { startPluginWorker } from "../../sdk/src/index.js";

import { helloWorldPlugin } from "./index.js";

export function registerExampleWorker(transport: Parameters<typeof startPluginWorker>[0]) {
  return startPluginWorker(transport, helloWorldPlugin);
}
