import type { UIAdapterModule } from "../types";
import { parseHttpStdoutLine } from "./parse-stdout";
import { buildHttpConfig } from "./build-config";
import { HttpConfigFields } from "./config-fields";

export const httpUIAdapter: UIAdapterModule = {
  type: "http",
  label: "HTTP Webhook",
  parseStdoutLine: parseHttpStdoutLine,
  ConfigFields: HttpConfigFields,
  buildAdapterConfig: buildHttpConfig,
};
