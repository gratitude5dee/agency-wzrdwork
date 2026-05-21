import type { UIAdapterModule } from "../types";
import { parseCursorCloudStdoutLine } from "./parse-stdout";
import { buildCursorCloudConfig } from "./build-config";
import { CursorCloudConfigFields } from "./config-fields";

export const cursorCloudUIAdapter: UIAdapterModule = {
  type: "cursor_cloud",
  label: "Cursor Cloud",
  parseStdoutLine: parseCursorCloudStdoutLine,
  ConfigFields: CursorCloudConfigFields,
  buildAdapterConfig: buildCursorCloudConfig,
};
