import type { UIAdapterModule } from "../types";
import { parseOpenClawGatewayStdoutLine } from "./parse-stdout";
import { buildOpenClawGatewayConfig } from "./build-config";
import { OpenClawGatewayConfigFields } from "./config-fields";

export const openClawGatewayUIAdapter: UIAdapterModule = {
  type: "openclaw_gateway",
  label: "OpenClaw Gateway",
  parseStdoutLine: parseOpenClawGatewayStdoutLine,
  ConfigFields: OpenClawGatewayConfigFields,
  buildAdapterConfig: buildOpenClawGatewayConfig,
};
