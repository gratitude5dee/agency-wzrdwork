import type { UIAdapterModule } from "../types";
import { parseGrokStdoutLine } from "./parse-stdout";
import { buildGrokLocalConfig } from "./build-config";
import { GrokLocalConfigFields } from "./config-fields";

export const grokLocalUIAdapter: UIAdapterModule = {
  type: "grok_local",
  label: "Grok Build (local)",
  parseStdoutLine: parseGrokStdoutLine,
  ConfigFields: GrokLocalConfigFields,
  buildAdapterConfig: buildGrokLocalConfig,
};
