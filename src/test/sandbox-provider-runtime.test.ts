import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  acquireSandboxProviderLease,
  findReusableSandboxProviderLeaseId,
  getSandboxProvider,
  listSandboxProviders,
  releaseSandboxProviderLease,
  sandboxConfigFromLeaseMetadata,
  sandboxConfigFromLeaseMetadataLoose,
  sandboxWorkspaceSyncTestHooks,
  validateSandboxProviderConfig,
} from "../../server/src/services/sandbox-provider-runtime";

async function withTempDir<T>(prefix: string, fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

describe("sandbox provider runtime", () => {
  it("exposes fake and Vercel as built-in sandbox providers", async () => {
    expect(listSandboxProviders().map((provider) => provider.provider).sort()).toEqual(["fake", "vercel"]);
    expect(getSandboxProvider("fake")?.provider).toBe("fake");
    expect(getSandboxProvider("vercel")?.provider).toBe("vercel");
    expect(getSandboxProvider("plugin-owned")).toBeNull();

    await expect(
      validateSandboxProviderConfig({
        provider: "vercel",
        runtime: "node24",
        reuseLease: true,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        ok: true,
        details: expect.objectContaining({
          provider: "vercel",
          runtime: "node24",
          reuseLease: true,
        }),
      }),
    );
  });

  it("acquires and resumes fake leases deterministically", async () => {
    const lease = await acquireSandboxProviderLease({
      config: {
        provider: "fake",
        image: "ubuntu:24.04",
        reuseLease: true,
      },
      environmentId: "env-1",
      heartbeatRunId: "run-1",
      issueId: "issue-1",
    });

    expect(lease.providerLeaseId).toBe("sandbox://fake/env-1");
    expect(lease.metadata).toEqual(expect.objectContaining({
      provider: "fake",
      image: "ubuntu:24.04",
      reuseLease: true,
    }));

    const resumed = await acquireSandboxProviderLease({
      config: {
        provider: "fake",
        image: "ubuntu:24.04",
        reuseLease: true,
      },
      environmentId: "env-1",
      heartbeatRunId: "run-2",
      issueId: "issue-1",
      reusableProviderLeaseId: lease.providerLeaseId,
    });

    expect(resumed.providerLeaseId).toBe(lease.providerLeaseId);
    expect(resumed.metadata).toEqual(expect.objectContaining({ resumedLease: true }));
  });

  it("matches reusable leases through provider-specific metadata", () => {
    expect(
      findReusableSandboxProviderLeaseId({
        config: {
          provider: "vercel",
          runtime: "node24",
          reuseLease: true,
        },
        leases: [
          {
            providerLeaseId: "sandbox-node22",
            metadata: {
              provider: "vercel",
              runtime: "node22",
              reuseLease: true,
            },
          },
          {
            providerLeaseId: "sandbox-node24",
            metadata: {
              provider: "vercel",
              runtime: "node24",
              reuseLease: true,
            },
          },
        ],
      }),
    ).toBe("sandbox-node24");
  });

  it("reconstructs built-in and plugin-backed configs from lease metadata", () => {
    expect(sandboxConfigFromLeaseMetadata({
      metadata: {
        provider: "vercel",
        runtime: "node24",
        timeoutMs: 300_000,
        reuseLease: true,
      },
    })).toEqual({
      provider: "vercel",
      runtime: "node24",
      timeoutMs: 300_000,
      reuseLease: true,
    });

    expect(sandboxConfigFromLeaseMetadataLoose({
      metadata: {
        provider: "plugin-sandbox",
        template: "paperclip-dev",
        timeoutMs: 120_000,
        reuseLease: true,
      },
    })).toEqual({
      provider: "plugin-sandbox",
      template: "paperclip-dev",
      timeoutMs: 120_000,
      reuseLease: true,
    });
  });

  it("releases fake leases without external side effects", async () => {
    await expect(releaseSandboxProviderLease({
      config: {
        provider: "fake",
        image: "ubuntu:24.04",
        reuseLease: true,
      },
      providerLeaseId: "sandbox://fake/env-1",
      status: "released",
    })).resolves.toBeUndefined();
  });
});

describe("sandbox workspace restore merge", () => {
  it("wraps stdin for sandbox commands without relying on SDK stdin support", () => {
    const wrapped = sandboxWorkspaceSyncTestHooks.buildSandboxStdinCommand(
      "node",
      ["script.js", "--flag"],
      "hello from stdin\n",
    );

    expect(wrapped.command).toBe("bash");
    expect(wrapped.args[0]).toBe("-lc");
    expect(wrapped.args[1]).toContain("set -o pipefail");
    expect(wrapped.args[1]).toContain("base64 -d <<'");
    expect(wrapped.args[1]).toContain("| 'node' 'script.js' '--flag'");
    expect(wrapped.args[1]).toContain(Buffer.from("hello from stdin\n", "utf8").toString("base64"));
  });

  it("applies sandbox changes while preserving local edits made after upload", async () => {
    await withTempDir("paperclip-sandbox-merge-", async (root) => {
      const localDir = path.join(root, "local");
      const sandboxDir = path.join(root, "sandbox");
      await fs.mkdir(path.join(localDir, "nested"), { recursive: true });
      await fs.mkdir(path.join(localDir, ".paperclip-runtime"), { recursive: true });

      await fs.writeFile(path.join(localDir, "same.txt"), "same\n", "utf8");
      await fs.writeFile(path.join(localDir, "changed.txt"), "before\n", "utf8");
      await fs.writeFile(path.join(localDir, "deleted.txt"), "delete me\n", "utf8");
      await fs.writeFile(path.join(localDir, "locally-edited.txt"), "baseline\n", "utf8");
      await fs.writeFile(path.join(localDir, "nested", "changed.txt"), "nested before\n", "utf8");
      await fs.writeFile(path.join(localDir, ".paperclip-runtime", "cache.txt"), "local cache\n", "utf8");

      const baseline = await sandboxWorkspaceSyncTestHooks.captureDirectorySnapshot(localDir, {
        exclude: [".paperclip-runtime"],
      });

      await fs.writeFile(path.join(localDir, "locally-edited.txt"), "local edit\n", "utf8");

      await fs.mkdir(path.join(sandboxDir, "nested"), { recursive: true });
      await fs.writeFile(path.join(sandboxDir, "same.txt"), "same\n", "utf8");
      await fs.writeFile(path.join(sandboxDir, "changed.txt"), "after\n", "utf8");
      await fs.writeFile(path.join(sandboxDir, "new.txt"), "new from sandbox\n", "utf8");
      await fs.writeFile(path.join(sandboxDir, "nested", "changed.txt"), "nested after\n", "utf8");

      await sandboxWorkspaceSyncTestHooks.mergeDirectoryWithBaseline({
        baseline,
        sourceDir: sandboxDir,
        targetDir: localDir,
      });

      await expect(fs.readFile(path.join(localDir, "same.txt"), "utf8")).resolves.toBe("same\n");
      await expect(fs.readFile(path.join(localDir, "changed.txt"), "utf8")).resolves.toBe("after\n");
      await expect(fs.readFile(path.join(localDir, "new.txt"), "utf8")).resolves.toBe("new from sandbox\n");
      await expect(fs.readFile(path.join(localDir, "nested", "changed.txt"), "utf8")).resolves.toBe("nested after\n");
      await expect(fs.readFile(path.join(localDir, "locally-edited.txt"), "utf8")).resolves.toBe("local edit\n");
      await expect(fs.readFile(path.join(localDir, ".paperclip-runtime", "cache.txt"), "utf8")).resolves.toBe("local cache\n");
      await expect(fs.access(path.join(localDir, "deleted.txt"))).rejects.toMatchObject({ code: "ENOENT" });
    });
  });
});
