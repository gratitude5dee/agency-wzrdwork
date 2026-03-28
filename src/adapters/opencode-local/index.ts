import type { UIAdapterModule } from "../types";
import { parseOpenCodeStdoutLine } from "./parse-stdout";
import { buildOpenCodeLocalConfig } from "./build-config";
import { OpenCodeLocalConfigFields } from "./config-fields";

export const openCodeLocalUIAdapter: UIAdapterModule = {
  type: "opencode_local",
  label: "OpenCode (local)",
  parseStdoutLine: parseOpenCodeStdoutLine,
  ConfigFields: OpenCodeLocalConfigFields,
  buildAdapterConfig: buildOpenCodeLocalConfig,
};
