import { z } from "zod";
import { randomUUID } from "node:crypto";
import type { Db } from "@paperclipai/db";
import type {
  Environment,
  EnvironmentDriver,
  FakeSandboxEnvironmentConfig,
  LocalEnvironmentConfig,
  PluginEnvironmentConfig,
  PluginSandboxEnvironmentConfig,
  SandboxEnvironmentConfig,
  SecretProvider,
  SecretVersionSelector,
  SshEnvironmentConfig,
} from "@paperclipai/shared";
import { unprocessable } from "../errors.js";
import { parseObject } from "../adapters/utils.js";
import { secretService } from "./secrets.js";

const secretRefSchema = z.object({
  type: z.literal("secret_ref"),
  secretId: z.string().uuid(),
  version: z.union([z.literal("latest"), z.number().int().positive()]).optional().default("latest"),
}).strict();

const sshEnvironmentConfigSchema = z.object({
  host: z.string({ required_error: "SSH environments require a host." }).trim().min(1, "SSH environments require a host."),
  port: z.coerce.number().int().min(1).max(65535).default(22),
  username: z.string({ required_error: "SSH environments require a username." }).trim().min(1, "SSH environments require a username."),
  remoteWorkspacePath: z
    .string({ required_error: "SSH environments require a remote workspace path." })
    .trim()
    .min(1, "SSH environments require a remote workspace path.")
    .refine((value) => value.startsWith("/"), "SSH remote workspace path must be absolute."),
  privateKey: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((value) => (value && value.length > 0 ? value : null)),
  privateKeySecretRef: secretRefSchema.optional().nullable().default(null),
  knownHosts: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((value) => (value && value.length > 0 ? value : null)),
  strictHostKeyChecking: z.boolean().optional().default(true),
}).strict();

const fakeSandboxEnvironmentConfigSchema = z.object({
  provider: z.literal("fake").default("fake"),
  image: z.string().trim().min(1, "Fake sandbox environments require an image.").default("ubuntu:24.04"),
  reuseLease: z.boolean().optional().default(false),
}).strict();

const pluginSandboxProviderKeySchema = z.string()
  .trim()
  .min(1, "Sandbox provider is required.")
  .regex(
    /^[a-z0-9][a-z0-9._-]*$/,
    "Sandbox provider key must start with a lowercase alphanumeric and contain only lowercase letters, digits, dots, hyphens, or underscores",
  );

const pluginSandboxEnvironmentConfigSchema = z.object({
  provider: pluginSandboxProviderKeySchema,
  timeoutMs: z.coerce.number().int().min(1).max(86_400_000).optional(),
  reuseLease: z.boolean().optional().default(false),
}).catchall(z.unknown());

const pluginEnvironmentConfigSchema = z.object({
  pluginKey: z.string().min(1),
  driverKey: z.string().min(1).regex(
    /^[a-z0-9][a-z0-9._-]*$/,
    "Environment driver key must start with a lowercase alphanumeric and contain only lowercase letters, digits, dots, hyphens, or underscores",
  ),
  driverConfig: z.record(z.unknown()).optional().default({}),
}).strict();

export type ParsedEnvironmentConfig =
  | { driver: "local"; config: LocalEnvironmentConfig }
  | { driver: "ssh"; config: SshEnvironmentConfig }
  | { driver: "sandbox"; config: SandboxEnvironmentConfig }
  | { driver: "plugin"; config: PluginEnvironmentConfig };

function toErrorMessage(error: z.ZodError) {
  const first = error.issues[0];
  if (!first) return "Invalid environment config.";
  return first.message;
}

function getSandboxProvider(raw: Record<string, unknown>) {
  return typeof raw.provider === "string" && raw.provider.trim().length > 0 ? raw.provider.trim() : "fake";
}

function parseSandboxEnvironmentConfig(
  input: Record<string, unknown> | null | undefined,
) {
  const raw = parseObject(input);
  const provider = getSandboxProvider(raw);

  if (provider === "fake") {
    const parsed = fakeSandboxEnvironmentConfigSchema.safeParse(raw);
    return parsed.success
      ? ({ success: true as const, data: parsed.data as FakeSandboxEnvironmentConfig })
      : ({ success: false as const, error: parsed.error });
  }

  const parsed = pluginSandboxEnvironmentConfigSchema.safeParse(raw);
  return parsed.success
    ? ({ success: true as const, data: parsed.data as PluginSandboxEnvironmentConfig })
    : ({ success: false as const, error: parsed.error });
}

function secretName(input: {
  environmentName: string;
  driver: EnvironmentDriver;
  field: string;
}) {
  const slug = input.environmentName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "environment";
  return `environment-${input.driver}-${slug}-${input.field}-${randomUUID().slice(0, 8)}`;
}

async function createEnvironmentSecret(input: {
  db: Db;
  companyId: string;
  environmentName: string;
  driver: EnvironmentDriver;
  field: string;
  provider: SecretProvider;
  value: string;
  actor?: { userId?: string | null; agentId?: string | null };
}) {
  const created = await secretService(input.db).create(
    input.companyId,
    {
      name: secretName(input),
      provider: input.provider,
      value: input.value,
      description: `Secret for ${input.environmentName} ${input.field}.`,
    },
    input.actor,
  );
  return {
    type: "secret_ref" as const,
    secretId: created.id,
    version: "latest" as const,
  };
}

