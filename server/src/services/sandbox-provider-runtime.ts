import { execFile as execFileCallback } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { constants as fsConstants, promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type {
  EnvironmentLeaseStatus,
  EnvironmentProbeResult,
  FakeSandboxEnvironmentConfig,
  SandboxEnvironmentConfig,
  SandboxEnvironmentProvider,
} from "@paperclipai/shared";

export interface SandboxProviderValidationResult {
  ok: boolean;
  summary: string;
  details?: Record<string, unknown>;
}

export interface AcquireSandboxLeaseInput {
  config: SandboxEnvironmentConfig;
  environmentId: string;
  heartbeatRunId: string;
  issueId: string | null;
}

export interface ResumeSandboxLeaseInput {
  config: SandboxEnvironmentConfig;
  providerLeaseId: string;
}

export interface ReleaseSandboxLeaseInput {
  config: SandboxEnvironmentConfig;
  providerLeaseId: string | null;
  status: Extract<EnvironmentLeaseStatus, "released" | "expired" | "failed">;
}

export interface DestroySandboxLeaseInput {
  config: SandboxEnvironmentConfig;
  providerLeaseId: string | null;
}

export interface PrepareSandboxWorkspaceInput {
  config: SandboxEnvironmentConfig;
  providerLeaseId: string | null;
  workspace: {
    localPath?: string;
    remotePath?: string;
    mode?: string;
    metadata?: Record<string, unknown>;
  };
}

export interface SandboxExecuteInput {
  config: SandboxEnvironmentConfig;
  providerLeaseId: string | null;
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  stdin?: string;
  timeoutMs?: number;
}

export interface SandboxLeaseHandle {
  providerLeaseId: string;
  metadata: Record<string, unknown>;
}

export interface PreparedSandboxWorkspace {
  remotePath?: string | null;
  metadata?: Record<string, unknown>;
}

export interface SandboxExecuteResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  signal?: string | null;
  timedOut?: boolean | null;
}

export interface SandboxProvider {
  readonly provider: SandboxEnvironmentProvider;
  validateConfig(config: SandboxEnvironmentConfig): Promise<SandboxProviderValidationResult>;
  probe(config: SandboxEnvironmentConfig): Promise<EnvironmentProbeResult>;
  acquireLease(input: AcquireSandboxLeaseInput): Promise<SandboxLeaseHandle>;
  resumeLease(input: ResumeSandboxLeaseInput): Promise<SandboxLeaseHandle | null>;
  releaseLease(input: ReleaseSandboxLeaseInput): Promise<void>;
  destroyLease(input: DestroySandboxLeaseInput): Promise<void>;
  matchesReusableLease(input: {
    config: SandboxEnvironmentConfig;
    lease: { providerLeaseId: string | null; metadata: Record<string, unknown> | null };
  }): boolean;
  configFromLeaseMetadata(metadata: Record<string, unknown>): SandboxEnvironmentConfig | null;
  prepareWorkspace?(input: PrepareSandboxWorkspaceInput): Promise<PreparedSandboxWorkspace>;
  execute?(input: SandboxExecuteInput): Promise<SandboxExecuteResult>;
}

type VercelSandboxInstance = {
  sandboxId: string;
  status?: string;
  timeout?: number;
  createdAt?: Date;
  runCommand: (
    params: {
      cmd: string;
      args?: string[];
      cwd?: string;
      env?: Record<string, string>;
      signal?: AbortSignal;
    },
  ) => Promise<{
    exitCode: number | null;
      stdout: () => Promise<string>;
      stderr: () => Promise<string>;
  }>;
  mkDir: (path: string, opts?: { signal?: AbortSignal }) => Promise<void>;
  writeFiles: (
    files: Array<{ path: string; content: Buffer }>,
    opts?: { signal?: AbortSignal },
  ) => Promise<void>;
  readFileToBuffer: (
    file: { path: string; cwd?: string },
    opts?: { signal?: AbortSignal },
  ) => Promise<Buffer | null>;
  stop: (opts?: { signal?: AbortSignal; blocking?: boolean }) => Promise<unknown>;
};

type VercelSandboxModule = {
  Sandbox: {
    create(params?: Record<string, unknown>): Promise<VercelSandboxInstance>;
    get(params: { sandboxId: string }): Promise<VercelSandboxInstance>;
  };
};

const dynamicImport = new Function("specifier", "return import(specifier)") as (
  specifier: string,
) => Promise<VercelSandboxModule>;
const execFile = promisify(execFileCallback);

type SnapshotEntry =
  | { kind: "dir" }
  | { kind: "file"; mode: number; hash: string }
  | { kind: "symlink"; target: string };

interface DirectorySnapshot {
  exclude: string[];
  entries: Map<string, SnapshotEntry>;
}

