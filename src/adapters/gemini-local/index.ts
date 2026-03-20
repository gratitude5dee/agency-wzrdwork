import type { UIAdapterModule } from "../types";
import { parseGeminiStdoutLine } from "./parse-stdout";
import { buildGeminiLocalConfig } from "./build-config";
import { GeminiLocalConfigFields } from "./config-fields";

export const geminiLocalUIAdapter: UIAdapterModule = {
  type: "gemini_local",
  label: "Gemini CLI (local)",
  parseStdoutLine: parseGeminiStdoutLine,
  ConfigFields: GeminiLocalConfigFields,
  buildAdapterConfig: buildGeminiLocalConfig,
};
