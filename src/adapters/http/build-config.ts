import type { CreateConfigValues } from "../types";

export function buildHttpConfig(v: CreateConfigValues): Record<string, unknown> {
  const ac: Record<string, unknown> = {};
  if (v.url) ac.url = v.url;
  ac.method = "POST";
  ac.timeoutMs = 15000;
  ac.heartbeatEnabled = v.heartbeatEnabled;
  ac.intervalSec = v.intervalSec;
  return ac;
}
