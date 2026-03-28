import type { UIAdapterModule } from "../types";
import { parseCursorStdoutLine } from "./parse-stdout";
import { buildCursorLocalConfig } from "./build-config";
import { CursorLocalConfigFields } from "./config-fields";

export const cursorLocalUIAdapter: UIAdapterModule = {
  type: "cursor",
  label: "Cursor CLI (local)",
  parseStdoutLine: parseCursorStdoutLine,
  ConfigFields: CursorLocalConfigFields,
  buildAdapterConfig: buildCursorLocalConfig,
};
