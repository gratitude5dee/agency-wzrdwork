import type { PluginManifest, PluginScaffoldFile } from "../../../shared/src/index.js";

import type { PluginRpcHandlerMap, PluginWorkerTransport } from "./worker-rpc.js";
import { createWorkerRpcServer } from "./worker-rpc.js";

export interface PluginDefinition {
  manifest: PluginManifest;
  run?: (input: unknown) => Promise<unknown> | unknown;
  scaffold?: () => PluginScaffoldFile[] | Promise<PluginScaffoldFile[]>;
}

export function definePlugin(definition: PluginDefinition): PluginDefinition {
  return definition;
}

export function startPluginWorker(transport: PluginWorkerTransport, plugin: PluginDefinition) {
  return createWorkerRpcServer(transport, {
    manifest: () => ({ ok: true, manifest: plugin.manifest }),
    run: async ({ input }) => ({
      ok: true,
      output: plugin.run ? await plugin.run(input) : input,
    }),
    scaffold: async ({ targetDir }) => ({
      ok: true,
      files: plugin.scaffold ? await plugin.scaffold() : [{ path: `${targetDir}/README.md`, content: "" }],
    }),
    ping: () => ({
      ok: true,
      version: plugin.manifest.version,
    }),
  });
}
