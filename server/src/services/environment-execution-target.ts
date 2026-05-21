import type { Db } from "@paperclipai/db";
import type { Environment, EnvironmentLease } from "@paperclipai/shared";
import {
  adapterExecutionTargetToRemoteSpec,
  type AdapterExecutionTarget,
} from "@paperclipai/adapter-utils/execution-target";
import { parseObject } from "../adapters/utils.js";
import type { EnvironmentRuntimeService } from "./environment-runtime.js";

export const DEFAULT_SANDBOX_REMOTE_CWD = "/vercel/sandbox";

const LOCAL_REMOTE_ADAPTER_TYPES = new Set([
  "acpx_local",
  "codex_local",
  "claude_local",
  "gemini_local",
  "grok_local",
  "opencode_local",
  "pi_local",
  "cursor",
]);

function adapterSupportsRemoteExecution(adapterType: string): boolean {
  return LOCAL_REMOTE_ADAPTER_TYPES.has(adapterType);
}

function readRemoteCwd(leaseMetadata: Record<string, unknown> | null, fallback: string): string {
  return typeof leaseMetadata?.remoteCwd === "string" && leaseMetadata.remoteCwd.trim().length > 0
    ? leaseMetadata.remoteCwd.trim()
    : fallback;
}

function parseSandboxExecutionConfig(config: Record<string, unknown> | null): Record<string, unknown> & {
  provider: string;
  reuseLease: boolean;
} {
  const raw = parseObject(config);
  const provider = typeof raw.provider === "string" && raw.provider.trim().length > 0
    ? raw.provider.trim()
    : "fake";
  return {
    ...raw,
    provider,
    reuseLease: raw.reuseLease === true,
  };
}

export async function resolveEnvironmentExecutionTarget(input: {
  db: Db;
  companyId: string;
  adapterType: string;
  environment: {
    id?: string;
    driver: string;
    config: Record<string, unknown> | null;
  };
  leaseId?: string | null;
  leaseMetadata: Record<string, unknown> | null;
  lease?: EnvironmentLease | null;
  environmentRuntime?: EnvironmentRuntimeService | null;
}): Promise<AdapterExecutionTarget | null> {
  if (input.environment.driver === "local") {
    return {
      kind: "local",
      environmentId: input.environment.id ?? null,
      leaseId: input.leaseId ?? null,
    };
  }

  if (!adapterSupportsRemoteExecution(input.adapterType)) {
    return null;
  }

  if (input.environment.driver === "sandbox") {
    const config = parseSandboxExecutionConfig(input.environment.config);

    const remoteCwd = readRemoteCwd(input.leaseMetadata, DEFAULT_SANDBOX_REMOTE_CWD);
    const timeoutMs = typeof config.timeoutMs === "number" && Number.isFinite(config.timeoutMs)
      ? config.timeoutMs
      : null;
    const shellCommand =
      input.leaseMetadata?.shellCommand === "bash" || input.leaseMetadata?.shellCommand === "sh"
        ? input.leaseMetadata.shellCommand
        : null;

    return {
      kind: "remote",
      transport: "sandbox",
      providerKey: config.provider,
      shellCommand,
      remoteCwd,
      environmentId: input.environment.id ?? null,
      leaseId: input.leaseId ?? null,
      timeoutMs,
      runner: input.environmentRuntime && input.lease
        ? {
            execute: async (commandInput) => {
              const startedAt = new Date().toISOString();
              const result = await input.environmentRuntime!.execute({
                environment: input.environment as Environment,
                lease: input.lease!,
                command: commandInput.command,
                args: commandInput.args,
                cwd: commandInput.cwd ?? remoteCwd,
                env: commandInput.env,
                stdin: commandInput.stdin,
                timeoutMs: commandInput.timeoutMs,
              });
              if (result.stdout) await commandInput.onLog?.("stdout", result.stdout);
              if (result.stderr) await commandInput.onLog?.("stderr", result.stderr);
              return {
                exitCode: result.exitCode,
                signal: result.signal ?? null,
                timedOut: result.timedOut ?? false,
                stdout: result.stdout,
                stderr: result.stderr,
                pid: null,
                startedAt,
              };
            },
          }
        : undefined,
    };
  }

  if (input.environment.driver !== "ssh") {
    return null;
  }

  const environmentId = input.environment.id;
  if (!environmentId) {
    return null;
  }

  const { resolveEnvironmentDriverConfigForRuntime } = await import("./environment-config.js");
  const parsed = await resolveEnvironmentDriverConfigForRuntime(input.db, input.companyId, {
    id: environmentId,
    driver: input.environment.driver as "ssh",
    config: parseObject(input.environment.config),
  });
  if (parsed.driver !== "ssh") {
    return null;
  }

  const remoteCwd = readRemoteCwd(input.leaseMetadata, parsed.config.remoteWorkspacePath);

  return {
    kind: "remote",
    transport: "ssh",
    environmentId,
    leaseId: input.leaseId ?? null,
    remoteCwd,
    spec: {
      host: parsed.config.host,
      port: parsed.config.port,
      username: parsed.config.username,
      remoteWorkspacePath: parsed.config.remoteWorkspacePath,
      privateKey: parsed.config.privateKey,
      knownHosts: parsed.config.knownHosts,
      strictHostKeyChecking: parsed.config.strictHostKeyChecking,
      remoteCwd,
    },
  };
}

export async function resolveEnvironmentExecutionTransport(
  input: Parameters<typeof resolveEnvironmentExecutionTarget>[0],
): Promise<ReturnType<typeof adapterExecutionTargetToRemoteSpec>> {
  return adapterExecutionTargetToRemoteSpec(await resolveEnvironmentExecutionTarget(input));
}