interface WorkspaceSyncState {
  localPath: string;
  remotePath: string;
  runtimeDir: string;
  exclude: string[];
  baseline: DirectorySnapshot;
}

function assertProviderConfig<T extends SandboxEnvironmentConfig>(
  provider: SandboxEnvironmentProvider,
  config: SandboxEnvironmentConfig,
): asserts config is T {
  if (config.provider !== provider) {
    throw new Error(`Sandbox provider "${provider}" received config for provider "${config.provider}".`);
  }
}

function parseRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readPositiveInt(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function readStringRecord(value: unknown): Record<string, string> | undefined {
  const parsed = parseRecord(value);
  if (!parsed) return undefined;
  const result: Record<string, string> = {};
  for (const [key, raw] of Object.entries(parsed)) {
    if (typeof raw === "string") result[key] = raw;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function readPorts(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const ports = value
    .filter((port): port is number => Number.isInteger(port) && port > 0 && port <= 65_535)
    .slice(0, 4);
  return ports.length > 0 ? ports : undefined;
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function isRelativePathOrDescendant(relative: string, candidate: string): boolean {
  return relative === candidate || relative.startsWith(`${candidate}/`);
}

function shouldExclude(relative: string, exclude: readonly string[]): boolean {
  return exclude.some((candidate) => isRelativePathOrDescendant(relative, candidate));
}

async function withTempDir<T>(prefix: string, fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function execTar(args: string[]): Promise<void> {
  await execFile("tar", args, {
    env: {
      ...process.env,
      COPYFILE_DISABLE: "1",
    },
    maxBuffer: 32 * 1024 * 1024,
  });
}

async function createTarballFromDirectory(input: {
  localDir: string;
  archivePath: string;
  exclude?: string[];
}): Promise<void> {
  const excludeArgs = ["._*", ...(input.exclude ?? [])].flatMap((entry) => ["--exclude", entry]);
  await execTar(["-c", "-f", input.archivePath, "-C", input.localDir, ...excludeArgs, "."]);
}

async function extractTarballToDirectory(input: {
  archivePath: string;
  localDir: string;
}): Promise<void> {
  await fs.mkdir(input.localDir, { recursive: true });
  await execTar(["-xf", input.archivePath, "-C", input.localDir]);
}

async function hashFile(filePath: string): Promise<string> {
  return await new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

async function walkDirectory(
  root: string,
  exclude: readonly string[],
  relative = "",
  out: Map<string, SnapshotEntry> = new Map(),
): Promise<Map<string, SnapshotEntry>> {
  const current = relative ? path.join(root, relative) : root;
  const entries = await fs.readdir(current, { withFileTypes: true }).catch(() => []);
  entries.sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    const nextRelative = relative ? path.posix.join(relative, entry.name) : entry.name;
    if (shouldExclude(nextRelative, exclude)) continue;

    const fullPath = path.join(root, nextRelative);
    const stats = await fs.lstat(fullPath);
    if (!stats.isDirectory() && !stats.isSymbolicLink() && !stats.isFile()) continue;

    if (stats.isDirectory()) {
      out.set(nextRelative, { kind: "dir" });
      await walkDirectory(root, exclude, nextRelative, out);
      continue;
    }

    if (stats.isSymbolicLink()) {
      out.set(nextRelative, {
        kind: "symlink",
        target: await fs.readlink(fullPath),
      });
      continue;
    }

    out.set(nextRelative, {
      kind: "file",
      mode: stats.mode,
      hash: await hashFile(fullPath),
    });
  }

  return out;
}

async function readSnapshotEntry(root: string, relative: string): Promise<SnapshotEntry | null> {
  const fullPath = path.join(root, relative);
  let stats;
  try {
    stats = await fs.lstat(fullPath);
  } catch {
    return null;
  }
  if (stats.isDirectory()) return { kind: "dir" };
  if (stats.isSymbolicLink()) {
    return {
      kind: "symlink",
      target: await fs.readlink(fullPath),
    };
  }
  if (!stats.isFile()) return null;
  return {
    kind: "file",
    mode: stats.mode,
    hash: await hashFile(fullPath),
  };
}

function entriesMatch(left: SnapshotEntry | null | undefined, right: SnapshotEntry | null | undefined): boolean {
  if (!left || !right) return false;
  if (left.kind !== right.kind) return false;
  if (left.kind === "dir") return true;
  if (left.kind === "symlink" && right.kind === "symlink") return left.target === right.target;
  if (left.kind === "file" && right.kind === "file") {
    return left.mode === right.mode && left.hash === right.hash;
  }
  return false;
}

async function captureDirectorySnapshot(rootDir: string, options: { exclude?: string[] } = {}): Promise<DirectorySnapshot> {
  const exclude = [...new Set(options.exclude ?? [])];
  return {
    exclude,
    entries: await walkDirectory(rootDir, exclude),
  };
}

async function acquireDirectoryMergeLock(lockDir: string): Promise<() => Promise<void>> {
  const deadline = Date.now() + 30_000;
  while (true) {
    try {
      await fs.mkdir(lockDir);
      await fs.writeFile(
        path.join(lockDir, "owner.json"),
        `${JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() })}\n`,
        "utf8",
      );
      return async () => {
        await fs.rm(lockDir, { recursive: true, force: true }).catch(() => undefined);
      };
    } catch (error) {
      const code = error && typeof error === "object" ? (error as { code?: unknown }).code : null;
      if (code !== "EEXIST") throw error;
      if (Date.now() >= deadline) {
        throw new Error(`Timed out waiting for workspace restore lock at ${lockDir}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}

async function copySnapshotEntry(sourceDir: string, targetDir: string, relative: string, entry: SnapshotEntry): Promise<void> {
  const sourcePath = path.join(sourceDir, relative);
  const targetPath = path.join(targetDir, relative);

  if (entry.kind === "dir") {
    const existing = await fs.lstat(targetPath).catch(() => null);
    if (existing?.isDirectory()) return;
    if (existing) await fs.rm(targetPath, { recursive: true, force: true }).catch(() => undefined);
    await fs.mkdir(targetPath, { recursive: true });
    return;
  }

  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.rm(targetPath, { recursive: true, force: true }).catch(() => undefined);
  if (entry.kind === "symlink") {
    await fs.symlink(entry.target, targetPath);
    return;
  }

  await fs.copyFile(sourcePath, targetPath, fsConstants.COPYFILE_FICLONE).catch(async () => {
    await fs.copyFile(sourcePath, targetPath);
  });
  await fs.chmod(targetPath, entry.mode);
}

async function mergeDirectoryWithBaseline(input: {
  baseline: DirectorySnapshot;
  sourceDir: string;
  targetDir: string;
}): Promise<void> {
  const source = await captureDirectorySnapshot(input.sourceDir, { exclude: input.baseline.exclude });
  const releaseLock = await acquireDirectoryMergeLock(`${input.targetDir}.paperclip-restore.lock`);
  try {
    const current = await captureDirectorySnapshot(input.targetDir, { exclude: input.baseline.exclude });
    const deletedEntries = [...input.baseline.entries.entries()]
      .filter(([relative, entry]) => entry.kind !== "dir" && !source.entries.has(relative))
      .sort(([left], [right]) => right.length - left.length);

    for (const [relative, baselineEntry] of deletedEntries) {
      if (!entriesMatch(current.entries.get(relative), baselineEntry)) continue;
      await fs.rm(path.join(input.targetDir, relative), { recursive: true, force: true }).catch(() => undefined);
    }

    const deletedDirs = [...input.baseline.entries.entries()]
      .filter(([relative, entry]) => entry.kind === "dir" && !source.entries.has(relative))
      .sort(([left], [right]) => right.length - left.length);
    for (const [relative] of deletedDirs) {
      await fs.rmdir(path.join(input.targetDir, relative)).catch(() => undefined);
    }

    const changedSourceEntries = [...source.entries.entries()]
      .filter(([relative, entry]) => !entriesMatch(input.baseline.entries.get(relative), entry))
      .sort(([left], [right]) => left.localeCompare(right));
    for (const [relative, entry] of changedSourceEntries) {
      await copySnapshotEntry(input.sourceDir, input.targetDir, relative, entry);
    }
  } finally {
    await releaseLock();
  }
}

function tarExcludeFlags(exclude: string[] | undefined): string {
  return ["._*", ...(exclude ?? [])].map((entry) => `--exclude ${shellQuote(entry)}`).join(" ");
}

function buildSandboxStdinCommand(command: string, args: string[], stdin: string): { command: string; args: string[] } {
  const marker = `__PAPERCLIP_STDIN_${randomUUID().replace(/-/g, "")}__`;
  const encodedStdin = Buffer.from(stdin, "utf8").toString("base64");
  const argv = [command, ...args].map(shellQuote).join(" ");
  return {
    command: "bash",
    args: [
      "-lc",
      [
        "set -o pipefail",
        `base64 -d <<'${marker}' | ${argv}`,
        encodedStdin,
        marker,
      ].join("\n"),
    ],
  };
}

async function loadVercelSandboxSdk(): Promise<VercelSandboxModule> {
  try {
    return await dynamicImport("@vercel/sandbox");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Vercel Sandbox SDK is unavailable. Install @vercel/sandbox or check the runtime bundle. ${message}`);
  }
}

function buildFakeSandboxProbe(config: FakeSandboxEnvironmentConfig): EnvironmentProbeResult {
  return {
    ok: true,
    driver: "sandbox",
    summary: `Fake sandbox provider is ready for image ${config.image}.`,
    details: {
      provider: config.provider,
      image: config.image,
      reuseLease: config.reuseLease,
      supportsRunExecution: false,
    },
  };
}

class FakeSandboxProvider implements SandboxProvider {
  readonly provider = "fake" as const;

  async validateConfig(config: SandboxEnvironmentConfig): Promise<SandboxProviderValidationResult> {
    assertProviderConfig<FakeSandboxEnvironmentConfig>(this.provider, config);
    return {
      ok: true,
      summary: `Fake sandbox provider config is valid for image ${config.image}.`,
      details: {
        provider: config.provider,
        image: config.image,
        reuseLease: config.reuseLease,
      },
    };
  }

  async probe(config: SandboxEnvironmentConfig): Promise<EnvironmentProbeResult> {
    assertProviderConfig<FakeSandboxEnvironmentConfig>(this.provider, config);
    return buildFakeSandboxProbe(config);
  }

  async acquireLease(input: AcquireSandboxLeaseInput): Promise<SandboxLeaseHandle> {
    assertProviderConfig<FakeSandboxEnvironmentConfig>(this.provider, input.config);
    const providerLeaseId = input.config.reuseLease
      ? `sandbox://fake/${input.environmentId}`
      : `sandbox://fake/${input.heartbeatRunId}/${randomUUID()}`;

    return {
      providerLeaseId,
      metadata: {
        provider: input.config.provider,
        image: input.config.image,
        reuseLease: input.config.reuseLease,
        remoteCwd: "/tmp",
      },
    };
  }

  async resumeLease(input: ResumeSandboxLeaseInput): Promise<SandboxLeaseHandle | null> {
    assertProviderConfig<FakeSandboxEnvironmentConfig>(this.provider, input.config);
    return {
      providerLeaseId: input.providerLeaseId,
      metadata: {
        provider: input.config.provider,
        image: input.config.image,
        reuseLease: input.config.reuseLease,
        remoteCwd: "/tmp",
        resumedLease: true,
      },
    };
  }

  async releaseLease(): Promise<void> {
    return;
  }

  async destroyLease(): Promise<void> {
    return;
  }

  matchesReusableLease(input: {
    config: SandboxEnvironmentConfig;
    lease: { providerLeaseId: string | null; metadata: Record<string, unknown> | null };
  }): boolean {
    assertProviderConfig<FakeSandboxEnvironmentConfig>(this.provider, input.config);
    return (
      typeof input.lease.providerLeaseId === "string" &&
      input.lease.providerLeaseId.length > 0 &&
      input.lease.metadata?.provider === input.config.provider &&
      input.lease.metadata?.reuseLease === true &&
      input.lease.metadata?.image === input.config.image
    );
  }

  configFromLeaseMetadata(metadata: Record<string, unknown>): SandboxEnvironmentConfig | null {
    if (metadata.provider !== this.provider || typeof metadata.image !== "string") {
      return null;
    }
    return {
      provider: this.provider,
      image: metadata.image,
      reuseLease: metadata.reuseLease === true,
    };
  }
}

class VercelSandboxProvider implements SandboxProvider {
  readonly provider = "vercel" as const;
  private readonly remoteCwd = "/vercel/sandbox";
  private readonly workspaceSyncs = new Map<string, WorkspaceSyncState>();

  async validateConfig(config: SandboxEnvironmentConfig): Promise<SandboxProviderValidationResult> {
    assertProviderConfig(this.provider, config);
    return {
      ok: true,
      summary: `Vercel Sandbox config is valid for runtime ${this.runtime(config)}.`,
      details: this.metadataFromConfig(config),
    };
  }

  async probe(config: SandboxEnvironmentConfig): Promise<EnvironmentProbeResult> {
    assertProviderConfig(this.provider, config);
    const sandbox = await this.createSandbox(config);
    try {
      const result = await sandbox.runCommand({
        cmd: this.runtime(config).startsWith("python") ? "python3" : "node",
        args: [this.runtime(config).startsWith("python") ? "--version" : "--version"],
        cwd: this.remoteCwd,
      });
      return {
        ok: result.exitCode === 0,
        driver: "sandbox",
        summary: result.exitCode === 0
          ? `Vercel Sandbox provider is ready for runtime ${this.runtime(config)}.`
          : `Vercel Sandbox probe exited with code ${result.exitCode}.`,
        details: {
          ...this.metadataFromConfig(config),
          sandboxId: sandbox.sandboxId,
          stdout: await result.stdout(),
          stderr: await result.stderr(),
          supportsRunExecution: true,
        },
      };
    } finally {
      await sandbox.stop({ blocking: false }).catch(() => undefined);
    }
  }

  async acquireLease(input: AcquireSandboxLeaseInput): Promise<SandboxLeaseHandle> {
    assertProviderConfig(this.provider, input.config);
    const sandbox = await this.createSandbox(input.config);
    return {
      providerLeaseId: sandbox.sandboxId,
      metadata: {
        ...this.metadataFromConfig(input.config),
        sandboxId: sandbox.sandboxId,
        sandboxStatus: sandbox.status ?? null,
        remoteCwd: this.remoteCwd,
        shellCommand: "bash",
        supportsRunExecution: true,
      },
    };
  }

  async resumeLease(input: ResumeSandboxLeaseInput): Promise<SandboxLeaseHandle | null> {
    assertProviderConfig(this.provider, input.config);
    const sandbox = await this.getSandbox(input.providerLeaseId).catch(() => null);
    if (!sandbox) return null;
    return {
      providerLeaseId: sandbox.sandboxId,
      metadata: {
        ...this.metadataFromConfig(input.config),
        sandboxId: sandbox.sandboxId,
        sandboxStatus: sandbox.status ?? null,
        remoteCwd: this.remoteCwd,
        shellCommand: "bash",
        supportsRunExecution: true,
        resumedLease: true,
      },
    };
  }

  async releaseLease(input: ReleaseSandboxLeaseInput): Promise<void> {
    assertProviderConfig(this.provider, input.config);
    if (!input.providerLeaseId) return;
    let restoreError: unknown = null;
    try {
      await this.restoreWorkspace(input.providerLeaseId);
    } catch (error) {
      restoreError = error;
    }
    if (input.config.reuseLease && input.status === "released") {
      if (restoreError) throw restoreError;
      return;
    }
    const sandbox = await this.getSandbox(input.providerLeaseId).catch(() => null);
    await sandbox?.stop({ blocking: false }).catch(() => undefined);
    if (restoreError) throw restoreError;
  }

  async destroyLease(input: DestroySandboxLeaseInput): Promise<void> {
    assertProviderConfig(this.provider, input.config);
    if (!input.providerLeaseId) return;
    let restoreError: unknown = null;
    try {
      await this.restoreWorkspace(input.providerLeaseId);
    } catch (error) {
      restoreError = error;
    }
    const sandbox = await this.getSandbox(input.providerLeaseId).catch(() => null);
    await sandbox?.stop({ blocking: true }).catch(() => undefined);
    if (restoreError) throw restoreError;
  }

  matchesReusableLease(input: {
    config: SandboxEnvironmentConfig;
    lease: { providerLeaseId: string | null; metadata: Record<string, unknown> | null };
  }): boolean {
    assertProviderConfig(this.provider, input.config);
    return (
      typeof input.lease.providerLeaseId === "string" &&
      input.lease.providerLeaseId.length > 0 &&
      input.lease.metadata?.provider === this.provider &&
      input.lease.metadata?.reuseLease === true &&
      input.lease.metadata?.runtime === this.runtime(input.config)
    );
  }

  configFromLeaseMetadata(metadata: Record<string, unknown>): SandboxEnvironmentConfig | null {
    if (metadata.provider !== this.provider) return null;
    return {
      provider: this.provider,
      runtime: readString(metadata.runtime) ?? "node24",
      timeoutMs: readPositiveInt(metadata.timeoutMs) ?? undefined,
      reuseLease: metadata.reuseLease === true,
    };
  }

  async prepareWorkspace(input: PrepareSandboxWorkspaceInput): Promise<PreparedSandboxWorkspace> {
    assertProviderConfig(this.provider, input.config);
    const remotePath = input.workspace.remotePath ?? this.remoteCwd;
    if (!input.providerLeaseId || !input.workspace.localPath) {
      return {
        remotePath,
        metadata: {
          remoteCwd: remotePath,
          workspaceSync: {
            strategy: "sandbox_archive_upload_download",
            uploaded: false,
            reason: !input.providerLeaseId ? "missing_provider_lease_id" : "missing_local_path",
          },
        },
      };
    }

    const localPath = input.workspace.localPath;
    const stats = await fs.stat(localPath).catch(() => null);
    if (!stats?.isDirectory()) {
      return {
        remotePath,
        metadata: {
          remoteCwd: remotePath,
          workspaceSync: {
            strategy: "sandbox_archive_upload_download",
            uploaded: false,
            reason: "local_path_not_directory",
          },
        },
      };
    }

    const sandbox = await this.getSandbox(input.providerLeaseId);
    const runtimeDir = path.posix.join(remotePath, ".paperclip-runtime");
    const exclude = [".paperclip-runtime"];
    const baseline = await captureDirectorySnapshot(localPath, { exclude });

    await withTempDir("paperclip-vercel-sandbox-upload-", async (tempDir) => {
      const localArchivePath = path.join(tempDir, "workspace.tar");
      await createTarballFromDirectory({
        localDir: localPath,
        archivePath: localArchivePath,
        exclude,
      });
      const remoteArchivePath = path.posix.join(runtimeDir, `workspace-upload-${randomUUID()}.tar`);
      await sandbox.mkDir(runtimeDir);
      await sandbox.writeFiles([
        {
          path: remoteArchivePath,
          content: await fs.readFile(localArchivePath),
        },
      ]);
      await this.runSandboxCommand(sandbox, {
        command: "bash",
        args: [
          "-lc",
          `mkdir -p ${shellQuote(remotePath)} && ` +
            `find ${shellQuote(remotePath)} -mindepth 1 -maxdepth 1 ! -name ${shellQuote(".paperclip-runtime")} -exec rm -rf -- {} + && ` +
            `tar -xf ${shellQuote(remoteArchivePath)} -C ${shellQuote(remotePath)} && ` +
            `rm -f ${shellQuote(remoteArchivePath)}`,
        ],
        cwd: this.remoteCwd,
        timeoutMs: readPositiveInt((input.config as Record<string, unknown>).timeoutMs) ?? 300_000,
      });
    });

    this.workspaceSyncs.set(input.providerLeaseId, {
      localPath,
      remotePath,
      runtimeDir,
      exclude,
      baseline,
    });

    return {
      remotePath,
      metadata: {
        remoteCwd: remotePath,
        workspaceSync: {
          strategy: "sandbox_archive_upload_download",
          uploaded: true,
          localPath,
          remotePath,
          runtimeDir,
        },
      },
    };
  }

  async execute(input: SandboxExecuteInput): Promise<SandboxExecuteResult> {
    assertProviderConfig(this.provider, input.config);
    if (!input.providerLeaseId) {
      throw new Error("Vercel Sandbox execution requires a provider lease id.");
    }
    const sandbox = await this.getSandbox(input.providerLeaseId);
    const commandInput = input.stdin != null
      ? buildSandboxStdinCommand(input.command, input.args ?? [], input.stdin)
      : { command: input.command, args: input.args ?? [] };
    const controller = new AbortController();
    const timeout = input.timeoutMs && input.timeoutMs > 0
      ? globalThis.setTimeout(() => controller.abort(), input.timeoutMs)
      : null;
    try {
      const result = await sandbox.runCommand({
        cmd: commandInput.command,
        args: commandInput.args,
        cwd: input.cwd ?? this.remoteCwd,
        env: input.env,
        signal: controller.signal,
      });
      return {
        exitCode: result.exitCode,
        stdout: await result.stdout(),
        stderr: await result.stderr(),
        signal: null,
        timedOut: false,
      };
    } catch (error) {
      if (controller.signal.aborted) {
        return {
          exitCode: null,
          stdout: "",
          stderr: error instanceof Error ? error.message : String(error),
          signal: "SIGTERM",
          timedOut: true,
        };
      }
      throw error;
    } finally {
      if (timeout) globalThis.clearTimeout(timeout);
    }
  }

  private runtime(config: SandboxEnvironmentConfig): string {
    return readString((config as Record<string, unknown>).runtime) ?? "node24";
  }

  private metadataFromConfig(config: SandboxEnvironmentConfig): Record<string, unknown> {
    const raw = config as Record<string, unknown>;
    return {
      provider: this.provider,
      runtime: this.runtime(config),
      reuseLease: config.reuseLease,
      timeoutMs: readPositiveInt(raw.timeoutMs),
      ports: readPorts(raw.ports) ?? null,
      vcpus: readPositiveInt(parseRecord(raw.resources)?.vcpus) ?? readPositiveInt(raw.vcpus),
    };
  }

  private createParams(config: SandboxEnvironmentConfig): Record<string, unknown> {
    const raw = config as Record<string, unknown>;
    const resources = parseRecord(raw.resources);
    return {
      runtime: this.runtime(config),
      ...(readPositiveInt(raw.timeoutMs) ? { timeout: readPositiveInt(raw.timeoutMs) } : {}),
      ...(readStringRecord(raw.env) ? { env: readStringRecord(raw.env) } : {}),
      ...(readPorts(raw.ports) ? { ports: readPorts(raw.ports) } : {}),
      ...(readPositiveInt(resources?.vcpus) || readPositiveInt(raw.vcpus)
        ? { resources: { vcpus: readPositiveInt(resources?.vcpus) ?? readPositiveInt(raw.vcpus) } }
        : {}),
      ...(raw.networkPolicy ? { networkPolicy: raw.networkPolicy } : {}),
    };
  }

  private async createSandbox(config: SandboxEnvironmentConfig): Promise<VercelSandboxInstance> {
    const { Sandbox } = await loadVercelSandboxSdk();
    return await Sandbox.create(this.createParams(config));
  }

  private async getSandbox(sandboxId: string): Promise<VercelSandboxInstance> {
    const { Sandbox } = await loadVercelSandboxSdk();
    return await Sandbox.get({ sandboxId });
  }

  private async runSandboxCommand(
    sandbox: VercelSandboxInstance,
    input: {
      command: string;
      args?: string[];
      cwd?: string;
      env?: Record<string, string>;
      timeoutMs?: number;
    },
  ): Promise<SandboxExecuteResult> {
    const controller = new AbortController();
    const timeout = input.timeoutMs && input.timeoutMs > 0
      ? globalThis.setTimeout(() => controller.abort(), input.timeoutMs)
      : null;
    try {
      const result = await sandbox.runCommand({
        cmd: input.command,
        args: input.args ?? [],
        cwd: input.cwd ?? this.remoteCwd,
        env: input.env,
        signal: controller.signal,
      });
      const output = {
        exitCode: result.exitCode,
        stdout: await result.stdout(),
        stderr: await result.stderr(),
        signal: null,
        timedOut: false,
      };
      if (output.exitCode !== 0) {
        const detail = output.stderr.trim() || output.stdout.trim();
        throw new Error(
          `Sandbox command "${input.command}" exited with code ${output.exitCode}${detail ? `: ${detail}` : ""}`,
        );
      }
      return output;
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error(
          `Sandbox command "${input.command}" timed out after ${input.timeoutMs ?? 0}ms: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      throw error;
    } finally {
      if (timeout) globalThis.clearTimeout(timeout);
    }
  }

  private async restoreWorkspace(providerLeaseId: string): Promise<void> {
    const sync = this.workspaceSyncs.get(providerLeaseId);
    if (!sync) return;

    const sandbox = await this.getSandbox(providerLeaseId);
    await withTempDir("paperclip-vercel-sandbox-restore-", async (tempDir) => {
      const remoteArchivePath = path.posix.join(sync.runtimeDir, `workspace-download-${randomUUID()}.tar`);
      await this.runSandboxCommand(sandbox, {
        command: "bash",
        args: [
          "-lc",
          `mkdir -p ${shellQuote(sync.runtimeDir)} && ` +
            `tar -cf ${shellQuote(remoteArchivePath)} -C ${shellQuote(sync.remotePath)} ${tarExcludeFlags(sync.exclude)} .`,
        ],
        cwd: this.remoteCwd,
        timeoutMs: 300_000,
      });
      const archive = await sandbox.readFileToBuffer({ path: remoteArchivePath });
      await this.runSandboxCommand(sandbox, {
        command: "bash",
        args: ["-lc", `rm -f ${shellQuote(remoteArchivePath)}`],
        cwd: this.remoteCwd,
        timeoutMs: 30_000,
      }).catch(() => undefined);
      if (!archive) return;

      const localArchivePath = path.join(tempDir, "workspace.tar");
      const extractedDir = path.join(tempDir, "workspace");
      await fs.writeFile(localArchivePath, archive);
      await extractTarballToDirectory({
        archivePath: localArchivePath,
        localDir: extractedDir,
      });
      await mergeDirectoryWithBaseline({
        baseline: sync.baseline,
        sourceDir: extractedDir,
        targetDir: sync.localPath,
      });
    });

    this.workspaceSyncs.delete(providerLeaseId);
  }
}

export const sandboxWorkspaceSyncTestHooks = {
  buildSandboxStdinCommand,
  captureDirectorySnapshot,
  mergeDirectoryWithBaseline,
};

const registeredSandboxProviders = new Map<SandboxEnvironmentProvider, SandboxProvider>([
  ["fake", new FakeSandboxProvider()],
  ["vercel", new VercelSandboxProvider()],
]);

export function getSandboxProvider(provider: string): SandboxProvider | null {
  return registeredSandboxProviders.get(provider as SandboxEnvironmentProvider) ?? null;
}

export function requireSandboxProvider(provider: string): SandboxProvider {
  const sandboxProvider = getSandboxProvider(provider);
  if (!sandboxProvider) {
    throw new Error(`Sandbox provider "${provider}" is not registered as a built-in provider.`);
  }
  return sandboxProvider;
}

export function isBuiltinSandboxProvider(provider: string): boolean {
  return registeredSandboxProviders.has(provider as SandboxEnvironmentProvider);
}

export function listSandboxProviders(): SandboxProvider[] {
  return [...registeredSandboxProviders.values()];
}

export async function validateSandboxProviderConfig(
  config: SandboxEnvironmentConfig,
): Promise<SandboxProviderValidationResult> {
  return await requireSandboxProvider(config.provider).validateConfig(config);
}

export function sandboxConfigFromLeaseMetadata(
  lease: Pick<{ metadata: Record<string, unknown> | null }, "metadata">,
): SandboxEnvironmentConfig | null {
  const metadata = lease.metadata ?? {};
  const provider = typeof metadata.provider === "string" ? getSandboxProvider(metadata.provider) : null;
  return provider?.configFromLeaseMetadata(metadata) ?? null;
}

export function sandboxConfigFromLeaseMetadataLoose(
  lease: Pick<{ metadata: Record<string, unknown> | null }, "metadata">,
): SandboxEnvironmentConfig | null {
  const metadata = lease.metadata ?? {};
  const providerKey = typeof metadata.provider === "string" ? metadata.provider : null;
  if (!providerKey) return null;

  const builtinProvider = getSandboxProvider(providerKey);
  if (builtinProvider) {
    return builtinProvider.configFromLeaseMetadata(metadata);
  }

  return {
    ...metadata,
    provider: providerKey,
    reuseLease: metadata.reuseLease === true,
  } satisfies SandboxEnvironmentConfig;
}

export function findReusableSandboxProviderLeaseId(input: {
  config: SandboxEnvironmentConfig;
  leases: Array<{ providerLeaseId: string | null; metadata: Record<string, unknown> | null }>;
}): string | null {
  const provider = getSandboxProvider(input.config.provider);
  if (!provider) {
    for (const lease of input.leases) {
      const metadata = lease.metadata ?? {};
      if (
        typeof lease.providerLeaseId === "string" &&
        lease.providerLeaseId.length > 0 &&
        metadata.provider === input.config.provider &&
        metadataMatchesPluginSandboxConfig(input.config, metadata)
      ) {
        return lease.providerLeaseId;
      }
    }
    return null;
  }
  for (const lease of input.leases) {
    if (provider.matchesReusableLease({ config: input.config, lease })) {
      return lease.providerLeaseId;
    }
  }
  return null;
}

function metadataMatchesPluginSandboxConfig(
  config: SandboxEnvironmentConfig,
  metadata: Record<string, unknown>,
): boolean {
  if (metadata.reuseLease !== true) return false;
  for (const [key, value] of Object.entries(config)) {
    if (key === "provider" || key === "reuseLease") continue;
    if (value === undefined) continue;
    if (JSON.stringify(metadata[key]) !== JSON.stringify(value)) {
      return false;
    }
  }
  return true;
}

export async function probeSandboxProvider(
  config: SandboxEnvironmentConfig,
): Promise<EnvironmentProbeResult> {
  return await requireSandboxProvider(config.provider).probe(config);
}

export async function acquireSandboxProviderLease(input: {
  config: SandboxEnvironmentConfig;
  environmentId: string;
  heartbeatRunId: string;
  issueId: string | null;
  reusableProviderLeaseId?: string | null;
}): Promise<SandboxLeaseHandle> {
  const provider = requireSandboxProvider(input.config.provider);
  if (input.config.reuseLease && input.reusableProviderLeaseId) {
    const resumedLease = await provider.resumeLease({
      config: input.config,
      providerLeaseId: input.reusableProviderLeaseId,
    });
    if (resumedLease) {
      return resumedLease;
    }
  }

  return await provider.acquireLease({
    config: input.config,
    environmentId: input.environmentId,
    heartbeatRunId: input.heartbeatRunId,
    issueId: input.issueId,
  });
}

export async function resumeSandboxProviderLease(input: {
  config: SandboxEnvironmentConfig;
  providerLeaseId: string;
}): Promise<SandboxLeaseHandle | null> {
  return await requireSandboxProvider(input.config.provider).resumeLease(input);
}

export async function releaseSandboxProviderLease(input: {
  config: SandboxEnvironmentConfig;
  providerLeaseId: string | null;
  status: Extract<EnvironmentLeaseStatus, "released" | "expired" | "failed">;
}): Promise<void> {
  await requireSandboxProvider(input.config.provider).releaseLease(input);
}

export async function destroySandboxProviderLease(input: {
  config: SandboxEnvironmentConfig;
  providerLeaseId: string | null;
}): Promise<void> {
  await requireSandboxProvider(input.config.provider).destroyLease(input);
}

export async function prepareSandboxProviderWorkspace(
  input: PrepareSandboxWorkspaceInput,
): Promise<PreparedSandboxWorkspace> {
  return await requireSandboxProvider(input.config.provider).prepareWorkspace?.(input) ?? {};
}

export async function executeSandboxProviderCommand(
  input: SandboxExecuteInput,
): Promise<SandboxExecuteResult> {
  const provider = requireSandboxProvider(input.config.provider);
  if (!provider.execute) {
    throw new Error(`Sandbox provider "${input.config.provider}" does not support direct command execution.`);
  }
  return await provider.execute(input);
}
