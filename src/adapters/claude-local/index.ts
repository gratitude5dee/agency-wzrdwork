import type { UIAdapterModule } from "../types";
import { parseClaudeStdoutLine } from "./parse-stdout";
import { buildClaudeLocalConfig } from "./build-config";
import { ClaudeLocalConfigFields } from "./config-fields";

export const claudeLocalUIAdapter: UIAdapterModule = {
  type: "claude_local",
  label: "Claude Code (local)",
  parseStdoutLine: parseClaudeStdoutLine,
  ConfigFields: ClaudeLocalConfigFields,
  buildAdapterConfig: buildClaudeLocalConfig,
};
