import os from "node:os";
import type { Db } from "@paperclipai/db";
import type { Environment, EnvironmentProbeResult } from "@paperclipai/shared";
import {
  resolveEnvironmentDriverConfigForRuntime,
  type ParsedEnvironmentConfig,
} from "./environment-config.js";
import { isBuiltinSandboxProvider, probeSandboxProvider } from "./sandbox-provider-runtime.js";

export async function probeEnvironment(
  db: Db,
  environment: Environment,
  options: { resolvedConfig?: ParsedEnvironmentConfig } = {},
): Promise<EnvironmentProbeResult> {
  const parsed = options.resolvedConfig ?? await resolveEnvironmentDriverConfigForRuntime(db, environment.companyId, environment);

  if (parsed.driver === "local") {
    return {
      ok: true,
      driver: "local",
      summary: "Local environment is available on this Paperclip host.",
      details: {
        hostname: os.hostname(),
        cwd: process.cwd(),
      },
    };
  }

  if (parsed.driver === "sandbox") {
    if (!isBuiltinSandboxProvider(parsed.config.provider)) {
      return {
        ok: false,
        driver: "sandbox",
        summary: `Sandbox provider "${parsed.config.provider}" is not registered as a built-in provider in this Agency runtime yet.`,
        details: {
          provider: parsed.config.provider,
          supportsRunExecution: false,
        },
      };
    }
    return await probeSandboxProvider(parsed.config);
  }

  if (parsed.driver === "plugin") {
    return {
      ok: false,
      driver: "plugin",
      summary: `Plugin environment driver "${parsed.config.pluginKey}:${parsed.config.driverKey}" is not installed in this Agency runtime yet.`,
      details: {
        pluginKey: parsed.config.pluginKey,
        driverKey: parsed.config.driverKey,
      },
    };
  }

  return {
    ok: false,
    driver: "ssh",
    summary: "SSH environment probing is not installed in this Agency runtime yet.",
    details: {
      host: parsed.config.host,
      port: parsed.config.port,
      username: parsed.config.username,
      remoteWorkspacePath: parsed.config.remoteWorkspacePath,
      supportsRunExecution: false,
    },
  };
}
