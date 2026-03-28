import type { UIAdapterModule } from "../types";
import { parseHermesStdoutLine } from "./parse-stdout";
import { buildHermesConfig } from "./build-config";
import { HermesConfigFields } from "./config-fields";

export const hermesUIAdapter: UIAdapterModule = {
  type: "hermes",
  label: "Hermes Agent",
  parseStdoutLine: parseHermesStdoutLine,
  ConfigFields: HermesConfigFields,
  buildAdapterConfig: buildHermesConfig,
};