export async function collectEnvironmentSecretRefs(input: {
  db: Db;
  environment: Pick<Environment, "id" | "driver" | "config">;
}): Promise<Array<{ secretId: string; configPath: string; versionSelector?: SecretVersionSelector }>> {
  const parsed = parseEnvironmentDriverConfig(input.environment);
  if (parsed.driver === "ssh" && parsed.config.privateKeySecretRef) {
    return [{
      secretId: parsed.config.privateKeySecretRef.secretId,
      configPath: "privateKeySecretRef",
      versionSelector: parsed.config.privateKeySecretRef.version ?? "latest",
    }];
  }
  return [];
}

export function normalizeEnvironmentConfig(input: {
  driver: EnvironmentDriver;
  config: Record<string, unknown> | null | undefined;
}): Record<string, unknown> {
  if (input.driver === "local") {
    return { ...parseObject(input.config) };
  }

  if (input.driver === "ssh") {
    const parsed = sshEnvironmentConfigSchema.safeParse(parseObject(input.config));
    if (!parsed.success) {
      throw unprocessable(toErrorMessage(parsed.error), {
        issues: parsed.error.issues,
      });
    }
    return parsed.data as unknown as Record<string, unknown>;
  }

  if (input.driver === "sandbox") {
    const parsed = parseSandboxEnvironmentConfig(input.config);
    if (!parsed.success) {
      throw unprocessable(toErrorMessage(parsed.error), {
        issues: parsed.error.issues,
      });
    }
    return parsed.data as unknown as Record<string, unknown>;
  }

  if (input.driver === "plugin") {
    const parsed = pluginEnvironmentConfigSchema.safeParse(parseObject(input.config));
    if (!parsed.success) {
      throw unprocessable(toErrorMessage(parsed.error), {
        issues: parsed.error.issues,
      });
    }
    return parsed.data as unknown as Record<string, unknown>;
  }

  throw unprocessable(`Unsupported environment driver: ${input.driver}`);
}

export function parseEnvironmentDriverConfig(
  environment: Pick<Environment, "driver" | "config">,
): ParsedEnvironmentConfig {
  const driver = environment.driver;
  const config = normalizeEnvironmentConfig({ driver, config: environment.config });
  if (driver === "local") return { driver, config };
  if (driver === "ssh") return { driver, config: config as unknown as SshEnvironmentConfig };
  if (driver === "sandbox") return { driver, config: config as unknown as SandboxEnvironmentConfig };
  return { driver: "plugin", config: config as unknown as PluginEnvironmentConfig };
}

export async function normalizeEnvironmentConfigForPersistence(input: {
  db: Db;
  companyId: string;
  environmentName: string;
  driver: EnvironmentDriver;
  secretProvider: SecretProvider;
  config: Record<string, unknown> | null | undefined;
  actor?: { userId?: string | null; agentId?: string | null };
}): Promise<Record<string, unknown>> {
  const normalized = normalizeEnvironmentConfig({ driver: input.driver, config: input.config });
  if (input.driver !== "ssh") return normalized;

  const sshConfig = normalized as unknown as SshEnvironmentConfig;
  if (!sshConfig.privateKey) return sshConfig as unknown as Record<string, unknown>;

  return {
    ...sshConfig,
    privateKey: null,
    privateKeySecretRef: await createEnvironmentSecret({
      db: input.db,
      companyId: input.companyId,
      environmentName: input.environmentName,
      driver: input.driver,
      field: "private-key",
      provider: input.secretProvider,
      value: sshConfig.privateKey,
      actor: input.actor,
    }),
  };
}

export async function normalizeEnvironmentConfigForProbe(input: {
  db: Db;
  driver: EnvironmentDriver;
  config: Record<string, unknown> | null | undefined;
}): Promise<Record<string, unknown>> {
  return normalizeEnvironmentConfig({ driver: input.driver, config: input.config });
}

export async function resolveEnvironmentDriverConfigForRuntime(
  db: Db,
  companyId: string,
  environment: Pick<Environment, "id" | "driver" | "config">,
): Promise<ParsedEnvironmentConfig> {
  const parsed = parseEnvironmentDriverConfig(environment);
  if (parsed.driver !== "ssh" || !parsed.config.privateKeySecretRef) return parsed;
  return {
    driver: "ssh",
    config: {
      ...parsed.config,
      privateKey: await secretService(db).resolveSecretValue(
        companyId,
        parsed.config.privateKeySecretRef.secretId,
        parsed.config.privateKeySecretRef.version ?? "latest",
      ),
    },
  };
}

export function readSshEnvironmentPrivateKeySecretId(environment: Pick<Environment, "driver" | "config">) {
  if (environment.driver !== "ssh") return null;
  const parsed = parseEnvironmentDriverConfig(environment);
  return parsed.driver === "ssh" ? parsed.config.privateKeySecretRef?.secretId ?? null : null;
}
