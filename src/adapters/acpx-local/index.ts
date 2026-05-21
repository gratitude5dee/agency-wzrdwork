import type { UIAdapterModule } from "../types";
import { parseAcpxStdoutLine } from "./parse-stdout";
import { buildAcpxLocalConfig } from "./build-config";
import { AcpxLocalConfigFields } from "./config-fields";

export const acpxLocalUIAdapter: UIAdapterModule = {
  type: "acpx_local",
  label: "ACPX (local)",
  parseStdoutLine: parseAcpxStdoutLine,
  ConfigFields: AcpxLocalConfigFields,
  buildAdapterConfig: buildAcpxLocalConfig,
};
