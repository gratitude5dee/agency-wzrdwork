import type { UIAdapterModule } from "../types";
import { parseCodexStdoutLine } from "./parse-stdout";
import { buildCodexLocalConfig } from "./build-config";
import { CodexLocalConfigFields } from "./config-fields";

export const codexLocalUIAdapter: UIAdapterModule = {
  type: "codex_local",
  label: "Codex (local)",
  parseStdoutLine: parseCodexStdoutLine,
  ConfigFields: CodexLocalConfigFields,
  buildAdapterConfig: buildCodexLocalConfig,
};
