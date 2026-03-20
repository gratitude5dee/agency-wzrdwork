import type { UIAdapterModule } from "../types";
import { parsePiStdoutLine } from "./parse-stdout";
import { buildPiLocalConfig } from "./build-config";
import { PiLocalConfigFields } from "./config-fields";

export const piLocalUIAdapter: UIAdapterModule = {
  type: "pi_local",
  label: "Pi (local)",
  parseStdoutLine: parsePiStdoutLine,
  ConfigFields: PiLocalConfigFields,
  buildAdapterConfig: buildPiLocalConfig,
};
